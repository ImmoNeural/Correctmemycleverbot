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

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'paraphrase') {
      selectedText = request.text;
      showParaphrasePopup(request.text, request.style);
    }
  });

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
    } else if (selection.rangeCount > 0) {
      savedRange = selection.getRangeAt(0).cloneRange();
      savedActiveElement = activeElement;
      savedSelectionStart = null;
      savedSelectionEnd = null;
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
                      title="${style.title}">
                ${style.emoji} ${style.title}
              </button>
            `).join('')}
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

    // Position popup near selection
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

    // Replace button
    popup.querySelector('.replace-btn').addEventListener('click', () => {
      const result = popup.querySelector('.paraphrase-result').textContent;
      replaceSelectedText(result);
      removeExistingPopup();
      showToast('Texto substituído!');
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
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      let top = rect.bottom + window.scrollY + 10;
      let left = rect.left + window.scrollX;

      // Ensure popup stays within viewport
      const popupWidth = 450;
      const popupHeight = 500;
      const taskbarMargin = 80; // Margin for Windows taskbar

      if (left + popupWidth > window.innerWidth) {
        left = window.innerWidth - popupWidth - 20;
      }
      if (left < 10) left = 10;

      // Check if popup would go below viewport (considering taskbar)
      const maxBottom = window.innerHeight + window.scrollY - taskbarMargin;
      if (top + popupHeight > maxBottom) {
        // Try placing above the selection
        top = rect.top + window.scrollY - popupHeight - 10;

        // If still too high (goes above viewport), center it with margin from bottom
        if (top < window.scrollY + 10) {
          top = window.scrollY + Math.max(10, (window.innerHeight - popupHeight - taskbarMargin) / 2);
        }
      }

      // Final safety check - ensure minimum margin from bottom
      const absoluteMaxTop = window.scrollY + window.innerHeight - popupHeight - taskbarMargin;
      if (top > absoluteMaxTop) {
        top = absoluteMaxTop;
      }

      popup.style.top = `${top}px`;
      popup.style.left = `${left}px`;
    } else {
      // Center in viewport with margin for taskbar
      popup.style.top = 'calc(50% - 40px)';
      popup.style.left = '50%';
      popup.style.transform = 'translate(-50%, -50%)';
    }
  }

  function removeExistingPopup() {
    if (currentPopup) {
      currentPopup.remove();
      currentPopup = null;
    }
  }

  function replaceSelectedText(newText) {
    // Use saved selection/range instead of current selection

    // Check if selection was in an input or textarea
    if (savedActiveElement && (savedActiveElement.tagName === 'INPUT' || savedActiveElement.tagName === 'TEXTAREA') && savedSelectionStart !== null) {
      try {
        const text = savedActiveElement.value;
        const newValue = text.substring(0, savedSelectionStart) + newText + text.substring(savedSelectionEnd);

        // Focus and set value
        savedActiveElement.focus();
        savedActiveElement.value = newValue;
        savedActiveElement.setSelectionRange(savedSelectionStart, savedSelectionStart + newText.length);

        // Trigger events for React/Vue/Angular compatibility
        savedActiveElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        savedActiveElement.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));

        return true;
      } catch (e) {
        console.error('Error replacing in input/textarea:', e);
        navigator.clipboard.writeText(newText);
        showToast('Texto copiado para a área de transferência!');
        return false;
      }
    }

    // Check if we have a saved range for contentEditable or regular elements
    if (savedRange) {
      try {
        // Check if the original element was contentEditable
        const container = savedRange.commonAncestorContainer;
        const editableParent = container.nodeType === 3
          ? container.parentElement
          : container;

        const editableElement = editableParent?.closest?.('[contenteditable="true"]') ||
                                (editableParent?.isContentEditable ? editableParent : null);

        if (editableElement) {
          // Restore focus to the editable element first
          editableElement.focus();

          // Use a small delay to ensure focus is set
          setTimeout(() => {
            try {
              // Restore selection
              const selection = window.getSelection();
              selection.removeAllRanges();
              selection.addRange(savedRange);

              // Try using execCommand first (better compatibility)
              const success = document.execCommand('insertText', false, newText);

              if (!success) {
                // Fallback: manual replacement
                savedRange.deleteContents();
                const textNode = document.createTextNode(newText);
                savedRange.insertNode(textNode);

                // Move cursor to end of inserted text
                const newRange = document.createRange();
                newRange.setStartAfter(textNode);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
              }

              // Trigger input event
              editableElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
            } catch (innerE) {
              console.error('Error in delayed replacement:', innerE);
            }
          }, 10);

          return true;
        } else {
          // Non-editable content - copy to clipboard
          navigator.clipboard.writeText(newText);
          showToast('Texto copiado para a área de transferência!');
          return false;
        }
      } catch (e) {
        console.error('Error replacing text:', e);
        // Fallback: just copy to clipboard
        navigator.clipboard.writeText(newText);
        showToast('Texto copiado para a área de transferência!');
        return false;
      }
    }

    // No saved selection - just copy to clipboard
    navigator.clipboard.writeText(newText);
    showToast('Texto copiado para a área de transferência!');
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

    // Save current selection BEFORE any async operation
    let localSavedRange = null;
    let localSavedActiveElement = null;
    let localSavedSelectionStart = null;
    let localSavedSelectionEnd = null;

    if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
      localSavedActiveElement = activeElement;
      localSavedSelectionStart = activeElement.selectionStart;
      localSavedSelectionEnd = activeElement.selectionEnd;
    } else if (selection.rangeCount > 0) {
      localSavedRange = selection.getRangeAt(0).cloneRange();
      localSavedActiveElement = activeElement;
    }

    // Show processing toast
    showToast(`${style.emoji} Parafraseando...`);

    try {
      const result = await callParaphraseAPI(text, style.prompt);

      // Replace the text silently
      if (localSavedActiveElement && (localSavedActiveElement.tagName === 'INPUT' || localSavedActiveElement.tagName === 'TEXTAREA') && localSavedSelectionStart !== null) {
        const currentText = localSavedActiveElement.value;
        localSavedActiveElement.value = currentText.substring(0, localSavedSelectionStart) + result + currentText.substring(localSavedSelectionEnd);
        localSavedActiveElement.focus();
        localSavedActiveElement.setSelectionRange(localSavedSelectionStart, localSavedSelectionStart + result.length);

        // Trigger input event for frameworks like React
        localSavedActiveElement.dispatchEvent(new Event('input', { bubbles: true }));

        showToast(`${style.emoji} Texto substituído!`);
      } else if (localSavedRange) {
        try {
          const container = localSavedRange.commonAncestorContainer;
          const editableParent = container.nodeType === 3 ? container.parentElement : container;

          if (editableParent && (editableParent.isContentEditable || editableParent.closest('[contenteditable="true"]'))) {
            const editableElement = editableParent.isContentEditable
              ? editableParent
              : editableParent.closest('[contenteditable="true"]');
            if (editableElement) {
              editableElement.focus();
            }

            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(localSavedRange);

            localSavedRange.deleteContents();
            localSavedRange.insertNode(document.createTextNode(result));

            // Trigger input event for frameworks
            if (editableElement) {
              editableElement.dispatchEvent(new Event('input', { bubbles: true }));
            }

            showToast(`${style.emoji} Texto substituído!`);
          } else {
            // Non-editable - copy to clipboard
            navigator.clipboard.writeText(result);
            showToast(`${style.emoji} Copiado para a área de transferência!`);
          }
        } catch (e) {
          console.error('Error replacing text:', e);
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
  // AltGr+1-8 = Direct paraphrase with specific style and auto-replace
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

    // AltGr+1-8 = Direct paraphrase with style and auto-replace
    // AltGr is detected as Ctrl+Alt in JavaScript
    if (e.altKey && e.ctrlKey && !e.shiftKey) {
      const style = PARAPHRASE_STYLES.find(s => s.shortcut === e.key);
      if (style) {
        e.preventDefault();
        silentParaphrase(style.id);
        return;
      }
    }
  });

})();
