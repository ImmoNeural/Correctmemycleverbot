// ==UserScript==
// @name         Paraphrase Hotkeys - Atalhos para Parafrasear
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Atalhos de teclado para parafrasear texto em alemão usando OpenAI API
// @author       CorrectMe
// @match        *://*/*
// @grant        none
// ==/UserScript==

// COMO USAR:
// 1. Instale no Tampermonkey/Greasemonkey como userscript
// 2. OU cole no DevTools > Sources > Snippets e execute
// 3. OU cole no console do navegador (F12 > Console)
//
// ATALHOS:
// Ctrl+Shift+P       = Abrir popup com todas as opções
// Ctrl+Alt+1         = Formal / Profissional
// Ctrl+Alt+Shift+2   = Informal / Casual
// Ctrl+Alt+Shift+3   = Conciso / Resumido
// Ctrl+Alt+4         = Detalhado / Expandido
// Ctrl+Alt+5         = Criativo / Original
// Ctrl+Alt+6         = Simples / Fácil
// Ctrl+Alt+Shift+7   = Acadêmico / Científico
// Ctrl+Alt+Shift+8   = Amigável / Empático
//
// CONFIGURAÇÃO:
// Use Ctrl+Shift+P para abrir o popup e configurar sua API Key

(function() {
  'use strict';

  // Evitar múltiplas instâncias
  if (window.__paraphraseHotkeysLoaded) {
    console.log('[Paraphrase Hotkeys] Já carregado!');
    return;
  }
  window.__paraphraseHotkeysLoaded = true;

  const CONFIG_KEY = 'paraphrase_hotkeys_config';
  const DEBUG = true;

  function dbg(...args) {
    if (DEBUG) console.log('[Paraphrase]', ...args);
  }

  dbg('Script carregado em:', location.hostname);

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

  // Helper para mostrar label do atalho
  function shortcutLabel(style) {
    return style.needsShift ? `Ctrl+Alt+Shift+${style.shortcut}` : `Ctrl+Alt+${style.shortcut}`;
  }

  // Configuração
  function getConfig() {
    try {
      return JSON.parse(localStorage.getItem(CONFIG_KEY)) || {};
    } catch(e) {
      return {};
    }
  }

  function saveConfig(config) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  }

  // Clipboard
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch(e) {
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
        dbg('Erro ao copiar:', e2);
        return false;
      }
    }
  }

  // Toast notification
  function showToast(message) {
    const existingToast = document.querySelector('.paraphrase-hotkey-toast');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = 'paraphrase-hotkey-toast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%) translateY(100px);
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 14px 28px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 500;
      z-index: 2147483647;
      transition: transform 0.3s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-shadow: 0 8px 30px rgba(102, 126, 234, 0.4);
    `;
    document.body.appendChild(toast);

    setTimeout(() => toast.style.transform = 'translateX(-50%) translateY(0)', 10);
    setTimeout(() => {
      toast.style.transform = 'translateX(-50%) translateY(100px)';
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  // API call
  async function callParaphraseAPI(text, stylePrompt) {
    const config = getConfig();

    if (!config.apiKey) {
      throw new Error('Configure sua API Key primeiro! Use Ctrl+Shift+P');
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

  // Detectar Teams
  function isTeamsPage() {
    return location.hostname.includes('teams.microsoft') ||
           location.hostname.includes('teams.live') ||
           location.hostname.includes('teams.cloud');
  }

  // Encontrar elemento editável
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

  // Paráfrase silenciosa (sem popup)
  async function silentParaphrase(styleId) {
    const style = PARAPHRASE_STYLES.find(s => s.id === styleId);
    if (!style) return;

    const selection = window.getSelection();
    const text = selection ? selection.toString().trim() : '';

    dbg('silentParaphrase:', { styleId, textLength: text.length });

    if (!text) {
      showToast('⚠️ Selecione um texto primeiro!');
      return;
    }

    // Salvar contexto da seleção
    const activeElement = document.activeElement;
    let savedRange = null;
    let savedActiveElement = null;
    let savedSelectionStart = null;
    let savedSelectionEnd = null;

    if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
      savedActiveElement = activeElement;
      savedSelectionStart = activeElement.selectionStart;
      savedSelectionEnd = activeElement.selectionEnd;
    } else if (selection.rangeCount > 0) {
      savedRange = selection.getRangeAt(0).cloneRange();
      savedActiveElement = activeElement;
    }

    showToast(`${style.emoji} Parafraseando...`);

    try {
      const result = await callParaphraseAPI(text, style.prompt);
      dbg('Resultado:', result.substring(0, 50) + '...');

      // Tentar substituir o texto
      let replaced = false;

      // INPUT/TEXTAREA
      if (savedActiveElement && (savedActiveElement.tagName === 'INPUT' || savedActiveElement.tagName === 'TEXTAREA') && savedSelectionStart !== null) {
        try {
          savedActiveElement.focus();
          savedActiveElement.setSelectionRange(savedSelectionStart, savedSelectionEnd);
          let success = document.execCommand('insertText', false, result);
          if (!success) {
            const val = savedActiveElement.value;
            savedActiveElement.value = val.substring(0, savedSelectionStart) + result + val.substring(savedSelectionEnd);
            savedActiveElement.setSelectionRange(savedSelectionStart, savedSelectionStart + result.length);
            savedActiveElement.dispatchEvent(new Event('input', { bubbles: true }));
          }
          replaced = true;
        } catch(e) {
          dbg('Erro ao substituir em input:', e);
        }
      }

      // ContentEditable
      if (!replaced && savedRange) {
        const editableEl = findEditableFromRange(savedRange);
        if (editableEl) {
          try {
            editableEl.focus();
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(savedRange);

            // Tentar execCommand
            let success = document.execCommand('insertText', false, result);
            if (!success) {
              // Fallback: manipulação DOM
              savedRange.deleteContents();
              savedRange.insertNode(document.createTextNode(result));
              editableEl.normalize();
            }
            replaced = true;
          } catch(e) {
            dbg('Erro ao substituir em contentEditable:', e);
          }
        }
      }

      // Se não substituiu, copiar para clipboard
      if (!replaced) {
        await copyToClipboard(result);
        showToast(`${style.emoji} Copiado! Use Ctrl+V para colar.`);
      } else {
        showToast(`${style.emoji} Texto substituído!`);
      }

    } catch(error) {
      dbg('Erro:', error);
      showToast(`❌ Erro: ${error.message}`);
    }
  }

  // Escape HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Remover popup existente
  function removePopup() {
    const popup = document.getElementById('paraphrase-hotkey-popup');
    if (popup) popup.remove();
    const styles = document.getElementById('paraphrase-hotkey-styles');
    if (styles) styles.remove();
  }

  // Mostrar popup completo
  function showPopup() {
    removePopup();

    const selectedText = window.getSelection().toString().trim();
    const config = getConfig();

    // Adicionar estilos CSS
    const styleSheet = document.createElement('style');
    styleSheet.id = 'paraphrase-hotkey-styles';
    styleSheet.textContent = `
      #paraphrase-hotkey-popup {
        position: fixed;
        top: 20px;
        right: 20px;
        width: 460px;
        max-height: 90vh;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 16px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        overflow: hidden;
        color: #333;
      }
      #paraphrase-hotkey-popup * { box-sizing: border-box; }
      .phk-header {
        background: rgba(255,255,255,0.15);
        padding: 14px 18px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        backdrop-filter: blur(10px);
      }
      .phk-header h3 { margin: 0; color: white; font-size: 17px; font-weight: 600; }
      .phk-close {
        background: rgba(255,255,255,0.2);
        border: none;
        color: white;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 20px;
        line-height: 1;
        transition: background 0.2s;
      }
      .phk-close:hover { background: rgba(255,255,255,0.3); }
      .phk-content {
        background: white;
        padding: 18px;
        max-height: calc(90vh - 56px);
        overflow-y: auto;
      }
      .phk-section { margin-bottom: 16px; }
      .phk-section label {
        display: block;
        font-weight: 600;
        margin-bottom: 8px;
        color: #444;
        font-size: 13px;
      }
      .phk-original {
        background: #f8f9fa;
        padding: 12px;
        border-radius: 8px;
        font-size: 13px;
        max-height: 100px;
        overflow-y: auto;
        border: 1px solid #e9ecef;
        color: #333;
      }
      .phk-styles {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
      }
      .phk-style-btn {
        padding: 12px 14px;
        border: 2px solid #e9ecef;
        border-radius: 12px;
        background: white;
        cursor: pointer;
        text-align: left;
        font-size: 12px;
        transition: all 0.2s;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .phk-style-btn:hover {
        border-color: #667eea;
        background: #f8f9ff;
      }
      .phk-style-btn.selected {
        border-color: #667eea;
        background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
      }
      .phk-style-btn .style-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 500;
      }
      .phk-style-btn .emoji { font-size: 18px; }
      .phk-style-btn .shortcut {
        font-size: 10px;
        color: #888;
        background: #f0f0f0;
        padding: 2px 6px;
        border-radius: 4px;
      }
      .phk-shortcuts-hint {
        margin-top: 12px;
        padding: 10px;
        background: #e3f2fd;
        border-radius: 8px;
        font-size: 11px;
        color: #1565c0;
      }
      .phk-loading {
        display: none;
        align-items: center;
        justify-content: center;
        gap: 12px;
        padding: 24px;
        color: #667eea;
      }
      .phk-spinner {
        width: 28px;
        height: 28px;
        border: 3px solid #e9ecef;
        border-top-color: #667eea;
        border-radius: 50%;
        animation: phk-spin 0.8s linear infinite;
      }
      @keyframes phk-spin { to { transform: rotate(360deg); } }
      .phk-result-section { display: none; }
      .phk-result {
        background: #e8f5e9;
        padding: 14px;
        border-radius: 8px;
        font-size: 13px;
        border: 1px solid #c8e6c9;
        margin-bottom: 12px;
        white-space: pre-wrap;
        max-height: 180px;
        overflow-y: auto;
      }
      .phk-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      .phk-action-btn {
        padding: 10px 18px;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        transition: all 0.2s;
      }
      .phk-copy-btn { background: #667eea; color: white; }
      .phk-copy-btn:hover { background: #5a6fd6; }
      .phk-replace-btn { background: #4caf50; color: white; }
      .phk-replace-btn:hover { background: #43a047; }
      .phk-retry-btn { background: #ff9800; color: white; }
      .phk-retry-btn:hover { background: #f57c00; }
      .phk-error {
        display: none;
        background: #ffebee;
        color: #c62828;
        padding: 12px;
        border-radius: 8px;
        font-size: 13px;
      }
      .phk-config {
        border-top: 1px solid #e9ecef;
        padding-top: 14px;
        margin-top: 14px;
      }
      .phk-config summary {
        cursor: pointer;
        font-weight: 600;
        color: #666;
        font-size: 13px;
      }
      .phk-config-content { margin-top: 12px; }
      .phk-config input {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid #ddd;
        border-radius: 8px;
        font-size: 13px;
        margin-bottom: 10px;
      }
      .phk-config input:focus {
        outline: none;
        border-color: #667eea;
      }
      .phk-save-config {
        background: #667eea;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
      }
      .phk-save-config:hover { background: #5a6fd6; }
      .phk-note {
        font-size: 11px;
        color: #888;
        margin-top: 8px;
      }
      .phk-no-selection {
        text-align: center;
        padding: 30px 20px;
        color: #666;
      }
      .phk-no-selection p { margin: 0 0 10px 0; }
    `;
    document.head.appendChild(styleSheet);

    // Criar popup
    const popup = document.createElement('div');
    popup.id = 'paraphrase-hotkey-popup';

    if (!selectedText) {
      popup.innerHTML = `
        <div class="phk-header">
          <h3>✨ Parafraseador com Hotkeys</h3>
          <button class="phk-close">&times;</button>
        </div>
        <div class="phk-content">
          <div class="phk-no-selection">
            <p>⚠️ Nenhum texto selecionado!</p>
            <p>Selecione um texto e use os atalhos abaixo.</p>
          </div>
          <div class="phk-shortcuts-hint">
            <strong>Atalhos disponíveis:</strong><br>
            ${PARAPHRASE_STYLES.map(s => `${shortcutLabel(s)} = ${s.emoji} ${s.title.split(' / ')[0]}`).join('<br>')}
          </div>
          <div class="phk-config">
            <details ${!config.apiKey ? 'open' : ''}>
              <summary>⚙️ Configurações da API</summary>
              <div class="phk-config-content">
                <input type="password" class="phk-api-key" placeholder="API Key (sk-...)" value="${config.apiKey || ''}">
                <input type="text" class="phk-api-url" placeholder="URL da API (opcional)" value="${config.apiUrl || ''}">
                <button class="phk-save-config">💾 Salvar Configurações</button>
                <p class="phk-note">A configuração é salva no localStorage do navegador.</p>
              </div>
            </details>
          </div>
        </div>
      `;
    } else {
      popup.innerHTML = `
        <div class="phk-header">
          <h3>✨ Parafraseador com Hotkeys</h3>
          <button class="phk-close">&times;</button>
        </div>
        <div class="phk-content">
          <div class="phk-section">
            <label>Texto Original:</label>
            <div class="phk-original">${escapeHtml(selectedText)}</div>
          </div>

          <div class="phk-section">
            <label>Escolha o estilo:</label>
            <div class="phk-styles">
              ${PARAPHRASE_STYLES.map(style => `
                <button class="phk-style-btn" data-style="${style.id}">
                  <span class="style-title">
                    <span class="emoji">${style.emoji}</span>
                    <span>${style.title.split(' / ')[0]}</span>
                  </span>
                  <span class="shortcut">${shortcutLabel(style)}</span>
                </button>
              `).join('')}
            </div>
            <div class="phk-shortcuts-hint">
              💡 <strong>Dica:</strong> Selecione texto e use os atalhos acima para parafrasear direto, sem abrir este popup!
            </div>
          </div>

          <div class="phk-loading">
            <div class="phk-spinner"></div>
            <span>Parafraseando...</span>
          </div>

          <div class="phk-error"></div>

          <div class="phk-section phk-result-section">
            <label>Resultado:</label>
            <div class="phk-result"></div>
            <div class="phk-actions">
              <button class="phk-action-btn phk-copy-btn">📋 Copiar</button>
              <button class="phk-action-btn phk-replace-btn">✅ Substituir</button>
              <button class="phk-action-btn phk-retry-btn">🔄 Novamente</button>
            </div>
          </div>

          <div class="phk-config">
            <details ${!config.apiKey ? 'open' : ''}>
              <summary>⚙️ Configurações da API</summary>
              <div class="phk-config-content">
                <input type="password" class="phk-api-key" placeholder="API Key (sk-...)" value="${config.apiKey || ''}">
                <input type="text" class="phk-api-url" placeholder="URL da API (opcional)" value="${config.apiUrl || ''}">
                <button class="phk-save-config">💾 Salvar Configurações</button>
                <p class="phk-note">A configuração é salva no localStorage do navegador.</p>
              </div>
            </details>
          </div>
        </div>
      `;
    }

    document.body.appendChild(popup);

    // Event handlers
    popup.querySelector('.phk-close').addEventListener('click', removePopup);

    // Salvar configuração
    popup.querySelector('.phk-save-config').addEventListener('click', () => {
      const apiKey = popup.querySelector('.phk-api-key').value.trim();
      const apiUrl = popup.querySelector('.phk-api-url').value.trim();
      saveConfig({ apiKey, apiUrl: apiUrl || 'https://api.openai.com/v1/chat/completions' });
      showToast('✅ Configurações salvas!');
    });

    // Se tem texto selecionado, configurar botões de estilo
    if (selectedText) {
      let currentResult = '';
      let currentStyle = null;

      // Salvar seleção
      const selection = window.getSelection();
      const activeElement = document.activeElement;
      let savedRange = null;
      let savedActiveElement = null;
      let savedSelectionStart = null;
      let savedSelectionEnd = null;

      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        savedActiveElement = activeElement;
        savedSelectionStart = activeElement.selectionStart;
        savedSelectionEnd = activeElement.selectionEnd;
      } else if (selection.rangeCount > 0) {
        savedRange = selection.getRangeAt(0).cloneRange();
        savedActiveElement = activeElement;
      }

      popup.querySelectorAll('.phk-style-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          popup.querySelectorAll('.phk-style-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          currentStyle = btn.dataset.style;
          await performParaphrase(currentStyle);
        });
      });

      popup.querySelector('.phk-copy-btn').addEventListener('click', async () => {
        await copyToClipboard(currentResult);
        showToast('📋 Texto copiado!');
      });

      popup.querySelector('.phk-replace-btn').addEventListener('click', async () => {
        removePopup();
        setTimeout(async () => {
          let replaced = false;

          // INPUT/TEXTAREA
          if (savedActiveElement && (savedActiveElement.tagName === 'INPUT' || savedActiveElement.tagName === 'TEXTAREA') && savedSelectionStart !== null) {
            try {
              savedActiveElement.focus();
              savedActiveElement.setSelectionRange(savedSelectionStart, savedSelectionEnd);
              let success = document.execCommand('insertText', false, currentResult);
              if (!success) {
                const val = savedActiveElement.value;
                savedActiveElement.value = val.substring(0, savedSelectionStart) + currentResult + val.substring(savedSelectionEnd);
                savedActiveElement.dispatchEvent(new Event('input', { bubbles: true }));
              }
              replaced = true;
            } catch(e) {}
          }

          // ContentEditable
          if (!replaced && savedRange) {
            const editableEl = findEditableFromRange(savedRange);
            if (editableEl) {
              try {
                editableEl.focus();
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(savedRange);
                let success = document.execCommand('insertText', false, currentResult);
                if (!success) {
                  savedRange.deleteContents();
                  savedRange.insertNode(document.createTextNode(currentResult));
                  editableEl.normalize();
                }
                replaced = true;
              } catch(e) {}
            }
          }

          if (!replaced) {
            await copyToClipboard(currentResult);
            showToast('📋 Copiado! Use Ctrl+V para colar.');
          } else {
            showToast('✅ Texto substituído!');
          }
        }, 300);
      });

      popup.querySelector('.phk-retry-btn').addEventListener('click', () => {
        if (currentStyle) performParaphrase(currentStyle);
      });

      async function performParaphrase(styleId) {
        const style = PARAPHRASE_STYLES.find(s => s.id === styleId);
        if (!style) return;

        const loading = popup.querySelector('.phk-loading');
        const resultSection = popup.querySelector('.phk-result-section');
        const resultDiv = popup.querySelector('.phk-result');
        const errorDiv = popup.querySelector('.phk-error');

        loading.style.display = 'flex';
        resultSection.style.display = 'none';
        errorDiv.style.display = 'none';

        try {
          currentResult = await callParaphraseAPI(selectedText, style.prompt);
          loading.style.display = 'none';
          resultSection.style.display = 'block';
          resultDiv.textContent = currentResult;
        } catch (error) {
          loading.style.display = 'none';
          errorDiv.style.display = 'block';
          errorDiv.textContent = `Erro: ${error.message}`;
        }
      }
    }

    // Fechar com Escape
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        removePopup();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    // Fechar ao clicar fora
    setTimeout(() => {
      const clickHandler = (e) => {
        const popup = document.getElementById('paraphrase-hotkey-popup');
        if (popup && !popup.contains(e.target)) {
          removePopup();
          document.removeEventListener('click', clickHandler);
        }
      };
      document.addEventListener('click', clickHandler);
    }, 100);
  }

  // ==================== KEYBOARD SHORTCUTS ====================
  // Usar capture phase para funcionar no Teams/React
  document.addEventListener('keydown', (e) => {
    // Debug log
    if (e.ctrlKey && e.altKey) {
      dbg('Tecla detectada:', {
        key: e.key,
        code: e.code,
        ctrl: e.ctrlKey,
        alt: e.altKey,
        shift: e.shiftKey
      });
    }

    // Ctrl+Shift+P = Abrir popup (sem Alt)
    if (e.ctrlKey && e.shiftKey && !e.altKey && (e.key === 'P' || e.key === 'p')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      dbg('Ctrl+Shift+P — abrindo popup');
      showPopup();
      return;
    }

    // Ctrl+Alt+1-8 = Paráfrase direta
    if (e.ctrlKey && e.altKey) {
      const digitMatch = e.code && e.code.match(/^Digit([1-8])$/);
      if (digitMatch) {
        const digit = digitMatch[1];
        const style = PARAPHRASE_STYLES.find(s => s.shortcut === digit);
        if (style) {
          dbg(`Digit${digit} detectado. Style "${style.id}" needsShift=${style.needsShift}, shiftKey=${e.shiftKey}`);
          // Verificar se Shift está correto para este estilo
          if (style.needsShift === e.shiftKey) {
            e.preventDefault();
            e.stopImmediatePropagation();
            dbg(`>>> Executando paráfrase: ${style.id}`);
            silentParaphrase(style.id);
            return;
          }
        }
      }
    }
  }, true); // CAPTURE PHASE — importante para Teams/React

  // Mostrar mensagem de carregamento
  showToast('✨ Hotkeys carregados! Ctrl+Shift+P para ajuda');
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║           PARAPHRASE HOTKEYS - ATALHOS CARREGADOS            ║
╠══════════════════════════════════════════════════════════════╣
║  Ctrl+Shift+P       = Abrir popup com todas as opções        ║
║  Ctrl+Alt+1         = 👔 Formal / Profissional               ║
║  Ctrl+Alt+Shift+2   = 😊 Informal / Casual                   ║
║  Ctrl+Alt+Shift+3   = 📝 Conciso / Resumido                  ║
║  Ctrl+Alt+4         = 📖 Detalhado / Expandido               ║
║  Ctrl+Alt+5         = 🎨 Criativo / Original                 ║
║  Ctrl+Alt+6         = 💡 Simples / Fácil de entender         ║
║  Ctrl+Alt+Shift+7   = 🎓 Acadêmico / Científico              ║
║  Ctrl+Alt+Shift+8   = 🤗 Amigável / Empático                 ║
╚══════════════════════════════════════════════════════════════╝
  `);

})();
