// Paraphrase Extension - Content Script
// Handles UI and paraphrasing logic on web pages

(function() {
  'use strict';

  const PARAPHRASE_STYLES = [
    { id: 'formal', title: 'Formal / Profissional', emoji: '👔', shortcut: '1', needsShift: false, prompt: 'Reescreva este texto EM ALEMÃO em um tom formal e profissional, usando "Sie" e vocabulário sofisticado. Mantenha o significado original. O resultado DEVE ser em alemão.' },
    { id: 'informal', title: 'Informal / Casual', emoji: '😊', shortcut: '2', needsShift: true, prompt: 'Reescreva este texto EM ALEMÃO em um tom informal e casual, usando "du" como se estivesse conversando com um amigo. O resultado DEVE ser em alemão.' },
    { id: 'concise', title: 'Conciso / Resumido', emoji: '📝', shortcut: '3', needsShift: true, prompt: 'Reescreva este texto EM ALEMÃO de forma mais concisa e direta, removendo palavras desnecessárias. O resultado DEVE ser em alemão.' },
    { id: 'detailed', title: 'Detalhado / Expandido', emoji: '📖', shortcut: '4', needsShift: false, prompt: 'Expanda este texto EM ALEMÃO com mais detalhes e explicações, tornando-o mais completo. O resultado DEVE ser em alemão.' },
    { id: 'creative', title: 'Criativo / Original', emoji: '🎨', shortcut: '5', needsShift: false, prompt: 'Reescreva este texto EM ALEMÃO de forma criativa e original, usando metáforas ou linguagem mais expressiva. O resultado DEVE ser em alemão.' },
    { id: 'simple', title: 'Simples / Fácil de entender', emoji: '💡', shortcut: '6', needsShift: false, prompt: 'Simplifique este texto EM ALEMÃO para que seja fácil de entender (nível A2-B1). O resultado DEVE ser em alemão.' },
    { id: 'academic', title: 'Acadêmico / Científico', emoji: '🎓', shortcut: '7', needsShift: true, prompt: 'Reescreva este texto EM ALEMÃO em um tom acadêmico e científico, com linguagem técnica apropriada. O resultado DEVE ser em alemão.' },
    { id: 'friendly', title: 'Amigável / Empático', emoji: '🤗', shortcut: '8', needsShift: true, prompt: 'Reescreva este texto EM ALEMÃO em um tom amigável e empático, demonstrando compreensão e cordialidade. O resultado DEVE ser em alemão.' }
  ];

  // Helper to get display label for a style's shortcut
  function shortcutLabel(style) {
    return style.needsShift ? `Ctrl+Alt+Shift+${style.shortcut}` : `Ctrl+Alt+${style.shortcut}`;
  }

  let currentPopup = null;
  let selectedText = '';
  let savedRange = null;
  let savedActiveElement = null;
  let savedSelectionStart = null;
  let savedSelectionEnd = null;
  // Extra context for Teams/rich editor compatibility
  let savedEditableElement = null;
  let savedSelectedText = '';
  let savedTextOffset = -1;

  // Debug mode - logs replacement strategy attempts to console
  const DEBUG = true;
  function dbg(...args) {
    if (DEBUG) console.log('[Paraphrase]', ...args);
  }

  // Detect if we're inside Microsoft Teams
  function isTeamsPage() {
    return location.hostname.includes('teams.microsoft') ||
           location.hostname.includes('teams.live') ||
           document.querySelector('[data-tid]') !== null ||
           document.querySelector('.ts-message-list-container') !== null;
  }

  // Find the Teams compose box (or any contentEditable) robustly
  function findTeamsComposeBox() {
    // Teams-specific selectors (various versions)
    const selectors = [
      '[data-tid="ckeditor"] [contenteditable="true"]',
      'div[role="textbox"][contenteditable="true"]',
      'div.ck-editor__editable[contenteditable="true"]',
      'div[data-tid="newMessageCommands"] [contenteditable="true"]',
      'div.cke_wysiwyg_div[contenteditable="true"]',
      '[contenteditable="true"][aria-label]',
      '[contenteditable="true"]'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  // Robust focus restoration - click + focus + wait
  async function restoreFocus(element) {
    if (!element) return false;
    try {
      // Dispatch mousedown/up to simulate real click (triggers Teams focus handlers)
      element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      element.focus();
      // Small delay for React/Teams state to settle
      await new Promise(r => setTimeout(r, 100));
      return document.activeElement === element || element.contains(document.activeElement);
    } catch(e) {
      dbg('restoreFocus error:', e);
      return false;
    }
  }

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'paraphrase') {
      selectedText = request.text;
      showParaphrasePopup(request.text, request.style);
    }
  });

  // Helper: get character offset of a node position within a root element
  function getTextOffset(rootElement, targetNode, targetOffset) {
    const walker = document.createTreeWalker(rootElement, NodeFilter.SHOW_TEXT);
    let offset = 0;
    while (walker.nextNode()) {
      if (walker.currentNode === targetNode) {
        return offset + targetOffset;
      }
      offset += walker.currentNode.textContent.length;
    }
    return -1;
  }

  // Helper: find text in element and create a Range
  function findTextRange(element, searchText, approximateOffset) {
    if (!element || !searchText) return null;
    const fullText = element.textContent;

    // Try near the approximate offset first
    let idx = -1;
    if (approximateOffset >= 0) {
      idx = fullText.indexOf(searchText, Math.max(0, approximateOffset - 10));
    }
    if (idx === -1) {
      idx = fullText.indexOf(searchText);
    }
    if (idx === -1) return null;

    // Convert text index to Range using TreeWalker
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let charCount = 0;
    let startNode = null, startOff = 0;
    let endNode = null, endOff = 0;
    const endIdx = idx + searchText.length;

    while (walker.nextNode()) {
      const node = walker.currentNode;
      const nodeLen = node.textContent.length;

      if (!startNode && charCount + nodeLen > idx) {
        startNode = node;
        startOff = idx - charCount;
      }
      if (!endNode && charCount + nodeLen >= endIdx) {
        endNode = node;
        endOff = endIdx - charCount;
        break;
      }
      charCount += nodeLen;
    }

    if (startNode && endNode) {
      try {
        const range = document.createRange();
        range.setStart(startNode, startOff);
        range.setEnd(endNode, endOff);
        return range;
      } catch(e) {
        return null;
      }
    }
    return null;
  }

  // Get a valid range, trying saved range first then text search
  function getValidRange(editableEl, origText, textOffset) {
    // Strategy 1: Use saved/passed range
    if (savedRange) {
      try {
        const parent = savedRange.commonAncestorContainer;
        if (parent && document.contains(parent)) {
          // Verify the range still contains expected text
          const currentText = savedRange.toString();
          if (currentText === origText) {
            return savedRange;
          }
        }
      } catch(e) {}
    }

    // Strategy 2: Find text in the editable element
    if (editableEl && origText) {
      const found = findTextRange(editableEl, origText, textOffset);
      if (found) return found;
    }

    return null;
  }

  // Find the contentEditable element from a range
  function findEditableFromRange(range) {
    if (!range) return null;
    try {
      const container = range.commonAncestorContainer;
      const el = container.nodeType === 3 ? container.parentElement : container;
      return el?.closest?.('[contenteditable="true"]') ||
             (el?.isContentEditable ? el : null);
    } catch(e) {
      return null;
    }
  }

  // Create and show the paraphrase popup
  function showParaphrasePopup(text, preSelectedStyle = null) {
    removeExistingPopup();

    // Save the current selection/range BEFORE creating the popup
    const selection = window.getSelection();
    const activeElement = document.activeElement;

    if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
      savedActiveElement = activeElement;
      savedSelectionStart = activeElement.selectionStart;
      savedSelectionEnd = activeElement.selectionEnd;
      savedRange = null;
      savedEditableElement = null;
      savedSelectedText = text;
      savedTextOffset = -1;
    } else if (selection.rangeCount > 0) {
      savedRange = selection.getRangeAt(0).cloneRange();
      savedActiveElement = activeElement;
      savedSelectionStart = null;
      savedSelectionEnd = null;
      savedSelectedText = text;

      // Save contentEditable element and text offset for reconstruction
      savedEditableElement = findEditableFromRange(savedRange);
      if (savedEditableElement) {
        savedTextOffset = getTextOffset(savedEditableElement, savedRange.startContainer, savedRange.startOffset);
      } else {
        savedTextOffset = -1;
      }
    }

    const popup = document.createElement('div');
    popup.id = 'paraphrase-popup';
    popup.className = 'paraphrase-popup';

    popup.innerHTML = `
      <div class="paraphrase-header">
        <h3>✨ Parafraseador de Texto</h3>
        <button class="paraphrase-close" title="Fechar">&times;</button>
      </div>

      <div class="paraphrase-content">
        <div class="paraphrase-section">
          <label>Texto Original:</label>
          <div class="paraphrase-original">${escapeHtml(text)}</div>
        </div>

        <div class="paraphrase-section">
          <label>Escolha o estilo:</label>
          <div class="paraphrase-styles">
            ${PARAPHRASE_STYLES.map(style => `
              <button class="style-btn ${preSelectedStyle === style.id ? 'selected' : ''}"
                      data-style="${style.id}"
                      title="${style.title} (${shortcutLabel(style)})">
                ${style.emoji} ${style.title.split(' / ')[0]}
                <span class="style-shortcut">${shortcutLabel(style)}</span>
              </button>
            `).join('')}
          </div>
          <div class="shortcuts-hint">
            Dica: Selecione texto e use os atalhos acima para parafrasear direto, sem abrir o popup.
          </div>
        </div>

        <div class="paraphrase-section result-section" style="display: none;">
          <label>Resultado:</label>
          <div class="paraphrase-result"></div>
          <div class="result-actions">
            <button class="action-btn copy-btn">📋 Copiar</button>
            <button class="action-btn replace-btn">✅ Substituir</button>
            <button class="action-btn retry-btn">🔄 Tentar novamente</button>
          </div>
        </div>

        <div class="paraphrase-loading" style="display: none;">
          <div class="loading-spinner"></div>
          <span>Parafraseando...</span>
        </div>

        <div class="paraphrase-error" style="display: none;"></div>

        <div class="paraphrase-section config-section">
          <details>
            <summary>⚙️ Configurações da API</summary>
            <div class="config-content">
              <label>
                API Key (OpenAI ou compatível):
                <input type="password" class="api-key-input" placeholder="sk-...">
              </label>
              <label>
                URL da API (opcional):
                <input type="text" class="api-url-input" placeholder="https://api.openai.com/v1/chat/completions">
              </label>
              <button class="save-config-btn">💾 Salvar Configurações</button>
              <p class="config-note">A API key é salva localmente no seu navegador.</p>
            </div>
          </details>
        </div>
      </div>
    `;

    document.body.appendChild(popup);
    currentPopup = popup;

    // Load saved configuration
    loadConfig(popup);

    // Position popup - FIXED positioning, prefer top of screen
    positionPopup(popup);

    // Add event listeners
    setupEventListeners(popup, text);

    // If style was pre-selected, trigger paraphrase
    if (preSelectedStyle) {
      const styleBtn = popup.querySelector(`[data-style="${preSelectedStyle}"]`);
      if (styleBtn) {
        styleBtn.click();
      }
    }
  }

  function setupEventListeners(popup, originalText) {
    // Close button
    popup.querySelector('.paraphrase-close').addEventListener('click', removeExistingPopup);

    // Style buttons
    popup.querySelectorAll('.style-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        // Update selected state
        popup.querySelectorAll('.style-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');

        const style = btn.dataset.style;
        await performParaphrase(popup, originalText, style);
      });
    });

    // Copy button
    popup.querySelector('.copy-btn').addEventListener('click', async () => {
      const result = popup.querySelector('.paraphrase-result').textContent;
      await copyToClipboard(result);
      showToast('Texto copiado! Use Ctrl+V para colar.');
    });

    // Replace button - remove popup first, then replace with delay for Teams focus restoration
    popup.querySelector('.replace-btn').addEventListener('click', () => {
      const result = popup.querySelector('.paraphrase-result').textContent;
      // Remove popup FIRST so it doesn't interfere with focus/selection
      removeExistingPopup();
      // Longer delay for corporate/Teams environments (500ms)
      const delay = isTeamsPage() ? 500 : 300;
      dbg('Replace clicked. Waiting', delay, 'ms before replacement...');
      setTimeout(async () => {
        const success = await replaceSelectedText(result);
        if (success) {
          showToast('Texto substituído!');
        }
      }, delay);
    });

    // Retry button
    popup.querySelector('.retry-btn').addEventListener('click', () => {
      const selectedStyle = popup.querySelector('.style-btn.selected');
      if (selectedStyle) {
        performParaphrase(popup, originalText, selectedStyle.dataset.style);
      }
    });

    // Save config button
    popup.querySelector('.save-config-btn').addEventListener('click', () => {
      saveConfig(popup);
    });

    // Close on Escape
    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape') {
        removeExistingPopup();
        document.removeEventListener('keydown', escHandler);
      }
    });

    // Close on click outside
    setTimeout(() => {
      document.addEventListener('click', function clickOutside(e) {
        if (currentPopup && !currentPopup.contains(e.target)) {
          removeExistingPopup();
          document.removeEventListener('click', clickOutside);
        }
      });
    }, 100);
  }

  async function performParaphrase(popup, text, styleId) {
    const style = PARAPHRASE_STYLES.find(s => s.id === styleId);
    if (!style) return;

    const loading = popup.querySelector('.paraphrase-loading');
    const resultSection = popup.querySelector('.result-section');
    const resultDiv = popup.querySelector('.paraphrase-result');
    const errorDiv = popup.querySelector('.paraphrase-error');

    // Show loading
    loading.style.display = 'flex';
    resultSection.style.display = 'none';
    errorDiv.style.display = 'none';

    try {
      const result = await callParaphraseAPI(text, style.prompt);

      // Show result
      loading.style.display = 'none';
      resultSection.style.display = 'block';
      resultDiv.textContent = result;
    } catch (error) {
      loading.style.display = 'none';
      errorDiv.style.display = 'block';
      errorDiv.textContent = `Erro: ${error.message}`;
    }
  }

  async function callParaphraseAPI(text, stylePrompt) {
    // Get saved configuration
    const config = await getConfig();

    if (!config.apiKey) {
      throw new Error('Configure sua API Key nas configurações abaixo.');
    }

    const apiUrl = config.apiUrl || 'https://api.openai.com/v1/chat/completions';

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `Você é um assistente especializado em parafrasear textos em ALEMÃO. ${stylePrompt} IMPORTANTE: O texto de saída DEVE estar em alemão correto. Responda APENAS com o texto parafraseado em alemão, sem explicações adicionais.`
          },
          {
            role: 'user',
            content: `Parafraseie o seguinte texto em alemão:\n\n${text}`
          }
        ],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Erro na API: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  }

  function getConfig() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['paraphraseConfig'], (result) => {
        resolve(result.paraphraseConfig || {});
      });
    });
  }

  function loadConfig(popup) {
    chrome.storage.local.get(['paraphraseConfig'], (result) => {
      const config = result.paraphraseConfig || {};
      if (config.apiKey) {
        popup.querySelector('.api-key-input').value = config.apiKey;
      }
      if (config.apiUrl) {
        popup.querySelector('.api-url-input').value = config.apiUrl;
      }
    });
  }

  function saveConfig(popup) {
    const apiKey = popup.querySelector('.api-key-input').value.trim();
    const apiUrl = popup.querySelector('.api-url-input').value.trim();

    chrome.storage.local.set({
      paraphraseConfig: {
        apiKey: apiKey,
        apiUrl: apiUrl || 'https://api.openai.com/v1/chat/completions',
        model: 'gpt-3.5-turbo'
      }
    }, () => {
      showToast('Configurações salvas!');
    });
  }

  function positionPopup(popup) {
    // Use FIXED positioning for reliability (especially in Teams)
    popup.style.position = 'fixed';

    const popupWidth = 450;

    // Get selection rect (viewport-relative since we use fixed positioning)
    const selection = window.getSelection();
    let selRect = null;
    if (selection.rangeCount > 0) {
      selRect = selection.getRangeAt(0).getBoundingClientRect();
    }

    // Horizontal: near selection or centered
    let left;
    if (selRect && selRect.left > 0) {
      left = selRect.left;
      if (left + popupWidth > window.innerWidth - 20) {
        left = window.innerWidth - popupWidth - 20;
      }
    } else {
      left = Math.max(10, (window.innerWidth - popupWidth) / 2);
    }
    if (left < 10) left = 10;

    // Vertical: ALWAYS place near the top of viewport
    // This ensures buttons are always visible even with long content
    let top = 20;

    // If selection is near the top, push popup down a bit to not cover it
    if (selRect && selRect.top < 200 && selRect.bottom < 300) {
      top = selRect.bottom + 10;
    }

    popup.style.top = `${top}px`;
    popup.style.left = `${left}px`;
  }

  function removeExistingPopup() {
    if (currentPopup) {
      currentPopup.remove();
      currentPopup = null;
    }
  }

  // Replace text in contentEditable with multiple strategies for Teams/corporate compatibility
  async function replaceInContentEditable(editableElement, newText, origText, textOffset, range) {
    const strategies = [];

    try {
      // Step 1: Robust focus restoration
      dbg('Step 1: Restoring focus to editable element');
      await restoreFocus(editableElement);

      // Step 2: Get a valid range
      const validRange = range || getValidRange(editableElement, origText, textOffset);
      if (!validRange) {
        dbg('ERROR: No valid range found. Trying text search fallback...');
        // Last-ditch: search for original text in the element
        const fallbackRange = origText ? findTextRange(editableElement, origText, 0) : null;
        if (!fallbackRange) {
          dbg('ERROR: Cannot find original text in element. Copying to clipboard.');
          await copyToClipboard(newText);
          showToast('Texto não encontrado. Copiado para a área de transferência! Use Ctrl+V para colar.');
          return false;
        }
        dbg('Found text via fallback search');
        return await tryReplacementStrategies(editableElement, newText, origText, textOffset, fallbackRange, strategies);
      }

      return await tryReplacementStrategies(editableElement, newText, origText, textOffset, validRange, strategies);
    } catch(e) {
      dbg('CRITICAL ERROR in replaceInContentEditable:', e);
      await copyToClipboard(newText);
      showToast('Erro na substituição. Copiado! Use Ctrl+V para colar.');
      return false;
    }
  }

  // Safe clipboard write with fallback
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch(e) {
      dbg('clipboard.writeText failed:', e);
      // Fallback: use a temporary textarea
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        return true;
      } catch(e2) {
        dbg('textarea copy fallback also failed:', e2);
        return false;
      }
    }
  }

  // Try all replacement strategies in sequence
  async function tryReplacementStrategies(editableElement, newText, origText, textOffset, validRange, strategies) {
    const selection = window.getSelection();

    // Helper to restore selection with a given range
    function selectRange(r) {
      selection.removeAllRanges();
      selection.addRange(r);
    }

    // Helper to get a fresh range (in case DOM changed)
    function freshRange() {
      return getValidRange(editableElement, origText, textOffset) || validRange;
    }

    // Strategy A: execCommand('insertText') - best for most editors
    try {
      selectRange(validRange);
      const success = document.execCommand('insertText', false, newText);
      strategies.push('A:execCommand-insertText=' + success);
      dbg('Strategy A (execCommand insertText):', success);
      if (success) {
        editableElement.dispatchEvent(new InputEvent('input', {
          bubbles: true, cancelable: true, inputType: 'insertText', data: newText
        }));
        return true;
      }
    } catch(e) {
      strategies.push('A:execCommand-error');
      dbg('Strategy A failed:', e);
    }

    // Strategy B: Delete + insertText (two-step)
    try {
      const rangeB = freshRange();
      if (rangeB) {
        selectRange(rangeB);
        document.execCommand('delete', false, null);
        const success = document.execCommand('insertText', false, newText);
        strategies.push('B:delete+insertText=' + success);
        dbg('Strategy B (delete+insertText):', success);
        if (success) {
          editableElement.dispatchEvent(new InputEvent('input', {
            bubbles: true, cancelable: true, inputType: 'insertText', data: newText
          }));
          return true;
        }
      }
    } catch(e) {
      strategies.push('B:delete+insertText-error');
      dbg('Strategy B failed:', e);
    }

    // Strategy C: DOM manipulation with beforeinput/input events
    try {
      const rangeC = freshRange();
      if (rangeC) {
        selectRange(rangeC);

        editableElement.dispatchEvent(new InputEvent('beforeinput', {
          bubbles: true, cancelable: true, inputType: 'insertReplacementText', data: newText
        }));

        rangeC.deleteContents();
        const textNode = document.createTextNode(newText);
        rangeC.insertNode(textNode);
        editableElement.normalize();

        const newRange = document.createRange();
        newRange.setStartAfter(textNode);
        newRange.collapse(true);
        selectRange(newRange);

        editableElement.dispatchEvent(new InputEvent('input', {
          bubbles: true, cancelable: true, inputType: 'insertReplacementText', data: newText
        }));

        strategies.push('C:DOM-manipulation=true');
        dbg('Strategy C (DOM manipulation): success');
        return true;
      }
    } catch(e) {
      strategies.push('C:DOM-manipulation-error');
      dbg('Strategy C failed:', e);
    }

    // Strategy D: ClipboardEvent paste simulation
    try {
      const rangeD = freshRange();
      if (rangeD) {
        selectRange(rangeD);
        document.execCommand('delete', false, null);

        const dt = new DataTransfer();
        dt.setData('text/plain', newText);
        const pasteEvent = new ClipboardEvent('paste', {
          bubbles: true, cancelable: true, clipboardData: dt
        });
        const dispatched = editableElement.dispatchEvent(pasteEvent);
        strategies.push('D:paste-event=' + dispatched);
        dbg('Strategy D (paste event):', dispatched);
        if (dispatched) {
          // Check if text was actually inserted
          await new Promise(r => setTimeout(r, 100));
          if (editableElement.textContent.includes(newText)) {
            return true;
          }
          dbg('Strategy D: paste event dispatched but text not found in element');
        }
      }
    } catch(e) {
      strategies.push('D:paste-event-error');
      dbg('Strategy D failed:', e);
    }

    // Strategy E: Clipboard write + execCommand('paste')
    // This triggers the browser's native paste handler which Teams respects
    try {
      dbg('Strategy E: Trying clipboard write + execCommand paste');
      const rangeE = freshRange();
      if (rangeE) {
        selectRange(rangeE);

        // Write to clipboard first
        await copyToClipboard(newText);
        await new Promise(r => setTimeout(r, 50));

        // Try native paste command
        const success = document.execCommand('paste');
        strategies.push('E:clipboard-paste=' + success);
        dbg('Strategy E (clipboard+paste):', success);
        if (success) {
          return true;
        }
      }
    } catch(e) {
      strategies.push('E:clipboard-paste-error');
      dbg('Strategy E failed:', e);
    }

    // Strategy F: InputEvent with dataTransfer (modern editors like CKEditor/ProseMirror)
    try {
      const rangeF = freshRange();
      if (rangeF) {
        selectRange(rangeF);

        const dt = new DataTransfer();
        dt.setData('text/plain', newText);

        // beforeinput with dataTransfer
        const beforeInput = new InputEvent('beforeinput', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertFromPaste',
          data: null,
          dataTransfer: dt
        });
        editableElement.dispatchEvent(beforeInput);

        // If beforeinput was not canceled, do DOM insertion
        const rangeF2 = freshRange();
        if (rangeF2) {
          rangeF2.deleteContents();
          rangeF2.insertNode(document.createTextNode(newText));
          editableElement.normalize();
        }

        // input event
        const inputEvt = new InputEvent('input', {
          bubbles: true,
          cancelable: false,
          inputType: 'insertFromPaste',
          data: null,
          dataTransfer: dt
        });
        editableElement.dispatchEvent(inputEvt);

        strategies.push('F:dataTransfer-input=true');
        dbg('Strategy F (dataTransfer input): dispatched');

        // Verify
        await new Promise(r => setTimeout(r, 100));
        if (editableElement.textContent.includes(newText)) {
          return true;
        }
      }
    } catch(e) {
      strategies.push('F:dataTransfer-input-error');
      dbg('Strategy F failed:', e);
    }

    // Strategy G: Keyboard event simulation (type each character)
    // Last resort - simulates actual keyboard typing
    try {
      const rangeG = freshRange();
      if (rangeG) {
        selectRange(rangeG);
        document.execCommand('delete', false, null);

        dbg('Strategy G: Simulating keyboard input for', newText.length, 'chars');
        for (const char of newText) {
          editableElement.dispatchEvent(new KeyboardEvent('keydown', {
            key: char, code: 'Key' + char.toUpperCase(), bubbles: true
          }));
          editableElement.dispatchEvent(new InputEvent('beforeinput', {
            bubbles: true, cancelable: true, inputType: 'insertText', data: char
          }));

          // Insert the character via text node
          const sel = window.getSelection();
          if (sel.rangeCount > 0) {
            const r = sel.getRangeAt(0);
            r.deleteContents();
            const tn = document.createTextNode(char);
            r.insertNode(tn);
            r.setStartAfter(tn);
            r.collapse(true);
            sel.removeAllRanges();
            sel.addRange(r);
          }

          editableElement.dispatchEvent(new InputEvent('input', {
            bubbles: true, cancelable: false, inputType: 'insertText', data: char
          }));
          editableElement.dispatchEvent(new KeyboardEvent('keyup', {
            key: char, code: 'Key' + char.toUpperCase(), bubbles: true
          }));
        }

        editableElement.normalize();
        strategies.push('G:keyboard-sim=true');
        dbg('Strategy G (keyboard simulation): completed');
        return true;
      }
    } catch(e) {
      strategies.push('G:keyboard-sim-error');
      dbg('Strategy G failed:', e);
    }

    // All strategies failed
    dbg('ALL STRATEGIES FAILED:', strategies.join(', '));
    await copyToClipboard(newText);
    showToast('Substituição bloqueada. Texto copiado! Use Ctrl+V para colar.');
    return false;
  }

  async function replaceSelectedText(newText) {
    dbg('replaceSelectedText called. savedActiveElement:', savedActiveElement?.tagName,
        'savedEditableElement:', !!savedEditableElement, 'savedRange:', !!savedRange,
        'isTeams:', isTeamsPage());

    // INPUT/TEXTAREA elements
    if (savedActiveElement && (savedActiveElement.tagName === 'INPUT' || savedActiveElement.tagName === 'TEXTAREA') && savedSelectionStart !== null) {
      try {
        savedActiveElement.focus();
        savedActiveElement.setSelectionRange(savedSelectionStart, savedSelectionEnd);

        // Try execCommand first (works with React controlled inputs)
        let success = document.execCommand('insertText', false, newText);
        dbg('INPUT/TEXTAREA execCommand insertText:', success);
        if (!success) {
          // Fallback: direct value manipulation
          const text = savedActiveElement.value;
          savedActiveElement.value = text.substring(0, savedSelectionStart) + newText + text.substring(savedSelectionEnd);
          savedActiveElement.setSelectionRange(savedSelectionStart, savedSelectionStart + newText.length);
          savedActiveElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
          savedActiveElement.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));

          // Also dispatch React-compatible native input event
          const nativeInputEvent = new Event('input', { bubbles: true });
          Object.defineProperty(nativeInputEvent, 'simulated', { value: true });
          savedActiveElement.dispatchEvent(nativeInputEvent);
          dbg('INPUT/TEXTAREA direct value set: done');
        }

        return true;
      } catch (e) {
        dbg('ERROR replacing in input/textarea:', e);
        await copyToClipboard(newText);
        showToast('Copiado! Use Ctrl+V para colar.');
        return false;
      }
    }

    // ContentEditable elements
    let editableEl = savedEditableElement || findEditableFromRange(savedRange);

    // Teams fallback: if no editable element found, try to find the compose box
    if (!editableEl && isTeamsPage()) {
      dbg('Teams detected, searching for compose box...');
      editableEl = findTeamsComposeBox();
      if (editableEl) {
        dbg('Found Teams compose box via selector');
      }
    }

    if (editableEl) {
      return await replaceInContentEditable(editableEl, newText, savedSelectedText, savedTextOffset, savedRange);
    }

    // Non-editable or no saved selection - copy to clipboard
    dbg('No editable element found. Copying to clipboard.');
    await copyToClipboard(newText);
    showToast('Copiado para a área de transferência! Use Ctrl+V para colar.');
    return false;
  }

  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'paraphrase-toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('show');
    }, 10);

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Silent paraphrase function - does everything in background and replaces text
  async function silentParaphrase(styleId) {
    const style = PARAPHRASE_STYLES.find(s => s.id === styleId);
    if (!style) return;

    // Get selected text
    const selection = window.getSelection();
    const activeElement = document.activeElement;
    const text = selection.toString().trim();

    if (!text) {
      showToast('Selecione um texto primeiro!');
      return;
    }

    dbg('silentParaphrase:', style.id, 'text:', text.substring(0, 50) + '...');

    // Save current selection context BEFORE any async operation
    let localRange = null;
    let localActiveElement = null;
    let localSelectionStart = null;
    let localSelectionEnd = null;
    let localEditableElement = null;
    let localTextOffset = -1;

    if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
      localActiveElement = activeElement;
      localSelectionStart = activeElement.selectionStart;
      localSelectionEnd = activeElement.selectionEnd;
      dbg('Saved INPUT/TEXTAREA context:', localSelectionStart, '-', localSelectionEnd);
    } else if (selection.rangeCount > 0) {
      localRange = selection.getRangeAt(0).cloneRange();
      localActiveElement = activeElement;

      // Save editable element and text offset for range reconstruction
      localEditableElement = findEditableFromRange(localRange);
      if (localEditableElement) {
        localTextOffset = getTextOffset(localEditableElement, localRange.startContainer, localRange.startOffset);
        dbg('Saved contentEditable context, offset:', localTextOffset);
      }

      // Teams fallback
      if (!localEditableElement && isTeamsPage()) {
        localEditableElement = findTeamsComposeBox();
        if (localEditableElement) {
          dbg('Using Teams compose box as fallback editable');
          localTextOffset = getTextOffset(localEditableElement, localRange.startContainer, localRange.startOffset);
        }
      }
    }

    // Show processing toast
    showToast(`${style.emoji} Parafraseando...`);

    try {
      const result = await callParaphraseAPI(text, style.prompt);
      dbg('API returned result:', result.substring(0, 50) + '...');

      // Replace the text
      if (localActiveElement && (localActiveElement.tagName === 'INPUT' || localActiveElement.tagName === 'TEXTAREA') && localSelectionStart !== null) {
        // Input/textarea replacement
        localActiveElement.focus();
        localActiveElement.setSelectionRange(localSelectionStart, localSelectionEnd);

        let success = document.execCommand('insertText', false, result);
        dbg('silentParaphrase INPUT execCommand:', success);
        if (!success) {
          const currentText = localActiveElement.value;
          localActiveElement.value = currentText.substring(0, localSelectionStart) + result + currentText.substring(localSelectionEnd);
          localActiveElement.setSelectionRange(localSelectionStart, localSelectionStart + result.length);
          localActiveElement.dispatchEvent(new Event('input', { bubbles: true }));
          dbg('silentParaphrase INPUT direct set: done');
        }

        showToast(`${style.emoji} Texto substituído!`);
      } else if (localRange || localEditableElement) {
        // ContentEditable replacement
        const editableEl = localEditableElement || findEditableFromRange(localRange);

        if (editableEl) {
          // Temporarily set module-level saved state for getValidRange
          const prevRange = savedRange;
          const prevEditable = savedEditableElement;
          const prevText = savedSelectedText;
          const prevOffset = savedTextOffset;

          savedRange = localRange;
          savedEditableElement = localEditableElement;
          savedSelectedText = text;
          savedTextOffset = localTextOffset;

          const success = await replaceInContentEditable(editableEl, result, text, localTextOffset, localRange);

          // Restore module-level state
          savedRange = prevRange;
          savedEditableElement = prevEditable;
          savedSelectedText = prevText;
          savedTextOffset = prevOffset;

          if (success) {
            showToast(`${style.emoji} Texto substituído!`);
          }
        } else {
          // Non-editable - copy to clipboard
          await copyToClipboard(result);
          showToast(`${style.emoji} Copiado! Use Ctrl+V para colar.`);
        }
      } else {
        await copyToClipboard(result);
        showToast(`${style.emoji} Copiado! Use Ctrl+V para colar.`);
      }
    } catch (error) {
      dbg('silentParaphrase error:', error);
      showToast(`Erro: ${error.message}`);
    }
  }

  // Keyboard shortcuts handler
  // Ctrl+Shift+P = Open popup
  // Ctrl+Alt+1-8 = Direct paraphrase with specific style and auto-replace
  document.addEventListener('keydown', (e) => {
    // Ctrl+Shift+P = Open popup (keep this one)
    if (e.ctrlKey && e.shiftKey && e.key === 'P') {
      e.preventDefault();
      const selection = window.getSelection().toString().trim();
      if (selection) {
        showParaphrasePopup(selection);
      } else {
        showToast('Selecione um texto primeiro!');
      }
      return;
    }

    // Ctrl+Alt+1-8 = Direct paraphrase with style and auto-replace
    // Some keys (2,3,7,8) require Shift to avoid Outlook conflicts
    // Use e.code (Digit1-Digit8) to avoid issues with modifier keys changing the key character
    if (e.ctrlKey && e.altKey) {
      const digitMatch = e.code && e.code.match(/^Digit([1-8])$/);
      if (digitMatch) {
        const digit = digitMatch[1];
        const style = PARAPHRASE_STYLES.find(s => s.shortcut === digit);
        if (style) {
          // Check if Shift state matches what this style requires
          if (style.needsShift === e.shiftKey) {
            e.preventDefault();
            silentParaphrase(style.id);
            return;
          }
        }
      }
    }
  });

})();
