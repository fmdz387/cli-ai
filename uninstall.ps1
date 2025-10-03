# CLI AI Assistant - Uninstall Script (Windows)
# This script removes all components of the CLI AI Assistant

Write-Host "CLI AI Assistant - Uninstall" -ForegroundColor Cyan
Write-Host "===============================" -ForegroundColor Cyan
Write-Host ""

$installDir = "$env:USERPROFILE\.cli_ai_assistant"

# Confirm uninstall
Write-Host "This will remove:" -ForegroundColor Yellow
Write-Host "  - Installation directory: $installDir" -ForegroundColor Yellow
Write-Host "  - Shell alias configuration (PowerShell profile)" -ForegroundColor Yellow
Write-Host "  - API key from keyring" -ForegroundColor Yellow
Write-Host ""

$confirm = Read-Host "Continue with uninstall? (y/N)"
if ($confirm -ne 'y' -and $confirm -ne 'Y') {
    Write-Host "Uninstall cancelled." -ForegroundColor Green
    exit 0
}

Write-Host ""

# Remove shell alias from PowerShell profile
Write-Host "[1/3] Removing shell alias..." -ForegroundColor Cyan

# Use $PROFILE variable (same as setup.ps1)
$profilePath = $PROFILE
if (Test-Path $profilePath) {
    $content = Get-Content $profilePath
    # Same pattern as setup: remove lines matching "function s.*cli_ai_assistant"
    if ($content -match "function s.*cli_ai_assistant") {
        # Backup
        $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
        $backupPath = "$profilePath.backup.$timestamp"
        Copy-Item $profilePath $backupPath

        # Remove the alias line (same logic as setup.ps1)
        $filteredContent = $content | Where-Object { $_ -notmatch "function s.*cli_ai_assistant" }
        $filteredContent | Set-Content $profilePath

        Write-Host "  ✓ Removed alias from PowerShell profile" -ForegroundColor Green
        Write-Host "    Backup saved: $(Split-Path -Leaf $backupPath)" -ForegroundColor Gray
    } else {
        Write-Host "  - No alias found in PowerShell profile" -ForegroundColor Gray
    }
} else {
    Write-Host "  - PowerShell profile not found" -ForegroundColor Gray
}

# Remove API key from keyring
Write-Host "[2/3] Removing API key from keyring..." -ForegroundColor Cyan
try {
    python -c "import keyring; keyring.delete_password('cli_ai_assistant', 'anthropic_api_key')" 2>$null
    Write-Host "  ✓ API key removed from keyring" -ForegroundColor Green
} catch {
    Write-Host "  - No API key found in keyring" -ForegroundColor Gray
}

# Remove installation directory
Write-Host "[3/3] Removing installation directory..." -ForegroundColor Cyan
if (Test-Path $installDir) {
    Remove-Item -Path $installDir -Recurse -Force
    Write-Host "  ✓ Removed $installDir" -ForegroundColor Green
} else {
    Write-Host "  - Installation directory not found" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Uninstall complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Note: Please restart your shell for alias removal to take effect." -ForegroundColor Yellow
Write-Host "Note: Python packages (anthropic, keyring) were not removed." -ForegroundColor Yellow
Write-Host "      Run 'pip uninstall anthropic keyring keyrings.alt' to remove them manually." -ForegroundColor Yellow
