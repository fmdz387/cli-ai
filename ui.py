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
import re
import shutil
import subprocess
import threading
import time
import platform
from typing import List, Dict, Optional, Tuple, Any
from dataclasses import dataclass
from enum import Enum

# Cross-platform imports
try:
    import termios
    import tty
    import select
    UNIX_AVAILABLE = True
except ImportError:
    UNIX_AVAILABLE = False

try:
    import msvcrt
    WINDOWS_AVAILABLE = True
except ImportError:
    WINDOWS_AVAILABLE = False

from cross_platform_utils import CrossPlatformUtils

class KeyCode(Enum):
    """Key codes for gesture-based input"""
    TAB = '\t'
    SHIFT_TAB = '\x1b[Z'
    ENTER = '\r'
    NEWLINE = '\n'
    ESC = '\x1b'
    CTRL_C = '\x03'
    CTRL_E = '\x05'
    CTRL_A = '\x01'
    CTRL_H = '\x08'
    CTRL_D = '\x04'
    CTRL_U = '\x15'
    CTRL_K = '\x0b'
    CTRL_L = '\x0c'
    CTRL_QUESTION = '\x1f'
    BACKSPACE = '\x7f'
    DELETE = '\x1b[3~'
    UP_ARROW = '\x1b[A'
    DOWN_ARROW = '\x1b[B'
    LEFT_ARROW = '\x1b[D'
    RIGHT_ARROW = '\x1b[C'
    HOME = '\x1b[H'
    END = '\x1b[F'
    PAGE_UP = '\x1b[5~'
    PAGE_DOWN = '\x1b[6~'

@dataclass
class CommandSuggestion:
    """Data class for AI command suggestions"""
    command: str
    explanation: str
    risk_level: str
    alternatives: List[str]
    context_hints: List[str]
    estimated_time: Optional[str] = None
    requires_sudo: bool = False
    is_destructive: bool = False

class TerminalCapabilities:
    """Detects and manages terminal capabilities for optimal UI rendering"""
    
    def __init__(self):
        self.platform_info = CrossPlatformUtils.get_platform_info()
        self.optimizations = CrossPlatformUtils.optimize_for_terminal()
        
        self.width, self.height = CrossPlatformUtils.get_terminal_size()
        self.supports_color = CrossPlatformUtils.supports_ansi_colors()
        self.supports_mouse = self.optimizations['mouse_support']
        self.supports_unicode = self.optimizations['use_unicode']
        self.terminal_type = self.platform_info['terminal']
        
    def _get_terminal_size(self) -> Tuple[int, int]:
        """Get terminal dimensions (deprecated, use CrossPlatformUtils)"""
        return CrossPlatformUtils.get_terminal_size()
            
    def _detect_color_support(self) -> bool:
        """Detect if terminal supports colors (deprecated, use CrossPlatformUtils)"""
        return CrossPlatformUtils.supports_ansi_colors()
        
    def _detect_mouse_support(self) -> bool:
        """Detect if terminal supports mouse events"""
        return self.optimizations['mouse_support']
        
    def _detect_unicode_support(self) -> bool:
        """Detect if terminal supports Unicode characters"""
        return self.optimizations['use_unicode']

class ColorScheme:
    """Terminal color scheme management"""
    
    def __init__(self, supports_color: bool = True):
        self.supports_color = supports_color
        
    def _colorize(self, text: str, color_code: str) -> str:
        """Apply color codes if supported"""
        if not self.supports_color:
            return text
        return f"\033[{color_code}m{text}\033[0m"
        
    def primary(self, text: str) -> str:
        return self._colorize(text, "36")  # Cyan
        
    def secondary(self, text: str) -> str:
        return self._colorize(text, "33")  # Yellow
        
    def success(self, text: str) -> str:
        return self._colorize(text, "32")  # Green
        
    def warning(self, text: str) -> str:
        return self._colorize(text, "93")  # Bright Yellow
        
    def error(self, text: str) -> str:
        return self._colorize(text, "31")  # Red
        
    def danger(self, text: str) -> str:
        return self._colorize(text, "91")  # Bright Red
        
    def muted(self, text: str) -> str:
        return self._colorize(text, "90")  # Bright Black
        
    def highlight(self, text: str) -> str:
        return self._colorize(text, "97;44")  # White on Blue
        
    def command(self, text: str) -> str:
        return self._colorize(text, "96")  # Bright Cyan
        
    def info(self, text: str) -> str:
        return self._colorize(text, "94")  # Bright Blue
        
    def cyan(self, text: str) -> str:
        return self._colorize(text, "36")  # Cyan
        
    def green(self, text: str) -> str:
        return self._colorize(text, "32")  # Green

