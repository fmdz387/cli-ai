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
if [ -d "~/.cli_ai_assistant" ]; then
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
        echo -e "\e[33mUsage: curl -sSL https://raw.githubusercontent.com/fmdz387/cli-ai/refs/heads/master/setup.sh | bash -s <your_anthropic_api_key>\e[0m"
        echo -e "$security_note"
        exit 1
    fi
else
    # For updates, try to preserve existing API key
    echo -e "\e[36mPreserving existing API key...\e[0m"
    # We'll handle this in the API key step
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
        # Use venv python if available, otherwise fallback to system python3
        if [ -f ~/.cli_ai_assistant/venv/bin/python ]; then
            ~/.cli_ai_assistant/venv/bin/python - "$@"
        else
            python3 - "$@"
        fi
    fi
}

# Step 1: Set up environment
echo -e "${YELLOW}Step 1: Setting up environment${NC}"

if [ "$IS_UPDATE" = true ]; then
    echo -e "${CYAN}Backing up existing configuration...${NC}"
    # Backup config if it exists
    if [ -f ~/.cli_ai_assistant/config ]; then
        cp ~/.cli_ai_assistant/config ~/.cli_ai_assistant/config.backup
        echo -e "${GREEN}Configuration backed up to config.backup${NC}"
    fi
    
    echo -e "${CYAN}Removing old files...${NC}"
    # Remove old Python files but keep config and venv
    rm -f ~/.cli_ai_assistant/*.py

    # Update virtual environment if it exists
    if [ -d ~/.cli_ai_assistant/venv ]; then
        echo -e "${CYAN}Updating virtual environment packages...${NC}"
        source ~/.cli_ai_assistant/venv/bin/activate
        pip install --upgrade pip --quiet
        pip install --upgrade anthropic keyring keyrings.alt colorama --quiet 2>/dev/null || true
        deactivate
    fi
else
    mkdir -p ~/.cli_ai_assistant
fi

# Secure download with error handling
echo -e "${CYAN}Downloading fresh files from GitHub...${NC}"
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

echo -e "${GREEN}All files downloaded successfully!${NC}"

# Make the scripts executable
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

# Install python3-venv if on Debian/Ubuntu and not installed
if [[ -f /etc/debian_version || -f /etc/lsb-release ]]; then
    if ! dpkg -l | grep -q python3-venv; then
        echo -e "${YELLOW}Installing python3-venv package...${NC}"
        if sudo apt-get install -y python3-venv 2>/dev/null; then
            echo -e "${GREEN}python3-venv installed${NC}"
        else
            echo -e "${RED}Failed to install python3-venv. Please run: sudo apt install python3-venv${NC}"
            exit 1
        fi
    fi
fi

# Create virtual environment if it doesn't exist
if [ ! -d ~/.cli_ai_assistant/venv ]; then
    echo -e "${CYAN}Creating virtual environment...${NC}"
    if python3 -m venv ~/.cli_ai_assistant/venv 2>/dev/null; then
        echo -e "${GREEN}Virtual environment created${NC}"
    else
        echo -e "${RED}Failed to create virtual environment${NC}"
        echo -e "${YELLOW}Trying alternative approach with --system-site-packages...${NC}"
        if python3 -m venv --system-site-packages ~/.cli_ai_assistant/venv; then
            echo -e "${GREEN}Virtual environment created with system packages${NC}"
        else
            echo -e "${RED}Virtual environment creation failed${NC}"
            exit 1
        fi
    fi
fi

# Verify venv activation script exists
if [ ! -f ~/.cli_ai_assistant/venv/bin/activate ]; then
    echo -e "${RED}Virtual environment activation script not found${NC}"
    echo -e "${YELLOW}Cleaning up and retrying...${NC}"
    rm -rf ~/.cli_ai_assistant/venv

    # Install python3-full if available (Ubuntu 24.04+)
    if [[ -f /etc/debian_version || -f /etc/lsb-release ]]; then
        sudo apt-get install -y python3-full python3-venv 2>/dev/null || true
    fi

    python3 -m venv ~/.cli_ai_assistant/venv
fi

# Activate virtual environment and install packages
source ~/.cli_ai_assistant/venv/bin/activate

# Upgrade pip first
pip install --upgrade pip --quiet 2>/dev/null || pip install --upgrade pip

# Install packages in virtual environment
if pip install anthropic keyring keyrings.alt colorama --quiet 2>/dev/null; then
    echo -e "${GREEN}Python packages installed successfully${NC}"
else
    # Try without --quiet to see errors
    echo -e "${YELLOW}Retrying package installation...${NC}"
    if pip install anthropic keyring keyrings.alt colorama; then
        echo -e "${GREEN}Python packages installed successfully${NC}"
    else
        echo -e "${RED}Failed to install Python packages${NC}"
        exit 1
    fi
fi

deactivate

# Step 3: Secure API key
echo -e "${YELLOW}Step 3: Securing API key${NC}"
if [ "$IS_UPDATE" = true ]; then
    # Check if API key exists in keyring
    existing_key=$(run_python <<EOF
try:
    import keyring
    key = keyring.get_password("cli_ai_assistant", "anthropic_api_key")
    print("exists" if key else "none")
except:
    print("none")
EOF
)
    
    if [ "$existing_key" = "exists" ]; then
        echo -e "${GREEN}Existing API key preserved${NC}"
    else
        read -sp "No API key found. Enter your API key: " api_key
        echo
        if [ -z "$api_key" ]; then
            echo -e "${RED}API key required for setup${NC}"
            exit 1
        fi
        run_python <<EOF
import keyring
keyring.set_password("cli_ai_assistant", "anthropic_api_key", "$api_key")
EOF
        echo -e "${GREEN}API key stored securely${NC}"
    fi
else
    run_python <<EOF
import keyring
keyring.set_password("cli_ai_assistant", "anthropic_api_key", "$api_key")
EOF
    echo -e "${GREEN}API key stored securely${NC}"
fi

# Step 4: Configure enhanced settings
echo -e "${YELLOW}Step 4: Configuring enhanced settings${NC}"

if [ "$IS_UPDATE" = true ] && [ -f ~/.cli_ai_assistant/config.backup ]; then
    echo -e "${CYAN}Restoring previous configuration...${NC}"
    mv ~/.cli_ai_assistant/config.backup ~/.cli_ai_assistant/config
    echo -e "${GREEN}Previous configuration restored${NC}"
elif [ ! -f ~/.cli_ai_assistant/config ]; then
    echo -e "${CYAN}Creating default configuration...${NC}"
    # Create enhanced configuration
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
    echo -e "${GREEN}Default configuration created${NC}"
else
    echo -e "${GREEN}Existing configuration preserved${NC}"
fi

# Step 5: Configure CLI aliases
echo -e "${YELLOW}Step 5: Configuring CLI aliases${NC}"

# Create or ensure .bashrc exists
touch ~/.bashrc

if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    # Windows (Git Bash or Cygwin)
    alias_line="alias s='python ~/.cli_ai_assistant/launcher.py'"
    # Remove any existing alias
    sed -i '/alias s=.*cli_ai_assistant/d' ~/.bashrc
    # Add fresh alias
    echo "$alias_line" >> ~/.bashrc
    echo -e "${GREEN}Windows alias configured${NC}"
else
    # Unix-based systems - use venv python
    if [ -f ~/.cli_ai_assistant/venv/bin/python ]; then
        alias_line="alias s='~/.cli_ai_assistant/venv/bin/python ~/.cli_ai_assistant/launcher.py'"
    else
        alias_line="alias s='python3 ~/.cli_ai_assistant/launcher.py'"
    fi
    # Remove any existing alias
    sed -i '/alias s=.*cli_ai_assistant/d' ~/.bashrc
    # Add fresh alias
    echo "$alias_line" >> ~/.bashrc
    echo -e "${GREEN}Unix alias configured${NC}"
fi

# Apply the changes made in .bashrc
source ~/.bashrc 2>/dev/null || true

# Print setup completion message
if [ "$IS_UPDATE" = true ]; then
    echo -e "\n${GREEN}*** CLI AI Assistant Update Complete! ***${NC}"
    echo -e "${CYAN}All files have been updated with the latest versions from GitHub.${NC}"
else
    echo -e "\n${GREEN}*** CLI AI Assistant Setup Complete! ***${NC}"
fi

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