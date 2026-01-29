# Paraphrase Hotkeys - PowerShell Edition

Script PowerShell para parafrasear texto em alemao com **hotkeys globais** que funcionam em **qualquer aplicativo** do Windows (Teams, Outlook, Word, etc.).

## Como Funciona

1. Selecione qualquer texto em qualquer aplicativo
2. Pressione a hotkey desejada (ex: `Ctrl+Alt+1` para formal)
3. O texto sera automaticamente substituido pela versao parafraseada!

## Requisitos

- Windows 10/11
- PowerShell 5.1 ou superior (ja vem instalado no Windows)
- API Key da OpenAI ou servico compativel

## Instalacao Rapida

### Opcao 1: Executar Direto

1. Clique duas vezes em `Start-Paraphrase.bat`
2. Use `Ctrl+Alt+0` para configurar sua API Key
3. Pronto!

### Opcao 2: Instalar Atalhos

```powershell
# Abra o PowerShell na pasta do script e execute:
.\Install-Shortcut.ps1

# Para iniciar automaticamente com o Windows:
.\Install-Shortcut.ps1 -StartWithWindows
```

## Atalhos Disponiveis

| Atalho | Estilo | Descricao |
|--------|--------|-----------|
| `Ctrl+Alt+1` | Formal | Tom profissional usando "Sie" |
| `Ctrl+Alt+Shift+2` | Informal | Tom casual usando "du" |
| `Ctrl+Alt+Shift+3` | Conciso | Versao resumida e direta |
| `Ctrl+Alt+4` | Detalhado | Versao expandida com mais detalhes |
| `Ctrl+Alt+5` | Criativo | Linguagem mais expressiva e original |
| `Ctrl+Alt+6` | Simples | Nivel A2-B1, facil de entender |
| `Ctrl+Alt+Shift+7` | Academico | Tom cientifico e tecnico |
| `Ctrl+Alt+Shift+8` | Amigavel | Tom empatico e cordial |
| `Ctrl+Alt+0` | Config | Abre janela de configuracao |
| `Ctrl+Alt+9` | Sair | Encerra o programa |

## Configuracao

### Via Interface Grafica

1. Pressione `Ctrl+Alt+0` ou clique duas vezes no icone na bandeja
2. Insira sua API Key
3. Escolha o modelo (gpt-4o-mini recomendado)
4. Clique em "Salvar"

### Via Arquivo de Configuracao

O arquivo de configuracao fica em:
```
%APPDATA%\ParaphraseHotkeys\config.json
```

Exemplo:
```json
{
    "ApiKey": "sk-...",
    "ApiUrl": "https://api.openai.com/v1/chat/completions",
    "Model": "gpt-4o-mini",
    "ShowNotifications": true
}
```

## Usando com Claude/Anthropic

Voce pode usar a API do Claude em vez do OpenAI:

1. Abra a configuracao (`Ctrl+Alt+0`)
2. Em "API URL", coloque: `https://api.anthropic.com/v1/messages`
3. Em "API Key", coloque sua chave da Anthropic
4. Escolha um modelo Claude (ex: `claude-3-haiku-20240307`)

**Nota:** O formato da API do Claude e um pouco diferente. Se tiver problemas, use um proxy OpenAI-compativel ou mantenha o OpenAI.

## Resolucao de Problemas

### "Nenhum texto selecionado"
- Certifique-se de ter texto selecionado antes de pressionar a hotkey
- Alguns aplicativos podem bloquear a captura do clipboard

### Hotkeys nao funcionam
- Verifique se o programa esta rodando (icone na bandeja do sistema)
- Outra aplicacao pode estar usando os mesmos atalhos
- Tente executar como administrador

### Erro de API
- Verifique se a API Key esta correta
- Verifique sua conexao com a internet
- Verifique se tem creditos na sua conta OpenAI

### Texto nao e substituido
- Alguns aplicativos (como Teams) podem ter restricoes
- O texto sera copiado para o clipboard - use Ctrl+V para colar

## Logs

Os logs sao salvos em:
```
%APPDATA%\ParaphraseHotkeys\log.txt
```

## Desinstalar

```powershell
.\Install-Shortcut.ps1 -Uninstall
```

Ou simplesmente:
1. Feche o programa (`Ctrl+Alt+9`)
2. Delete a pasta `paraphrase-powershell`
3. Delete a pasta `%APPDATA%\ParaphraseHotkeys`

## Comparacao: PowerShell vs Extensao do Navegador

| Caracteristica | PowerShell | Extensao |
|----------------|------------|----------|
| Funciona no Teams Desktop | Sim | Nao |
| Funciona no Teams Web | Sim | Sim |
| Funciona no Outlook Desktop | Sim | Nao |
| Funciona no Word | Sim | Nao |
| Requer instalacao | Nao | Sim (Tampermonkey) |
| Inicia com Windows | Opcional | Com navegador |

## Licenca

MIT License - Use livremente!