class KeyboardInput:
    """Advanced keyboard input handling with gesture support"""
    
    def __init__(self):
        self.original_settings = None
        self.platform = platform.system()
        self._setup_terminal()
        
    def _setup_terminal(self):
        """Setup terminal for raw input mode"""
        if not sys.stdin.isatty():
            return
            
        if self.platform != 'Windows' and UNIX_AVAILABLE:
            try:
                self.original_settings = termios.tcgetattr(sys.stdin)
                tty.setraw(sys.stdin.fileno())
            except:
                pass  # Fallback for non-Unix systems
                
    def _restore_terminal(self):
        """Restore original terminal settings"""
        if self.original_settings and sys.stdin.isatty() and UNIX_AVAILABLE:
            try:
                termios.tcsetattr(sys.stdin, termios.TCSADRAIN, self.original_settings)
            except:
                pass
                
    def read_key(self, timeout: Optional[float] = None) -> Optional[str]:
        """Read a single key with optional timeout"""
        if not sys.stdin.isatty():
            return input()  # Fallback for non-interactive
            
        # Windows-specific handling
        if self.platform == 'Windows' and WINDOWS_AVAILABLE:
            return self._read_key_windows(timeout)
        
        # Unix-like systems
        elif UNIX_AVAILABLE:
            return self._read_key_unix(timeout)
        
        # Fallback
        else:
            try:
                return input()
            except:
                return None
                
    def _read_key_windows(self, timeout: Optional[float]) -> Optional[str]:
        """Windows-specific key reading"""
        import time
        start_time = time.time()
        
        while True:
            if msvcrt.kbhit():
                key = msvcrt.getch()
                if isinstance(key, bytes):
                    key = key.decode('utf-8', errors='ignore')
                
                # Handle backspace explicitly on Windows
                if key == '\x08':  # Backspace on Windows
                    return KeyCode.BACKSPACE.value
                
                # Handle special keys
                if key == '\x00' or key == '\xe0':  # Special key prefix
                    if msvcrt.kbhit():
                        special = msvcrt.getch()
                        if isinstance(special, bytes):
                            special = special.decode('utf-8', errors='ignore')
                        # Map special keys to escape sequences
                        special_map = {
                            'H': KeyCode.UP_ARROW.value,      # Up arrow
                            'P': KeyCode.DOWN_ARROW.value,    # Down arrow
                            'K': KeyCode.LEFT_ARROW.value,    # Left arrow
                            'M': KeyCode.RIGHT_ARROW.value,   # Right arrow
                            'G': KeyCode.HOME.value,          # Home
                            'O': KeyCode.END.value,           # End
                            'S': KeyCode.DELETE.value,        # Delete
                            'R': KeyCode.PAGE_UP.value,       # Page Up
                            'Q': KeyCode.PAGE_DOWN.value,     # Page Down
                        }
                        return special_map.get(special, special)
                
                return key
                
            if timeout and (time.time() - start_time) > timeout:
                return None
                
            time.sleep(0.01)  # Small delay to prevent busy waiting
            
    def _read_key_unix(self, timeout: Optional[float]) -> Optional[str]:
        """Unix-specific key reading"""
        try:
            if timeout:
                ready, _, _ = select.select([sys.stdin], [], [], timeout)
                if not ready:
                    return None
                    
            key = sys.stdin.read(1)
            
            # Handle escape sequences
            if key == '\x1b':
                # Read potential escape sequence
                if timeout:
                    ready, _, _ = select.select([sys.stdin], [], [], 0.1)
                    if ready:
                        key += sys.stdin.read(1)
                        if key == '\x1b[':
                            # Read the rest of the sequence
                            ready, _, _ = select.select([sys.stdin], [], [], 0.1)
                            if ready:
                                key += sys.stdin.read(1)
                                # Handle sequences that need more characters
                                if key[-1] in '0123456789':
                                    ready, _, _ = select.select([sys.stdin], [], [], 0.1)
                                    if ready:
                                        key += sys.stdin.read(1)
                else:
                    # Non-blocking read for escape sequences
                    try:
                        import fcntl
                        fd = sys.stdin.fileno()
                        flags = fcntl.fcntl(fd, fcntl.F_GETFL)
                        fcntl.fcntl(fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)
                        try:
                            key += sys.stdin.read(2)
                        except:
                            pass
                        finally:
                            fcntl.fcntl(fd, fcntl.F_SETFL, flags)
                    except:
                        pass
                        
            return key
            
        except KeyboardInterrupt:
            return KeyCode.CTRL_C.value
        except:
            return None
            
    def __enter__(self):
        return self
        
    def __exit__(self, exc_type, exc_val, exc_tb):
        self._restore_terminal()

