#!/bin/bash
# CLI AI Setup Script for Unix (Linux/macOS)
# Installs CLI AI globally with all dependencies

set -e

echo ""
echo "CLI AI Setup Script"
echo "==================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Check if Node.js is installed and version >= 20
echo -e "${YELLOW}Checking Node.js...${NC}"

NODE_VERSION=""
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    MAJOR_VERSION=$(echo $NODE_VERSION | sed 's/v//' | cut -d. -f1)

    if [ "$MAJOR_VERSION" -lt 20 ]; then
        echo -e "${RED}Node.js $NODE_VERSION is installed but version 20+ is required.${NC}"
        NODE_VERSION=""
    else
        echo -e "${GREEN}Node.js $NODE_VERSION is installed.${NC}"
    fi
fi

# Install Node.js if not available or version is too old
if [ -z "$NODE_VERSION" ]; then
    echo -e "${YELLOW}Node.js 20+ is not installed. Installing via nvm...${NC}"

    # Check if nvm is installed
    if [ -z "$NVM_DIR" ]; then
        export NVM_DIR="$HOME/.nvm"
    fi

    if [ -s "$NVM_DIR/nvm.sh" ]; then
        # Load nvm
        . "$NVM_DIR/nvm.sh"
    else
        # Install nvm
        echo -e "${YELLOW}Installing nvm...${NC}"
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash

        # Load nvm
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
    fi

    # Install Node.js LTS
    nvm install --lts
    nvm use --lts

    NODE_VERSION=$(node --version)
    if [ -n "$NODE_VERSION" ]; then
        echo -e "${GREEN}Node.js $NODE_VERSION installed successfully.${NC}"
    else
        echo -e "${RED}Failed to install Node.js. Please install manually from https://nodejs.org${NC}"
        exit 1
    fi
fi

echo ""

# Check if npm is available
echo -e "${YELLOW}Checking npm...${NC}"
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}npm $NPM_VERSION is available.${NC}"
else
    echo -e "${RED}npm is not available. Please reinstall Node.js.${NC}"
    exit 1
fi

echo ""

# Install CLI AI globally
echo -e "${YELLOW}Installing CLI AI...${NC}"

npm install -g @fmdz387/cli-ai

echo ""
echo -e "${GREEN}CLI AI installed successfully!${NC}"
echo ""
echo -e "${CYAN}Usage:${NC}"
echo "  s              # Start interactive session"
echo "  cli-ai         # Alternative command"
echo "  s --help       # Show help"
echo ""
