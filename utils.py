# Copyright 2024 Fahir M.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

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
        try:
            with open(config_path, 'r', encoding='utf-8') as file:
                for line in file:
                    line = line.strip()
                    if line and '=' in line:
                        key, value = line.split('=', 1)
                        config[key] = value
        except Exception as e:
            print(f"Warning: Could not read config file: {e}")
    return config

def get_config_schema():
    """Get the configuration schema with validation rules."""
    return {
        'AI_ASSISTANT_SKIP_CONFIRM': {
            'description': 'Skip command confirmation prompts',
            'type': 'boolean',
            'default': 'true',
            'values': ['true', 'false']
        },
        'AI_ASSISTANT_MODEL': {
            'description': 'The model to use for the AI assistant. Check Anthropic API documentation for available models: https://docs.anthropic.com/en/docs/about-claude/models/overview',
            'type': 'string',
            'default': 'claude-sonnet-4-20250514',
            'values': ['claude-sonnet-4-20250514', 'claude-opus-4-20250514']
        },
        'AI_DIRECTORY_TREE_CONTEXT': {
            'description': 'Include directory structure in AI context',
            'type': 'boolean',
            'default': 'true',
            'values': ['true', 'false']
        },
        'AI_ASSISTANT_SAFETY_LEVEL': {
            'description': 'Command risk assessment level',
            'type': 'enum',
            'default': 'medium',
            'values': ['low', 'medium', 'high']
        },
        'AI_ASSISTANT_SHOW_EXPLANATIONS': {
            'description': 'Display command explanations',
            'type': 'boolean',
            'default': 'true',
            'values': ['true', 'false']
        },
        'AI_ASSISTANT_MAX_ALTERNATIVES': {
            'description': 'Number of alternative commands to generate',
            'type': 'integer',
            'default': '3',
            'values': ['0', '1', '2', '3', '4', '5']
        },
        'AI_ASSISTANT_ENABLE_SYNTAX_HIGHLIGHTING': {
            'description': 'Enable command syntax highlighting',
            'type': 'boolean',
            'default': 'true',
            'values': ['true', 'false']
        },
        'AI_ASSISTANT_ENABLE_COMMAND_HISTORY': {
            'description': 'Enable command history navigation',
            'type': 'boolean',
            'default': 'true',
            'values': ['true', 'false']
        },
        'AI_ASSISTANT_SIMPLE_MODE': {
            'description': 'Enable simple mode (no UI boxes, just clipboard/display)',
            'type': 'boolean',
            'default': 'false',
            'values': ['true', 'false']
        }
    }

def validate_config(key, value):
    """Validate configuration key and value."""
    schema = get_config_schema()
    
    # Check if key exists
    if key not in schema:
        available_keys = ', '.join(sorted(schema.keys()))
        return False, f"Unknown configuration key '{key}'. Available keys: {available_keys}"
    
    config_def = schema[key]
    
    # Validate value
    if value not in config_def['values']:
        valid_values = ' | '.join(config_def['values'])
        return False, f"Invalid value '{value}' for {key}. Valid values: {valid_values}"
    
    return True, "Valid configuration"

