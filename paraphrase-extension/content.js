// Paraphrase Extension - Content Script
// Handles UI and paraphrasing logic on web pages

(function() {
  'use strict';

  const PARAPHRASE_STYLES = [
    { id: 'formal', title: 'Formal / Profissional', emoji: '👔', prompt: 'Reescreva este texto em um tom formal e profissional, mantendo o significado original.' },
    { id: 'informal', title: 'Informal / Casual', emoji: '😊', prompt: 'Reescreva este texto em um tom informal e casual, como se estivesse conversando com um amigo.' },
    { id: 'concise', title: 'Conciso / Resumido', emoji: '📝', prompt: 'Reescreva este texto de forma mais concisa e direta, removendo palavras desnecessárias.' },
    { id: 'detailed', title: 'Detalhado / Expandido', emoji: '📖', prompt: 'Expanda este texto com mais detalhes e explicações, tornando-o mais completo.' },
    { id: 'creative', title: 'Criativo / Original', emoji: '🎨', prompt: 'Reescreva este texto de forma criativa e original, usando metáforas ou linguagem mais expressiva.' },
    { id: 'simple', title: 'Simples / Fácil de entender', emoji: '💡', prompt: 'Simplifique este texto para que seja fácil de entender por qualquer pessoa.' },
    { id: 'academic', title: 'Acadêmico / Científico', emoji: '🎓', prompt: 'Reescreva este texto em um tom acadêmico e científico, com linguagem técnica apropriada.' },
    { id: 'friendly', title: 'Amigável / Empático', emoji: '🤗', prompt: 'Reescreva este texto em um tom amigável e empático, demonstrando compreensão e cordialidade.' }
  ];

  let currentPopup = null;
  let selectedText = '';

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
            content: `Você é um assistente especializado em parafrasear textos. ${stylePrompt} Responda APENAS com o texto parafraseado, sem explicações adicionais.`
          },
          {
            role: 'user',
            content: text
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

      if (left + popupWidth > window.innerWidth) {
        left = window.innerWidth - popupWidth - 20;
      }
      if (left < 10) left = 10;

      if (top + popupHeight > window.innerHeight + window.scrollY) {
        top = rect.top + window.scrollY - popupHeight - 10;
      }

      popup.style.top = `${top}px`;
      popup.style.left = `${left}px`;
    } else {
      // Center in viewport
      popup.style.top = '50%';
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
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const activeElement = document.activeElement;

      // Check if selection is in an input or textarea
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        const start = activeElement.selectionStart;
        const end = activeElement.selectionEnd;
        const text = activeElement.value;
        activeElement.value = text.substring(0, start) + newText + text.substring(end);
        activeElement.setSelectionRange(start, start + newText.length);
      } else if (activeElement && activeElement.isContentEditable) {
        // For contentEditable elements
        range.deleteContents();
        range.insertNode(document.createTextNode(newText));
      } else {
        // For regular text (may not work in all contexts)
        try {
          range.deleteContents();
          range.insertNode(document.createTextNode(newText));
        } catch (e) {
          // Fallback: just copy to clipboard
          navigator.clipboard.writeText(newText);
          showToast('Texto copiado para a área de transferência!');
        }
      }
    }
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

  // Also detect keyboard shortcut (Ctrl+Shift+P)
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'P') {
      e.preventDefault();
      const selection = window.getSelection().toString().trim();
      if (selection) {
        showParaphrasePopup(selection);
      } else {
        showToast('Selecione um texto primeiro!');
      }
    }
  });

})();
