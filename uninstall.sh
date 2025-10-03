#!/bin/bash
# CLI AI Assistant - Uninstall Script (Unix/Linux/macOS)
# This script removes all components of the CLI AI Assistant

echo -e "\033[36mCLI AI Assistant - Uninstall\033[0m"
echo -e "\033[36m===============================\033[0m"
echo ""

INSTALL_DIR="$HOME/.cli_ai_assistant"

# Confirm uninstall
echo -e "\033[33mThis will remove:\033[0m"
echo -e "\033[33m  - Installation directory: $INSTALL_DIR\033[0m"
echo -e "\033[33m  - Shell alias configuration (bash/zsh profiles)\033[0m"
echo -e "\033[33m  - API key from keyring\033[0m"
echo ""

read -p "Continue with uninstall? (y/N): " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo -e "\033[32mUninstall cancelled.\033[0m"
    exit 0
fi

echo ""

# Remove shell alias from profiles
echo -e "\033[36m[1/3] Removing shell alias...\033[0m"
removed_count=0

for profile in "$HOME/.bashrc" "$HOME/.bash_profile" "$HOME/.zshrc" "$HOME/.profile"; do
    if [[ -f "$profile" ]]; then
        # Same pattern as setup.sh: remove lines matching "alias s=.*cli_ai_assistant"
        if grep -q "alias s=.*cli_ai_assistant" "$profile" 2>/dev/null; then
            # Create backup
            timestamp=$(date +%Y%m%d_%H%M%S)
            cp "$profile" "${profile}.backup.${timestamp}"

            # Remove alias line (same logic as setup.sh sed command)
            sed -i.tmp '/alias s=.*cli_ai_assistant/d' "$profile" 2>/dev/null || \
            sed -i '' '/alias s=.*cli_ai_assistant/d' "$profile" 2>/dev/null
            rm -f "${profile}.tmp"

            echo -e "  \033[32m✓\033[0m Removed alias from $(basename $profile)"
            echo -e "    \033[90mBackup saved: $(basename ${profile}).backup.${timestamp}\033[0m"
            ((removed_count++))
        fi
    fi
done

if [[ $removed_count -eq 0 ]]; then
    echo -e "  \033[90m- No alias found in shell profiles\033[0m"
fi

# Remove API key from keyring
echo -e "\033[36m[2/3] Removing API key from keyring...\033[0m"
if [[ -f "$INSTALL_DIR/venv/bin/python" ]]; then
    "$INSTALL_DIR/venv/bin/python" -c "import keyring; keyring.delete_password('cli_ai_assistant', 'anthropic_api_key')" 2>/dev/null && \
        echo -e "  \033[32m✓\033[0m API key removed from keyring" || \
        echo -e "  \033[90m- No API key found in keyring\033[0m"
else
    python3 -c "import keyring; keyring.delete_password('cli_ai_assistant', 'anthropic_api_key')" 2>/dev/null && \
        echo -e "  \033[32m✓\033[0m API key removed from keyring" || \
        echo -e "  \033[90m- No API key found in keyring\033[0m"
fi

# Remove installation directory
echo -e "\033[36m[3/3] Removing installation directory...\033[0m"
if [[ -d "$INSTALL_DIR" ]]; then
    rm -rf "$INSTALL_DIR"
    echo -e "  \033[32m✓\033[0m Removed $INSTALL_DIR"
else
    echo -e "  \033[90m- Installation directory not found\033[0m"
fi

echo ""
echo -e "\033[32mUninstall complete!\033[0m"
echo ""
echo -e "\033[33mNote: Please restart your shell or run 'source ~/.bashrc' (or ~/.zshrc) for changes to take effect.\033[0m"
echo -e "\033[33mNote: System Python packages were not removed (if installed globally).\033[0m"
echo -e "\033[33m      Run 'pip3 uninstall anthropic keyring keyrings.alt' to remove them manually.\033[0m"