class CommandEditor:
    """Advanced command line editor with syntax highlighting"""
    
    def __init__(self, terminal_caps: TerminalCapabilities, color_scheme: ColorScheme):
        self.terminal_caps = terminal_caps
        self.colors = color_scheme
        self.cursor_pos = 0
        self.command = ""
        self.history = []
        self.history_index = -1
        self.insert_mode = True  # True for insert, False for overwrite
        
    def _syntax_highlight(self, command: str) -> str:
        """Apply syntax highlighting to command"""
        if not self.colors.supports_color:
            return command
            
        # Basic syntax highlighting patterns
        patterns = [
            (r'\b(sudo|su)\b', self.colors.danger),  # Dangerous commands
            (r'\b(rm|rmdir|dd|mkfs|format)\b', self.colors.error),  # Destructive commands
            (r'\b(ls|cat|grep|find|which|whereis)\b', self.colors.success),  # Safe commands
            (r'\b(cd|pwd|echo|printf)\b', self.colors.primary),  # Navigation commands
            (r'[|&;]', self.colors.secondary),  # Operators
            (r'[<>]', self.colors.warning),  # Redirects
            (r'--?\w+', self.colors.muted),  # Flags
            (r'"[^"]*"', self.colors.highlight),  # Quoted strings
            (r"'[^']*'", self.colors.highlight),  # Single quoted strings
        ]
        
        result = command
        for pattern, color_func in patterns:
            result = re.sub(pattern, lambda m: color_func(m.group(0)), result)
            
        return result
        
    def _draw_command_line(self, command: str, cursor_pos: int):
        """Draw the command line with cursor"""
        # Clear current line
        print('\r\033[K')
        
        # Draw prompt with safe Unicode fallback
        if self._can_display_unicode():
            prompt = self.colors.primary("❯ ")
        else:
            prompt = self.colors.primary("> ")
        print(prompt)
        
        # For cursor positioning, we need to work with the raw command text
        # but display the highlighted version
        if cursor_pos < len(command):
            # Split command at cursor position
            before_cursor = command[:cursor_pos]
            at_cursor = command[cursor_pos]
            after_cursor = command[cursor_pos + 1:]
            
            # Display with highlighting, but show cursor position
            highlighted_before = self._syntax_highlight(before_cursor)
            highlighted_at = self.colors.highlight(at_cursor)
            highlighted_after = self._syntax_highlight(after_cursor)
            
            print(highlighted_before + highlighted_at + highlighted_after)
        else:
            # Cursor is at the end
            highlighted = self._syntax_highlight(command)
            print(highlighted)
            # Show cursor at end - different styles for insert/overwrite
            if self.insert_mode:
                if self._can_display_unicode():
                    cursor = self.colors.muted('█')  # Block cursor for insert
                else:
                    cursor = self.colors.muted('|')  # Fallback cursor
            else:
                if self._can_display_unicode():
                    cursor = self.colors.warning('▄')  # Underscore cursor for overwrite
                else:
                    cursor = self.colors.warning('_')  # Fallback cursor
            print(cursor)
        
    def edit_command(self, initial_command: str) -> Optional[str]:
        """Interactive command editing"""
        self.command = initial_command
        self.cursor_pos = len(initial_command)
        
        with KeyboardInput() as kbd:
            while True:
                self._draw_command_line(self.command, self.cursor_pos)
                
                key = kbd.read_key()
                if key is None:
                    continue
                    
                # Handle different key inputs
                if key == KeyCode.ENTER.value or key == KeyCode.NEWLINE.value:
                    print('\n')
                    return self.command
                    
                elif key == KeyCode.CTRL_C.value:
                    print('\n')
                    return None
                    
                elif key == KeyCode.CTRL_D.value:
                    if not self.command:
                        print('\n')
                        return None
                    
                elif key == KeyCode.BACKSPACE.value or key == '\x08' or (len(key) == 1 and ord(key) == 127):
                    # Handle different backspace codes: \x7f (127), \x08 (8)
                    if self.cursor_pos > 0:
                        self.command = self.command[:self.cursor_pos-1] + self.command[self.cursor_pos:]
                        self.cursor_pos -= 1
                        
                elif key == KeyCode.DELETE.value or (len(key) == 4 and key.startswith('\x1b[3')):
                    # Handle delete key and its variations
                    if self.cursor_pos < len(self.command):
                        self.command = self.command[:self.cursor_pos] + self.command[self.cursor_pos+1:]
                        
                elif key == KeyCode.LEFT_ARROW.value:
                    if self.cursor_pos > 0:
                        self.cursor_pos -= 1
                        
                elif key == KeyCode.RIGHT_ARROW.value:
                    if self.cursor_pos < len(self.command):
                        self.cursor_pos += 1
                        
                elif key == '\x1b[1;5D':  # Ctrl+Left Arrow - word left
                    if self.cursor_pos > 0:
                        # Move to beginning of current word or previous word
                        pos = self.cursor_pos - 1
                        # Skip whitespace
                        while pos > 0 and self.command[pos].isspace():
                            pos -= 1
                        # Skip word characters
                        while pos > 0 and not self.command[pos].isspace():
                            pos -= 1
                        # Move to start of word (skip whitespace)
                        while pos < len(self.command) and self.command[pos].isspace():
                            pos += 1
                        self.cursor_pos = pos
                        
                elif key == '\x1b[1;5C':  # Ctrl+Right Arrow - word right
                    if self.cursor_pos < len(self.command):
                        # Move to end of current word or next word
                        pos = self.cursor_pos
                        # Skip current word
                        while pos < len(self.command) and not self.command[pos].isspace():
                            pos += 1
                        # Skip whitespace
                        while pos < len(self.command) and self.command[pos].isspace():
                            pos += 1
                        self.cursor_pos = pos
                        
                elif key == KeyCode.HOME.value:
                    self.cursor_pos = 0
                    
                elif key == KeyCode.END.value:
                    self.cursor_pos = len(self.command)
                    
                elif key == KeyCode.CTRL_U.value:
                    # Clear from cursor to beginning
                    self.command = self.command[self.cursor_pos:]
                    self.cursor_pos = 0
                    
                elif key == KeyCode.CTRL_K.value:
                    # Clear from cursor to end
                    self.command = self.command[:self.cursor_pos]
                    
                elif key == '\x17':  # Ctrl+W - delete word before cursor
                    if self.cursor_pos > 0:
                        # Find start of current word
                        pos = self.cursor_pos - 1
                        # Skip whitespace
                        while pos >= 0 and self.command[pos].isspace():
                            pos -= 1
                        # Delete word characters
                        while pos >= 0 and not self.command[pos].isspace():
                            pos -= 1
                        pos += 1  # Move to start of word
                        # Delete from word start to cursor
                        self.command = self.command[:pos] + self.command[self.cursor_pos:]
                        self.cursor_pos = pos
                        
                elif key == '\x1b[3;5~':  # Ctrl+Delete - delete word after cursor
                    if self.cursor_pos < len(self.command):
                        # Find end of current word
                        pos = self.cursor_pos
                        # Skip whitespace
                        while pos < len(self.command) and self.command[pos].isspace():
                            pos += 1
                        # Delete word characters
                        while pos < len(self.command) and not self.command[pos].isspace():
                            pos += 1
                        # Delete from cursor to end of word
                        self.command = self.command[:self.cursor_pos] + self.command[pos:]
                    
                elif key == KeyCode.UP_ARROW.value:
                    # Command history
                    if self.history and self.history_index < len(self.history) - 1:
                        self.history_index += 1
                        self.command = self.history[-(self.history_index + 1)]
                        self.cursor_pos = len(self.command)
                        
                elif key == KeyCode.DOWN_ARROW.value:
                    # Command history
                    if self.history_index > 0:
                        self.history_index -= 1
                        self.command = self.history[-(self.history_index + 1)]
                        self.cursor_pos = len(self.command)
                    elif self.history_index == 0:
                        self.history_index = -1
                        self.command = initial_command
                        self.cursor_pos = len(self.command)
                        
                elif key == '\x1b[2~':  # Insert key - toggle insert/overwrite mode
                    self.insert_mode = not self.insert_mode
                    
                elif len(key) == 1 and key.isprintable():
                    # Insert or overwrite character based on mode
                    if self.insert_mode:
                        # Insert mode - insert character at cursor
                        self.command = self.command[:self.cursor_pos] + key + self.command[self.cursor_pos:]
                    else:
                        # Overwrite mode - replace character at cursor
                        if self.cursor_pos < len(self.command):
                            self.command = self.command[:self.cursor_pos] + key + self.command[self.cursor_pos + 1:]
                        else:
                            # At end of command, just append
                            self.command += key
                    self.cursor_pos += 1

