# Paraphrase Hotkeys - Script de Atalhos

Script standalone com atalhos de teclado para parafrasear texto em alemão usando a API da OpenAI.

## Atalhos de Teclado

| Atalho | Estilo |
|--------|--------|
| `Ctrl+Shift+P` | Abrir popup com todas as opções |
| `Ctrl+Alt+1` | 👔 Formal / Profissional |
| `Ctrl+Alt+Shift+2` | 😊 Informal / Casual |
| `Ctrl+Alt+Shift+3` | 📝 Conciso / Resumido |
| `Ctrl+Alt+4` | 📖 Detalhado / Expandido |
| `Ctrl+Alt+5` | 🎨 Criativo / Original |
| `Ctrl+Alt+6` | 💡 Simples / Fácil de entender |
| `Ctrl+Alt+Shift+7` | 🎓 Acadêmico / Científico |
| `Ctrl+Alt+Shift+8` | 🤗 Amigável / Empático |

## Como Instalar

### Opção 1: Tampermonkey (Recomendado)

1. Instale a extensão Tampermonkey no seu navegador:
   - [Chrome](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
   - [Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
   - [Edge](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)

2. Clique no ícone do Tampermonkey e selecione "Criar novo script..."

3. Apague todo o conteúdo e cole o conteúdo do arquivo `hotkey-script.js`

4. Salve o script (Ctrl+S)

5. O script agora está ativo em todas as páginas!

### Opção 2: Snippet do DevTools

1. Abra o DevTools (F12)
2. Vá para a aba "Sources" (Fontes)
3. No painel esquerdo, clique em "Snippets"
4. Clique em "New snippet"
5. Cole o conteúdo do arquivo `hotkey-script.js`
6. Salve (Ctrl+S) e execute (Ctrl+Enter)

**Nota:** Com esta opção você precisa executar o snippet manualmente cada vez que recarregar a página.

### Opção 3: Console do Navegador

1. Abra o DevTools (F12)
2. Vá para a aba "Console"
3. Cole o conteúdo do arquivo `hotkey-script.js`
4. Pressione Enter

**Nota:** Esta é a opção mais simples mas temporária - o script precisa ser colado novamente após recarregar a página.

## Configuração Inicial

Na primeira vez que usar:

1. Pressione `Ctrl+Shift+P` para abrir o popup
2. Expanda a seção "⚙️ Configurações da API"
3. Cole sua API Key da OpenAI (começa com `sk-...`)
4. Clique em "💾 Salvar Configurações"

A API Key é salva no localStorage do navegador e persiste entre sessões.

## Como Usar

1. **Selecione** o texto que deseja parafrasear
2. **Pressione** o atalho correspondente ao estilo desejado
3. **Aguarde** a paráfrase ser processada
4. O texto será **substituído automaticamente** ou **copiado** para a área de transferência

## Funciona em:

- ✅ Campos de texto (`<input>`, `<textarea>`)
- ✅ Editores ContentEditable
- ✅ Microsoft Teams (com algumas limitações)
- ✅ Gmail, Outlook Web, WhatsApp Web
- ✅ Qualquer página web

## Solução de Problemas

### O atalho não funciona
- Alguns sites podem bloquear atalhos. Tente usar `Ctrl+Shift+P` para abrir o popup.
- Verifique se o script está carregado olhando no console (deve mostrar "PARAPHRASE HOTKEYS - ATALHOS CARREGADOS")

### Erro de API
- Verifique se sua API Key está correta
- Certifique-se de ter créditos na sua conta OpenAI

### O texto não é substituído
- Em alguns sites (como Teams), a substituição direta pode não funcionar
- Nesse caso, o texto é copiado automaticamente - use `Ctrl+V` para colar

## Dicas

- Use `Ctrl+Shift+P` para ver a lista completa de atalhos a qualquer momento
- Os atalhos funcionam mesmo sem abrir o popup - selecione o texto e pressione diretamente
- O script detecta automaticamente se você está no Teams e usa estratégias especiais de substituição