def update_config(key, value):
    """
    Update the configuration file with the given key-value pair.
    Validates key and value before updating.
    """
    # Validate the configuration
    is_valid, message = validate_config(key, value)
    if not is_valid:
        raise ValueError(message)
    
    config_path = os.path.join(os.path.expanduser('~'), '.cli_ai_assistant', 'config')
    
    # Ensure directory exists
    os.makedirs(os.path.dirname(config_path), exist_ok=True)
    
    # Read the current config
    if os.path.exists(config_path):
        try:
            with open(config_path, 'r', encoding='utf-8') as file:
                lines = file.readlines()
        except Exception as e:
            raise ValueError(f"Failed to read configuration file: {e}")
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
    try:
        with open(config_path, 'w', encoding='utf-8') as file:
            file.writelines(lines)
    except Exception as e:
        raise ValueError(f"Failed to write configuration file: {e}")

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
      s config-show [key]
      s help
    
    Commands:
      <natural language command>  Translate natural language into a command and execute it.
                                  Supports both Unix-based shell and Windows PowerShell commands.
      config-set <key=value>      Update the configuration with the specified key-value pair.
      config-show [key]           Display configuration settings. Show all if no key specified.
      help                        Display this help message.

    Configuration Commands:
      config-show                 Display all configuration settings with descriptions
      config-show <key>           Display specific configuration setting details
      config-set <key>=<value>    Update configuration setting

    Examples:
      s "list all files in the current directory"
      s config-show
      s config-show AI_ASSISTANT_MODEL
      s config-set AI_ASSISTANT_SKIP_CONFIRM=true
      s help

    For more information, visit CLI AI Assistant GitHub repository at: https://github.com/fmdz387/cli-ai
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

