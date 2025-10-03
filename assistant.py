import os
import sys
import anthropic
import threading
import json
import subprocess
from typing import List, Optional, Dict, Any
from utils import (
    get_config,
    update_config,
    show_config,
    loader_animation,
    display_help,
    execute_command,
    get_api_key,
    get_current_directory_tree,
    determine_shell_environment,
    get_install_dir,
)
from ui import (
    InteractiveCommandInterface,
    CommandSuggestion,
    TerminalCapabilities,
    ColorScheme
)
from cross_platform_utils import CrossPlatformUtils

class AIAssistant:
    """AI Assistant with gesture-based command interaction"""
    
    def __init__(self):
        self.api_key = get_api_key()
        self.config = get_config()
        os.environ["ANTHROPIC_API_KEY"] = self.api_key
        self.client = anthropic.Anthropic()
        
        # Initialize UI components with cross-platform color detection
        self.terminal_caps = TerminalCapabilities()
        color_support = self._detect_color_support()
        self.colors = ColorScheme(color_support)
        self.ui = InteractiveCommandInterface()
        
        # Context management
        self.command_history = []
        self.session_context = {}
        self.user_preferences = self._load_user_preferences()
        
    def _load_user_preferences(self) -> Dict[str, Any]:
        """Load user preferences from config"""
        shell_env = determine_shell_environment()
        
        # Default Simple Mode to True for Git Bash (MSYS2 environments)
        default_simple_mode = shell_env.startswith("MSYS2")
        
        prefs = {
            'preferred_shell': shell_env,
            'safety_level': 'medium',
            'show_explanations': True,
            'enable_syntax_highlighting': True,
            'max_alternatives': 3,
            'enable_command_history': True,
            'simple_mode': default_simple_mode,
        }
        
        # Override with config values
        for key, default_value in prefs.items():
            config_key = f'AI_ASSISTANT_{key.upper()}'
            if config_key in self.config:
                if isinstance(default_value, bool):
                    prefs[key] = self.config[config_key].lower() == 'true'
                elif isinstance(default_value, int):
                    prefs[key] = int(self.config[config_key])
                else:
                    prefs[key] = self.config[config_key]
                    
        return prefs
        
    def _detect_color_support(self) -> bool:
        """Detect color support across platforms"""
        try:
            import platform
            import os
            
            # Check environment variables first
            if os.environ.get('NO_COLOR'):
                return False
            if os.environ.get('FORCE_COLOR'):
                return True
                
            # Platform-specific detection
            system = platform.system()
            
            if system == 'Windows':
                # Windows Terminal, VS Code, or ConEmu
                if (os.environ.get('WT_SESSION') or 
                    os.environ.get('TERM_PROGRAM') == 'vscode' or
                    os.environ.get('ConEmuPID') or
                    os.environ.get('ANSICON')):
                    return True
                    
                # Windows 10+ supports ANSI colors
                try:
                    import sys
                    if sys.version_info >= (3, 6):
                        return True
                except:
                    pass
                    
                return False
            else:
                # Unix-like systems
                if not sys.stdout.isatty():
                    return False
                    
                term = os.environ.get('TERM', '').lower()
                if 'color' in term or term in ['xterm', 'xterm-256color', 'screen', 'tmux']:
                    return True
                    
                if os.environ.get('COLORTERM'):
                    return True
                    
                return False
                
        except Exception:
            # Safe fallback
            return False
        
    def _build_prompt(self, user_input: str, simple_mode: bool = False) -> str:
        """Build prompt with context and preferences"""
        shell_environment = self.user_preferences['preferred_shell']
        
        base_prompt = f"""Your Role: You are an expert AI assistant for {shell_environment}, specializing in translating natural language into precise, safe commands.

Your Task: Translate the following natural language input into an appropriate command for {shell_environment}:

<natural_language_input>
{user_input}
</natural_language_input>

Requirements:
1. Provide ONLY the command as your primary response
2. Ensure the command is correct and will work in {shell_environment}
3. Consider safety and best practices
4. If the request is ambiguous, choose the most common/safe interpretation

Context Information:"""

        # Skip heavy context operations in Simple Mode for faster response
        if not simple_mode:
            # Add directory context if enabled
            if self.config.get('AI_DIRECTORY_TREE_CONTEXT', 'false') == 'true':
                directory_tree = get_current_directory_tree()
                base_prompt += f"""
<current_directory_tree>
{directory_tree}
</current_directory_tree>"""

            # Add command history context
            if self.command_history and self.user_preferences['enable_command_history']:
                recent_commands = self.command_history[-5:]  # Last 5 commands
                base_prompt += f"""
<recent_commands>
{json.dumps(recent_commands, indent=2)}
</recent_commands>"""

            # Add session context
            if self.session_context:
                base_prompt += f"""
<session_context>
{json.dumps(self.session_context, indent=2)}
</session_context>"""

        return base_prompt
        
    def _generate_alternatives(self, user_input: str, primary_command: str) -> List[str]:
        """Generate alternative commands for the same intent"""
        if not self.user_preferences['max_alternatives']:
            return []
            
        try:
            alternatives_prompt = f"""Given the user input: "{user_input}" and the primary command: "{primary_command}"

Generate {self.user_preferences['max_alternatives']} alternative commands that accomplish the same goal but with different approaches or options.

Respond with a JSON array of command strings only.
Example: ["command1", "command2", "command3"]"""

            # Get model from config or use default
            model = self.config.get('AI_ASSISTANT_MODEL', 'claude-sonnet-4-5-20250929')
            message = self.client.messages.create(
                model=model,
                max_tokens=200,
                temperature=0.3,
                messages=[{"role": "user", "content": alternatives_prompt}]
            )
            
            response_text = message.content[0].text.strip()
            
            # Parse JSON response
            try:
                alternatives = json.loads(response_text)
                return alternatives if isinstance(alternatives, list) else []
            except json.JSONDecodeError:
                # Fallback: extract commands from text
                lines = response_text.split('\n')
                alternatives = []
                for line in lines:
                    line = line.strip()
                    if line and not line.startswith(('•', '-', '*', '#')):
                        # Remove quotes and clean up
                        cleaned = line.strip('"\'')
                        if cleaned and cleaned != primary_command:
                            alternatives.append(cleaned)
                return alternatives[:self.user_preferences['max_alternatives']]
                
        except Exception as e:
            print(f"Warning: Could not generate alternatives: {e}")
            return []
            
    def _generate_explanation(self, command: str) -> str:
        """Generate detailed explanation of the command"""
        if not self.user_preferences['show_explanations']:
            return ""
            
        try:
            explanation_prompt = f"""Explain what this command does in clear, concise terms:

Command: {command}

Provide a brief explanation focusing on:
1. What the command accomplishes
2. Key options/flags used
3. Any important warnings or considerations

Keep it under 3 sentences and use bullet points for multiple aspects."""

            # Get model from config or use default
            model = self.config.get('AI_ASSISTANT_MODEL', 'claude-sonnet-4-5-20250929')
            message = self.client.messages.create(
                model=model,
                max_tokens=150,
                temperature=0,
                messages=[{"role": "user", "content": explanation_prompt}]
            )
            
            return message.content[0].text.strip()
            
        except Exception:
            return ""
            
    def _generate_context_hints(self, user_input: str, command: str) -> List[str]:
        """Generate contextual hints for the command"""
        hints = []
        
        # Add hints based on command analysis
        if 'sudo' in command.lower():
            hints.append("This command requires administrator privileges")
            
        if any(dangerous in command.lower() for dangerous in ['rm ', 'rmdir', 'dd ', 'mkfs']):
            hints.append("This command can permanently delete data")
            
        if '>' in command and not '>>' in command:
            hints.append("This will overwrite the target file")
            
        if 'find' in command.lower() and '-exec' in command:
            hints.append("This will execute commands on found files")
            
        # Add performance hints
        if 'find /' in command or 'find /home' in command:
            hints.append("This search may take a long time")
            
        return hints
        
    def get_simple_command(self, user_input: str) -> str:
        """Get AI command for Simple Mode - only basic command without extras"""
        prompt = self._build_prompt(user_input, simple_mode=True)

        try:
            # Get model from config or use default
            model = self.config.get('AI_ASSISTANT_MODEL', 'claude-sonnet-4-5-20250929')
            message = self.client.messages.create(
                model=model,
                max_tokens=100,
                temperature=0,
                system="You are an expert command-line assistant. Provide only the command as your response.",
                messages=[{"role": "user", "content": prompt}]
            )
            
            # Extract the command from the response
            if isinstance(message.content, list) and len(message.content) > 0:
                command = message.content[0].text.strip()
                return command
            else:
                raise ValueError("Unexpected response format")
                
        except Exception as e:
            return f"# Error: {str(e)}"
        
    def get_ai_suggestion(self, user_input: str) -> CommandSuggestion:
        """Get AI suggestion with context"""
        prompt = self._build_prompt(user_input)
        
        try:
            # Get model from config or use default
            model = self.config.get('AI_ASSISTANT_MODEL', 'claude-sonnet-4-5-20250929')
            message = self.client.messages.create(
                model=model,
                max_tokens=100,
                temperature=0,
                system="You are an expert command-line assistant. Provide only the command as your response.",
                messages=[{"role": "user", "content": prompt}]
            )

            # Extract the command from the response
            if isinstance(message.content, list) and len(message.content) > 0:
                command = message.content[0].text.strip()
            else:
                raise ValueError("Unexpected response format")
                
            # Generate suggestion data
            alternatives = self._generate_alternatives(user_input, command)
            explanation = self._generate_explanation(command)
            context_hints = self._generate_context_hints(user_input, command)
            
            # Create suggestion object
            suggestion = CommandSuggestion(
                command=command,
                explanation=explanation,
                risk_level="",  # Will be assessed by UI
                alternatives=alternatives,
                context_hints=context_hints,
                requires_sudo='sudo' in command.lower(),
                is_destructive=any(dangerous in command.lower() 
                                 for dangerous in ['rm ', 'rmdir', 'dd ', 'mkfs', 'format'])
            )
            
            return suggestion
            
        except Exception as e:
            # Fallback suggestion with error info
            return CommandSuggestion(
                command=f"# Error: {str(e)}",
                explanation="Failed to generate command suggestion",
                risk_level="UNKNOWN",
                alternatives=[],
                context_hints=["AI service is currently unavailable"],
                requires_sudo=False,
                is_destructive=False
            )
            
    def _update_session_context(self, user_input: str, command: str, executed: bool):
        """Update session context with command information"""
        command_info = {
            'user_input': user_input,
            'command': command,
            'executed': executed,
            'timestamp': threading.current_thread().ident  # Simple timestamp
        }
        
        self.command_history.append(command_info)
        
        # Keep only last 10 commands
        if len(self.command_history) > 10:
            self.command_history.pop(0)
            
        # Update session context
        self.session_context['last_command'] = command
        self.session_context['total_commands'] = len(self.command_history)
        
    def _loader_animation(self, stop_event: threading.Event):
        """Loader animation with status messages"""
        messages = [
            "Analyzing request",
            "Generating command",
            "Checking safety",
            "Preparing suggestions"
        ]
        
        message_index = 0
        chars = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏" if self.terminal_caps.supports_unicode else "/—\\|"
        char_index = 0
        message_timer = 0
        dots_count = 0
        
        while not stop_event.is_set():
            if self.terminal_caps.supports_color:
                spinner = f"\033[36m{chars[char_index]}\033[0m"
            else:
                spinner = chars[char_index]
                
            message = messages[message_index % len(messages)]
            dots = "." * (dots_count % 4)
            
            # Clear line with enough spaces to handle longest message
            line_content = f'{spinner} {message}{dots}   '
            sys.stdout.write(f'\r{line_content}')
            sys.stdout.flush()
            
            char_index = (char_index + 1) % len(chars)
            message_timer += 1
            
            # Update dots every 3 spinner cycles
            if message_timer % 3 == 0:
                dots_count += 1
            
            # Change message every 30 cycles (3 seconds)
            if message_timer % 30 == 0:
                message_index += 1
                dots_count = 0  # Reset dots when changing message
                
            threading.Event().wait(0.1)
            
        # Clear the entire line properly
        sys.stdout.write('\r' + ' ' * 60 + '\r')
        sys.stdout.flush()
        
    def process_command(self, user_input: str) -> bool:
        """Process user command with UI"""
        # Check if Simple Mode is enabled first to avoid unnecessary API calls
        if self.user_preferences['simple_mode']:
            return self._process_simple_mode_optimized(user_input)
        
        # Show loader animation for full mode
        stop_event = threading.Event()
        loader_thread = threading.Thread(target=self._loader_animation, args=(stop_event,))
        loader_thread.start()
        
        try:
            suggestion = self.get_ai_suggestion(user_input)
        except Exception as e:
            print(f"{self.colors.error('Error:')} Failed to get AI suggestion: {e}")
            return False
        finally:
            stop_event.set()
            loader_thread.join()
            
        # Check if command generation failed
        if suggestion.command.startswith("# Error:"):
            print(f"{self.colors.error('Error:')} {suggestion.explanation}")
            return False
        
        # Use interactive UI for command processing
        try:
            selected_command = self.ui.process_command_interaction(suggestion)
            
            if selected_command:
                # Check if this is an accept action (paste to CLI)
                if selected_command.startswith("ACCEPT:"):
                    command_to_paste = selected_command[7:]  # Remove "ACCEPT:" prefix
                    
                    print(f"\n{self.colors.success('✓ Command ready:')}")
                    print(f"{self.colors.command(command_to_paste)}")
                    
                    self._update_session_context(user_input, command_to_paste, False)
                    
                    # Attempt smart pasting with focus detection
                    paste_result = CrossPlatformUtils.write_to_shell_input(command_to_paste)
                    
                    if paste_result['success']:
                        if paste_result['method'] in ['pyautogui_paste', 'powershell_sendkeys', 'bracketed_paste']:
                            print(f"{self.colors.success('✓ Command copied to clipboard and pasted to terminal if focused!')}")
                        else:
                            print(f"{self.colors.success('✓ Command ready in clipboard')}")
                            print(f"{self.colors.muted('Paste with Ctrl+V in your terminal')}")
                    else:
                        print(f"{self.colors.error('✗ Failed to paste command')}")
                        print(f"{self.colors.muted(paste_result['message'])}")
                        print(f"{self.colors.muted('Manual copy: Select and copy the command above')}")
                    
                    # Small delay to ensure the pasting completes before exit
                    import time
                    time.sleep(0.2)
                    
                    return True  # Exit cleanly
                else:
                    # Execute the command
                    print(f"\n{self.colors.success('Executing:')} {self.colors.command(selected_command)}")
                    result = execute_command(selected_command)
                    
                    if result:
                        print(result)
                        
                    # Update session context
                    self._update_session_context(user_input, selected_command, True)
                    return True
            else:
                print(f"\n{self.colors.muted('Command execution cancelled')}")
                self._update_session_context(user_input, suggestion.command, False)
                return False
                
        except KeyboardInterrupt:
            print(f"\n{self.colors.muted('Operation cancelled by user')}")
            return False
        except Exception as e:
            print(f"{self.colors.error('Error:')} Command processing failed: {e}")
            return False
            
    def _process_simple_mode_optimized(self, user_input: str) -> bool:
        """Optimized Simple Mode - only gets basic command, no alternatives/explanations"""
        # Show loader animation
        stop_event = threading.Event()
        loader_thread = threading.Thread(target=self._loader_animation, args=(stop_event,))
        loader_thread.start()
        
        try:
            command = self.get_simple_command(user_input)
        except Exception as e:
            print(f"{self.colors.error('Error:')} Failed to get command: {e}")
            return False
        finally:
            stop_event.set()
            loader_thread.join()
            
        # Check if command generation failed
        if command.startswith("# Error:"):
            print(f"{self.colors.error('Error:')} Failed to generate command")
            return False
            
        # Update session context
        self._update_session_context(user_input, command, False)
        
        # Detect OS for different behavior
        import platform
        is_windows = platform.system() == 'Windows'
        
        if is_windows:
            # Windows: Copy to clipboard and paste to next line
            print(f"{self.colors.command(command)}")
            
            # Copy to clipboard
            from cross_platform_utils import CrossPlatformUtils
            clipboard_result = CrossPlatformUtils.copy_to_clipboard(command)
            
            if clipboard_result:
                # Try to paste to terminal
                paste_result = CrossPlatformUtils.write_to_shell_input(command)
                if paste_result['success']:
                    print(f"{self.colors.success('✓ Command copied and pasted to terminal')}")
                    print()  # Add blank line for clarity
                else:
                    print(f"{self.colors.success('✓ Command copied to clipboard')}")
                    print(f"{self.colors.muted('Paste with Ctrl+V in your terminal')}")
                    print()  # Add blank line for clarity
            else:
                print(f"{self.colors.warning('⚠️  Could not copy to clipboard')}")
                print(f"{self.colors.muted('Manual copy: Select and copy the command above')}")
        else:
            # Unix/Linux/macOS: Copy to clipboard and display
            print(f"{self.colors.command(command)}")
            
            # Enhanced clipboard handling with diagnostics
            from cross_platform_utils import CrossPlatformUtils
            clipboard_result = CrossPlatformUtils.copy_to_clipboard(command)
            
            if clipboard_result:
                print(f"{self.colors.success('✓ Command copied to clipboard')}")
                print(f"{self.colors.muted('Paste with Ctrl+V in your terminal')}")
            else:
                # Get diagnostic information for better error messages
                diag = CrossPlatformUtils.get_clipboard_diagnostics()
                
                if not diag['available_commands']:
                    print(f"{self.colors.warning('⚠️  No clipboard utility found')}")
                    if diag['system'] == 'Linux':
                        if diag.get('is_wsl', False):
                            print(f"{self.colors.muted('WSL detected - clip.exe should be available')}")
                            print(f"{self.colors.muted('Try: which clip.exe')}")
                        else:
                            print(f"{self.colors.muted('Install: sudo apt install xclip  # or xsel, wl-clipboard')}")
                    elif diag['system'] == 'Darwin':
                        print(f"{self.colors.muted('pbcopy should be available on macOS')}")
                elif diag['issues']:
                    print(f"{self.colors.warning('⚠️  Clipboard setup issue')}")
                    for issue in diag['issues']:
                        print(f"{self.colors.muted(f'  • {issue}')}")
                else:
                    print(f"{self.colors.warning('⚠️  Clipboard operation failed')}")
                    
                print(f"{self.colors.muted('Manually copy the command above')}")
            
            # Provide clear completion message and natural flow
            print()  # Add blank line for clarity
            print(f"{self.colors.muted('✨ Ready! You can now use the command in your terminal')}")
        
        return True
            
    def _process_simple_mode(self, user_input: str, suggestion: CommandSuggestion) -> bool:
        """Process command in Simple Mode - no UI boxes, just copy/paste or display"""
        command = suggestion.command
        
        # Update session context
        self._update_session_context(user_input, command, False)
        
        # Detect OS for different behavior
        import platform
        is_windows = platform.system() == 'Windows'
        
        if is_windows:
            # Windows: Copy to clipboard and paste to next line
            print(f"{self.colors.command(command)}")
            
            # Copy to clipboard
            from cross_platform_utils import CrossPlatformUtils
            clipboard_result = CrossPlatformUtils.copy_to_clipboard(command)
            
            if clipboard_result:
                # Try to paste to terminal
                paste_result = CrossPlatformUtils.write_to_shell_input(command)
                if paste_result['success']:
                    print(f"{self.colors.success('✓ Command copied and pasted to terminal')}")
                else:
                    print(f"{self.colors.success('✓ Command copied to clipboard')}")
                    print(f"{self.colors.muted('Paste with Ctrl+V in your terminal')}")
            else:
                print(f"{self.colors.warning('⚠️  Could not copy to clipboard')}")
                print(f"{self.colors.muted('Manual copy: Select and copy the command above')}")
        else:
            # Unix/Linux/macOS: Copy to clipboard and display
            print(f"{self.colors.command(command)}")
            
            # Copy to clipboard
            from cross_platform_utils import CrossPlatformUtils
            clipboard_result = CrossPlatformUtils.copy_to_clipboard(command)
            
            if clipboard_result:
                print(f"{self.colors.success('✓ Command copied to clipboard')}")
                print(f"{self.colors.muted('Paste with Ctrl+V in your terminal')}")
            else:
                print(f"{self.colors.warning('⚠️  Could not copy to clipboard')}")
                print(f"{self.colors.muted('Manual copy: Select and copy the command above')}")
        
        return True
            
    def handle_config_command(self, key_value: str) -> bool:
        """Handle configuration update commands"""
        if '=' not in key_value:
            print(f"{self.colors.error('Error:')} Invalid format. Use 'key=value'")
            print(f"{self.colors.muted('Example:')} s config-set AI_ASSISTANT_SAFETY_LEVEL=high")
            return False
            
        key, value = key_value.split('=', 1)
        key = key.strip()
        value = value.strip()
        
        try:
            update_config(key, value)
            
            # Safe color methods with fallbacks
            success_msg = self.colors.success('✓ Configuration updated:')
            key_colored = self.colors.cyan(key) if hasattr(self.colors, 'cyan') else key
            value_colored = self.colors.green(value) if hasattr(self.colors, 'green') else value
            msg = f"{success_msg} {key_colored}={value_colored}"
            print(msg)
            
            # Show the updated setting details
            from utils import get_config_schema
            schema = get_config_schema()
            if key in schema:
                desc_msg = self.colors.muted('Description:')
                desc_full = f"{desc_msg} {schema[key]['description']}"
                print(desc_full)
            
            # Reload preferences if they changed
            if key.startswith('AI_ASSISTANT_'):
                self.user_preferences = self._load_user_preferences()
                reload_msg = self.colors.muted('✓ Preferences reloaded')
                print(reload_msg)
                
            return True
        except ValueError as e:
            # Validation error - show helpful message
            error_msg = self.colors.error('✗ Invalid configuration:')
            use_msg = self.colors.muted('Use:')
            see_msg = self.colors.muted('to see valid values')
            print(f"{error_msg} {e}")
            print(f"{use_msg} s config-show {key} {see_msg}")
            return False
        except Exception as e:
            error_msg = self.colors.error('Error:')
            print(f"{error_msg} Failed to update configuration: {e}")
            return False
            
    def handle_config_show_command(self, key: str = None) -> bool:
        """Handle configuration display commands"""
        try:
            show_config(key)
            return True
        except Exception as e:
            print(f"{self.colors.error('Error:')} Failed to display configuration: {e}")
            return False

    def handle_uninstall_command(self) -> bool:
        """Handle uninstall command - remove all CLI AI Assistant components"""
        import platform
        import shutil

        print(f"{self.colors.primary('CLI AI Assistant - Uninstall')}")
        print("=" * 50)
        print()

        install_dir = get_install_dir()

        print(f"{self.colors.warning('This will remove:')}")
        print(f"  - Installation directory: {install_dir}")
        print(f"  - Shell alias configuration")
        print(f"  - API key from keyring")
        print()

        # Confirmation
        response = input(f"{self.colors.primary('Continue with uninstall? (y/N):')} ")
        if response.lower() not in ['y', 'yes']:
            print(f"{self.colors.success('Uninstall cancelled.')}")
            return False

        print()

        # Step 1: Remove shell alias
        print(f"{self.colors.primary('[1/3] Removing shell alias...')}")
        removed_count = 0

        if platform.system() == 'Windows':
            # Use PowerShell $PROFILE variable to find the active profile (same as setup)
            try:
                result = subprocess.run(
                    ['powershell', '-Command', '$PROFILE'],
                    capture_output=True,
                    text=True,
                    timeout=5
                )
                profile_path = result.stdout.strip()

                if profile_path and os.path.exists(profile_path):
                    try:
                        with open(profile_path, 'r', encoding='utf-8') as f:
                            lines = f.readlines()

                        # Check if CLI AI Assistant alias exists (same pattern as setup)
                        if any('cli_ai_assistant' in line for line in lines):
                            # Backup
                            import datetime
                            backup_path = f"{profile_path}.backup.{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}"
                            shutil.copy2(profile_path, backup_path)

                            # Remove alias - same pattern as setup: filter out lines matching "function s.*cli_ai_assistant"
                            new_lines = [line for line in lines if not ('function s' in line and 'cli_ai_assistant' in line)]

                            with open(profile_path, 'w', encoding='utf-8') as f:
                                f.writelines(new_lines)

                            print(f"  {self.colors.success('✓')} Removed alias from PowerShell profile")
                            print(f"    Backup saved: {os.path.basename(backup_path)}")
                            removed_count += 1
                        else:
                            print(f"  {self.colors.muted('-')} No alias found in PowerShell profile")
                    except Exception as e:
                        print(f"  {self.colors.warning('!')} Could not modify PowerShell profile: {e}")
                else:
                    print(f"  {self.colors.muted('-')} PowerShell profile not found")
            except Exception as e:
                print(f"  {self.colors.warning('!')} Could not access PowerShell profile: {e}")
        else:
            # Unix profiles
            profiles = [
                os.path.expanduser('~/.bashrc'),
                os.path.expanduser('~/.bash_profile'),
                os.path.expanduser('~/.zshrc'),
                os.path.expanduser('~/.profile')
            ]

            for profile_path in profiles:
                if os.path.exists(profile_path):
                    try:
                        with open(profile_path, 'r', encoding='utf-8') as f:
                            lines = f.readlines()

                        # Same pattern as setup.sh: remove lines matching "alias s=.*cli_ai_assistant"
                        if any('alias s=' in line and 'cli_ai_assistant' in line for line in lines):
                            # Backup
                            import datetime
                            backup_path = f"{profile_path}.backup.{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}"
                            shutil.copy2(profile_path, backup_path)

                            # Remove alias line (same logic as setup.sh sed command)
                            new_lines = [line for line in lines if not ('alias s=' in line and 'cli_ai_assistant' in line)]

                            with open(profile_path, 'w', encoding='utf-8') as f:
                                f.writelines(new_lines)

                            print(f"  {self.colors.success('✓')} Removed alias from {os.path.basename(profile_path)}")
                            print(f"    Backup saved: {os.path.basename(backup_path)}")
                            removed_count += 1
                    except Exception as e:
                        print(f"  {self.colors.warning('!')} Could not modify {profile_path}: {e}")

        if removed_count == 0:
            print(f"  {self.colors.muted('-')} No alias found in shell profiles")

        # Step 2: Remove API key
        print(f"{self.colors.primary('[2/3] Removing API key from keyring...')}")
        try:
            keyring.delete_password('cli_ai_assistant', 'anthropic_api_key')
            print(f"  {self.colors.success('✓')} API key removed from keyring")
        except:
            print(f"  {self.colors.muted('-')} No API key found in keyring")

        # Step 3: Remove installation directory
        print(f"{self.colors.primary('[3/3] Removing installation directory...')}")
        if os.path.exists(install_dir):
            try:
                shutil.rmtree(install_dir)
                print(f"  {self.colors.success('✓')} Removed {install_dir}")
            except Exception as e:
                print(f"  {self.colors.error('✗')} Could not remove directory: {e}")
                return False
        else:
            print(f"  {self.colors.muted('-')} Installation directory not found")

        print()
        print(f"{self.colors.success('Uninstall complete!')}")
        print()
        print(f"{self.colors.warning('Note:')} Please restart your shell for alias removal to take effect.")

        return True

    def show_help(self):
        """Show help with gesture commands"""
        help_content = [
            "",
            "Basic Usage:",
            "  s <natural language command>",
            "  s config-set <key=value>",
            "  s config-show [key]",
            "  s uninstall",
            "  s help",
            "",
            "Interactive Controls:",
            "  Enter     - Execute command",
            "  Tab       - Accept command and copy/paste to terminal if focused",
            "  Ctrl+A    - Show alternatives",
            "  Esc       - Cancel",
            "",
            "Configuration Commands:",
            "  config-show           - Display all configuration settings",
            "  config-show <key>     - Display specific configuration",
            "  config-set <key>=<val> - Update configuration setting",
            "",
            "System Commands:",
            "  uninstall             - Remove CLI AI Assistant completely",
            "",
            "Examples:",
            "  s show directory tree with permissions",
            "  s config-show",
            "  s config-show AI_ASSISTANT_SAFETY_LEVEL",
            "  s config-set AI_ASSISTANT_MAX_ALTERNATIVES=5",
        ]

        self.ui._draw_box(help_content, "CLI AI Assistant - Help")

