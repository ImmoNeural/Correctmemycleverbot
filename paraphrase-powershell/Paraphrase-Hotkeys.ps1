<#
.SYNOPSIS
    Paraphrase Hotkeys - Script PowerShell para parafrasear texto em alemao com hotkeys globais

.DESCRIPTION
    Este script registra atalhos de teclado globais que funcionam em QUALQUER aplicativo
    (Teams, Outlook, Word, etc.). Selecione texto, pressione a hotkey e o texto sera
    automaticamente parafraseado e substituido.

.NOTES
    Autor: CorrectMe CleverBot
    Versao: 1.0
    Requisitos: Windows PowerShell 5.1+ ou PowerShell 7+, .NET Framework

.EXAMPLE
    .\Paraphrase-Hotkeys.ps1

    Ou execute como administrador para melhor compatibilidade:
    Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -File .\Paraphrase-Hotkeys.ps1" -Verb RunAs

ATALHOS:
    Ctrl+Alt+1         = Formal / Profissional
    Ctrl+Alt+Shift+2   = Informal / Casual
    Ctrl+Alt+Shift+3   = Conciso / Resumido
    Ctrl+Alt+4         = Detalhado / Expandido
    Ctrl+Alt+5         = Criativo / Original
    Ctrl+Alt+6         = Simples / Facil de entender
    Ctrl+Alt+Shift+7   = Academico / Cientifico
    Ctrl+Alt+Shift+8   = Amigavel / Empatico
    Ctrl+Alt+0         = Configurar API Key
    Ctrl+Alt+9         = Sair do programa
#>

# ========================== CONFIGURACAO ==========================

# Arquivo de configuracao
$ConfigPath = Join-Path $env:APPDATA "ParaphraseHotkeys\config.json"

# Configuracao padrao
$DefaultConfig = @{
    ApiKey = ""
    ApiUrl = "https://api.openai.com/v1/chat/completions"
    Model = "gpt-4o-mini"
    ShowNotifications = $true
}

# Estilos de parafraseamento
$ParaphraseStyles = @(
    @{
        Id = "formal"
        Title = "Formal / Profissional"
        Emoji = "[F]"
        Hotkey = 1
        NeedsShift = $false
        Prompt = "Reescreva este texto EM ALEMAO em um tom formal e profissional, usando 'Sie' e vocabulario sofisticado. Mantenha o significado original. O resultado DEVE ser em alemao."
    },
    @{
        Id = "informal"
        Title = "Informal / Casual"
        Emoji = "[I]"
        Hotkey = 2
        NeedsShift = $true
        Prompt = "Reescreva este texto EM ALEMAO em um tom informal e casual, usando 'du' como se estivesse conversando com um amigo. O resultado DEVE ser em alemao."
    },
    @{
        Id = "concise"
        Title = "Conciso / Resumido"
        Emoji = "[C]"
        Hotkey = 3
        NeedsShift = $true
        Prompt = "Reescreva este texto EM ALEMAO de forma mais concisa e direta, removendo palavras desnecessarias. O resultado DEVE ser em alemao."
    },
    @{
        Id = "detailed"
        Title = "Detalhado / Expandido"
        Emoji = "[D]"
        Hotkey = 4
        NeedsShift = $false
        Prompt = "Expanda este texto EM ALEMAO com mais detalhes e explicacoes, tornando-o mais completo. O resultado DEVE ser em alemao."
    },
    @{
        Id = "creative"
        Title = "Criativo / Original"
        Emoji = "[R]"
        Hotkey = 5
        NeedsShift = $false
        Prompt = "Reescreva este texto EM ALEMAO de forma criativa e original, usando metaforas ou linguagem mais expressiva. O resultado DEVE ser em alemao."
    },
    @{
        Id = "simple"
        Title = "Simples / Facil"
        Emoji = "[S]"
        Hotkey = 6
        NeedsShift = $false
        Prompt = "Simplifique este texto EM ALEMAO para que seja facil de entender (nivel A2-B1). O resultado DEVE ser em alemao."
    },
    @{
        Id = "academic"
        Title = "Academico / Cientifico"
        Emoji = "[A]"
        Hotkey = 7
        NeedsShift = $true
        Prompt = "Reescreva este texto EM ALEMAO em um tom academico e cientifico, com linguagem tecnica apropriada. O resultado DEVE ser em alemao."
    },
    @{
        Id = "friendly"
        Title = "Amigavel / Empatico"
        Emoji = "[E]"
        Hotkey = 8
        NeedsShift = $true
        Prompt = "Reescreva este texto EM ALEMAO em um tom amigavel e empatico, demonstrando compreensao e cordialidade. O resultado DEVE ser em alemao."
    }
)

