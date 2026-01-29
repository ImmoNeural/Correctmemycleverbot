# Parafraseador - Versao para Ambientes Corporativos

Para empresas que bloqueiam extensoes do navegador, existem **3 alternativas** que funcionam:

---

## Opcao 1: Bookmarklet (Favorito com JavaScript)

### Passo a Passo:

1. **Abra o gerenciador de favoritos** do navegador (Ctrl+Shift+O no Chrome/Edge)
2. **Crie um novo favorito** com:
   - **Nome:** `Parafrasear`
   - **URL:** Cole o codigo abaixo (tudo em uma linha)

```
javascript:(function(){const e='paraphrase_bookmarklet_config',t=[{id:'formal',title:'Formal',emoji:'👔',prompt:'Reescreva este texto EM ALEMÃO em um tom formal e profissional, usando "Sie". O resultado DEVE ser em alemão.'},{id:'informal',title:'Informal',emoji:'😊',prompt:'Reescreva este texto EM ALEMÃO em um tom informal, usando "du". O resultado DEVE ser em alemão.'},{id:'concise',title:'Conciso',emoji:'📝',prompt:'Reescreva este texto EM ALEMÃO de forma concisa. O resultado DEVE ser em alemão.'},{id:'detailed',title:'Detalhado',emoji:'📖',prompt:'Expanda este texto EM ALEMÃO com mais detalhes. O resultado DEVE ser em alemão.'},{id:'creative',title:'Criativo',emoji:'🎨',prompt:'Reescreva este texto EM ALEMÃO de forma criativa. O resultado DEVE ser em alemão.'},{id:'simple',title:'Simples',emoji:'💡',prompt:'Simplifique este texto EM ALEMÃO (nível A2-B1). O resultado DEVE ser em alemão.'}];let n=document.getElementById('pb-popup');n&&n.remove();const o=window.getSelection().toString().trim(),i=()=>{try{return JSON.parse(localStorage.getItem(e))||{}}catch{return{}}},s=document.createElement('style');s.textContent='#pb-popup{position:fixed;top:20px;right:20px;width:380px;background:#fff;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,.3);z-index:2147483647;font-family:system-ui,sans-serif}#pb-popup *{box-sizing:border-box}.pb-h{background:linear-gradient(135deg,#667eea,#764ba2);padding:12px;border-radius:12px 12px 0 0;display:flex;justify-content:space-between;color:#fff}.pb-h h3{margin:0;font-size:14px}.pb-x{background:0;border:0;color:#fff;font-size:20px;cursor:pointer}.pb-c{padding:12px;max-height:70vh;overflow-y:auto}.pb-s{margin-bottom:12px}.pb-s label{display:block;font-weight:600;margin-bottom:4px;font-size:12px;color:#444}.pb-o{background:#f5f5f5;padding:8px;border-radius:6px;font-size:12px;max-height:60px;overflow-y:auto}.pb-g{display:grid;grid-template-columns:repeat(2,1fr);gap:6px}.pb-b{padding:8px;border:2px solid #eee;border-radius:8px;background:#fff;cursor:pointer;font-size:11px;text-align:left}.pb-b:hover{border-color:#667eea}.pb-b.sel{border-color:#667eea;background:#f0f4ff}.pb-l{display:none;text-align:center;padding:15px;color:#667eea}.pb-r{display:none}.pb-rt{background:#e8f5e9;padding:10px;border-radius:6px;font-size:12px;margin-bottom:8px;white-space:pre-wrap}.pb-a{display:flex;gap:6px}.pb-a button{padding:6px 12px;border:0;border-radius:6px;cursor:pointer;font-size:11px;color:#fff}.pb-cp{background:#667eea}.pb-e{display:none;background:#ffebee;color:#c62828;padding:8px;border-radius:6px;font-size:12px}.pb-cfg{border-top:1px solid #eee;padding-top:10px;margin-top:10px}.pb-cfg summary{font-size:12px;cursor:pointer;color:#666}.pb-cfg input{width:100%;padding:6px;border:1px solid #ddd;border-radius:4px;font-size:12px;margin:4px 0}.pb-cfg button{background:#667eea;color:#fff;border:0;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:11px}',document.head.appendChild(s);const a=document.createElement('div');a.id='pb-popup';const c=i();a.innerHTML=o?`<div class="pb-h"><h3>✨ Parafraseador</h3><button class="pb-x">×</button></div><div class="pb-c"><div class="pb-s"><label>Original:</label><div class="pb-o">${o.replace(/</g,'&lt;')}</div></div><div class="pb-s"><label>Estilo:</label><div class="pb-g">${t.map(e=>`<button class="pb-b" data-id="${e.id}">${e.emoji} ${e.title}</button>`).join('')}</div></div><div class="pb-l">⏳ Parafraseando...</div><div class="pb-e"></div><div class="pb-r pb-s"><label>Resultado:</label><div class="pb-rt"></div><div class="pb-a"><button class="pb-cp">📋 Copiar</button></div></div><div class="pb-cfg"><details ${c.apiKey?'':'open'}><summary>⚙️ API</summary><input type="password" class="pb-k" placeholder="API Key" value="${c.apiKey||''}"><input class="pb-u" placeholder="URL (opcional)" value="${c.apiUrl||''}"><button class="pb-sv">💾 Salvar</button></details></div></div>`:`<div class="pb-h"><h3>✨ Parafraseador</h3><button class="pb-x">×</button></div><div class="pb-c"><p style="text-align:center;color:#666">⚠️ Selecione um texto primeiro!</p><div class="pb-cfg"><details open><summary>⚙️ API</summary><input type="password" class="pb-k" placeholder="API Key" value="${c.apiKey||''}"><input class="pb-u" placeholder="URL (opcional)" value="${c.apiUrl||''}"><button class="pb-sv">💾 Salvar</button></details></div></div>`,document.body.appendChild(a),a.querySelector('.pb-x').onclick=()=>a.remove(),a.querySelector('.pb-sv').onclick=()=>{localStorage.setItem(e,JSON.stringify({apiKey:a.querySelector('.pb-k').value.trim(),apiUrl:a.querySelector('.pb-u').value.trim()||'https://api.openai.com/v1/chat/completions'})),alert('Salvo!')},o&&(a.querySelectorAll('.pb-b').forEach(e=>{e.onclick=async()=>{a.querySelectorAll('.pb-b').forEach(e=>e.classList.remove('sel')),e.classList.add('sel');const n=t.find(t=>t.id===e.dataset.id),s=i();if(!s.apiKey)return a.querySelector('.pb-e').style.display='block',void(a.querySelector('.pb-e').textContent='Configure a API Key!');a.querySelector('.pb-l').style.display='block',a.querySelector('.pb-r').style.display='none',a.querySelector('.pb-e').style.display='none';try{const e=await fetch(s.apiUrl||'https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${s.apiKey}`},body:JSON.stringify({model:'gpt-3.5-turbo',messages:[{role:'system',content:`Você é um assistente que parafraseia em ALEMÃO. ${n.prompt}`},{role:'user',content:`Parafraseie em alemão:\n\n${o}`}],temperature:.7})});if(!e.ok)throw new Error(`Erro: ${e.status}`);const t=(await e.json()).choices[0].message.content.trim();a.querySelector('.pb-l').style.display='none',a.querySelector('.pb-r').style.display='block',a.querySelector('.pb-rt').textContent=t,a.querySelector('.pb-cp').onclick=async()=>{await navigator.clipboard.writeText(t),alert('Copiado!')}}catch(e){a.querySelector('.pb-l').style.display='none',a.querySelector('.pb-e').style.display='block',a.querySelector('.pb-e').textContent=e.message}}})),document.onkeydown=e=>{'Escape'===e.key&&a.remove()}})();
```

3. **Para usar:** Selecione texto em qualquer pagina e clique no favorito

---

## Opcao 2: Snippet no DevTools (Mais Completo)

Esta opcao oferece mais funcionalidades e e mais facil de editar.

### Passo a Passo:

1. Abra o DevTools com **F12**
2. Va para **Sources** > **Snippets** (no painel esquerdo)
3. Clique em **+ New snippet**
4. Cole o conteudo do arquivo `bookmarklet.js`
5. Salve com **Ctrl+S**
6. Para executar: **Ctrl+Enter** ou clique direito > Run

### Vantagem:
- O snippet fica salvo permanentemente no navegador
- Funciona em qualquer site
- Mais facil de atualizar

---

## Opcao 3: Console do DevTools (Temporario)

Para uso rapido sem salvar nada:

1. Selecione o texto que deseja parafrasear
2. Abra o DevTools com **F12**
3. Va para a aba **Console**
4. Cole o conteudo do arquivo `bookmarklet.js`
5. Pressione **Enter**

**Nota:** Precisa repetir toda vez que recarregar a pagina.

---

## Configuracao Inicial (Todas as Opcoes)

Na primeira vez que usar:

1. Clique em **⚙️ Configuracoes da API**
2. Insira sua **API Key** da OpenAI (ou compativel)
3. Opcionalmente, altere a **URL da API** se usar outro provedor
4. Clique em **💾 Salvar**

A configuracao fica salva no `localStorage` do navegador.

---

## Provedores de API Compativeis

Alem da OpenAI, voce pode usar:

| Provedor | URL da API |
|----------|------------|
| OpenAI | `https://api.openai.com/v1/chat/completions` (padrao) |
| Azure OpenAI | `https://SEU-RECURSO.openai.azure.com/openai/deployments/SEU-MODELO/chat/completions?api-version=2024-02-15-preview` |
| OpenRouter | `https://openrouter.ai/api/v1/chat/completions` |
| Groq | `https://api.groq.com/openai/v1/chat/completions` |
| Together AI | `https://api.together.xyz/v1/chat/completions` |

---

## Solucao de Problemas

### "Erro na API: 401"
- API Key incorreta ou expirada

### "Erro na API: 429"
- Limite de requisicoes excedido, aguarde um pouco

### "Erro na API: 403"
- Firewall corporativo pode estar bloqueando. Tente usar uma VPN ou o celular.

### O popup nao aparece
- Verifique se o JavaScript esta habilitado no navegador
- Alguns sites bloqueiam scripts externos por CSP (Content Security Policy)

---

## Seguranca

- A API Key e armazenada **apenas localmente** no seu navegador (localStorage)
- Nenhum dado e enviado para servidores externos alem da API configurada
- O codigo e open source e pode ser auditado