def main():
    """Main function with error handling"""
    try:
        assistant = AIAssistant()
        
        if len(sys.argv) < 2:
            print(f"{assistant.colors.error('Usage:')} s <natural language command>")
            sys.exit(1)
            
        # Handle help command
        if sys.argv[1] == "help":
            assistant.show_help()
            sys.exit(0)

        # Handle uninstall command
        if sys.argv[1] == "uninstall":
            success = assistant.handle_uninstall_command()
            sys.exit(0 if success else 1)

        # Handle config-set command
        if sys.argv[1] == "config-set" and len(sys.argv) == 3:
            success = assistant.handle_config_command(sys.argv[2])
            sys.exit(0 if success else 1)

        # Handle config-show command
        if sys.argv[1] == "config-show":
            key = sys.argv[2] if len(sys.argv) == 3 else None
            success = assistant.handle_config_show_command(key)
            sys.exit(0 if success else 1)
            
        # Process natural language command
        user_input = " ".join(sys.argv[1:])
        success = assistant.process_command(user_input)
        sys.exit(0 if success else 1)
        
    except KeyboardInterrupt:
        print(f"\n{ColorScheme().muted('Goodbye!')}")
        sys.exit(0)
    except Exception as e:
        print(f"{ColorScheme().error('Fatal Error:')} {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()