# ========================== ASSEMBLIES ==========================

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName PresentationFramework

# Importar APIs do Windows para hotkeys globais
# Check if the type already exists (from a previous run in the same session)
if (-not ([System.Management.Automation.PSTypeName]'GlobalHotkey').Type) {
    try {
        Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Windows.Forms;

public class GlobalHotkey {
    [DllImport("user32.dll")]
    public static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);

    [DllImport("user32.dll")]
    public static extern bool UnregisterHotKey(IntPtr hWnd, int id);

    public const uint MOD_ALT = 0x0001;
    public const uint MOD_CONTROL = 0x0002;
    public const uint MOD_SHIFT = 0x0004;
    public const uint MOD_WIN = 0x0008;
    public const uint MOD_NOREPEAT = 0x4000;

    // Virtual key codes for numbers
    public const uint VK_0 = 0x30;
    public const uint VK_1 = 0x31;
    public const uint VK_2 = 0x32;
    public const uint VK_3 = 0x33;
    public const uint VK_4 = 0x34;
    public const uint VK_5 = 0x35;
    public const uint VK_6 = 0x36;
    public const uint VK_7 = 0x37;
    public const uint VK_8 = 0x38;
    public const uint VK_9 = 0x39;
}

public class ClipboardHelper {
    [DllImport("user32.dll")]
    public static extern IntPtr GetOpenClipboardWindow();

    [DllImport("user32.dll")]
    public static extern int GetWindowThreadProcessId(IntPtr hWnd, out int lpdwProcessId);
}
"@ -ReferencedAssemblies System.Windows.Forms -ErrorAction Stop
    } catch {
        Write-Host "[ERRO] Falha ao compilar tipos nativos: $_" -ForegroundColor Red
        Write-Host "Detalhes do erro: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "Verifique se o .NET Framework esta instalado corretamente." -ForegroundColor Yellow
        Read-Host "Pressione Enter para sair"
        exit 1
    }
}

# Verify the type was loaded successfully
if (-not ([System.Management.Automation.PSTypeName]'GlobalHotkey').Type) {
    Write-Host "[ERRO] Tipo GlobalHotkey nao foi carregado corretamente." -ForegroundColor Red
    Write-Host "Tente reiniciar o PowerShell e executar novamente." -ForegroundColor Yellow
    Read-Host "Pressione Enter para sair"
    exit 1
}

# ========================== FUNCOES ==========================

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    Write-Host $logMessage

    # Tambem salvar em arquivo de log
    $logPath = Join-Path $env:APPDATA "ParaphraseHotkeys\log.txt"
    $logDir = Split-Path $logPath -Parent
    if (-not (Test-Path $logDir)) {
        New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    }
    Add-Content -Path $logPath -Value $logMessage -ErrorAction SilentlyContinue
}

function Get-Config {
    try {
        if (Test-Path $ConfigPath) {
            $config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
            return $config
        }
    } catch {
        Write-Log "Erro ao ler configuracao: $_" "ERROR"
    }
    return $DefaultConfig
}

