#!/bin/bash
security_note="\n\e[33mNOTE: \e[0mYour API key is stored securely in your system's keyring and is not shared outside of this machine."

# ASCII art as a multi-line string
cat << "EOF"


	 ██████╗██╗     ██╗     █████╗ ██╗
	██╔════╝██║     ██║    ██╔══██╗██║
	██║     ██║     ██║    ███████║██║
	██║     ██║     ██║    ██╔══██║██║
	╚██████╗███████╗██║    ██║  ██║██║
	 ╚═════╝╚══════╝╚═╝    ╚═╝  ╚═╝╚═╝
EOF

echo -e "\nWelcome to CLI AI Assistant!\n"

# Check if this is an update or fresh install
if [ -d ~/.cli_ai_assistant ] && [ -f ~/.cli_ai_assistant/launcher.py ]; then
    echo -e "\e[36mDetected existing CLI AI Assistant installation.\e[0m"
    echo -e "\e[33mThis will update your installation with the latest files from GitHub.\e[0m"
    read -p "Continue with update? (y/N): " confirm_update
    if [[ ! "$confirm_update" =~ ^[Yy]$ ]]; then
        echo -e "\e[31mUpdate cancelled.\e[0m"
        exit 0
    fi
    IS_UPDATE=true
    echo -e "\e[32mProceeding with update...\e[0m"
else
    IS_UPDATE=false
    echo -e "\e[32mProceeding with fresh installation...\e[0m"
fi

# Prompt for API key for fresh installs or if keyring fails
api_key=""
if [ "$IS_UPDATE" = false ]; then
    read -sp "Enter your API key: " api_key
    echo

    # Check if the API key is provided
    if [ -z "$api_key" ]; then
        echo -e "\e[31mWARNING: API key not provided!\e[0m"
        exit 1
    fi
else
    # For updates, try to preserve existing API key
    echo -e "\e[36mPreserving existing API key...\e[0m"
fi

# Define colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
MAGENTA='\033[1;35m'
NC='\033[0m'

# Step 1: Set up environment
echo -e "${YELLOW}Step 1: Setting up environment${NC}"