def show_config(key=None):
    """Display configuration settings with beautiful formatting."""
    config = get_config()
    config_schema = get_config_schema()
    
    # Convert schema format for display
    display_schema = {}
    for k, v in config_schema.items():
        display_schema[k] = {
            'description': v['description'],
            'type': v['type'],
            'default': v['default'],
            'values': '|'.join(v['values']) if v['type'] in ['boolean', 'enum'] else '0-5' if k.endswith('ALTERNATIVES') else '|'.join(v['values'])
        }
    config_schema = display_schema
    
    # Colors for different terminal types
    def get_colors():
        """Get color codes based on terminal support"""
        try:
            import os
            if os.name == 'nt' and not ('ANSICON' in os.environ or 'WT_SESSION' in os.environ):
                return {'reset': '', 'bold': '', 'dim': '', 'cyan': '', 'green': '', 'yellow': '', 'red': '', 'blue': ''}
            else:
                return {
                    'reset': '\033[0m',
                    'bold': '\033[1m',
                    'dim': '\033[2m',
                    'cyan': '\033[36m',
                    'green': '\033[32m',
                    'yellow': '\033[33m',
                    'red': '\033[31m',
                    'blue': '\033[34m'
                }
        except:
            return {'reset': '', 'bold': '', 'dim': '', 'cyan': '', 'green': '', 'yellow': '', 'red': '', 'blue': ''}
    
    colors = get_colors()
    
    # Terminal width detection
    try:
        import shutil
        terminal_width = shutil.get_terminal_size().columns
    except:
        terminal_width = 80
    
    def print_separator(char='─', width=None):
        """Print a separator line"""
        if width is None:
            width = min(terminal_width, 80)
        print(colors['dim'] + char * width + colors['reset'])
    
    def format_table_row(key, value, status, description, max_key_len=30, max_value_len=15):
        """Format a table row with proper alignment"""
        # Truncate if needed
        key_display = key[:max_key_len] if len(key) > max_key_len else key
        value_display = str(value)[:max_value_len] if len(str(value)) > max_value_len else str(value)
        
        # Color based on status
        if status == 'default':
            value_color = colors['dim']
        elif status == 'set':
            value_color = colors['green']
        else:
            value_color = colors['yellow']
        
        # Align columns
        key_padded = key_display.ljust(max_key_len)
        value_padded = value_display.ljust(max_value_len)
        
        return f"{colors['cyan']}{key_padded}{colors['reset']} │ {value_color}{value_padded}{colors['reset']} │ {colors['dim']}{description}{colors['reset']}"
    
    if key:
        # Show single configuration
        key_upper = key.upper()
        if key_upper in config_schema:
            current_value = config.get(key_upper, config_schema[key_upper]['default'])
            schema_info = config_schema[key_upper]
            status = 'set' if key_upper in config else 'default'
            
            print(f"\n{colors['bold']}Configuration: {key_upper}{colors['reset']}")
            print_separator()
            print(f"{colors['cyan']}Description:{colors['reset']} {schema_info['description']}")
            print(f"{colors['cyan']}Current Value:{colors['reset']} {colors['green'] if status == 'set' else colors['dim']}{current_value}{colors['reset']}")
            print(f"{colors['cyan']}Default Value:{colors['reset']} {colors['dim']}{schema_info['default']}{colors['reset']}")
            print(f"{colors['cyan']}Valid Values:{colors['reset']} {colors['yellow']}{schema_info['values']}{colors['reset']}")
            print(f"{colors['cyan']}Type:{colors['reset']} {schema_info['type']}")
            print(f"{colors['cyan']}Status:{colors['reset']} {colors['green'] if status == 'set' else colors['dim']}{status}{colors['reset']}")
            print_separator()
            print(f"\n{colors['dim']}Update with: s config-set {key_upper}=<value>{colors['reset']}")
            
            # Show example values from original schema
            original_schema = get_config_schema()
            if key_upper in original_schema:
                valid_values = original_schema[key_upper]['values']
                if len(valid_values) <= 3:
                    examples = valid_values
                else:
                    examples = valid_values[:2] + ['...']
                example_str = ' | '.join(examples)
                print(f"{colors['dim']}Examples: {example_str}{colors['reset']}")
        else:
            print(f"{colors['red']}Error: Unknown configuration key '{key}'{colors['reset']}")
            print(f"{colors['dim']}Use 's config-show' to see all available options{colors['reset']}")
            
            # Show similar keys as suggestions
            available_keys = list(config_schema.keys())
            suggestions = [k for k in available_keys if key.upper() in k or k.split('_')[-1].upper() == key.upper()]
            if suggestions:
                print(f"{colors['yellow']}Did you mean:{colors['reset']} {' | '.join(suggestions[:3])}")
    else:
        # Show all configurations
        print(f"\n{colors['bold']}CLI AI Assistant Configuration{colors['reset']}")
        print_separator('═')
        
        # Header
        header = format_table_row("Setting", "Value", "", "Description")
        print(header)
        print_separator()
        
        # Configuration rows
        for config_key, schema_info in config_schema.items():
            current_value = config.get(config_key, schema_info['default'])
            status = 'set' if config_key in config else 'default'
            
            row = format_table_row(
                config_key,
                current_value,
                status,
                schema_info['description']
            )
            print(row)
        
        print_separator()
        
        # Summary
        total_configs = len(config_schema)
        set_configs = len([k for k in config_schema.keys() if k in config])
        default_configs = total_configs - set_configs
        
        print(f"\n{colors['bold']}Summary:{colors['reset']}")
        print(f"  Total settings: {colors['cyan']}{total_configs}{colors['reset']}")
        print(f"  Customized: {colors['green']}{set_configs}{colors['reset']}")
        print(f"  Using defaults: {colors['dim']}{default_configs}{colors['reset']}")
        
        # Usage examples
        print(f"\n{colors['bold']}Usage:{colors['reset']}")
        print(f"  {colors['dim']}Show all configs:{colors['reset']} s config-show")
        print(f"  {colors['dim']}Show single config:{colors['reset']} s config-show <key>")
        print(f"  {colors['dim']}Update config:{colors['reset']} s config-set <key>=<value>")
        
        print(f"\n{colors['dim']}Config file: ~/.cli_ai_assistant/config{colors['reset']}")

def get_current_directory_tree():
    """Return the current directory tree as a formatted string."""
    try:
        shell_env = determine_shell_environment()
        if shell_env == "Windows CMD":
            command = 'dir /s /b'
        elif shell_env == "PowerShell":
            command = 'Get-ChildItem -Force'
        elif shell_env.startswith("WSL") or shell_env.startswith("MSYS2") or shell_env == "Cygwin" or shell_env.startswith("Linux") or shell_env == "Unix Shell":
            command = 'ls -l'
        else:
            command = 'ls -l'  # Default to Unix-like command

        result = execute_command(command)
        return result
    except subprocess.CalledProcessError as e:
        print(f"Error getting directory tree: {e}")
        return ""