function Save-Config {
    param($Config)
    try {
        $configDir = Split-Path $ConfigPath -Parent
        if (-not (Test-Path $configDir)) {
            New-Item -ItemType Directory -Path $configDir -Force | Out-Null
        }
        $Config | ConvertTo-Json | Set-Content $ConfigPath -Encoding UTF8
        Write-Log "Configuracao salva com sucesso"
    } catch {
        Write-Log "Erro ao salvar configuracao: $_" "ERROR"
    }
}

function Show-Notification {
    param(
        [string]$Title = "Paraphrase Hotkeys",
        [string]$Message,
        [string]$Type = "Info"  # Info, Warning, Error
    )

    $config = Get-Config
    if (-not $config.ShowNotifications) { return }

    try {
        # Usar balloon tip do system tray se disponivel
        if ($script:NotifyIcon) {
            $iconType = switch ($Type) {
                "Error" { [System.Windows.Forms.ToolTipIcon]::Error }
                "Warning" { [System.Windows.Forms.ToolTipIcon]::Warning }
                default { [System.Windows.Forms.ToolTipIcon]::Info }
            }
            $script:NotifyIcon.ShowBalloonTip(3000, $Title, $Message, $iconType)
        } else {
            # Fallback: Toast notification via PowerShell
            [System.Windows.Forms.MessageBox]::Show($Message, $Title, [System.Windows.Forms.MessageBoxButtons]::OK)
        }
    } catch {
        Write-Log "Erro ao mostrar notificacao: $_" "ERROR"
    }
}

function Get-SelectedText {
    <#
    .SYNOPSIS
        Captura o texto atualmente selecionado em qualquer aplicativo
    #>
    try {
        # Salvar o conteudo atual do clipboard
        $originalClipboard = $null
        try {
            $originalClipboard = [System.Windows.Forms.Clipboard]::GetText()
        } catch {}

        # Limpar clipboard
        [System.Windows.Forms.Clipboard]::Clear()
        Start-Sleep -Milliseconds 50

        # Simular Ctrl+C para copiar o texto selecionado
        [System.Windows.Forms.SendKeys]::SendWait("^c")
        Start-Sleep -Milliseconds 150

        # Pegar o texto copiado
        $selectedText = ""
        $retries = 3
        while ($retries -gt 0 -and [string]::IsNullOrEmpty($selectedText)) {
            Start-Sleep -Milliseconds 100
            try {
                $selectedText = [System.Windows.Forms.Clipboard]::GetText()
            } catch {}
            $retries--
        }

        # Restaurar clipboard original (se nao tinha texto selecionado)
        if ([string]::IsNullOrEmpty($selectedText) -and $originalClipboard) {
            try {
                [System.Windows.Forms.Clipboard]::SetText($originalClipboard)
            } catch {}
        }

        return $selectedText.Trim()
    } catch {
        Write-Log "Erro ao capturar texto selecionado: $_" "ERROR"
        return ""
    }
}

function Set-TextReplacement {
    param([string]$NewText)
    <#
    .SYNOPSIS
        Substitui o texto selecionado pelo novo texto
    #>
    try {
        # Copiar novo texto para clipboard
        [System.Windows.Forms.Clipboard]::SetText($NewText)
        Start-Sleep -Milliseconds 50

        # Simular Ctrl+V para colar
        [System.Windows.Forms.SendKeys]::SendWait("^v")
        Start-Sleep -Milliseconds 100

        Write-Log "Texto substituido com sucesso"
        return $true
    } catch {
        Write-Log "Erro ao substituir texto: $_" "ERROR"
        return $false
    }
}

