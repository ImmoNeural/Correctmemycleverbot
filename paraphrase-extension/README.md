# Parafraseador de Texto - Extensao para Chrome/Edge

Extensao de navegador que permite parafrasear qualquer texto selecionado com diferentes estilos diretamente pelo menu de contexto (botao direito).

## Funcionalidades

- **Menu de Contexto**: Selecione texto, clique com botao direito e escolha "Parafrasear texto"
- **8 Estilos de Parafrase**:
  - Formal / Profissional
  - Informal / Casual
  - Conciso / Resumido
  - Detalhado / Expandido
  - Criativo / Original
  - Simples / Facil de entender
  - Academico / Cientifico
  - Amigavel / Empatico
- **Atalhos de Teclado**:
  - `Ctrl+Shift+P`: Abre popup com todos os estilos
  - `AltGr+1-8`: Parafraseia e substitui automaticamente (sem popup)
- **Copiar ou Substituir**: Copie o resultado ou substitua o texto original diretamente

## Como Instalar

### Passo 1: Criar os icones

Antes de instalar, voce precisa criar os icones PNG. Use qualquer editor de imagem para criar:

1. `icons/icon16.png` (16x16 pixels)
2. `icons/icon48.png` (48x48 pixels)
3. `icons/icon128.png` (128x128 pixels)

Sugestao: Um quadrado com gradiente roxo/azul e a letra "P" no centro.

Ou voce pode converter os SVGs da pasta icons para PNG usando ferramentas online como:
- https://svgtopng.com/
- https://cloudconvert.com/svg-to-png

### Passo 2: Carregar a extensao no Chrome/Edge

1. Abra o navegador Chrome ou Edge
2. Digite na barra de endereco:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
3. Ative o **Modo de desenvolvedor** (canto superior direito)
4. Clique em **Carregar sem compactacao** (ou "Load unpacked")
5. Selecione a pasta `paraphrase-extension`
6. Pronto! A extensao esta instalada

### Passo 3: Configurar a API

1. Clique no icone da extensao na barra de ferramentas
2. Insira sua **API Key** (OpenAI ou compativel)
3. Opcionalmente, altere a URL da API se usar outro provedor
4. Clique em "Salvar Configuracoes"

## Como Usar

### Metodo 1: Menu de Contexto
1. Selecione qualquer texto em uma pagina web
2. Clique com o botao direito do mouse
3. Escolha "Parafrasear texto" > Selecione o estilo desejado
4. Um popup aparecera com o texto parafraseado
5. Clique em "Copiar" ou "Substituir"

### Metodo 2: Atalho de Teclado (Popup)
1. Selecione qualquer texto
2. Pressione `Ctrl+Shift+P`
3. Escolha o estilo no popup que aparecer

### Metodo 3: Atalhos Diretos (Substituicao Automatica)
Selecione texto e pressione o atalho para parafrasear e substituir automaticamente:

| Atalho | Estilo |
|--------|--------|
| `AltGr+1` | Formal / Profissional |
| `AltGr+2` | Informal / Casual |
| `AltGr+3` | Conciso / Resumido |
| `AltGr+4` | Detalhado / Expandido |
| `AltGr+5` | Criativo / Original |
| `AltGr+6` | Simples / Facil de entender |
| `AltGr+7` | Academico / Cientifico |
| `AltGr+8` | Amigavel / Empatico |

**Nota**: O texto sera substituido diretamente em campos editaveis (Teams, Gmail, etc). Em areas nao editaveis, o resultado e copiado para a area de transferencia.

**Dica**: A tecla AltGr fica a direita da barra de espaco no teclado.

## APIs Compativeis

Esta extensao funciona com qualquer API compativel com o formato OpenAI:

- **OpenAI** (padrao): `https://api.openai.com/v1/chat/completions`
- **Azure OpenAI**: Sua URL do Azure
- **Outros provedores**: Groq, Together, Anyscale, etc.

## Privacidade

- Sua API key e salva **localmente** no seu navegador
- Nenhum dado e enviado para servidores terceiros (exceto a API que voce configurar)
- A extensao nao coleta nem armazena seus textos

## Problemas Comuns

### "Configure sua API Key"
Voce precisa configurar uma API key valida. Clique no icone da extensao e insira sua chave.

### Erro de API
Verifique se:
- Sua API key esta correta
- Voce tem creditos/saldo na API
- A URL da API esta correta

### O menu nao aparece
Certifique-se de que ha texto selecionado antes de clicar com o botao direito.

## Desenvolvimento

Para modificar a extensao:

1. Faca as alteracoes nos arquivos
2. Va para `chrome://extensions`
3. Clique no botao de recarregar da extensao
4. Teste as alteracoes

## Licenca

MIT License - Use livremente!
