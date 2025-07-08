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

# Prompt for API key instead of passing as an argument
read -sp "Enter your API key: " api_key
echo

# Check if the API key is provided
if [ -z "$api_key" ]; then
    echo -e "\e[31mWARNING: API key not provided!\e[0m"
    echo -e "\e[33mUsage: curl -sSL https://raw.githubusercontent.com/fmdz387/cli-ai/refs/heads/master/setup.sh | bash -s <your_anthropic_api_key>\e[0m"
    echo -e "$security_note"
    exit 1
fi

# Define colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
MAGENTA='\033[1;35m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Define a function to execute Python commands
run_python() {
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
        python - "$@"
    else
        python3 - "$@"
    fi
}

# Step 1: Set up environment
echo -e "${YELLOW}Step 1: Setting up environment${NC}"
mkdir -p ~/.cli_ai_assistant

# Secure download with error handling
echo -e "${CYAN}Downloading core files...${NC}"
if ! curl -sSL https://raw.githubusercontent.com/fmdz387/cli-ai/refs/heads/master/ai_assistant.py -o ~/.cli_ai_assistant/ai_assistant.py; then
    echo -e "${RED}Error downloading ai_assistant.py${NC}"
    exit 1
fi

if ! curl -sSL https://raw.githubusercontent.com/fmdz387/cli-ai/refs/heads/master/utils.py -o ~/.cli_ai_assistant/utils.py; then
    echo -e "${RED}Error downloading utils.py${NC}"
    exit 1
fi

echo -e "${CYAN}Downloading enhanced UI components...${NC}"
if ! curl -sSL https://raw.githubusercontent.com/fmdz387/cli-ai/refs/heads/master/ui.py -o ~/.cli_ai_assistant/ui.py; then
    echo -e "${RED}Error downloading ui.py${NC}"
    exit 1
fi

if ! curl -sSL https://raw.githubusercontent.com/fmdz387/cli-ai/refs/heads/master/assistant.py -o ~/.cli_ai_assistant/assistant.py; then
    echo -e "${RED}Error downloading assistant.py${NC}"
    exit 1
fi

if ! curl -sSL https://raw.githubusercontent.com/fmdz387/cli-ai/refs/heads/master/cross_platform_utils.py -o ~/.cli_ai_assistant/cross_platform_utils.py; then
    echo -e "${RED}Error downloading cross_platform_utils.py${NC}"
    exit 1
fi

if ! curl -sSL https://raw.githubusercontent.com/fmdz387/cli-ai/refs/heads/master/launcher.py -o ~/.cli_ai_assistant/launcher.py; then
    echo -e "${RED}Error downloading launcher.py${NC}"
    exit 1
fi

# Make the scripts executable
chmod +x ~/.cli_ai_assistant/ai_assistant.py
chmod +x ~/.cli_ai_assistant/launcher.py

# Step 2: Install dependencies
echo -e "${YELLOW}Step 2: Installing dependencies${NC}"
# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo -e "${YELLOW}Python not found. Installing Python...${NC}"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        brew install python
    elif [[ -f /etc/debian_version || -f /etc/lsb-release ]]; then
        # Debian or Ubuntu
        sudo apt-get update
        sudo apt-get install -y python3
    else
        echo -e "${RED}Unsupported OS. Please install Python manually.${NC}"
        exit 1
    fi
fi

# Check if pip is installed
if ! command -v pip3 &> /dev/null; then
    echo -e "${YELLOW}pip not found. Installing pip...${NC}"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py
        python3 get-pip.py
        rm get-pip.py
    elif [[ -f /etc/debian_version || -f /etc/lsb-release ]]; then
        # Debian or Ubuntu
        sudo apt-get install -y python3-pip
    else
        echo -e "${RED}Unsupported OS. Please install pip manually.${NC}"
        exit 1
    fi
fi

# Install enhanced dependencies for better UI experience
echo -e "${CYAN}Installing Python packages...${NC}"
pip3 install anthropic pyreadline3 keyring keyrings.alt colorama

# Step 3: Secure API key
echo -e "${YELLOW}Step 3: Securing API key${NC}"
run_python <<EOF
import keyring
keyring.set_password("cli_ai_assistant", "anthropic_api_key", "$api_key")
EOF

# Step 4: Configure enhanced settings
echo -e "${YELLOW}Step 4: Configuring enhanced settings${NC}"

# Create enhanced configuration
cat > ~/.cli_ai_assistant/config << 'EOF'
AI_ASSISTANT_SKIP_CONFIRM=false
AI_DIRECTORY_TREE_CONTEXT=true
AI_ASSISTANT_SHOW_EXPLANATIONS=true
AI_ASSISTANT_MAX_ALTERNATIVES=3
AI_ASSISTANT_ENABLE_SYNTAX_HIGHLIGHTING=true
AI_ASSISTANT_ENABLE_COMMAND_HISTORY=true
AI_ASSISTANT_SAFETY_LEVEL=medium
EOF

# Step 5: Configure CLI aliases
echo -e "${YELLOW}Step 5: Configuring CLI aliases${NC}"

if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    # Windows (Git Bash or Cygwin)
    if ! grep -q "alias s='python ~/.cli_ai_assistant/launcher.py'" ~/.bashrc; then
        echo "alias s='python ~/.cli_ai_assistant/launcher.py'" >>~/.bashrc
    fi
else
    # Unix-based systems
    if ! grep -q "alias s='python3 ~/.cli_ai_assistant/launcher.py'" ~/.bashrc; then
        echo "alias s='python3 ~/.cli_ai_assistant/launcher.py'" >>~/.bashrc
    fi
fi

# Apply the changes made in .bashrc
source ~/.bashrc 2>/dev/null || true

# Print setup completion message
echo -e "\n${GREEN}*** CLI AI Assistant Setup Complete! ***${NC}"

# Print usage information
echo -e "\n${YELLOW}Usage:${NC}"
echo -e "  ${CYAN}s${NC} <natural language command>   - Use AI assistant"

# Print enhanced features
echo -e "\n${YELLOW}Enhanced Features:${NC}"
echo -e "  ${WHITE}- Interactive command preview with syntax highlighting${NC}"
echo -e "  ${WHITE}- Gesture-based controls (Enter, Tab, Ctrl+A, Esc, etc.)${NC}"
echo -e "  ${WHITE}- Alternative command suggestions${NC}"
echo -e "  ${WHITE}- Risk assessment and safety warnings${NC}"
echo -e "  ${WHITE}- Cross-platform clipboard support${NC}"

# Print gesture controls
echo -e "\n${YELLOW}Gesture Controls:${NC}"
echo -e "  ${CYAN}Enter${NC}       Execute command"
echo -e "  ${CYAN}Tab${NC}         Accept command and copy/paste to terminal if focused"
echo -e "  ${CYAN}Ctrl+A${NC}      Show alternatives"
echo -e "  ${CYAN}Esc${NC}         Cancel"

# Print examples
echo -e "\n${YELLOW}Examples:${NC}"
echo -e "  ${CYAN}s${NC} \"show docker containers\""
echo -e "  ${CYAN}s${NC} \"show directory tree with permissions\""

# Add colored note about API key security
echo -e "$security_note"

echo -e "\n${MAGENTA}Restart your terminal session to use the 's' command!${NC}"