class InteractiveCommandInterface:
    """Main interactive command interface with gesture support"""
    
    def __init__(self):
        self.terminal_caps = TerminalCapabilities()
        self.colors = ColorScheme(self.terminal_caps.supports_color)
        self.editor = CommandEditor(self.terminal_caps, self.colors)
        self.command_history = []
        
    def _can_display_unicode(self) -> bool:
        """Test if terminal can display Unicode characters safely"""
        try:
            # Test with a common Unicode character
            test_char = "─"
            encoding = sys.stdout.encoding or 'utf-8'
            test_char.encode(encoding)
            return encoding not in ['ascii', 'latin1']
        except (UnicodeEncodeError, LookupError):
            return False
        except Exception:
            # Conservative fallback for any other encoding issues
            return False
        
    def _safe_unicode_print(self, text: str) -> None:
        """Safely print text with Unicode fallback"""
        print(text)
    
    def _draw_box(self, content: List[str], title: str = "", width: Optional[int] = None, style: str = "normal") -> None:
        """Draw a decorative box around content with different styles"""
        if width is None:
            width = min(self.terminal_caps.width - 4, 80)
            
        # Detect if we can safely use Unicode
        can_use_unicode = self.terminal_caps.supports_unicode and self._can_display_unicode()
        
        # Box drawing characters based on style
        if can_use_unicode:
            if style == "rounded":
                top_left, top_right = "╭", "╮"
                bottom_left, bottom_right = "╰", "╯"
                horizontal, vertical = "─", "│"
                title_left, title_right = "─ ", " ─"
            elif style == "double":
                top_left, top_right = "╔", "╗"
                bottom_left, bottom_right = "╚", "╝"
                horizontal, vertical = "═", "║"
                title_left, title_right = "═ ", " ═"
            else:  # normal
                top_left, top_right = "┌", "┐"
                bottom_left, bottom_right = "└", "┘"
                horizontal, vertical = "─", "│"
                title_left, title_right = "─ ", " ─"
        else:
            top_left = top_right = bottom_left = bottom_right = "+"
            horizontal = vertical = "-"
            title_left = title_right = "- "
            
        # Top border with title
        if title:
            title_text = f"{title_left}{title}{title_right}"
            padding = max(0, width - len(title_text) - 2)
            top_line = f"{top_left}{title_text}{horizontal * padding}{top_right}"
        else:
            top_line = f"{top_left}{horizontal * (width - 2)}{top_right}"
            
        self._safe_unicode_print(self.colors.primary(top_line))
        
        # Content lines
        for line in content:
            # Handle ANSI color codes when calculating length
            ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
            clean_line = ansi_escape.sub('', line)
            
            # Truncate or pad line to fit box
            if len(clean_line) > width - 4:
                # Truncate at character boundary
                display_line = line[:width-7] + "..."
            else:
                display_line = line
                
            # Calculate padding based on clean line length
            clean_display = ansi_escape.sub('', display_line)
            padding = width - len(clean_display) - 4
            content_line = f"{vertical} {display_line}{' ' * padding} {vertical}"
            self._safe_unicode_print(self.colors.primary(content_line))
            
        # Bottom border
        bottom_line = f"{bottom_left}{horizontal * (width - 2)}{bottom_right}"
        self._safe_unicode_print(self.colors.primary(bottom_line))
        
    def _assess_command_risk(self, command: str) -> Tuple[str, bool]:
        """Assess the risk level of a command"""
        dangerous_patterns = [
            r'\brm\s+.*-r',  # Recursive remove
            r'\bdd\s+',  # Disk operations
            r'\bmkfs\.',  # Format filesystem
            r'\bformat\b',  # Format command
            r'\bfdisk\b',  # Partition editor
            r'\bshred\b',  # Secure delete
            r'\bchmod\s+777',  # Dangerous permissions
            r'\bchown\s+.*root',  # Change ownership to root
            r'>\s*/dev/',  # Writing to device files
            r'\bcrontab\s+-r',  # Remove crontab
            r'\biptables\s+-F',  # Flush firewall rules
        ]
        
        destructive_patterns = [
            r'\brm\s+.*/',  # Remove directories
            r'\bmv\s+.*\s+/dev/null',  # Move to null device
            r'\btruncate\s+',  # Truncate files
            r'>\s*[^|&;]*$',  # Redirect to file (overwrites)
        ]
        
        for pattern in dangerous_patterns:
            if re.search(pattern, command, re.IGNORECASE):
                return "HIGH", True
                
        for pattern in destructive_patterns:
            if re.search(pattern, command, re.IGNORECASE):
                return "MEDIUM", True
                
        if 'sudo' in command.lower():
            return "MEDIUM", False
            
        return "LOW", False
        
    def _generate_command_explanation(self, command: str) -> List[str]:
        """Generate human-readable explanation of command"""
        explanations = []
        
        # Basic command explanations
        if command.startswith('find '):
            explanations.append("• Searches for files and directories")
        elif command.startswith('ls '):
            explanations.append("• Lists directory contents")
        elif command.startswith('grep '):
            explanations.append("• Searches for patterns in text")
        elif command.startswith('cat '):
            explanations.append("• Displays file contents")
        elif command.startswith('chmod '):
            explanations.append("• Changes file permissions")
        elif command.startswith('chown '):
            explanations.append("• Changes file ownership")
        elif 'sudo' in command:
            explanations.append("• Requires administrator privileges")
            
        # Flag explanations
        if '-r' in command:
            explanations.append("• Operates recursively on directories")
        if '-f' in command:
            explanations.append("• Forces operation without confirmation")
        if '-v' in command:
            explanations.append("• Provides verbose output")
        if '-h' in command:
            explanations.append("• Shows human-readable format")
            
        if self._can_display_unicode():
            return explanations if explanations else ["• Command will be executed as specified"]
        else:
            # ASCII fallback for bullet points
            if explanations:
                return [explanation.replace("•", "*") for explanation in explanations]
            else:
                return ["* Command will be executed as specified"]
        
    def display_command_preview(self, suggestion: CommandSuggestion) -> None:
        """Display interactive command preview"""
        # Clear screen area
        print()
        
        # Main command display
        content = [
            self.colors.command(suggestion.command),
            "",
        ]
        
        # Add explanation
        content.extend(suggestion.explanation.split('\n') if suggestion.explanation else 
                      self._generate_command_explanation(suggestion.command))
        
        # Add risk assessment
        risk_level, is_destructive = self._assess_command_risk(suggestion.command)
        # Risk warnings with safe Unicode fallbacks
        if risk_level == "HIGH":
            content.append("")
            if self._can_display_unicode():
                content.append(self.colors.danger("⚠️  HIGH RISK - This command may cause data loss"))
            else:
                content.append(self.colors.danger("WARNING: HIGH RISK - This command may cause data loss"))
        elif risk_level == "MEDIUM":
            content.append("")
            if self._can_display_unicode():
                content.append(self.colors.warning("⚠️  MEDIUM RISK - Use with caution"))
            else:
                content.append(self.colors.warning("WARNING: MEDIUM RISK - Use with caution"))
            
        # Add context hints
        if suggestion.context_hints:
            content.append("")
            if self._can_display_unicode():
                content.extend(f"💡 {hint}" for hint in suggestion.context_hints)
            else:
                content.extend(f"TIP: {hint}" for hint in suggestion.context_hints)
            
        self._draw_box(content, "AI Command Suggestion")
        
        # Controls menu with better spacing and organization
        print()  # Add space before controls
        
        # Primary actions with safe Unicode fallbacks
        can_use_unicode = self._can_display_unicode()
        
        if can_use_unicode:
            primary_actions = [
                (self.colors.success('↵ Enter'), 'Execute'),
                (self.colors.primary('⇥ Tab'), 'Accept (paste to CLI)'),
                (self.colors.secondary('📋 Ctrl+C'), 'Copy to Clipboard'),
            ]
            
            # Secondary actions
            secondary_actions = []
            
            if suggestion.alternatives:
                secondary_actions.append((self.colors.primary('⚡ Ctrl+A'), 'Show Alternatives'))
                
            # Exit actions
            exit_actions = [
                (self.colors.muted('✗ Esc'), 'Cancel'),
                (self.colors.info('? Help'), 'Show Help'),
            ]
        else:
            # ASCII fallback versions
            primary_actions = [
                (self.colors.success('Enter'), 'Execute'),
                (self.colors.primary('Tab'), 'Accept (paste to CLI)'),
                (self.colors.secondary('Ctrl+C'), 'Copy to Clipboard'),
            ]
            
            # Secondary actions
            secondary_actions = []
            
            if suggestion.alternatives:
                secondary_actions.append((self.colors.primary('Ctrl+A'), 'Show Alternatives'))
                
            # Exit actions
            exit_actions = [
                (self.colors.muted('Esc'), 'Cancel'),
                (self.colors.info('? Help'), 'Show Help'),
            ]
        
        # Create formatted menu sections
        term_width = self.terminal_caps.width
        menu_width = min(term_width - 4, 80)  # Max width of 80 chars
        
        # Draw controls box
        box_content = []
        
        # Primary actions section
        box_content.append(self.colors.secondary("Quick Actions:"))
        for key, action in primary_actions:
            box_content.append(f"  {key:<20} {action}")
        
        # Secondary actions section (only if there are any)
        if secondary_actions:
            box_content.append("")  # Spacing
            box_content.append(self.colors.secondary("Options:"))
            for key, action in secondary_actions:
                box_content.append(f"  {key:<20} {action}")
        
        box_content.append("")  # Spacing
        
        # Exit section
        box_content.append(self.colors.secondary("Exit:"))
        for key, action in exit_actions:
            box_content.append(f"  {key:<20} {action}")
            
        self._draw_box(box_content, "Command Controls", width=menu_width, style="rounded")
        
    def handle_gesture_input(self, suggestion: CommandSuggestion) -> Tuple[str, Optional[str]]:
        """Handle gesture-based input for command interaction"""
        with KeyboardInput() as kbd:
            while True:
                key = kbd.read_key()
                if key is None:
                    continue
                    
                # Execute command (Enter only)
                if key == KeyCode.ENTER.value or key == KeyCode.NEWLINE.value:
                    return "execute", suggestion.command
                    
                # Accept to CLI (Tab) - paste command into CLI
                elif key == KeyCode.TAB.value:
                    return "accept", suggestion.command
                    
                # Copy to clipboard (Ctrl+C)
                elif key == KeyCode.CTRL_C.value:
                    return "clipboard", suggestion.command
                        
                # Show alternatives (Ctrl+A)
                elif key == KeyCode.CTRL_A.value:
                    if suggestion.alternatives:
                        return "alternatives", None
                    else:
                        print(f"\n{self.colors.muted('No alternatives available')}")
                        time.sleep(1)
                        return "redraw", None
                        
                # Cancel (Esc)
                elif key == KeyCode.ESC.value:
                    return "cancel", None
                    
                # Help (Ctrl+? or ?)
                elif key == KeyCode.CTRL_QUESTION.value or key == '?':
                    return "help", None
                    
    def copy_to_clipboard(self, command: str) -> bool:
        """Copy command to system clipboard"""
        return CrossPlatformUtils.copy_to_clipboard(command)
            
    def show_alternatives(self, alternatives: List[str]) -> Optional[str]:
        """Display and allow selection of alternative commands"""
        if not alternatives:
            return None
            
        print(f"\n{self.colors.secondary('Alternative Commands:')}")
        for i, alt in enumerate(alternatives, 1):
            print(f"{self.colors.primary(str(i))}. {self.colors.command(alt)}")
            
        print(f"\n{self.colors.muted('Enter number to select, or press Enter to go back')}")
        
        with KeyboardInput() as kbd:
            selection = ""
            while True:
                key = kbd.read_key()
                if key is None:
                    continue
                    
                if key == KeyCode.ENTER.value or key == KeyCode.NEWLINE.value:
                    if selection.isdigit():
                        idx = int(selection) - 1
                        if 0 <= idx < len(alternatives):
                            return alternatives[idx]
                    return None
                    
                elif key == KeyCode.CTRL_C.value or key == KeyCode.ESC.value:
                    return None
                    
                elif key.isdigit():
                    selection = key
                    sys.stdout.write(f"\r{self.colors.primary('Selected:')} {selection}")
                    sys.stdout.flush()
                    
    def process_command_interaction(self, suggestion: CommandSuggestion) -> Optional[str]:
        """Main command interaction loop"""
        while True:
            # Display command preview
            self.display_command_preview(suggestion)
            
            # Handle gesture input
            action, result = self.handle_gesture_input(suggestion)
            
            if action == "execute":
                return result
                
            elif action == "accept":
                # Return special value to indicate command should be pasted to CLI
                return f"ACCEPT:{result}"
                
            elif action == "clipboard":
                if self.copy_to_clipboard(result):
                    print(f"\n{self.colors.success('✓ Command copied to clipboard')}")
                else:
                    print(f"\n{self.colors.warning('⚠️  Could not copy to clipboard')}")
                    print(f"{self.colors.muted('Command:')} {self.colors.command(result)}")
                time.sleep(2)
                return None
                
            elif action == "alternatives":
                selected = self.show_alternatives(suggestion.alternatives)
                if selected:
                    suggestion.command = selected
                    continue
                    
            elif action == "cancel":
                return None
                
            elif action == "help":
                self._show_help()
                
            elif action == "redraw":
                # Clear screen and redraw
                print("\033[2J\033[H")
                continue
            
    def _show_help(self):
        """Display help information"""
        help_content = [
            "Gesture Commands:",
            "",
            "Enter       - Execute command immediately",
            "Tab         - Accept command and paste to CLI if focused",
            "Ctrl + A    - Show alternative commands",
            "Esc         - Cancel and exit",
            "?           - Show help",
            "",
        ]
        
        self._draw_box(help_content, "Help")
        msg = f"\n{self.colors.muted('Press any key to continue...')}"
        print(msg)
        
        with KeyboardInput() as kbd:
            kbd.read_key()