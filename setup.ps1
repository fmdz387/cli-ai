# CLI AI Setup Script for Windows (PowerShell)
# Installs CLI AI globally with all dependencies

$ErrorActionPreference = "Stop"

Write-Host "CLI AI Setup Script" -ForegroundColor Cyan
Write-Host "===================" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
Write-Host "Checking Node.js..." -ForegroundColor Yellow

$nodeVersion = $null
try {
    $nodeVersion = (node --version 2>$null)
    if ($nodeVersion) {
        $majorVersion = [int]($nodeVersion -replace 'v', '' -split '\.')[0]
        if ($majorVersion -lt 20) {
            Write-Host "Node.js $nodeVersion is installed but version 20+ is required." -ForegroundColor Red
            $nodeVersion = $null
        } else {
            Write-Host "Node.js $nodeVersion is installed." -ForegroundColor Green
        }
    }
} catch {
    $nodeVersion = $null
}

if (-not $nodeVersion) {
    Write-Host "Node.js 20+ is not installed. Installing via winget..." -ForegroundColor Yellow

    try {
        winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements

        # Refresh PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

        $nodeVersion = (node --version 2>$null)
        if ($nodeVersion) {
            Write-Host "Node.js $nodeVersion installed successfully." -ForegroundColor Green
        } else {
            Write-Host "Failed to install Node.js. Please install manually from https://nodejs.org" -ForegroundColor Red
            exit 1
        }
    } catch {
        Write-Host "Failed to install Node.js via winget. Please install manually from https://nodejs.org" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""

# Check if npm is available
Write-Host "Checking npm..." -ForegroundColor Yellow
try {
    $npmVersion = (npm --version 2>$null)
    Write-Host "npm $npmVersion is available." -ForegroundColor Green
} catch {
    Write-Host "npm is not available. Please reinstall Node.js." -ForegroundColor Red
    exit 1
}

Write-Host ""

# Install CLI AI globally
Write-Host "Installing CLI AI..." -ForegroundColor Yellow

try {
    npm install -g @fmdz387/cli-ai
    Write-Host ""
    Write-Host "CLI AI installed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Usage:" -ForegroundColor Cyan
    Write-Host "  s              # Start interactive session"
    Write-Host "  cli-ai         # Alternative command"
    Write-Host "  s --help       # Show help"
    Write-Host ""
} catch {
    Write-Host "Failed to install CLI AI. Error: $_" -ForegroundColor Red
    exit 1
}
