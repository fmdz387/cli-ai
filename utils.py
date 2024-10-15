import os
import sys
import subprocess
import time
import textwrap
import keyring

def get_config():
    """Get configuration settings from the config file."""
    config_path = os.path.join(os.path.expanduser('~'), '.cli_ai_assistant', 'config')
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
    config_path = os.path.join(os.path.expanduser('~'), '.cli_ai_assistant', 'config')
    
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
      <natural language command>  Translate natural language into a command and execute it.
                                  Supports both Unix-based shell and Windows PowerShell commands.
      config-set <key=value>      Update the configuration with the specified key-value pair.
      help                        Display this help message.

    Options:
      key=value                   Specify the configuration key and value to update. 
                                  Example: AI_ASSISTANT_SKIP_CONFIRM=true

    Description:
      The CLI AI Assistant is designed to help you translate natural language instructions into 
      executable commands. It uses AI to interpret your input and suggest the most appropriate 
      command for your operating system, whether it's Unix-based or Windows.

    Examples:
      s "list all files in the current directory"
      s config AI_ASSISTANT_SKIP_CONFIRM=true
      s help

    For more information, visit our documentation at: https://example.com/docs
    """
    print(textwrap.dedent(help_text))

def determine_shell_environment():
    """Determine the specific shell environment for command execution."""
    try:
        if os.name == 'nt':
            # Check for Unix-like environments on Windows
            if 'WSL_DISTRO_NAME' in os.environ:
                return f"WSL {os.environ['WSL_DISTRO_NAME']}"
            if 'MSYSTEM' in os.environ:
                return f"MSYS2 {os.environ['MSYSTEM']}"
            if 'CYGWIN' in os.environ:
                return "Cygwin"
            # Check for PowerShell
            if 'PSModulePath' in os.environ:
                return "PowerShell"
            # Default to Windows CMD
            return "Windows CMD"
        else:
            # For Unix-based systems, check the distribution
            try:
                with open('/etc/os-release') as f:
                    lines = f.readlines()
                    for line in lines:
                        if line.startswith('ID='):
                            distro_id = line.strip().split('=')[1].strip('"')
                            return f"Linux {distro_id.capitalize()}"
            except FileNotFoundError:
                pass
            # Fallback for other Unix-like systems
            return "Unix Shell"
    except Exception as e:
        print(f"Error determining shell environment: {e}")
        return "Unknown Shell"

def execute_command(command):
    """Execute the given command and return the output."""
    shell_environment = determine_shell_environment()
    try:
        if shell_environment == "Windows CMD":
            # Use CMD to execute the command
            result = subprocess.run(command, shell=True, check=True, text=True, capture_output=True)
        elif shell_environment == "PowerShell":
            # Use PowerShell to execute the command
            result = subprocess.run(f'powershell -Command "{command}"', shell=True, check=True, text=True, capture_output=True)
        elif shell_environment.startswith("WSL"):
            # Use WSL to execute the command
            result = subprocess.run(f'wsl {command}', shell=True, check=True, text=True, capture_output=True)
        elif shell_environment.startswith("MSYS2") or shell_environment == "Cygwin":
            # Use MSYS2 or Cygwin to execute the command
            result = subprocess.run(command, shell=True, check=True, text=True, capture_output=True)
        else:
            # Use the default shell for Unix-like systems
            result = subprocess.run(command, shell=True, check=True, text=True, capture_output=True)
        
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"Error executing command: {e}")
        return e.stderr.strip()

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
        shell_env = determine_shell_environment()
        if shell_env == "Windows CMD":
            command = 'dir /s /b'
        elif shell_env == "PowerShell":
            command = 'Get-ChildItem -Force'
        elif shell_env.startswith("WSL") or shell_env.startswith("MSYS2") or shell_env == "Cygwin" or shell_env.startswith("Linux") or shell_env == "Unix Shell":
            command = 'ls -R'
        else:
            command = 'ls -R'  # Default to Unix-like command

        result = execute_command(command)
        return result
    except subprocess.CalledProcessError as e:
        print(f"Error getting directory tree: {e}")
        return ""
