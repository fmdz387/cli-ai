import os
import sys
import subprocess
import time
import textwrap
import keyring

def get_config():
    """Get configuration settings from the config file."""
    config_path = os.path.expanduser('~/.cli_ai_assistant/config')
    config = {}
    if os.path.exists(config_path):
        with open(config_path, 'r') as file:
            for line in file:
                key, value = line.strip().split('=', 1)
                config[key] = value
    return config

def update_config(key, value):
    """
    Update the configuration file with the given key-value pair.
    Handles edge cases where the value might contain '='.
    """
    config_path = os.path.expanduser('~/.cli_ai_assistant/config')
    
    # Read the current config
    if os.path.exists(config_path):
        with open(config_path, 'r') as file:
            lines = file.readlines()
    else:
        lines = []

    # Prepare the new line to be added or updated
    new_line = f"{key}={value}\n"
    key_found = False

    # Update the line if the key already exists
    for i, line in enumerate(lines):
        if line.startswith(f"{key}="):
            lines[i] = new_line
            key_found = True
            break

    # If the key was not found, append the new line
    if not key_found:
        lines.append(new_line)

    # Write the updated config back to the file
    with open(config_path, 'w') as file:
        file.writelines(lines)

def loader_animation(stop_event):
    """Display a loader animation while waiting for AI response."""
    chars = "/—\\|"
    while not stop_event.is_set():
        for char in chars:
            if stop_event.is_set():
                break
            sys.stdout.write('\r' + 'Thinking... ' + char)
            time.sleep(0.1)
            sys.stdout.flush()
    sys.stdout.write('\r' + ' ' * 20 + '\r')  # Clear the loading line

def display_help():
    """Display help information for the CLI AI Assistant."""
    help_text = """
    CLI AI Assistant - Help

    Usage:
      s <natural language command>
      s config-set <key=value>
      s help
    
    Commands:
      <natural language command>  Translate natural language into a Linux command and execute it.
      config-set <key=value>      Update the configuration with the specified key-value pair.
      help                        Display this help message.

    Options:
      key=value                   Specify the configuration key and value to update. 
                                  Example: AI_ASSISTANT_SKIP_CONFIRM=true

    Description:
      The CLI AI Assistant is designed to help you translate natural language instructions into 
      executable Linux commands. It uses AI to interpret your input and suggest the most appropriate 
      command. You can also update configuration settings using the 'config' command.

    Examples:
      s "list all files in the current directory"
      s config AI_ASSISTANT_SKIP_CONFIRM=true
      s help

    For more information, visit our documentation at: https://example.com/docs
    """
    print(textwrap.dedent(help_text))

def execute_command(command):
    """Execute the given command and handle potential errors."""
    try:
        result = subprocess.run(command, shell=True, check=True, text=True, capture_output=True)
        print(result.stdout)
    except subprocess.CalledProcessError as e:
        print(f"Error executing command: {e}")
        print(e.stderr)

def get_api_key():
    """Retrieve the API key from the system's keyring."""
    api_key = keyring.get_password("cli_ai_assistant", "anthropic_api_key")
    if api_key is None:
        print("\033[91mError: API key not found. Please run the setup script first.\033[0m")
        sys.exit(1)
    return api_key

def get_current_directory_tree():
    """Return the current directory tree as a formatted string."""
    try:
        result = subprocess.run(['ls', '-lR'], capture_output=True, text=True, check=True)
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"Error getting directory tree: {e}")
        return ""