function Invoke-ParaphraseAPI {
    param(
        [string]$Text,
        [string]$StylePrompt
    )

    $config = Get-Config

    if ([string]::IsNullOrEmpty($config.ApiKey)) {
        throw "API Key nao configurada! Use Ctrl+Alt+0 para configurar."
    }

    $apiUrl = if ($config.ApiUrl) { $config.ApiUrl } else { "https://api.openai.com/v1/chat/completions" }
    $model = if ($config.Model) { $config.Model } else { "gpt-4o-mini" }

    $headers = @{
        "Content-Type" = "application/json"
        "Authorization" = "Bearer $($config.ApiKey)"
    }

    $body = @{
        model = $model
        messages = @(
            @{
                role = "system"
                content = "Voce e um assistente especializado em parafrasear textos em ALEMAO. $StylePrompt IMPORTANTE: O texto de saida DEVE estar em alemao correto. Responda APENAS com o texto parafraseado em alemao, sem explicacoes adicionais."
            },
            @{
                role = "user"
                content = "Parafraseie o seguinte texto em alemao:`n`n$Text"
            }
        )
        temperature = 0.7
    } | ConvertTo-Json -Depth 10

    Write-Log "Chamando API: $apiUrl com modelo $model"

    try {
        $response = Invoke-RestMethod -Uri $apiUrl -Method Post -Headers $headers -Body $body -TimeoutSec 30
        $result = $response.choices[0].message.content.Trim()
        Write-Log "API respondeu com sucesso"
        return $result
    } catch {
        $errorMessage = $_.Exception.Message
        if ($_.Exception.Response) {
            try {
                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $errorBody = $reader.ReadToEnd()
                $errorMessage = "API Error: $errorBody"
            } catch {}
        }
        throw $errorMessage
    }
}

function Invoke-Paraphrase {
    param([hashtable]$Style)

    Write-Log "Iniciando parafraseamento: $($Style.Title)"

    # Capturar texto selecionado
    $selectedText = Get-SelectedText

    if ([string]::IsNullOrEmpty($selectedText)) {
        Show-Notification -Message "Nenhum texto selecionado! Selecione um texto primeiro." -Type "Warning"
        Write-Log "Nenhum texto selecionado" "WARNING"
        return
    }

    Write-Log "Texto capturado: $($selectedText.Substring(0, [Math]::Min(50, $selectedText.Length)))..."
    Show-Notification -Message "$($Style.Emoji) Parafraseando..." -Type "Info"

    try {
        # Chamar API
        $result = Invoke-ParaphraseAPI -Text $selectedText -StylePrompt $Style.Prompt

        # Substituir texto
        $success = Set-TextReplacement -NewText $result

        if ($success) {
            Show-Notification -Message "$($Style.Emoji) Texto substituido!" -Type "Info"
        } else {
            Show-Notification -Message "$($Style.Emoji) Copiado para clipboard. Use Ctrl+V para colar." -Type "Info"
        }
    } catch {
        $errorMsg = $_.Exception.Message
        Write-Log "Erro na parafraseacao: $errorMsg" "ERROR"
        Show-Notification -Message "Erro: $errorMsg" -Type "Error"
    }
}

