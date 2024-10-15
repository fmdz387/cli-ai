# Copyright 2024 Fahir M.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# Set execution policy to bypass for this session
Set-ExecutionPolicy Bypass -Scope Process -Force

# Draw CLI AI branding
Write-Host -ForegroundColor DarkYellow "   ____ _     ___    _    ___ "
Write-Host -ForegroundColor DarkYellow "  / ___| |   |_ _|  / \  |_ _|"
Write-Host -ForegroundColor DarkYellow " | |   | |    | |  / _ \  | | "
Write-Host -ForegroundColor DarkYellow " | |___| |___ | | / ___ \ | | "
Write-Host -ForegroundColor DarkYellow "  \____|_____|___/_/   \_|___|"

Write-Host "`nWelcome to CLI AI Assistant!`n" -ForegroundColor Cyan

# Securely prompt for API key
$apiKey = Read-Host -Prompt "Enter your Anthropic API key" -AsSecureString
$apiKeyPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($apiKey))

# Step 1: Set up environment
Write-Host "Step 1: Setting up environment" -ForegroundColor Yellow
$cliDir = "$HOME\.cli_ai_assistant"
if (-Not (Test-Path -Path $cliDir)) {
    New-Item -ItemType Directory -Path $cliDir | Out-Null
}

# Secure download with error handling
try {
    Invoke-WebRequest -Uri "https://raw.githubusercontent.com/fmdz387/cli-ai/refs/heads/master/ai_assistant.py" -OutFile "$cliDir\ai_assistant.py"
    Invoke-WebRequest -Uri "https://raw.githubusercontent.com/fmdz387/cli-ai/refs/heads/master/utils.py" -OutFile "$cliDir\utils.py"
} catch {
    Write-Host "Error downloading files: $_" -ForegroundColor Red
    exit 1
}

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
keyring.set_password('cli_ai_assistant', 'anthropic_api_key', '$apiKeyPlain')
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
