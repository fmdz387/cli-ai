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
Write-Host -ForegroundColor DarkYellow "  / ___| |   |_ _|   / \  |_ _|"
Write-Host -ForegroundColor DarkYellow " | |   | |    | |   / _ \  | | "
Write-Host -ForegroundColor DarkYellow " | |___| |___ | |  / ___ \ | | "
Write-Host -ForegroundColor DarkYellow "  \____|_____|___ /_/   \_|___|"

Write-Host "`nWelcome to CLI AI Assistant!`n" -ForegroundColor Cyan

# Check if this is an update or fresh install
$cliDir = "$HOME\.cli_ai_assistant"
if (Test-Path -Path $cliDir) {
    Write-Host "Detected existing CLI AI Assistant installation." -ForegroundColor Cyan
    Write-Host "This will update your installation with the latest files from GitHub." -ForegroundColor Yellow
    $confirmUpdate = Read-Host "Continue with update? (y/N)"
    if ($confirmUpdate -notmatch "^[Yy]$") {
        Write-Host "Update cancelled." -ForegroundColor Red
        exit 0
    }
    $isUpdate = $true
    Write-Host "Proceeding with update..." -ForegroundColor Green
} else {
    $isUpdate = $false
    Write-Host "Proceeding with fresh installation..." -ForegroundColor Green
}

# Securely prompt for API key for fresh installs or if keyring fails
$apiKeyPlain = ""
if (-not $isUpdate) {
    $apiKey = Read-Host -Prompt "Enter your Anthropic API key" -AsSecureString
    $apiKeyPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($apiKey))
} else {
    # For updates, try to preserve existing API key
    Write-Host "Preserving existing API key..." -ForegroundColor Cyan
    # We'll handle this in the API key step
}

# Step 1: Set up environment
Write-Host "Step 1: Setting up environment" -ForegroundColor Yellow

if ($isUpdate) {
    Write-Host "Backing up existing configuration..." -ForegroundColor Cyan
    # Backup config if it exists
    if (Test-Path -Path "$cliDir\config") {
        Copy-Item -Path "$cliDir\config" -Destination "$cliDir\config.backup" -Force
        Write-Host "Configuration backed up to config.backup" -ForegroundColor Green
    }
    
    Write-Host "Removing old files..." -ForegroundColor Cyan
    # Remove old Python files but keep config
    Remove-Item -Path "$cliDir\*.py" -Force -ErrorAction SilentlyContinue
} else {
    if (-Not (Test-Path -Path $cliDir)) {
        New-Item -ItemType Directory -Path $cliDir | Out-Null
    }
}

# Secure download with error handling
try {
    Write-Host "Downloading fresh files from GitHub..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri "https://raw.githubusercontent.com/fmdz387/cli-ai/refs/heads/master/utils.py" -OutFile "$cliDir\utils.py"
    
    Write-Host "Downloading enhanced UI components..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri "https://raw.githubusercontent.com/fmdz387/cli-ai/refs/heads/master/ui.py" -OutFile "$cliDir\ui.py"
    Invoke-WebRequest -Uri "https://raw.githubusercontent.com/fmdz387/cli-ai/refs/heads/master/assistant.py" -OutFile "$cliDir\assistant.py"
    Invoke-WebRequest -Uri "https://raw.githubusercontent.com/fmdz387/cli-ai/refs/heads/master/cross_platform_utils.py" -OutFile "$cliDir\cross_platform_utils.py"
    Invoke-WebRequest -Uri "https://raw.githubusercontent.com/fmdz387/cli-ai/refs/heads/master/launcher.py" -OutFile "$cliDir\launcher.py"
    
    Write-Host "All files downloaded successfully!" -ForegroundColor Green
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

# Install enhanced dependencies for better UI experience
Write-Host "Installing Python packages..." -ForegroundColor Cyan
pip install anthropic pyreadline3 keyring keyrings.alt colorama

# Step 3: Secure API key
Write-Host "Step 3: Securing API key" -ForegroundColor Yellow
if ($isUpdate) {
    # Check if API key exists in keyring
    $checkKeyScript = @"
try:
    import keyring
    key = keyring.get_password('cli_ai_assistant', 'anthropic_api_key')
    print('exists' if key else 'none')
except:
    print('none')
"@
    $existingKey = python -c $checkKeyScript
    
    if ($existingKey -eq "exists") {
        Write-Host "Existing API key preserved" -ForegroundColor Green
    } else {
        $apiKey = Read-Host -Prompt "No API key found. Enter your Anthropic API key" -AsSecureString
        $apiKeyPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($apiKey))
        if ([string]::IsNullOrEmpty($apiKeyPlain)) {
            Write-Host "API key required for setup" -ForegroundColor Red
            exit 1
        }
        $pythonScript = @"
import keyring
keyring.set_password('cli_ai_assistant', 'anthropic_api_key', '$apiKeyPlain')
"@
        python -c $pythonScript
        Write-Host "API key stored securely" -ForegroundColor Green
    }
} else {
    $pythonScript = @"
import keyring
keyring.set_password('cli_ai_assistant', 'anthropic_api_key', '$apiKeyPlain')
"@
    python -c $pythonScript
    Write-Host "API key stored securely" -ForegroundColor Green
}

