<#
.SYNOPSIS
    Instala atalhos para o Paraphrase Hotkeys na area de trabalho e menu iniciar

.DESCRIPTION
    Este script cria atalhos convenientes para iniciar o Paraphrase Hotkeys
    e opcionalmente configura para iniciar com o Windows.

.EXAMPLE
    .\Install-Shortcut.ps1
#>

param(
    [switch]$StartWithWindows,
    [switch]$Uninstall
)

$AppName = "Paraphrase Hotkeys"
$ScriptPath = Join-Path $PSScriptRoot "Paraphrase-Hotkeys.ps1"

# Funcao para criar atalho
function New-Shortcut {
    param(
        [string]$ShortcutPath,
        [string]$TargetPath,
        [string]$Arguments,
        [string]$WorkingDirectory,
        [string]$Description,
        [string]$IconLocation
    )

    $WshShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut($ShortcutPath)
    $Shortcut.TargetPath = $TargetPath
    $Shortcut.Arguments = $Arguments
    $Shortcut.WorkingDirectory = $WorkingDirectory
    $Shortcut.Description = $Description
    if ($IconLocation) { $Shortcut.IconLocation = $IconLocation }
    $Shortcut.Save()
}

# Desinstalar
if ($Uninstall) {
    Write-Host "Removendo atalhos do $AppName..."

    # Desktop
    $desktopPath = [Environment]::GetFolderPath("Desktop")
    $desktopShortcut = Join-Path $desktopPath "$AppName.lnk"
    if (Test-Path $desktopShortcut) {
        Remove-Item $desktopShortcut -Force
        Write-Host "  - Atalho da area de trabalho removido"
    }

    # Menu Iniciar
    $startMenuPath = [Environment]::GetFolderPath("StartMenu")
    $startMenuShortcut = Join-Path $startMenuPath "Programs\$AppName.lnk"
    if (Test-Path $startMenuShortcut) {
        Remove-Item $startMenuShortcut -Force
        Write-Host "  - Atalho do menu iniciar removido"
    }

    # Startup
    $startupPath = [Environment]::GetFolderPath("Startup")
    $startupShortcut = Join-Path $startupPath "$AppName.lnk"
    if (Test-Path $startupShortcut) {
        Remove-Item $startupShortcut -Force
        Write-Host "  - Inicializacao automatica removida"
    }

    Write-Host ""
    Write-Host "$AppName desinstalado com sucesso!"
    exit 0
}

Write-Host ""
Write-Host "======================================================"
Write-Host "       INSTALADOR - $AppName"
Write-Host "======================================================"
Write-Host ""

# Verificar se o script existe
if (-not (Test-Path $ScriptPath)) {
    Write-Host "[ERRO] Script nao encontrado: $ScriptPath" -ForegroundColor Red
    exit 1
}

$powershellPath = (Get-Command powershell.exe).Source
$arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ScriptPath`""

# Criar atalho na area de trabalho
Write-Host "Criando atalho na area de trabalho..."
$desktopPath = [Environment]::GetFolderPath("Desktop")
$desktopShortcut = Join-Path $desktopPath "$AppName.lnk"

New-Shortcut -ShortcutPath $desktopShortcut `
    -TargetPath $powershellPath `
    -Arguments $arguments `
    -WorkingDirectory $PSScriptRoot `
    -Description "Parafraseador de texto em alemao com hotkeys globais"

Write-Host "  [OK] $desktopShortcut" -ForegroundColor Green

# Criar atalho no menu iniciar
Write-Host "Criando atalho no menu iniciar..."
$startMenuPath = [Environment]::GetFolderPath("StartMenu")
$programsPath = Join-Path $startMenuPath "Programs"
$startMenuShortcut = Join-Path $programsPath "$AppName.lnk"

New-Shortcut -ShortcutPath $startMenuShortcut `
    -TargetPath $powershellPath `
    -Arguments $arguments `
    -WorkingDirectory $PSScriptRoot `
    -Description "Parafraseador de texto em alemao com hotkeys globais"

Write-Host "  [OK] $startMenuShortcut" -ForegroundColor Green

# Iniciar com Windows (opcional)
if ($StartWithWindows) {
    Write-Host "Configurando inicializacao automatica..."
    $startupPath = [Environment]::GetFolderPath("Startup")
    $startupShortcut = Join-Path $startupPath "$AppName.lnk"

    New-Shortcut -ShortcutPath $startupShortcut `
        -TargetPath $powershellPath `
        -Arguments $arguments `
        -WorkingDirectory $PSScriptRoot `
        -Description "Parafraseador de texto em alemao com hotkeys globais"

    Write-Host "  [OK] Iniciara automaticamente com o Windows" -ForegroundColor Green
}

Write-Host ""
Write-Host "======================================================"
Write-Host "            INSTALACAO CONCLUIDA!"
Write-Host "======================================================"
Write-Host ""
Write-Host "Voce pode iniciar o $AppName de duas formas:"
Write-Host "  1. Atalho na area de trabalho"
Write-Host "  2. Menu Iniciar > $AppName"
Write-Host ""

if (-not $StartWithWindows) {
    Write-Host "DICA: Para iniciar automaticamente com o Windows, execute:"
    Write-Host "      .\Install-Shortcut.ps1 -StartWithWindows"
    Write-Host ""
}

Write-Host "Para desinstalar, execute:"
Write-Host "      .\Install-Shortcut.ps1 -Uninstall"
Write-Host ""

# Perguntar se deseja iniciar agora
$response = Read-Host "Deseja iniciar o $AppName agora? (S/N)"
if ($response -match "^[Ss]") {
    Write-Host ""
    Write-Host "Iniciando $AppName..."
    Start-Process powershell -ArgumentList $arguments -WindowStyle Hidden
    Write-Host "O programa esta rodando na bandeja do sistema!"
}

Write-Host ""
Write-Host "Pressione qualquer tecla para sair..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
