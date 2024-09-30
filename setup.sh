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

# Check if the API key is provided
if [ -z "$1" ]; then
    echo -e "\e[31mWARNING: API key not provided!\e[0m"
    echo -e "\e[33mUsage: curl -sSL https://raw.githubusercontent.com/fmdz387/cli-ai/refs/heads/master/setup.sh | bash -s <your_anthropic_api_key>\e[0m"
    echo -e "$security_note"
    exit 1
fi

# Define colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Define a function to execute Python commands
run_python() {
    if command -v python3 &> /dev/null; then
        python3 - "$@"
    else
        python - "$@"
    fi
}

# Step 1: Set up environment
echo -e "${YELLOW}Step 1: Setting up environment${NC}"
mkdir -p ~/.cli_ai_assistant
curl -sSL https://raw.githubusercontent.com/fmdz387/cli-ai/refs/heads/master/ai_assistant.py -o ~/.cli_ai_assistant/ai_assistant.py
# Make the script executable
chmod +x ~/.cli_ai_assistant/ai_assistant.py

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

pip install anthropic pyreadline3 keyring

# Step 3: Secure API key
echo -e "${YELLOW}Step 3: Securing API key${NC}"
run_python <<EOF
import keyring
keyring.set_password("cli_ai_assistant", "anthropic_api_key", "$1")
EOF

# Step 4: Configure CLI
echo -e "${YELLOW}Step 4: Configuring CLI${NC}"
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    # Windows (Git Bash or Cygwin)
    if ! grep -q "alias s='python ~/.cli_ai_assistant/ai_assistant.py'" ~/.bashrc; then
        echo "alias s='python ~/.cli_ai_assistant/ai_assistant.py'" >>~/.bashrc
    fi
else
    # Unix-based systems
    if ! grep -q "alias s='python3 ~/.cli_ai_assistant/ai_assistant.py'" ~/.bashrc; then
        echo "alias s='python3 ~/.cli_ai_assistant/ai_assistant.py'" >>~/.bashrc
    fi
fi
echo "export AI_ASSISTANT_SKIP_CONFIRM=true" >~/.cli_ai_assistant/config
source ~/.bashrc

# Print setup completion message
echo -e "${GREEN}✔ Setup complete!${NC}"

# Print usage information
echo -e "\n${YELLOW}Usage:${NC}"
echo -e "  ${CYAN}s${NC} <natural language command>"

# Print example
echo -e "\n${YELLOW}Example:${NC}"
echo -e "  ${CYAN}s${NC} show all docker images - ${GREEN}↳${NC} docker ps -a\n"

# Add colored note about API key security
echo -e "$security_note"
