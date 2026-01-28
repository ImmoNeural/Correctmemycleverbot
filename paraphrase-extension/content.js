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

  // Log initialization
  dbg('Content script loaded on:', location.hostname, location.pathname?.substring(0, 50));

  // Detect if we're inside Microsoft Teams
  function isTeamsPage() {
    const checks = {
      hostTeamsMicrosoft: location.hostname.includes('teams.microsoft'),
      hostTeamsLive: location.hostname.includes('teams.live'),
      hostTeamsCloud: location.hostname.includes('teams.cloud'),
      dataTid: !!document.querySelector('[data-tid]'),
      tsMessageList: !!document.querySelector('.ts-message-list-container'),
      teamsAppFrame: !!document.querySelector('#app') && location.hostname.includes('teams')
    };
    const result = Object.values(checks).some(v => v);
    return result;
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
    if (!element) {
      dbg('restoreFocus: no element provided');
      return false;
    }
    try {
      dbg('restoreFocus: attempting on', element.tagName, element.id || '', 'isTeams:', isTeamsPage());

      // Dispatch mousedown/up to simulate real click (triggers Teams focus handlers)
      const rect = element.getBoundingClientRect();
      const clickX = rect.left + rect.width / 2;
      const clickY = rect.top + rect.height / 2;
      const mouseOpts = { bubbles: true, cancelable: true, clientX: clickX, clientY: clickY, view: window };

      element.dispatchEvent(new MouseEvent('mousedown', mouseOpts));
      element.dispatchEvent(new MouseEvent('mouseup', mouseOpts));
      element.dispatchEvent(new MouseEvent('click', mouseOpts));
      element.focus();

      // Longer delay for Teams (React state needs more time to settle)
      const delay = isTeamsPage() ? 200 : 100;
      await new Promise(r => setTimeout(r, delay));

      const focused = document.activeElement === element || element.contains(document.activeElement);
      dbg('restoreFocus result:', focused, 'activeElement:', document.activeElement?.tagName, document.activeElement?.id);

      // Second attempt for Teams if first failed
      if (!focused && isTeamsPage()) {
        dbg('restoreFocus: second attempt for Teams...');
        element.focus();
        element.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
        element.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        await new Promise(r => setTimeout(r, 200));
        const focused2 = document.activeElement === element || element.contains(document.activeElement);
        dbg('restoreFocus second attempt result:', focused2);
        return focused2;
      }

      return focused;
    } catch(e) {
      dbg('restoreFocus error:', e.message);
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
    const inTeams = isTeamsPage();

    dbg('replaceInContentEditable called:', {
      editableTag: editableElement?.tagName,
      editableId: editableElement?.id,
      newTextLen: newText?.length,
      origTextLen: origText?.length,
      origTextPreview: origText?.substring(0, 50),
      textOffset,
      hasRange: !!range,
      rangeValid: range ? document.contains(range.commonAncestorContainer) : false,
      inTeams
    });

    try {
      // Step 1: Robust focus restoration
      dbg('Step 1: Restoring focus to editable element');
      const focusResult = await restoreFocus(editableElement);
      dbg('Focus restoration result:', focusResult, 'activeElement:', document.activeElement?.tagName);

      // Step 2: Get a valid range
      let validRange = null;

      // First check if passed range is still valid
      if (range) {
        try {
          const ancestor = range.commonAncestorContainer;
          if (ancestor && document.contains(ancestor)) {
            const rangeText = range.toString();
            dbg('Passed range text:', rangeText?.substring(0, 50), 'matches orig:', rangeText === origText);
            if (rangeText === origText) {
              validRange = range;
            }
          } else {
            dbg('Passed range ancestor no longer in document (DOM changed)');
          }
        } catch(e) {
          dbg('Passed range is invalid:', e.message);
        }
      }

      // Try getValidRange as second option
      if (!validRange) {
        dbg('Trying getValidRange...');
        validRange = getValidRange(editableElement, origText, textOffset);
        if (validRange) {
          dbg('getValidRange returned a range, text:', validRange.toString()?.substring(0, 50));
        }
      }

      if (!validRange) {
        dbg('ERROR: No valid range found. Trying text search fallback...');
        // Last-ditch: search for original text in the element
        const elementText = editableElement.textContent;
        dbg('Element textContent length:', elementText?.length, 'searching for origText...');
        const fallbackRange = origText ? findTextRange(editableElement, origText, 0) : null;
        if (!fallbackRange) {
          dbg('ERROR: Cannot find original text in element. Element text:', elementText?.substring(0, 100));
          dbg('Copying to clipboard as last resort.');
          await copyToClipboard(newText);
          showToast('Texto não encontrado. Copiado para a área de transferência! Use Ctrl+V para colar.');
          return false;
        }
        dbg('Found text via fallback search');
        validRange = fallbackRange;
      }

      return await tryReplacementStrategies(editableElement, newText, origText, textOffset, validRange, strategies);
    } catch(e) {
      dbg('CRITICAL ERROR in replaceInContentEditable:', e.message, e);
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
  // For Teams, reorder to prioritize clipboard-based approaches which are more reliable
  async function tryReplacementStrategies(editableElement, newText, origText, textOffset, validRange, strategies) {
    const selection = window.getSelection();
    const inTeams = isTeamsPage();

    dbg('tryReplacementStrategies starting:', {
      inTeams,
      rangeText: validRange?.toString()?.substring(0, 50),
      rangeValid: validRange ? document.contains(validRange.commonAncestorContainer) : false
    });

    // Helper to restore selection with a given range
    function selectRange(r) {
      try {
        selection.removeAllRanges();
        selection.addRange(r);
        dbg('  selectRange: success, selected text:', selection.toString()?.substring(0, 30));
        return true;
      } catch(e) {
        dbg('  selectRange failed:', e.message);
        return false;
      }
    }

    // Helper to get a fresh range (in case DOM changed)
    function freshRange() {
      const fr = getValidRange(editableElement, origText, textOffset);
      if (fr) {
        dbg('  freshRange: got valid range, text:', fr.toString()?.substring(0, 30));
        return fr;
      }
      // Try finding text directly
      const searchRange = origText ? findTextRange(editableElement, origText, 0) : null;
      if (searchRange) {
        dbg('  freshRange: found via text search');
        return searchRange;
      }
      dbg('  freshRange: using original validRange (may be stale)');
      return validRange;
    }

    // Helper to verify replacement worked
    function verifyReplacement() {
      const contains = editableElement.textContent.includes(newText);
      const noOrig = !origText || !editableElement.textContent.includes(origText);
      dbg('  verifyReplacement:', { containsNew: contains, origRemoved: noOrig });
      return contains;
    }

    // For Teams: try clipboard-based approach FIRST since it's most reliable
    if (inTeams) {
      dbg('=== Teams mode: trying clipboard-first strategy ===');

      // Teams Strategy 1: Clipboard write + execCommand('paste')
      try {
        dbg('Teams Strategy 1: clipboard write + execCommand paste');
        const range1 = freshRange();
        if (range1 && selectRange(range1)) {
          await copyToClipboard(newText);
          await new Promise(r => setTimeout(r, 100)); // extra delay for Teams
          const success = document.execCommand('paste');
          strategies.push('Teams1:clipboard-paste=' + success);
          dbg('Teams Strategy 1 result:', success);
          if (success) {
            await new Promise(r => setTimeout(r, 100));
            if (verifyReplacement()) return true;
          }
        }
      } catch(e) {
        strategies.push('Teams1:clipboard-paste-error');
        dbg('Teams Strategy 1 failed:', e.message);
      }

      // Teams Strategy 2: Delete selection + insertText
      try {
        dbg('Teams Strategy 2: delete + insertText');
        const range2 = freshRange();
        if (range2 && selectRange(range2)) {
          document.execCommand('delete', false, null);
          await new Promise(r => setTimeout(r, 50));
          const success = document.execCommand('insertText', false, newText);
          strategies.push('Teams2:delete+insertText=' + success);
          dbg('Teams Strategy 2 result:', success);
          if (success) {
            editableElement.dispatchEvent(new InputEvent('input', {
              bubbles: true, cancelable: true, inputType: 'insertText', data: newText
            }));
            return true;
          }
        }
      } catch(e) {
        strategies.push('Teams2:delete+insertText-error');
        dbg('Teams Strategy 2 failed:', e.message);
      }

      // Teams Strategy 3: ClipboardEvent paste simulation
      try {
        dbg('Teams Strategy 3: ClipboardEvent paste simulation');
        const range3 = freshRange();
        if (range3 && selectRange(range3)) {
          document.execCommand('delete', false, null);
          await new Promise(r => setTimeout(r, 50));

          const dt = new DataTransfer();
          dt.setData('text/plain', newText);
          dt.setData('text/html', `<span>${newText.replace(/</g, '&lt;')}</span>`);
          const pasteEvent = new ClipboardEvent('paste', {
            bubbles: true, cancelable: true, clipboardData: dt
          });
          const dispatched = editableElement.dispatchEvent(pasteEvent);
          strategies.push('Teams3:paste-event=' + dispatched);
          dbg('Teams Strategy 3 dispatched:', dispatched);
          if (dispatched) {
            await new Promise(r => setTimeout(r, 200));
            if (verifyReplacement()) return true;
            dbg('Teams Strategy 3: paste event dispatched but text not found');
          }
        }
      } catch(e) {
        strategies.push('Teams3:paste-event-error');
        dbg('Teams Strategy 3 failed:', e.message);
      }

      // Teams Strategy 4: InputEvent with dataTransfer (CKEditor/ProseMirror)
      try {
        dbg('Teams Strategy 4: InputEvent with dataTransfer');
        const range4 = freshRange();
        if (range4 && selectRange(range4)) {
          const dt = new DataTransfer();
          dt.setData('text/plain', newText);

          editableElement.dispatchEvent(new InputEvent('beforeinput', {
            bubbles: true, cancelable: true, inputType: 'insertFromPaste',
            data: null, dataTransfer: dt
          }));

          const range4b = freshRange();
          if (range4b) {
            range4b.deleteContents();
            range4b.insertNode(document.createTextNode(newText));
            editableElement.normalize();
          }

          editableElement.dispatchEvent(new InputEvent('input', {
            bubbles: true, cancelable: false, inputType: 'insertFromPaste',
            data: null, dataTransfer: dt
          }));

          strategies.push('Teams4:dataTransfer-input=true');
          dbg('Teams Strategy 4: dispatched');

          await new Promise(r => setTimeout(r, 100));
          if (verifyReplacement()) return true;
        }
      } catch(e) {
        strategies.push('Teams4:dataTransfer-input-error');
        dbg('Teams Strategy 4 failed:', e.message);
      }

      // Teams Strategy 5: DOM manipulation with events
      try {
        dbg('Teams Strategy 5: DOM manipulation');
        const range5 = freshRange();
        if (range5 && selectRange(range5)) {
          editableElement.dispatchEvent(new InputEvent('beforeinput', {
            bubbles: true, cancelable: true, inputType: 'insertReplacementText', data: newText
          }));

          range5.deleteContents();
          const textNode = document.createTextNode(newText);
          range5.insertNode(textNode);
          editableElement.normalize();

          const newRange = document.createRange();
          newRange.setStartAfter(textNode);
          newRange.collapse(true);
          selectRange(newRange);

          editableElement.dispatchEvent(new InputEvent('input', {
            bubbles: true, cancelable: true, inputType: 'insertReplacementText', data: newText
          }));

          strategies.push('Teams5:DOM-manipulation=true');
          dbg('Teams Strategy 5 (DOM manipulation): success');
          return true;
        }
      } catch(e) {
        strategies.push('Teams5:DOM-manipulation-error');
        dbg('Teams Strategy 5 failed:', e.message);
      }

      // Teams: all strategies failed
      dbg('ALL TEAMS STRATEGIES FAILED:', strategies.join(', '));
      await copyToClipboard(newText);
      showToast('Substituição bloqueada pelo Teams. Texto copiado! Use Ctrl+V para colar.');
      return false;
    }

    // ===== NON-TEAMS path (standard editors) =====
    dbg('=== Standard mode: trying strategies A-G ===');

    // Strategy A: execCommand('insertText') - best for most editors
    try {
      dbg('Strategy A: execCommand insertText');
      if (selectRange(validRange)) {
        const success = document.execCommand('insertText', false, newText);
        strategies.push('A:execCommand-insertText=' + success);
        dbg('Strategy A result:', success);
        if (success) {
          editableElement.dispatchEvent(new InputEvent('input', {
            bubbles: true, cancelable: true, inputType: 'insertText', data: newText
          }));
          return true;
        }
      }
    } catch(e) {
      strategies.push('A:execCommand-error');
      dbg('Strategy A failed:', e.message);
    }

    // Strategy B: Delete + insertText (two-step)
    try {
      dbg('Strategy B: delete + insertText');
      const rangeB = freshRange();
      if (rangeB && selectRange(rangeB)) {
        document.execCommand('delete', false, null);
        const success = document.execCommand('insertText', false, newText);
        strategies.push('B:delete+insertText=' + success);
        dbg('Strategy B result:', success);
        if (success) {
          editableElement.dispatchEvent(new InputEvent('input', {
            bubbles: true, cancelable: true, inputType: 'insertText', data: newText
          }));
          return true;
        }
      }
    } catch(e) {
      strategies.push('B:delete+insertText-error');
      dbg('Strategy B failed:', e.message);
    }

    // Strategy C: DOM manipulation with beforeinput/input events
    try {
      dbg('Strategy C: DOM manipulation');
      const rangeC = freshRange();
      if (rangeC && selectRange(rangeC)) {
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
      dbg('Strategy C failed:', e.message);
    }

    // Strategy D: ClipboardEvent paste simulation
    try {
      dbg('Strategy D: paste event simulation');
      const rangeD = freshRange();
      if (rangeD && selectRange(rangeD)) {
        document.execCommand('delete', false, null);

        const dt = new DataTransfer();
        dt.setData('text/plain', newText);
        const pasteEvent = new ClipboardEvent('paste', {
          bubbles: true, cancelable: true, clipboardData: dt
        });
        const dispatched = editableElement.dispatchEvent(pasteEvent);
        strategies.push('D:paste-event=' + dispatched);
        dbg('Strategy D dispatched:', dispatched);
        if (dispatched) {
          await new Promise(r => setTimeout(r, 100));
          if (verifyReplacement()) return true;
          dbg('Strategy D: paste event dispatched but text not found');
        }
      }
    } catch(e) {
      strategies.push('D:paste-event-error');
      dbg('Strategy D failed:', e.message);
    }

    // Strategy E: Clipboard write + execCommand('paste')
    try {
      dbg('Strategy E: clipboard write + execCommand paste');
      const rangeE = freshRange();
      if (rangeE && selectRange(rangeE)) {
        await copyToClipboard(newText);
        await new Promise(r => setTimeout(r, 50));
        const success = document.execCommand('paste');
        strategies.push('E:clipboard-paste=' + success);
        dbg('Strategy E result:', success);
        if (success) return true;
      }
    } catch(e) {
      strategies.push('E:clipboard-paste-error');
      dbg('Strategy E failed:', e.message);
    }

    // Strategy F: InputEvent with dataTransfer (CKEditor/ProseMirror)
    try {
      dbg('Strategy F: InputEvent with dataTransfer');
      const rangeF = freshRange();
      if (rangeF && selectRange(rangeF)) {
        const dt = new DataTransfer();
        dt.setData('text/plain', newText);

        editableElement.dispatchEvent(new InputEvent('beforeinput', {
          bubbles: true, cancelable: true, inputType: 'insertFromPaste',
          data: null, dataTransfer: dt
        }));

        const rangeF2 = freshRange();
        if (rangeF2) {
          rangeF2.deleteContents();
          rangeF2.insertNode(document.createTextNode(newText));
          editableElement.normalize();
        }

        editableElement.dispatchEvent(new InputEvent('input', {
          bubbles: true, cancelable: false, inputType: 'insertFromPaste',
          data: null, dataTransfer: dt
        }));

        strategies.push('F:dataTransfer-input=true');
        dbg('Strategy F: dispatched');

        await new Promise(r => setTimeout(r, 100));
        if (verifyReplacement()) return true;
      }
    } catch(e) {
      strategies.push('F:dataTransfer-input-error');
      dbg('Strategy F failed:', e.message);
    }

    // Strategy G: Keyboard event simulation (type each character)
    try {
      dbg('Strategy G: keyboard simulation for', newText.length, 'chars');
      const rangeG = freshRange();
      if (rangeG && selectRange(rangeG)) {
        document.execCommand('delete', false, null);

        for (const char of newText) {
          editableElement.dispatchEvent(new KeyboardEvent('keydown', {
            key: char, code: 'Key' + char.toUpperCase(), bubbles: true
          }));
          editableElement.dispatchEvent(new InputEvent('beforeinput', {
            bubbles: true, cancelable: true, inputType: 'insertText', data: char
          }));

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
      dbg('Strategy G failed:', e.message);
    }

    // All strategies failed
    dbg('ALL STRATEGIES FAILED:', strategies.join(', '));
    await copyToClipboard(newText);
    showToast('Substituição bloqueada. Texto copiado! Use Ctrl+V para colar.');
    return false;
  }

  async function replaceSelectedText(newText) {
    dbg('replaceSelectedText called:', {
      newTextLen: newText?.length,
      savedActiveElement: savedActiveElement?.tagName,
      savedActiveElementId: savedActiveElement?.id,
      savedEditableElement: !!savedEditableElement,
      savedEditableTag: savedEditableElement?.tagName,
      savedRange: !!savedRange,
      savedRangeValid: savedRange ? (() => { try { return document.contains(savedRange.commonAncestorContainer); } catch(e) { return false; } })() : false,
      savedSelectedText: savedSelectedText?.substring(0, 30),
      savedTextOffset,
      isTeams: isTeamsPage()
    });

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
    if (!style) {
      dbg('silentParaphrase: style not found for id:', styleId);
      return;
    }

    // Get selected text IMMEDIATELY (before any async or DOM changes)
    const selection = window.getSelection();
    const activeElement = document.activeElement;
    const text = selection ? selection.toString().trim() : '';

    dbg('silentParaphrase called:', {
      styleId: style.id,
      textLength: text.length,
      textPreview: text.substring(0, 80),
      activeElement: activeElement?.tagName,
      activeElementId: activeElement?.id,
      activeElementClass: activeElement?.className?.substring?.(0, 50),
      contentEditable: activeElement?.contentEditable,
      selectionRangeCount: selection?.rangeCount,
      isTeams: isTeamsPage()
    });

    if (!text) {
      dbg('silentParaphrase: NO TEXT SELECTED');
      showToast('Selecione um texto primeiro!');
      return;
    }

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

      dbg('Selection range saved:', {
        collapsed: localRange.collapsed,
        startContainer: localRange.startContainer?.nodeName,
        endContainer: localRange.endContainer?.nodeName,
        rangeText: localRange.toString().substring(0, 50)
      });

      // Save editable element and text offset for range reconstruction
      localEditableElement = findEditableFromRange(localRange);
      if (localEditableElement) {
        localTextOffset = getTextOffset(localEditableElement, localRange.startContainer, localRange.startOffset);
        dbg('Saved contentEditable context:', {
          tagName: localEditableElement.tagName,
          id: localEditableElement.id,
          textOffset: localTextOffset,
          elementTextLength: localEditableElement.textContent?.length
        });
      } else {
        dbg('No editable element found from range');
      }

      // Teams fallback
      if (!localEditableElement && isTeamsPage()) {
        localEditableElement = findTeamsComposeBox();
        if (localEditableElement) {
          dbg('Using Teams compose box as fallback editable:', localEditableElement.tagName);
          localTextOffset = getTextOffset(localEditableElement, localRange.startContainer, localRange.startOffset);
          dbg('Teams compose box textOffset:', localTextOffset);
        } else {
          dbg('WARNING: Teams page detected but no compose box found!');
        }
      }
    } else {
      dbg('WARNING: No selection range available (rangeCount=0)');
    }

    // Show processing toast
    showToast(`${style.emoji} Parafraseando...`);

    try {
      dbg('Calling API with style:', style.id);
      const result = await callParaphraseAPI(text, style.prompt);
      dbg('API returned result:', result.substring(0, 80) + (result.length > 80 ? '...' : ''));

      // Replace the text
      if (localActiveElement && (localActiveElement.tagName === 'INPUT' || localActiveElement.tagName === 'TEXTAREA') && localSelectionStart !== null) {
        // Input/textarea replacement
        dbg('Replacing in INPUT/TEXTAREA');
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
        dbg('Replacing in contentEditable:', {
          found: !!editableEl,
          tagName: editableEl?.tagName,
          id: editableEl?.id
        });

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
          dbg('replaceInContentEditable result:', success);

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
          dbg('No editable element — copying to clipboard');
          await copyToClipboard(result);
          showToast(`${style.emoji} Copiado! Use Ctrl+V para colar.`);
        }
      } else {
        dbg('No selection context saved — copying to clipboard');
        await copyToClipboard(result);
        showToast(`${style.emoji} Copiado! Use Ctrl+V para colar.`);
      }
    } catch (error) {
      dbg('silentParaphrase error:', error.message, error);
      showToast(`Erro: ${error.message}`);
    }
  }

  // Keyboard shortcuts handler
  // IMPORTANT: Use capture phase (3rd arg = true) so we receive events BEFORE
  // Teams/React handlers call stopPropagation() in the bubbling phase.
  // Ctrl+Shift+P = Open popup
  // Ctrl+Alt+1-8 = Direct paraphrase with specific style and auto-replace
  document.addEventListener('keydown', (e) => {
    // Log ALL Ctrl+Alt combinations for debugging
    if (e.ctrlKey && e.altKey) {
      dbg('keydown captured:', {
        key: e.key,
        code: e.code,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        shiftKey: e.shiftKey,
        metaKey: e.metaKey,
        target: e.target?.tagName,
        contentEditable: e.target?.contentEditable,
        isTeams: isTeamsPage()
      });
    }

    // Ctrl+Shift+P = Open popup (but NOT when Alt is also pressed)
    if (e.ctrlKey && e.shiftKey && !e.altKey && (e.key === 'P' || e.key === 'p')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      dbg('Ctrl+Shift+P detected — opening popup');
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
          dbg(`Digit${digit} detected. Style "${style.id}" needsShift=${style.needsShift}, e.shiftKey=${e.shiftKey}`);
          // Check if Shift state matches what this style requires
          if (style.needsShift === e.shiftKey) {
            e.preventDefault();
            e.stopImmediatePropagation();
            dbg(`>>> Triggering silentParaphrase for style "${style.id}"`);
            silentParaphrase(style.id);
            return;
          } else {
            dbg(`Shift mismatch for style "${style.id}": needs ${style.needsShift}, got ${e.shiftKey} — ignoring`);
          }
        }
      } else {
        dbg('Ctrl+Alt pressed but code did not match Digit1-8:', e.code);
      }
    }
  }, true);  // <<< CAPTURE PHASE — critical for Teams/React compatibility

})();