function Show-ConfigDialog {
    Write-Log "Abrindo dialogo de configuracao"

    $config = Get-Config

    # Criar formulario de configuracao
    $form = New-Object System.Windows.Forms.Form
    $form.Text = "Paraphrase Hotkeys - Configuracao"
    $form.Size = New-Object System.Drawing.Size(450, 350)
    $form.StartPosition = "CenterScreen"
    $form.FormBorderStyle = "FixedDialog"
    $form.MaximizeBox = $false
    $form.MinimizeBox = $false
    $form.TopMost = $true

    # API Key
    $lblApiKey = New-Object System.Windows.Forms.Label
    $lblApiKey.Text = "API Key:"
    $lblApiKey.Location = New-Object System.Drawing.Point(20, 20)
    $lblApiKey.Size = New-Object System.Drawing.Size(100, 20)
    $form.Controls.Add($lblApiKey)

    $txtApiKey = New-Object System.Windows.Forms.TextBox
    $txtApiKey.Location = New-Object System.Drawing.Point(20, 45)
    $txtApiKey.Size = New-Object System.Drawing.Size(390, 25)
    $txtApiKey.Text = $config.ApiKey
    $txtApiKey.PasswordChar = '*'
    $form.Controls.Add($txtApiKey)

    # API URL
    $lblApiUrl = New-Object System.Windows.Forms.Label
    $lblApiUrl.Text = "API URL (opcional):"
    $lblApiUrl.Location = New-Object System.Drawing.Point(20, 80)
    $lblApiUrl.Size = New-Object System.Drawing.Size(200, 20)
    $form.Controls.Add($lblApiUrl)

    $txtApiUrl = New-Object System.Windows.Forms.TextBox
    $txtApiUrl.Location = New-Object System.Drawing.Point(20, 105)
    $txtApiUrl.Size = New-Object System.Drawing.Size(390, 25)
    $txtApiUrl.Text = if ($config.ApiUrl) { $config.ApiUrl } else { "https://api.openai.com/v1/chat/completions" }
    $form.Controls.Add($txtApiUrl)

    # Model
    $lblModel = New-Object System.Windows.Forms.Label
    $lblModel.Text = "Modelo:"
    $lblModel.Location = New-Object System.Drawing.Point(20, 140)
    $lblModel.Size = New-Object System.Drawing.Size(100, 20)
    $form.Controls.Add($lblModel)

    $cmbModel = New-Object System.Windows.Forms.ComboBox
    $cmbModel.Location = New-Object System.Drawing.Point(20, 165)
    $cmbModel.Size = New-Object System.Drawing.Size(200, 25)
    $cmbModel.DropDownStyle = "DropDownList"
    $cmbModel.Items.AddRange(@("gpt-4o-mini", "gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo", "claude-3-haiku-20240307", "claude-3-sonnet-20240229"))
    $currentModel = if ($config.Model) { $config.Model } else { "gpt-4o-mini" }
    $cmbModel.SelectedIndex = [Math]::Max(0, $cmbModel.Items.IndexOf($currentModel))
    $form.Controls.Add($cmbModel)

    # Mostrar notificacoes
    $chkNotify = New-Object System.Windows.Forms.CheckBox
    $chkNotify.Text = "Mostrar notificacoes"
    $chkNotify.Location = New-Object System.Drawing.Point(20, 200)
    $chkNotify.Size = New-Object System.Drawing.Size(200, 25)
    $chkNotify.Checked = if ($null -eq $config.ShowNotifications) { $true } else { $config.ShowNotifications }
    $form.Controls.Add($chkNotify)

    # Atalhos info
    $lblShortcuts = New-Object System.Windows.Forms.Label
    $lblShortcuts.Text = @"
ATALHOS:
Ctrl+Alt+1 = Formal    |  Ctrl+Alt+Shift+2 = Informal
Ctrl+Alt+Shift+3 = Conciso  |  Ctrl+Alt+4 = Detalhado
Ctrl+Alt+5 = Criativo  |  Ctrl+Alt+6 = Simples
Ctrl+Alt+Shift+7 = Academico  |  Ctrl+Alt+Shift+8 = Amigavel
"@
    $lblShortcuts.Location = New-Object System.Drawing.Point(20, 230)
    $lblShortcuts.Size = New-Object System.Drawing.Size(400, 60)
    $lblShortcuts.ForeColor = [System.Drawing.Color]::DarkGray
    $form.Controls.Add($lblShortcuts)

    # Botao Salvar
    $btnSave = New-Object System.Windows.Forms.Button
    $btnSave.Text = "Salvar"
    $btnSave.Location = New-Object System.Drawing.Point(230, 295)
    $btnSave.Size = New-Object System.Drawing.Size(80, 30)
    $btnSave.Add_Click({
        $newConfig = @{
            ApiKey = $txtApiKey.Text.Trim()
            ApiUrl = $txtApiUrl.Text.Trim()
            Model = $cmbModel.SelectedItem.ToString()
            ShowNotifications = $chkNotify.Checked
        }
        Save-Config -Config $newConfig
        Show-Notification -Message "Configuracoes salvas!" -Type "Info"
        $form.Close()
    })
    $form.Controls.Add($btnSave)

    # Botao Cancelar
    $btnCancel = New-Object System.Windows.Forms.Button
    $btnCancel.Text = "Cancelar"
    $btnCancel.Location = New-Object System.Drawing.Point(320, 295)
    $btnCancel.Size = New-Object System.Drawing.Size(80, 30)
    $btnCancel.Add_Click({ $form.Close() })
    $form.Controls.Add($btnCancel)

    $form.ShowDialog() | Out-Null
}

