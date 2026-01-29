// Paraphrase Bookmarklet - Versão Standalone
// Para ambientes corporativos que bloqueiam extensões
//
// COMO USAR:
// 1. Crie um novo favorito/bookmark no navegador
// 2. No campo URL, cole o código minificado (ver bookmarklet-minified.txt)
// 3. Selecione texto em qualquer página e clique no favorito
//
// Ou use como snippet no DevTools (F12 > Sources > Snippets)

(function() {
  'use strict';

  // Configuração - edite aqui sua API key
  const CONFIG_KEY = 'paraphrase_bookmarklet_config';

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

  // Remover popup existente
  const existingPopup = document.getElementById('paraphrase-bookmarklet-popup');
  if (existingPopup) existingPopup.remove();
  const existingStyles = document.getElementById('paraphrase-bookmarklet-styles');
  if (existingStyles) existingStyles.remove();

  // Obter texto selecionado
  const selectedText = window.getSelection().toString().trim();

  // Carregar configuração do localStorage
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

  // Adicionar estilos CSS
  const styleSheet = document.createElement('style');
  styleSheet.id = 'paraphrase-bookmarklet-styles';
  styleSheet.textContent = `
    #paraphrase-bookmarklet-popup {
      position: fixed;
      top: 20px;
      right: 20px;
      width: 420px;
      max-height: 90vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow: hidden;
      color: #333;
    }
    #paraphrase-bookmarklet-popup * {
      box-sizing: border-box;
    }
    .pb-header {
      background: rgba(255,255,255,0.15);
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      backdrop-filter: blur(10px);
    }
    .pb-header h3 {
      margin: 0;
      color: white;
      font-size: 16px;
      font-weight: 600;
    }
    .pb-close {
      background: rgba(255,255,255,0.2);
      border: none;
      color: white;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 18px;
      line-height: 1;
      transition: background 0.2s;
    }
    .pb-close:hover {
      background: rgba(255,255,255,0.3);
    }
    .pb-content {
      background: white;
      padding: 16px;
      max-height: calc(90vh - 52px);
      overflow-y: auto;
    }
    .pb-section {
      margin-bottom: 16px;
    }
    .pb-section label {
      display: block;
      font-weight: 600;
      margin-bottom: 6px;
      color: #444;
      font-size: 13px;
    }
    .pb-original {
      background: #f8f9fa;
      padding: 10px;
      border-radius: 8px;
      font-size: 13px;
      max-height: 80px;
      overflow-y: auto;
      border: 1px solid #e9ecef;
      color: #333;
    }
    .pb-styles {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    }
    .pb-style-btn {
      padding: 10px 12px;
      border: 2px solid #e9ecef;
      border-radius: 10px;
      background: white;
      cursor: pointer;
      text-align: left;
      font-size: 12px;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .pb-style-btn:hover {
      border-color: #667eea;
      background: #f8f9ff;
    }
    .pb-style-btn.selected {
      border-color: #667eea;
      background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
    }
    .pb-style-btn .emoji {
      font-size: 18px;
    }
    .pb-loading {
      display: none;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 20px;
      color: #667eea;
    }
    .pb-spinner {
      width: 24px;
      height: 24px;
      border: 3px solid #e9ecef;
      border-top-color: #667eea;
      border-radius: 50%;
      animation: pb-spin 0.8s linear infinite;
    }
    @keyframes pb-spin {
      to { transform: rotate(360deg); }
    }
    .pb-result-section {
      display: none;
    }
    .pb-result {
      background: #e8f5e9;
      padding: 12px;
      border-radius: 8px;
      font-size: 13px;
      border: 1px solid #c8e6c9;
      margin-bottom: 10px;
      white-space: pre-wrap;
      max-height: 150px;
      overflow-y: auto;
    }
    .pb-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .pb-action-btn {
      padding: 8px 14px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      transition: all 0.2s;
    }
    .pb-copy-btn {
      background: #667eea;
      color: white;
    }
    .pb-copy-btn:hover {
      background: #5a6fd6;
    }
    .pb-replace-btn {
      background: #4caf50;
      color: white;
    }
    .pb-replace-btn:hover {
      background: #43a047;
    }
    .pb-retry-btn {
      background: #ff9800;
      color: white;
    }
    .pb-retry-btn:hover {
      background: #f57c00;
    }
    .pb-error {
      display: none;
      background: #ffebee;
      color: #c62828;
      padding: 10px;
      border-radius: 8px;
      font-size: 13px;
    }
    .pb-config {
      border-top: 1px solid #e9ecef;
      padding-top: 12px;
      margin-top: 12px;
    }
    .pb-config summary {
      cursor: pointer;
      font-weight: 600;
      color: #666;
      font-size: 13px;
    }
    .pb-config-content {
      margin-top: 10px;
    }
    .pb-config input {
      width: 100%;
      padding: 8px 10px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 13px;
      margin-bottom: 8px;
    }
    .pb-config input:focus {
      outline: none;
      border-color: #667eea;
    }
    .pb-save-config {
      background: #667eea;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
    }
    .pb-save-config:hover {
      background: #5a6fd6;
    }
    .pb-note {
      font-size: 11px;
      color: #888;
      margin-top: 6px;
    }
    .pb-no-selection {
      text-align: center;
      padding: 30px 20px;
      color: #666;
    }
    .pb-no-selection p {
      margin: 0 0 10px 0;
    }
    .pb-toast {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%) translateY(100px);
      background: #333;
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 2147483647;
      transition: transform 0.3s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .pb-toast.show {
      transform: translateX(-50%) translateY(0);
    }
  `;
  document.head.appendChild(styleSheet);

  // Criar popup
  const popup = document.createElement('div');
  popup.id = 'paraphrase-bookmarklet-popup';

  const config = getConfig();

  if (!selectedText) {
    popup.innerHTML = `
      <div class="pb-header">
        <h3>✨ Parafraseador</h3>
        <button class="pb-close">&times;</button>
      </div>
      <div class="pb-content">
        <div class="pb-no-selection">
          <p>⚠️ Nenhum texto selecionado!</p>
          <p>Selecione um texto na página e clique no bookmarklet novamente.</p>
        </div>
        <div class="pb-config">
          <details ${!config.apiKey ? 'open' : ''}>
            <summary>⚙️ Configurações da API</summary>
            <div class="pb-config-content">
              <input type="password" class="pb-api-key" placeholder="API Key (sk-...)" value="${config.apiKey || ''}">
              <input type="text" class="pb-api-url" placeholder="URL da API (opcional)" value="${config.apiUrl || ''}">
              <button class="pb-save-config">💾 Salvar</button>
              <p class="pb-note">A configuração é salva no localStorage do navegador.</p>
            </div>
          </details>
        </div>
      </div>
    `;
  } else {
    popup.innerHTML = `
      <div class="pb-header">
        <h3>✨ Parafraseador</h3>
        <button class="pb-close">&times;</button>
      </div>
      <div class="pb-content">
        <div class="pb-section">
          <label>Texto Original:</label>
          <div class="pb-original">${escapeHtml(selectedText)}</div>
        </div>

        <div class="pb-section">
          <label>Escolha o estilo:</label>
          <div class="pb-styles">
            ${PARAPHRASE_STYLES.map(style => `
              <button class="pb-style-btn" data-style="${style.id}">
                <span class="emoji">${style.emoji}</span>
                <span>${style.title.split(' / ')[0]}</span>
              </button>
            `).join('')}
          </div>
        </div>

        <div class="pb-loading">
          <div class="pb-spinner"></div>
          <span>Parafraseando...</span>
        </div>

        <div class="pb-error"></div>

        <div class="pb-section pb-result-section">
          <label>Resultado:</label>
          <div class="pb-result"></div>
          <div class="pb-actions">
            <button class="pb-action-btn pb-copy-btn">📋 Copiar</button>
            <button class="pb-action-btn pb-replace-btn">✅ Substituir</button>
            <button class="pb-action-btn pb-retry-btn">🔄 Novamente</button>
          </div>
        </div>

        <div class="pb-config">
          <details ${!config.apiKey ? 'open' : ''}>
            <summary>⚙️ Configurações da API</summary>
            <div class="pb-config-content">
              <input type="password" class="pb-api-key" placeholder="API Key (sk-...)" value="${config.apiKey || ''}">
              <input type="text" class="pb-api-url" placeholder="URL da API (opcional)" value="${config.apiUrl || ''}">
              <button class="pb-save-config">💾 Salvar</button>
              <p class="pb-note">A configuração é salva no localStorage do navegador.</p>
            </div>
          </details>
        </div>
      </div>
    `;
  }

  document.body.appendChild(popup);

  // Event handlers
  popup.querySelector('.pb-close').addEventListener('click', () => popup.remove());

  // Salvar configuração
  popup.querySelector('.pb-save-config').addEventListener('click', () => {
    const apiKey = popup.querySelector('.pb-api-key').value.trim();
    const apiUrl = popup.querySelector('.pb-api-url').value.trim();
    saveConfig({ apiKey, apiUrl: apiUrl || 'https://api.openai.com/v1/chat/completions' });
    showToast('Configurações salvas!');
  });

  // Botões de estilo
  if (selectedText) {
    let currentResult = '';
    let currentStyle = null;

    popup.querySelectorAll('.pb-style-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        popup.querySelectorAll('.pb-style-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');

        currentStyle = btn.dataset.style;
        await performParaphrase(currentStyle);
      });
    });

    popup.querySelector('.pb-copy-btn').addEventListener('click', async () => {
      await copyToClipboard(currentResult);
      showToast('Texto copiado!');
    });

    popup.querySelector('.pb-replace-btn').addEventListener('click', async () => {
      await copyToClipboard(currentResult);
      showToast('Texto copiado! Use Ctrl+V para colar.');
      popup.remove();
    });

    popup.querySelector('.pb-retry-btn').addEventListener('click', () => {
      if (currentStyle) performParaphrase(currentStyle);
    });

    async function performParaphrase(styleId) {
      const style = PARAPHRASE_STYLES.find(s => s.id === styleId);
      if (!style) return;

      const loading = popup.querySelector('.pb-loading');
      const resultSection = popup.querySelector('.pb-result-section');
      const resultDiv = popup.querySelector('.pb-result');
      const errorDiv = popup.querySelector('.pb-error');

      loading.style.display = 'flex';
      resultSection.style.display = 'none';
      errorDiv.style.display = 'none';

      try {
        const cfg = getConfig();
        if (!cfg.apiKey) {
          throw new Error('Configure sua API Key nas configurações abaixo.');
        }

        const apiUrl = cfg.apiUrl || 'https://api.openai.com/v1/chat/completions';

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${cfg.apiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content: `Você é um assistente especializado em parafrasear textos em ALEMÃO. ${style.prompt} IMPORTANTE: O texto de saída DEVE estar em alemão correto. Responda APENAS com o texto parafraseado em alemão, sem explicações adicionais.`
              },
              {
                role: 'user',
                content: `Parafraseie o seguinte texto em alemão:\n\n${selectedText}`
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
        currentResult = data.choices[0].message.content.trim();

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
  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') {
      popup.remove();
      document.removeEventListener('keydown', escHandler);
    }
  });

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch(e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      return true;
    }
  }

  function showToast(message) {
    const existingToast = document.querySelector('.pb-toast');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = 'pb-toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

})();
