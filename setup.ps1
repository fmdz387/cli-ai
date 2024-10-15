# Set execution policy to bypass for this session
Set-ExecutionPolicy Bypass -Scope Process -Force

# Draw CLI AI branding
Write-Host -ForegroundColor DarkYellow "   ____ _     ___    _    ___ "
Write-Host -ForegroundColor DarkYellow "  / ___| |   |_ _|  / \  |_ _|"
Write-Host -ForegroundColor DarkYellow " | |   | |    | |  / _ \  | | "
Write-Host -ForegroundColor DarkYellow " | |___| |___ | | / ___ \ | | "
Write-Host -ForegroundColor DarkYellow "  \____|_____|___/_/   \_|___|"

Write-Host "`nWelcome to CLI AI Assistant!`n" -ForegroundColor Cyan

# Check if the API key is provided
if ($args.Count -eq 0) {
    Write-Host "WARNING: API key not provided!" -ForegroundColor Red
    Write-Host "Usage: .\setup.ps1 `<your_anthropic_api_key`>" -ForegroundColor Yellow
    Write-Host "NOTE: Your API key is stored securely in your system's keyring and is not shared outside of this machine." -ForegroundColor Yellow
    exit 1
}

$apiKey = $args[0]

# Step 1: Set up environment
Write-Host "Step 1: Setting up environment" -ForegroundColor Yellow
$cliDir = "$HOME\.cli_ai_assistant"
if (-Not (Test-Path -Path $cliDir)) {
    New-Item -ItemType Directory -Path $cliDir | Out-Null
}

Invoke-WebRequest -Uri "https://raw.githubusercontent.com/fmdz387/cli-ai/refs/heads/master/ai_assistant.py" -OutFile "$cliDir\ai_assistant.py"
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/fmdz387/cli-ai/refs/heads/master/utils.py" -OutFile "$cliDir\utils.py"

# Step 2: Install dependencies
Write-Host "Step 2: Installing dependencies" -ForegroundColor Yellow
if (-Not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "Python not found. Installing Python..." -ForegroundColor Yellow
    # Install Python using winget
    winget install Python.Python.3.11
}

if (-Not (Get-Command pip -ErrorAction SilentlyContinue)) {
    Write-Host "pip not found. Installing pip..." -ForegroundColor Yellow
    # Install pip
    python -m ensurepip --upgrade
}

pip install anthropic pyreadline3 keyring keyrings.alt

# Step 3: Secure API key
Write-Host "Step 3: Securing API key" -ForegroundColor Yellow
$pythonScript = @"
import keyring
keyring.set_password('cli_ai_assistant', 'anthropic_api_key', '$apiKey')
"@
python -c $pythonScript

# Step 4: Configure CLI
Write-Host "Step 4: Configuring CLI" -ForegroundColor Yellow

# Add alias to PowerShell profile
$profilePath = $PROFILE
if (-Not (Test-Path -Path $profilePath)) {
    New-Item -ItemType File -Path $profilePath -Force | Out-Null
}

if (-Not (Select-String -Path $profilePath -Pattern "function s")) {
    Add-Content -Path $profilePath -Value "function s { python $cliDir\ai_assistant.py @args }"
}

# Print setup completion message
Write-Host "Setup complete!" -ForegroundColor Green

# Print usage information
Write-Host "`nUsage:" -ForegroundColor Yellow
Write-Host "  s <natural language command>" -ForegroundColor Cyan

# Print example
Write-Host "`nExample:" -ForegroundColor Yellow
Write-Host "  s show all docker images - " -ForegroundColor Cyan -NoNewline
Write-Host "-> docker images -a`n" -ForegroundColor Green

# Add colored note about API key security
Write-Host "NOTE: Your API key is stored securely in your system's keyring and is not shared outside of this machine." -ForegroundColor Yellow
