# Top-level install script wrapper for AgentOS CLI on Windows
# Delegates to apps/agentos/scripts/install.ps1

$ErrorActionPreference = "Stop"

$ScriptDirectory = $PSScriptRoot
$TargetScript = Join-Path $ScriptDirectory "..\apps\agentos\scripts\install.ps1"

if (Test-Path $TargetScript) {
    & $TargetScript @args
} else {
    $InstallerUrl = "https://raw.githubusercontent.com/anishs1207/inqora/main/apps/agentos/scripts/install.ps1"
    Write-Host "Delegating to AgentOS installer from $InstallerUrl..." -ForegroundColor Cyan
    iwr -useb $InstallerUrl | iex
}