function Initialize-TrayIcon {
    # Criar icone na bandeja do sistema
    $script:NotifyIcon = New-Object System.Windows.Forms.NotifyIcon
    $script:NotifyIcon.Icon = [System.Drawing.SystemIcons]::Application
    $script:NotifyIcon.Text = "Paraphrase Hotkeys"
    $script:NotifyIcon.Visible = $true

    # Menu de contexto
    $contextMenu = New-Object System.Windows.Forms.ContextMenuStrip

    # Item de configuracao
    $configItem = New-Object System.Windows.Forms.ToolStripMenuItem
    $configItem.Text = "Configurar (Ctrl+Alt+0)"
    $configItem.Add_Click({ Show-ConfigDialog })
    $contextMenu.Items.Add($configItem)

    # Separador
    $contextMenu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))

    # Itens de estilo
    foreach ($style in $ParaphraseStyles) {
        $styleItem = New-Object System.Windows.Forms.ToolStripMenuItem
        $shortcutLabel = if ($style.NeedsShift) { "Ctrl+Alt+Shift+$($style.Hotkey)" } else { "Ctrl+Alt+$($style.Hotkey)" }
        $styleItem.Text = "$($style.Emoji) $($style.Title) ($shortcutLabel)"
        $styleItem.Tag = $style
        $styleItem.Add_Click({
            $clickedStyle = $this.Tag
            Invoke-Paraphrase -Style $clickedStyle
        })
        $contextMenu.Items.Add($styleItem)
    }

    # Separador
    $contextMenu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))

    # Item de sair
    $exitItem = New-Object System.Windows.Forms.ToolStripMenuItem
    $exitItem.Text = "Sair (Ctrl+Alt+9)"
    $exitItem.Add_Click({
        $script:Running = $false
        $script:NotifyIcon.Visible = $false
        [System.Windows.Forms.Application]::Exit()
    })
    $contextMenu.Items.Add($exitItem)

    $script:NotifyIcon.ContextMenuStrip = $contextMenu

    # Duplo-clique abre configuracao
    $script:NotifyIcon.Add_DoubleClick({ Show-ConfigDialog })

    Write-Log "Tray icon inicializado"
}

function Register-Hotkeys {
    param([IntPtr]$Handle)

    $registered = @()

    # Registrar hotkeys para cada estilo
    foreach ($style in $ParaphraseStyles) {
        $modifiers = [GlobalHotkey]::MOD_CONTROL -bor [GlobalHotkey]::MOD_ALT -bor [GlobalHotkey]::MOD_NOREPEAT
        if ($style.NeedsShift) {
            $modifiers = $modifiers -bor [GlobalHotkey]::MOD_SHIFT
        }

        $vk = [uint32]([GlobalHotkey]::"VK_$($style.Hotkey)")
        $id = $style.Hotkey

        $result = [GlobalHotkey]::RegisterHotKey($Handle, $id, $modifiers, $vk)
        if ($result) {
            Write-Log "Hotkey registrada: $($style.Title) (ID: $id)"
            $registered += $id
        } else {
            Write-Log "Falha ao registrar hotkey: $($style.Title) (ID: $id)" "WARNING"
        }
    }

    # Ctrl+Alt+0 = Configuracao
    $result = [GlobalHotkey]::RegisterHotKey($Handle, 0,
        [GlobalHotkey]::MOD_CONTROL -bor [GlobalHotkey]::MOD_ALT -bor [GlobalHotkey]::MOD_NOREPEAT,
        [GlobalHotkey]::VK_0)
    if ($result) {
        Write-Log "Hotkey registrada: Configuracao (ID: 0)"
        $registered += 0
    }

    # Ctrl+Alt+9 = Sair
    $result = [GlobalHotkey]::RegisterHotKey($Handle, 9,
        [GlobalHotkey]::MOD_CONTROL -bor [GlobalHotkey]::MOD_ALT -bor [GlobalHotkey]::MOD_NOREPEAT,
        [GlobalHotkey]::VK_9)
    if ($result) {
        Write-Log "Hotkey registrada: Sair (ID: 9)"
        $registered += 9
    }

    return $registered
}

