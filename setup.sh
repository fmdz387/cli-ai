#!/bin/bash
security_note="\e[33mNOTE: \e[0mYour API key is stored securely in your system's keyring and is not shared outside of this machine."
# ASCII art for "CLI AI"
cat <<"EOF"
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
    echo "Usage: curl -sSL https://raw.githubusercontent.com/username/repo/main/setup.sh | bash -s <your_anthropic_api_key>"
    echo -e "$security_note"
    exit 1
fi

# Define colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Step 1: Set up environment
echo -e "${YELLOW}Step 1: Setting up environment${NC}"
mkdir -p ~/.cli_ai_assistant
curl -sSL https://raw.githubusercontent.com/username/repo/main/cli_ai_assistant.py -o ~/.cli_ai_assistant/ai_assistant.py

# Step 2: Install dependencies
echo -e "${YELLOW}Step 2: Installing dependencies${NC}"
pip install anthropic pyreadline3 keyring

# Step 3: Secure API key
echo -e "${YELLOW}Step 3: Securing API key${NC}"
python - <<EOF
import keyring
keyring.set_password("cli_ai_assistant", "anthropic_api_key", "$1")
EOF

# Step 4: Configure CLI
echo -e "${YELLOW}Step 4: Configuring CLI${NC}"
if ! grep -q "alias s='python ~/.cli_ai_assistant/ai_assistant.py'" ~/.bashrc; then
    echo "alias s='python ~/.cli_ai_assistant/ai_assistant.py'" >>~/.bashrc
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
