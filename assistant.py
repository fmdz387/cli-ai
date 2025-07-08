import os
import sys
import anthropic
import threading
import json
from typing import List, Optional, Dict, Any
from utils import (
    get_config,
    update_config,
    loader_animation,
    display_help,
    execute_command,
    get_api_key,
    get_current_directory_tree,
    determine_shell_environment,
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
        
        # Initialize UI components
        self.terminal_caps = TerminalCapabilities()
        self.colors = ColorScheme(self.terminal_caps.supports_color)
        self.ui = InteractiveCommandInterface()
        
        # Context management
        self.command_history = []
        self.session_context = {}
        self.user_preferences = self._load_user_preferences()
        
    def _load_user_preferences(self) -> Dict[str, Any]:
        """Load user preferences from config"""
        prefs = {
            'preferred_shell': determine_shell_environment(),
            'safety_level': 'medium',
            'show_explanations': True,
            'enable_syntax_highlighting': True,
            'max_alternatives': 3,
            'enable_command_history': True,
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
        
    def _build_prompt(self, user_input: str) -> str:
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

            message = self.client.messages.create(
                model="claude-3-5-sonnet-20241022",
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

            message = self.client.messages.create(
                model="claude-3-5-sonnet-20241022",
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
        
    def get_ai_suggestion(self, user_input: str) -> CommandSuggestion:
        """Get AI suggestion with context"""
        prompt = self._build_prompt(user_input)
        
        try:
            message = self.client.messages.create(
                model="claude-3-5-sonnet-20241022",
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
        # Show loader animation
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
            
    def handle_config_command(self, key_value: str) -> bool:
        """Handle configuration update commands"""
        if '=' not in key_value:
            print(f"{self.colors.error('Error:')} Invalid format. Use 'key=value'")
            return False
            
        key, value = key_value.split('=', 1)
        try:
            update_config(key, value)
            print(f"{self.colors.success('Configuration updated:')} {key}={value}")
            
            # Reload preferences if they changed
            if key.startswith('AI_ASSISTANT_'):
                self.user_preferences = self._load_user_preferences()
                
            return True
        except Exception as e:
            print(f"{self.colors.error('Error:')} Failed to update configuration: {e}")
            return False
            
    def show_help(self):
        """Show help with gesture commands"""
        help_content = [
            "",
            "Basic Usage:",
            "  s <natural language command>",
            "  s config-set <key=value>",
            "  s help",
            "",
            "Interactive Controls:",
            "  Enter     - Execute command",
            "  Tab       - Accept command and copy/paste to terminal if focused",
            "  Ctrl+A    - Show alternatives",
            "  Esc       - Cancel",
            "",
            "Configuration Options:",
            "  AI_ASSISTANT_SKIP_CONFIRM=true/false",
            "  AI_ASSISTANT_SAFETY_LEVEL=low/medium/high",
            "  AI_ASSISTANT_SHOW_EXPLANATIONS=true/false",
            "  AI_ASSISTANT_MAX_ALTERNATIVES=0-5",
            "",
            "Examples:",
            "  s show directory tree with permissions",
            "  s show docker containers",
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
            
        # Handle config command
        if sys.argv[1] == "config-set" and len(sys.argv) == 3:
            success = assistant.handle_config_command(sys.argv[2])
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