# Step 4: Configure enhanced settings
Write-Host "Step 4: Configuring enhanced settings" -ForegroundColor Yellow

if ($isUpdate -and (Test-Path -Path "$cliDir\config.backup")) {
    Write-Host "Restoring previous configuration..." -ForegroundColor Cyan
    Move-Item -Path "$cliDir\config.backup" -Destination "$cliDir\config" -Force
    Write-Host "Previous configuration restored" -ForegroundColor Green
} elseif (-not (Test-Path -Path "$cliDir\config")) {
    Write-Host "Creating default configuration..." -ForegroundColor Cyan
    # Create enhanced configuration
    $configContent = @"
AI_ASSISTANT_SKIP_CONFIRM=false
AI_DIRECTORY_TREE_CONTEXT=true
AI_ASSISTANT_SHOW_EXPLANATIONS=true
AI_ASSISTANT_MAX_ALTERNATIVES=3
AI_ASSISTANT_ENABLE_SYNTAX_HIGHLIGHTING=true
AI_ASSISTANT_ENABLE_COMMAND_HISTORY=true
AI_ASSISTANT_SAFETY_LEVEL=medium
"@
    $configContent | Out-File -FilePath "$cliDir\config" -Encoding UTF8
    Write-Host "Default configuration created" -ForegroundColor Green
} else {
    Write-Host "Existing configuration preserved" -ForegroundColor Green
}

# Step 5: Configure CLI
Write-Host "Step 5: Configuring CLI aliases" -ForegroundColor Yellow

# Add enhanced alias to PowerShell profile
$profilePath = $PROFILE
if (-Not (Test-Path -Path $profilePath)) {
    New-Item -ItemType File -Path $profilePath -Force | Out-Null
}

# Remove any existing CLI AI Assistant functions
if (Test-Path -Path $profilePath) {
    $content = Get-Content $profilePath
    $filteredContent = $content | Where-Object { $_ -notmatch "function s.*cli_ai_assistant" }
    $filteredContent | Set-Content $profilePath
}

# Add fresh launcher function
$functionLine = "function s { python $cliDir\launcher.py @args }"
Add-Content -Path $profilePath -Value $functionLine
Write-Host "PowerShell function configured" -ForegroundColor Green

# Print setup completion message
if ($isUpdate) {
    Write-Host "`n*** CLI AI Assistant Update Complete! ***" -ForegroundColor Green
    Write-Host "All files have been updated with the latest versions from GitHub." -ForegroundColor Cyan
} else {
    Write-Host "`n*** CLI AI Assistant Setup Complete! ***" -ForegroundColor Green
}

# Print usage information
Write-Host "`nUsage:" -ForegroundColor Yellow
Write-Host "  s -natural language command-   - Use AI assistant" -ForegroundColor Cyan

# Print enhanced features
Write-Host "`nEnhanced Features:" -ForegroundColor Yellow
Write-Host "  - Interactive command preview with syntax highlighting" -ForegroundColor White
Write-Host "  - Gesture-based controls (Enter, Tab, Ctrl+A, Esc, etc.)" -ForegroundColor White
Write-Host "  - Alternative command suggestions" -ForegroundColor White
Write-Host "  - Risk assessment and safety warnings" -ForegroundColor White
Write-Host "  - Cross-platform clipboard support" -ForegroundColor White

# Print gesture controls
Write-Host "`nGesture Controls:" -ForegroundColor Yellow
Write-Host "  Enter       Execute command" -ForegroundColor Cyan
Write-Host "  Tab         Accept command and copy/paste to terminal if focused" -ForegroundColor Cyan
Write-Host "  Ctrl+A      Show alternatives" -ForegroundColor Cyan
Write-Host "  Esc         Cancel" -ForegroundColor Cyan

# Print examples
Write-Host "`nExamples:" -ForegroundColor Yellow
Write-Host "  s `"show docker containers`"" -ForegroundColor Cyan
Write-Host "  s `"show directory tree with permissions`"" -ForegroundColor Cyan

# Add colored note about API key security
Write-Host "`nNOTE: Your API key is stored securely in your system's keyring and is not shared outside of this machine." -ForegroundColor Yellow

Write-Host "`nRestart your PowerShell session to use the 's' command!" -ForegroundColor Magenta
