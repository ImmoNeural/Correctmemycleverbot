// Paraphrase Extension - Content Script
// Handles UI and paraphrasing logic on web pages

(function() {
  'use strict';

  const PARAPHRASE_STYLES = [
    { id: 'formal', title: 'Formal / Profissional', emoji: '👔', shortcut: '1', prompt: 'Reescreva este texto EM ALEMÃO em um tom formal e profissional, usando "Sie" e vocabulário sofisticado. Mantenha o significado original. O resultado DEVE ser em alemão.' },
    { id: 'informal', title: 'Informal / Casual', emoji: '😊', shortcut: '2', prompt: 'Reescreva este texto EM ALEMÃO em um tom informal e casual, usando "du" como se estivesse conversando com um amigo. O resultado DEVE ser em alemão.' },
    { id: 'concise', title: 'Conciso / Resumido', emoji: '📝', shortcut: '3', prompt: 'Reescreva este texto EM ALEMÃO de forma mais concisa e direta, removendo palavras desnecessárias. O resultado DEVE ser em alemão.' },
    { id: 'detailed', title: 'Detalhado / Expandido', emoji: '📖', shortcut: '4', prompt: 'Expanda este texto EM ALEMÃO com mais detalhes e explicações, tornando-o mais completo. O resultado DEVE ser em alemão.' },
    { id: 'creative', title: 'Criativo / Original', emoji: '🎨', shortcut: '5', prompt: 'Reescreva este texto EM ALEMÃO de forma criativa e original, usando metáforas ou linguagem mais expressiva. O resultado DEVE ser em alemão.' },
    { id: 'simple', title: 'Simples / Fácil de entender', emoji: '💡', shortcut: '6', prompt: 'Simplifique este texto EM ALEMÃO para que seja fácil de entender (nível A2-B1). O resultado DEVE ser em alemão.' },
    { id: 'academic', title: 'Acadêmico / Científico', emoji: '🎓', shortcut: '7', prompt: 'Reescreva este texto EM ALEMÃO em um tom acadêmico e científico, com linguagem técnica apropriada. O resultado DEVE ser em alemão.' },
    { id: 'friendly', title: 'Amigável / Empático', emoji: '🤗', shortcut: '8', prompt: 'Reescreva este texto EM ALEMÃO em um tom amigável e empático, demonstrando compreensão e cordialidade. O resultado DEVE ser em alemão.' }
  ];

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
                      title="${style.title} (Ctrl+Alt+${style.shortcut})">
                ${style.emoji} ${style.title.split(' / ')[0]}
                <span class="style-shortcut">Ctrl+Alt+${style.shortcut}</span>
              </button>
            `).join('')}
          </div>
          <div class="shortcuts-hint">
            Dica: Selecione texto e use <strong>Ctrl+Alt+1-8</strong> para parafrasear direto, sem abrir o popup.
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
    popup.querySelector('.copy-btn').addEventListener('click', () => {
      const result = popup.querySelector('.paraphrase-result').textContent;
      navigator.clipboard.writeText(result).then(() => {
        showToast('Texto copiado!');
      });
    });

    // Replace button - remove popup first, then replace with delay for Teams focus restoration
    popup.querySelector('.replace-btn').addEventListener('click', () => {
      const result = popup.querySelector('.paraphrase-result').textContent;
      // Remove popup FIRST so it doesn't interfere with focus/selection
      removeExistingPopup();
      // Longer delay to let Teams/React fully restore focus
      setTimeout(() => {
        const success = replaceSelectedText(result);
        if (success) {
          showToast('Texto substituído!');
        }
      }, 250);
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

  // Replace text in contentEditable with multiple strategies for Teams compatibility
  function replaceInContentEditable(editableElement, newText, origText, textOffset, range) {
    try {
      // Step 1: Focus the element
      editableElement.focus();

      // Step 2: Get a valid range
      const validRange = range || getValidRange(editableElement, origText, textOffset);
      if (!validRange) {
        console.error('Paraphrase: No valid range found for replacement');
        navigator.clipboard.writeText(newText);
        showToast('Copiado para a área de transferência!');
        return false;
      }

      // Step 3: Restore selection
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(validRange);

      // Strategy A: execCommand('insertText') - best compatibility with editors
      let success = false;
      try {
        success = document.execCommand('insertText', false, newText);
      } catch(e) {
        console.log('Paraphrase: execCommand insertText failed:', e);
      }

      if (success) {
        editableElement.dispatchEvent(new InputEvent('input', {
          bubbles: true, cancelable: true, inputType: 'insertText', data: newText
        }));
        return true;
      }

      // Strategy B: Delete selection first, then insert
      try {
        // Re-restore selection
        selection.removeAllRanges();
        const rangeB = getValidRange(editableElement, origText, textOffset);
        if (rangeB) {
          selection.addRange(rangeB);
          document.execCommand('delete', false, null);
          success = document.execCommand('insertText', false, newText);
          if (success) {
            editableElement.dispatchEvent(new InputEvent('input', {
              bubbles: true, cancelable: true, inputType: 'insertText', data: newText
            }));
            return true;
          }
        }
      } catch(e) {
        console.log('Paraphrase: delete+insertText failed:', e);
      }

      // Strategy C: Dispatch beforeinput + DOM manipulation + input
      try {
        selection.removeAllRanges();
        const rangeC = getValidRange(editableElement, origText, textOffset);
        if (rangeC) {
          selection.addRange(rangeC);

          // Dispatch beforeinput
          editableElement.dispatchEvent(new InputEvent('beforeinput', {
            bubbles: true, cancelable: true, inputType: 'insertReplacementText', data: newText
          }));

          // DOM manipulation
          rangeC.deleteContents();
          const textNode = document.createTextNode(newText);
          rangeC.insertNode(textNode);
          editableElement.normalize();

          // Move cursor after inserted text
          const newRange = document.createRange();
          newRange.setStartAfter(textNode);
          newRange.collapse(true);
          selection.removeAllRanges();
          selection.addRange(newRange);

          // Dispatch input
          editableElement.dispatchEvent(new InputEvent('input', {
            bubbles: true, cancelable: true, inputType: 'insertReplacementText', data: newText
          }));

          return true;
        }
      } catch(e) {
        console.log('Paraphrase: DOM manipulation failed:', e);
      }

      // Strategy D: Simulate paste event
      try {
        selection.removeAllRanges();
        const rangeD = getValidRange(editableElement, origText, textOffset);
        if (rangeD) {
          selection.addRange(rangeD);

          // First delete selection
          document.execCommand('delete', false, null);

          const dt = new DataTransfer();
          dt.setData('text/plain', newText);
          const pasteEvent = new ClipboardEvent('paste', {
            bubbles: true, cancelable: true, clipboardData: dt
          });
          editableElement.dispatchEvent(pasteEvent);
          return true;
        }
      } catch(e) {
        console.log('Paraphrase: Paste simulation failed:', e);
      }

      // All strategies failed - copy to clipboard
      navigator.clipboard.writeText(newText);
      showToast('Copiado para a área de transferência!');
      return false;
    } catch(e) {
      console.error('Paraphrase: replaceInContentEditable error:', e);
      navigator.clipboard.writeText(newText);
      showToast('Copiado para a área de transferência!');
      return false;
    }
  }

  function replaceSelectedText(newText) {
    // INPUT/TEXTAREA elements
    if (savedActiveElement && (savedActiveElement.tagName === 'INPUT' || savedActiveElement.tagName === 'TEXTAREA') && savedSelectionStart !== null) {
      try {
        savedActiveElement.focus();
        savedActiveElement.setSelectionRange(savedSelectionStart, savedSelectionEnd);

        // Try execCommand first (works with React controlled inputs)
        let success = document.execCommand('insertText', false, newText);
        if (!success) {
          // Fallback: direct value manipulation
          const text = savedActiveElement.value;
          savedActiveElement.value = text.substring(0, savedSelectionStart) + newText + text.substring(savedSelectionEnd);
          savedActiveElement.setSelectionRange(savedSelectionStart, savedSelectionStart + newText.length);
          savedActiveElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
          savedActiveElement.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        }

        return true;
      } catch (e) {
        console.error('Paraphrase: Error replacing in input/textarea:', e);
        navigator.clipboard.writeText(newText);
        showToast('Copiado para a área de transferência!');
        return false;
      }
    }

    // ContentEditable elements
    const editableEl = savedEditableElement || findEditableFromRange(savedRange);
    if (editableEl) {
      return replaceInContentEditable(editableEl, newText, savedSelectedText, savedTextOffset, savedRange);
    }

    // Non-editable or no saved selection - copy to clipboard
    navigator.clipboard.writeText(newText);
    showToast('Copiado para a área de transferência!');
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
    } else if (selection.rangeCount > 0) {
      localRange = selection.getRangeAt(0).cloneRange();
      localActiveElement = activeElement;

      // Save editable element and text offset for range reconstruction
      localEditableElement = findEditableFromRange(localRange);
      if (localEditableElement) {
        localTextOffset = getTextOffset(localEditableElement, localRange.startContainer, localRange.startOffset);
      }
    }

    // Show processing toast
    showToast(`${style.emoji} Parafraseando...`);

    try {
      const result = await callParaphraseAPI(text, style.prompt);

      // Replace the text
      if (localActiveElement && (localActiveElement.tagName === 'INPUT' || localActiveElement.tagName === 'TEXTAREA') && localSelectionStart !== null) {
        // Input/textarea replacement
        localActiveElement.focus();
        localActiveElement.setSelectionRange(localSelectionStart, localSelectionEnd);

        let success = document.execCommand('insertText', false, result);
        if (!success) {
          const currentText = localActiveElement.value;
          localActiveElement.value = currentText.substring(0, localSelectionStart) + result + currentText.substring(localSelectionEnd);
          localActiveElement.setSelectionRange(localSelectionStart, localSelectionStart + result.length);
          localActiveElement.dispatchEvent(new Event('input', { bubbles: true }));
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

          const success = replaceInContentEditable(editableEl, result, text, localTextOffset, localRange);

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
          navigator.clipboard.writeText(result);
          showToast(`${style.emoji} Copiado para a área de transferência!`);
        }
      } else {
        navigator.clipboard.writeText(result);
        showToast(`${style.emoji} Copiado para a área de transferência!`);
      }
    } catch (error) {
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
    // Use e.code (Digit1-Digit8) to avoid issues with modifier keys changing the key character
    // Also works with AltGr+1-8 since AltGr sends Ctrl+Alt
    if (e.ctrlKey && e.altKey && !e.shiftKey) {
      const digitMatch = e.code && e.code.match(/^Digit([1-8])$/);
      if (digitMatch) {
        const style = PARAPHRASE_STYLES.find(s => s.shortcut === digitMatch[1]);
        if (style) {
          e.preventDefault();
          silentParaphrase(style.id);
          return;
        }
      }
    }
  });

})();