if [ "$IS_UPDATE" = true ]; then
    echo -e "${CYAN}Backing up existing configuration...${NC}"
    if [ -f ~/.cli_ai_assistant/config ]; then
        cp ~/.cli_ai_assistant/config ~/.cli_ai_assistant/config.backup
        echo -e "${GREEN}Configuration backed up${NC}"
    fi

    echo -e "${CYAN}Removing old files...${NC}"
    rm -f ~/.cli_ai_assistant/*.py

    if [ -d ~/.cli_ai_assistant/venv ]; then
        echo -e "${CYAN}Updating venv packages...${NC}"
        source ~/.cli_ai_assistant/venv/bin/activate 2>/dev/null && {
            pip install --upgrade pip --quiet 2>/dev/null
            pip install --upgrade anthropic keyring keyrings.alt colorama --quiet 2>/dev/null
            deactivate
        }
    fi
else
    mkdir -p ~/.cli_ai_assistant
fi

# Download files
echo -e "${CYAN}Downloading files from GitHub...${NC}"
curl -sSL https://raw.githubusercontent.com/fmdz387/cli-ai/refs/heads/master/utils.py -o ~/.cli_ai_assistant/utils.py || exit 1
curl -sSL https://raw.githubusercontent.com/fmdz387/cli-ai/refs/heads/master/ui.py -o ~/.cli_ai_assistant/ui.py || exit 1
curl -sSL https://raw.githubusercontent.com/fmdz387/cli-ai/refs/heads/master/assistant.py -o ~/.cli_ai_assistant/assistant.py || exit 1
curl -sSL https://raw.githubusercontent.com/fmdz387/cli-ai/refs/heads/master/cross_platform_utils.py -o ~/.cli_ai_assistant/cross_platform_utils.py || exit 1
curl -sSL https://raw.githubusercontent.com/fmdz387/cli-ai/refs/heads/master/launcher.py -o ~/.cli_ai_assistant/launcher.py || exit 1

echo -e "${GREEN}Files downloaded successfully${NC}"
chmod +x ~/.cli_ai_assistant/launcher.py

# Step 2: Install dependencies
echo -e "${YELLOW}Step 2: Installing dependencies${NC}"

# Check Python
if ! command -v python3 &> /dev/null; then
    echo -e "${YELLOW}Installing Python...${NC}"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install python
    elif [[ -f /etc/debian_version ]]; then
        sudo apt-get update && sudo apt-get install -y python3
    fi
fi

# Install python3-venv and python3-pip for Debian/Ubuntu
if [[ -f /etc/debian_version ]]; then
    echo -e "${CYAN}Installing required Python packages...${NC}"
    sudo apt-get install -y python3-venv python3-pip python3-full 2>/dev/null || sudo apt-get install -y python3-venv python3-pip
fi

# Create venv
echo -e "${CYAN}Setting up virtual environment...${NC}"
rm -rf ~/.cli_ai_assistant/venv  # Clean start
python3 -m venv ~/.cli_ai_assistant/venv || {
    echo -e "${RED}venv creation failed, trying with --system-site-packages${NC}"
    python3 -m venv --system-site-packages ~/.cli_ai_assistant/venv || {
        echo -e "${RED}Failed to create venv${NC}"
        exit 1
    }
}

# Install packages in venv
source ~/.cli_ai_assistant/venv/bin/activate || exit 1
echo -e "${CYAN}Installing Python packages in venv...${NC}"
pip install --upgrade pip --quiet
pip install anthropic keyring keyrings.alt colorama || exit 1
deactivate

echo -e "${GREEN}Dependencies installed successfully${NC}"

# Step 3: Store API key
echo -e "${YELLOW}Step 3: Securing API key${NC}"

if [ "$IS_UPDATE" = true ]; then
    existing_key=$(~/.cli_ai_assistant/venv/bin/python -c "
try:
    import keyring
    key = keyring.get_password('cli_ai_assistant', 'anthropic_api_key')
    print('exists' if key else 'none')
except:
    print('none')
" 2>/dev/null)

    if [ "$existing_key" = "exists" ]; then
        echo -e "${GREEN}API key preserved${NC}"
    else
        read -sp "Enter your API key: " api_key
        echo
        [ -z "$api_key" ] && exit 1
        ~/.cli_ai_assistant/venv/bin/python -c "import keyring; keyring.set_password('cli_ai_assistant', 'anthropic_api_key', '$api_key')"
        echo -e "${GREEN}API key stored${NC}"
    fi
else
    ~/.cli_ai_assistant/venv/bin/python -c "import keyring; keyring.set_password('cli_ai_assistant', 'anthropic_api_key', '$api_key')"
    echo -e "${GREEN}API key stored securely${NC}"
fi

# Step 4: Configuration
echo -e "${YELLOW}Step 4: Configuration${NC}"

if [ "$IS_UPDATE" = true ] && [ -f ~/.cli_ai_assistant/config.backup ]; then
    mv ~/.cli_ai_assistant/config.backup ~/.cli_ai_assistant/config
    echo -e "${GREEN}Configuration restored${NC}"
elif [ ! -f ~/.cli_ai_assistant/config ]; then
    cat > ~/.cli_ai_assistant/config << 'EOF'
AI_ASSISTANT_SKIP_CONFIRM=false
AI_ASSISTANT_MODEL=claude-sonnet-4-20250514
AI_DIRECTORY_TREE_CONTEXT=true
AI_ASSISTANT_SHOW_EXPLANATIONS=true
AI_ASSISTANT_MAX_ALTERNATIVES=3
AI_ASSISTANT_ENABLE_SYNTAX_HIGHLIGHTING=true
AI_ASSISTANT_ENABLE_COMMAND_HISTORY=true
AI_ASSISTANT_SAFETY_LEVEL=medium
EOF
    echo -e "${GREEN}Default config created${NC}"
fi

# Step 5: Shell alias
echo -e "${YELLOW}Step 5: Configuring shell alias${NC}"

touch ~/.bashrc
alias_line="alias s='~/.cli_ai_assistant/venv/bin/python ~/.cli_ai_assistant/launcher.py'"
sed -i '/alias s=.*cli_ai_assistant/d' ~/.bashrc 2>/dev/null || sed '/alias s=.*cli_ai_assistant/d' ~/.bashrc > ~/.bashrc.tmp && mv ~/.bashrc.tmp ~/.bashrc
echo "$alias_line" >> ~/.bashrc

echo -e "${GREEN}✓ Setup complete!${NC}\n"
echo -e "${YELLOW}Usage:${NC} ${CYAN}s${NC} <command>"
echo -e "${YELLOW}Example:${NC} ${CYAN}s${NC} \"list files\"\n"
echo -e "${MAGENTA}Restart your terminal or run: source ~/.bashrc${NC}"