function Unregister-Hotkeys {
    param(
        [IntPtr]$Handle,
        [int[]]$HotkeyIds
    )

    foreach ($id in $HotkeyIds) {
        [GlobalHotkey]::UnregisterHotKey($Handle, $id) | Out-Null
    }
    Write-Log "Todas as hotkeys desregistradas"
}

# ========================== MAIN ==========================

function Start-ParaphraseHotkeys {
    Write-Host ""
    Write-Host "======================================================"
    Write-Host "      PARAPHRASE HOTKEYS - Parafraseador em Alemao"
    Write-Host "======================================================"
    Write-Host ""
    Write-Host "ATALHOS DISPONIVEIS:"
    Write-Host "  Ctrl+Alt+1         = [F] Formal / Profissional"
    Write-Host "  Ctrl+Alt+Shift+2   = [I] Informal / Casual"
    Write-Host "  Ctrl+Alt+Shift+3   = [C] Conciso / Resumido"
    Write-Host "  Ctrl+Alt+4         = [D] Detalhado / Expandido"
    Write-Host "  Ctrl+Alt+5         = [R] Criativo / Original"
    Write-Host "  Ctrl+Alt+6         = [S] Simples / Facil"
    Write-Host "  Ctrl+Alt+Shift+7   = [A] Academico / Cientifico"
    Write-Host "  Ctrl+Alt+Shift+8   = [E] Amigavel / Empatico"
    Write-Host ""
    Write-Host "  Ctrl+Alt+0         = Configurar API Key"
    Write-Host "  Ctrl+Alt+9         = Sair do programa"
    Write-Host ""
    Write-Host "======================================================"
    Write-Host ""

    # Verificar se API Key esta configurada
    $config = Get-Config
    if ([string]::IsNullOrEmpty($config.ApiKey)) {
        Write-Host "[AVISO] API Key nao configurada!" -ForegroundColor Yellow
        Write-Host "        Use Ctrl+Alt+0 para configurar ou edite:" -ForegroundColor Yellow
        Write-Host "        $ConfigPath" -ForegroundColor Yellow
        Write-Host ""
    } else {
        Write-Host "[OK] API Key configurada" -ForegroundColor Green
        Write-Host ""
    }

    Write-Log "Iniciando Paraphrase Hotkeys..."

    # Criar uma janela oculta para receber mensagens de hotkey
    $form = New-Object System.Windows.Forms.Form
    $form.Text = "Paraphrase Hotkeys"
    $form.ShowInTaskbar = $false
    $form.WindowState = "Minimized"
    $form.FormBorderStyle = "FixedToolWindow"
    $form.Opacity = 0

    # Inicializar tray icon
    Initialize-TrayIcon

    # Registrar hotkeys
    $registeredHotkeys = Register-Hotkeys -Handle $form.Handle

    if ($registeredHotkeys.Count -eq 0) {
        Write-Host "[ERRO] Nenhuma hotkey foi registrada. Outra instancia pode estar rodando." -ForegroundColor Red
        return
    }

    Write-Host "Hotkeys registradas: $($registeredHotkeys.Count)" -ForegroundColor Green
    Write-Host ""
    Write-Host "O programa esta rodando na bandeja do sistema."
    Write-Host "Selecione texto em qualquer aplicativo e use os atalhos!"
    Write-Host ""

    # Handler de mensagens Windows
    $script:Running = $true

    # Processar mensagens de hotkey
    $form.Add_Load({
        # Esconder a janela completamente
        $this.Visible = $false
    })

    # Criar timer para processar mensagens
    $messageTimer = New-Object System.Windows.Forms.Timer
    $messageTimer.Interval = 100
    $messageTimer.Add_Tick({
        # Processar mensagens pendentes
        [System.Windows.Forms.Application]::DoEvents()
    })
    $messageTimer.Start()

    # Override WndProc para capturar WM_HOTKEY
    # Usando uma abordagem diferente com um filtro de mensagens

    $hotkeyHandler = {
        param($m)
        if ($m.Msg -eq 0x0312) {  # WM_HOTKEY
            $hotkeyId = $m.WParam.ToInt32()
            Write-Log "Hotkey detectada: ID $hotkeyId"

            switch ($hotkeyId) {
                0 {
                    # Configuracao
                    Show-ConfigDialog
                }
                9 {
                    # Sair
                    $script:Running = $false
                    $script:NotifyIcon.Visible = $false
                    $messageTimer.Stop()
                    Unregister-Hotkeys -Handle $form.Handle -HotkeyIds $registeredHotkeys
                    [System.Windows.Forms.Application]::Exit()
                }
                default {
                    # Parafrasear
                    $style = $ParaphraseStyles | Where-Object { $_.Hotkey -eq $hotkeyId }
                    if ($style) {
                        Invoke-Paraphrase -Style $style
                    }
                }
            }
        }
    }

    # Adicionar filtro de mensagens
    if (-not ([System.Management.Automation.PSTypeName]'HotkeyMessageFilter').Type) {
        try {
            Add-Type -TypeDefinition @"
using System;
using System.Windows.Forms;

public class HotkeyMessageFilter : IMessageFilter {
    public const int WM_HOTKEY = 0x0312;
    public event EventHandler<Message> HotkeyPressed;

    public bool PreFilterMessage(ref Message m) {
        if (m.Msg == WM_HOTKEY) {
            if (HotkeyPressed != null) {
                HotkeyPressed(this, m);
            }
        }
        return false;
    }
}
"@ -ReferencedAssemblies System.Windows.Forms -ErrorAction Stop
        } catch {
            Write-Log "Erro ao compilar HotkeyMessageFilter: $_" "ERROR"
        }
    }

    $messageFilter = New-Object HotkeyMessageFilter
    $messageFilter.add_HotkeyPressed({
        param($sender, $m)
        $hotkeyId = $m.WParam.ToInt32()
        Write-Log "Hotkey detectada: ID $hotkeyId"

        switch ($hotkeyId) {
            0 {
                Show-ConfigDialog
            }
            9 {
                $script:Running = $false
                $script:NotifyIcon.Visible = $false
                $messageTimer.Stop()
                Unregister-Hotkeys -Handle $form.Handle -HotkeyIds $registeredHotkeys
                [System.Windows.Forms.Application]::Exit()
            }
            default {
                $style = $ParaphraseStyles | Where-Object { $_.Hotkey -eq $hotkeyId }
                if ($style) {
                    Invoke-Paraphrase -Style $style
                }
            }
        }
    })

    [System.Windows.Forms.Application]::AddMessageFilter($messageFilter)

    # Mostrar notificacao inicial
    Show-Notification -Message "Hotkeys ativadas! Selecione texto e use os atalhos." -Type "Info"

    # Loop principal
    try {
        [System.Windows.Forms.Application]::Run($form)
    } finally {
        # Cleanup
        $messageTimer.Stop()
        Unregister-Hotkeys -Handle $form.Handle -HotkeyIds $registeredHotkeys
        if ($script:NotifyIcon) {
            $script:NotifyIcon.Visible = $false
            $script:NotifyIcon.Dispose()
        }
        [System.Windows.Forms.Application]::RemoveMessageFilter($messageFilter)
        Write-Log "Paraphrase Hotkeys encerrado"
    }
}

# Executar
Start-ParaphraseHotkeys
