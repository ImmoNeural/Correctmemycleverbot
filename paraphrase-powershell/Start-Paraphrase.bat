@echo off
title Paraphrase Hotkeys - Iniciando...

:: ============================================================
:: PARAPHRASE HOTKEYS - Launcher
:: Parafraseador de texto em alemao com hotkeys globais
:: ============================================================

echo.
echo ======================================================
echo       PARAPHRASE HOTKEYS - Parafraseador em Alemao
echo ======================================================
echo.

:: Verificar se PowerShell esta disponivel
where powershell >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] PowerShell nao encontrado!
    echo        Instale o PowerShell para usar este script.
    pause
    exit /b 1
)

:: Obter diretorio do script
set "SCRIPT_DIR=%~dp0"

:: Executar o script PowerShell
echo Iniciando Paraphrase Hotkeys...
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%Paraphrase-Hotkeys.ps1"

:: Se chegou aqui, o script terminou
echo.
echo Paraphrase Hotkeys encerrado.
pause
