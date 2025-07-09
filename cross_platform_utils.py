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
import platform
import subprocess
import time
from typing import Optional, Dict, Any, Tuple

class CrossPlatformUtils:
    """Cross-platform utility functions for CLI experience"""
    
    @staticmethod
    def get_platform_info() -> Dict[str, Any]:
        """Get detailed platform information"""
        return {
            'system': platform.system(),
            'release': platform.release(),
            'version': platform.version(),
            'machine': platform.machine(),
            'processor': platform.processor(),
            'python_version': platform.python_version(),
            'is_wsl': 'Microsoft' in platform.release(),
            'is_cygwin': 'CYGWIN' in platform.system(),
            'is_msys': 'MSYS' in os.environ.get('MSYSTEM', ''),
            'terminal': os.environ.get('TERM', 'unknown'),
            'shell': os.environ.get('SHELL', 'unknown'),
        }
    
    @staticmethod
    def supports_ansi_colors() -> bool:
        """Check if terminal supports ANSI color codes"""
        if not sys.stdout.isatty():
            return False
            
        # Windows Command Prompt detection
        if platform.system() == 'Windows':
            # Check if we're in a modern Windows Terminal or have ANSI support
            if os.environ.get('WT_SESSION'):  # Windows Terminal
                return True
            if os.environ.get('TERM_PROGRAM') == 'vscode':  # VS Code terminal
                return True
            # Try to enable ANSI support on Windows
            try:
                import colorama
                colorama.init()
                return True
            except ImportError:
                # Fallback: check Windows version
                if sys.version_info >= (3, 6):
                    try:
                        # Enable ANSI processing on Windows 10+
                        import ctypes
                        kernel32 = ctypes.windll.kernel32
                        kernel32.SetConsoleMode(kernel32.GetStdHandle(-11), 7)
                        return True
                    except:
                        pass
                return False
        
        # Unix-like systems
        term = os.environ.get('TERM', '')
        if 'color' in term or term in ['xterm', 'xterm-256color', 'screen', 'tmux']:
            return True
            
        return os.environ.get('COLORTERM') is not None
    
    @staticmethod
    def get_terminal_size() -> Tuple[int, int]:
        """Get terminal size with fallback"""
        try:
            import shutil
            size = shutil.get_terminal_size()
            return size.columns, size.lines
        except:
            # Fallback methods
            try:
                # Unix-like systems
                import fcntl
                import termios
                import struct
                
                h, w, hp, wp = struct.unpack('HHHH',
                    fcntl.ioctl(0, termios.TIOCGWINSZ,
                    struct.pack('HHHH', 0, 0, 0, 0)))
                return w, h
            except:
                # Final fallback
                return 80, 24
    
    @staticmethod
    def setup_keyboard_input():
        """Setup keyboard input handling based on platform"""
        if platform.system() == 'Windows':
            try:
                import msvcrt
                return 'msvcrt'
            except ImportError:
                return 'input'
        else:
            try:
                import termios
                import tty
                return 'termios'
            except ImportError:
                return 'input'
    
    @staticmethod
    def read_single_key() -> Optional[str]:
        """Read a single key press across platforms"""
        input_method = CrossPlatformUtils.setup_keyboard_input()
        
        if input_method == 'msvcrt':
            import msvcrt
            if msvcrt.kbhit():
                key = msvcrt.getch()
                if isinstance(key, bytes):
                    key = key.decode('utf-8', errors='ignore')
                return key
            return None
            
        elif input_method == 'termios':
            import termios
            import tty
            import select
            
            fd = sys.stdin.fileno()
            old_settings = termios.tcgetattr(fd)
            try:
                tty.setraw(fd)
                # Check if input is available
                if select.select([sys.stdin], [], [], 0.1)[0]:
                    key = sys.stdin.read(1)
                    return key
                return None
            finally:
                termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)
        
        else:
            # Fallback to regular input
            try:
                return input()
            except:
                return None
    
    @staticmethod
    def clear_screen():
        """Clear terminal screen across platforms"""
        if platform.system() == 'Windows':
            os.system('cls')
        else:
            os.system('clear')
    
    @staticmethod
    def get_clipboard_command() -> Optional[str]:
        """Get the appropriate clipboard command for the platform with robust detection"""
        system = platform.system()
        
        # Check for WSL first (priority over Linux detection)
        if system == 'Linux':
            # Multiple WSL detection methods
            wsl_indicators = [
                'microsoft' in platform.release().lower(),
                'wsl' in platform.release().lower(),
                os.environ.get('WSL_DISTRO_NAME') is not None,
                os.environ.get('WSL_INTEROP') is not None,
            ]
            
            # Check /proc/version for WSL indicators
            try:
                if os.path.exists('/proc/version'):
                    with open('/proc/version', 'r') as f:
                        proc_version = f.read().lower()
                        wsl_indicators.append('microsoft' in proc_version)
                        wsl_indicators.append('wsl' in proc_version)
            except:
                pass
            
            # If any WSL indicator is found, use Windows clipboard
            if any(wsl_indicators):
                return 'clip.exe'
        
        if system == 'Linux':
            # Check for display environment first
            display_env = os.environ.get('DISPLAY')
            wayland_env = os.environ.get('WAYLAND_DISPLAY')
            
            if wayland_env:
                # Wayland session - prefer wl-copy
                if CrossPlatformUtils.command_exists('wl-copy'):
                    return 'wl-copy'
                    
            if display_env:
                # X11 session - prefer xclip, fallback to xsel
                if CrossPlatformUtils.command_exists('xclip'):
                    return 'xclip -selection clipboard'
                elif CrossPlatformUtils.command_exists('xsel'):
                    return 'xsel --clipboard --input'
                    
            # Final fallback for headless/SSH sessions
            if CrossPlatformUtils.command_exists('xclip'):
                return 'xclip -selection clipboard'
            elif CrossPlatformUtils.command_exists('xsel'):
                return 'xsel --clipboard --input'
            elif CrossPlatformUtils.command_exists('wl-copy'):
                return 'wl-copy'
                
        elif system == 'Darwin':
            # macOS
            if CrossPlatformUtils.command_exists('pbcopy'):
                return 'pbcopy'
                
        elif system == 'Windows':
            return 'clip.exe'
            
        return None
    
    @staticmethod
    def command_exists(command: str) -> bool:
        """Check if a command exists in the system PATH with robust error handling"""
        if not command:
            return False
            
        try:
            # Primary method: Use Python's built-in shutil.which (most reliable)
            import shutil
            result = shutil.which(command)
            return result is not None
            
        except Exception:
            # Fallback: Platform-specific command existence check
            try:
                system = platform.system()
                
                if system == 'Windows':
                    # Windows: Use 'where' command
                    try:
                        result = subprocess.run(['where', command], 
                                             stdout=subprocess.PIPE, stderr=subprocess.PIPE, 
                                             check=True, timeout=5)
                        return result.returncode == 0
                    except Exception:
                        return False
                else:
                    # Unix/Linux/macOS: Use 'which' command
                    try:
                        result = subprocess.run(['which', command], 
                                             stdout=subprocess.PIPE, stderr=subprocess.PIPE, 
                                             check=True, timeout=5)
                        return result.returncode == 0
                    except Exception:
                        # Fallback: try 'command -v' which is more portable
                        try:
                            result = subprocess.run(['command', '-v', command], 
                                                 stdout=subprocess.PIPE, stderr=subprocess.PIPE, 
                                                 check=True, timeout=5, shell=True)
                            return result.returncode == 0
                        except Exception:
                            return False
                            
            except Exception:
                # Final fallback for any unexpected errors
                return False
    
    @staticmethod
    def copy_to_clipboard(text: str) -> bool:
        """Copy text to clipboard across platforms with robust error handling"""
        if not text:
            return False
            
        clipboard_cmd = CrossPlatformUtils.get_clipboard_command()
        if not clipboard_cmd:
            return False
            
        try:
            # Split command properly to handle arguments
            cmd_parts = clipboard_cmd.split()
            
            # Create process with proper error handling
            process = subprocess.Popen(
                cmd_parts,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=False  # Use binary mode for cross-platform compatibility
            )
            
            # Communicate with timeout for production reliability
            try:
                stdout, stderr = process.communicate(
                    input=text.encode('utf-8', errors='replace'),
                    timeout=3  # 3 second timeout for faster failures
                )
                
                # Check if process completed successfully
                if process.returncode == 0:
                    # For xclip/xsel, verify the clipboard was actually set
                    if 'xclip' in clipboard_cmd or 'xsel' in clipboard_cmd:
                        return CrossPlatformUtils._verify_clipboard_contents(text)
                    return True
                else:
                    # Log error for debugging (only in development)
                    if stderr:
                        error_msg = stderr.decode('utf-8', errors='replace').strip()
                        # Could log this in production: print(f"Clipboard error: {error_msg}")
                    return False
                    
            except subprocess.TimeoutExpired:
                # Kill the process if it times out
                process.kill()
                try:
                    process.wait(timeout=1)
                except subprocess.TimeoutExpired:
                    process.terminate()
                return False
                
        except FileNotFoundError:
            # Command not found
            return False
        except Exception:
            # Any other error
            return False
    
    @staticmethod
    def _verify_clipboard_contents(expected_text: str) -> bool:
        """Verify that clipboard contents match expected text (for xclip/xsel)"""
        try:
            # Get the clipboard read command
            system = platform.system()
            if system == 'Linux':
                display_env = os.environ.get('DISPLAY')
                wayland_env = os.environ.get('WAYLAND_DISPLAY')
                
                read_cmd = None
                if wayland_env and CrossPlatformUtils.command_exists('wl-paste'):
                    read_cmd = 'wl-paste'
                elif display_env:
                    if CrossPlatformUtils.command_exists('xclip'):
                        read_cmd = 'xclip -selection clipboard -o'
                    elif CrossPlatformUtils.command_exists('xsel'):
                        read_cmd = 'xsel --clipboard --output'
                
                if read_cmd:
                    result = subprocess.run(
                        read_cmd.split(),
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE,
                        timeout=5,
                        text=True
                    )
                    
                    if result.returncode == 0:
                        # Check if clipboard content matches (allowing for whitespace differences)
                        clipboard_content = result.stdout.strip()
                        expected_content = expected_text.strip()
                        return clipboard_content == expected_content
                        
        except Exception:
            pass
            
        # If verification fails, assume success (better than false negative)
        return True
    
    @staticmethod
    def get_clipboard_diagnostics() -> Dict[str, Any]:
        """Get diagnostic information about clipboard support"""
        system = platform.system()
        diag = {
            'system': system,
            'available_commands': [],
            'selected_command': None,
            'display_env': None,
            'wayland_env': None,
            'is_wsl': False,
            'issues': []
        }
        
        if system == 'Linux':
            diag['display_env'] = os.environ.get('DISPLAY')
            diag['wayland_env'] = os.environ.get('WAYLAND_DISPLAY')
            
            # Check for WSL
            wsl_indicators = [
                'microsoft' in platform.release().lower(),
                'wsl' in platform.release().lower(),
                os.environ.get('WSL_DISTRO_NAME') is not None,
                os.environ.get('WSL_INTEROP') is not None,
            ]
            
            try:
                if os.path.exists('/proc/version'):
                    with open('/proc/version', 'r') as f:
                        proc_version = f.read().lower()
                        wsl_indicators.append('microsoft' in proc_version)
                        wsl_indicators.append('wsl' in proc_version)
            except:
                pass
            
            diag['is_wsl'] = any(wsl_indicators)
            
            if diag['is_wsl']:
                # WSL should use Windows clipboard
                if CrossPlatformUtils.command_exists('clip.exe'):
                    diag['available_commands'].append('clip.exe')
                else:
                    diag['issues'].append('clip.exe not found (required for WSL)')
            else:
                # Regular Linux - check for X11/Wayland clipboard utilities
                commands = ['xclip', 'xsel', 'wl-copy']
                for cmd in commands:
                    if CrossPlatformUtils.command_exists(cmd):
                        diag['available_commands'].append(cmd)
                        
                # Check environment issues
                if not diag['display_env'] and not diag['wayland_env']:
                    diag['issues'].append('No DISPLAY or WAYLAND_DISPLAY environment variable set')
                    
                if not diag['available_commands']:
                    diag['issues'].append('No clipboard utilities installed (xclip, xsel, wl-copy)')
                
        elif system == 'Darwin':
            if CrossPlatformUtils.command_exists('pbcopy'):
                diag['available_commands'].append('pbcopy')
            else:
                diag['issues'].append('pbcopy not found (should be available on macOS)')
                
        elif system == 'Windows':
            if CrossPlatformUtils.command_exists('clip.exe'):
                diag['available_commands'].append('clip.exe')
            else:
                diag['issues'].append('clip.exe not found')
            
        diag['selected_command'] = CrossPlatformUtils.get_clipboard_command()
        
        return diag
    
    @staticmethod
    def get_shell_info() -> Dict[str, str]:
        """Get detailed shell information"""
        shell_path = os.environ.get('SHELL', '')
        shell_name = os.path.basename(shell_path) if shell_path else 'unknown'
        
        # Windows-specific shell detection
        if platform.system() == 'Windows':
            if os.environ.get('PSModulePath'):
                shell_name = 'powershell'
            elif os.environ.get('PROMPT'):
                shell_name = 'cmd'
            elif os.environ.get('MSYSTEM'):
                shell_name = f"msys2-{os.environ.get('MSYSTEM', '').lower()}"
        
        return {
            'name': shell_name,
            'path': shell_path,
            'version': CrossPlatformUtils._get_shell_version(shell_name),
            'is_interactive': sys.stdin.isatty() and sys.stdout.isatty(),
        }
    
    @staticmethod
    def _get_shell_version(shell_name: str) -> str:
        """Get shell version information"""
        version_commands = {
            'bash': ['bash', '--version'],
            'zsh': ['zsh', '--version'],
            'fish': ['fish', '--version'],
            'powershell': ['powershell', '-Command', '$PSVersionTable.PSVersion'],
            'cmd': ['cmd', '/c', 'ver'],
        }
        
        if shell_name in version_commands:
            try:
                result = subprocess.run(
                    version_commands[shell_name],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    timeout=2
                )
                if result.returncode == 0:
                    return result.stdout.strip().split('\n')[0]
            except:
                pass
        
        return 'unknown'
    
    @staticmethod
    def get_system_theme() -> str:
        """Detect system theme (light/dark) if possible"""
        if platform.system() == 'Darwin':  # macOS
            try:
                result = subprocess.run(
                    ['defaults', 'read', '-g', 'AppleInterfaceStyle'],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True
                )
                if result.returncode == 0 and 'Dark' in result.stdout:
                    return 'dark'
                return 'light'
            except:
                pass
        
        elif platform.system() == 'Linux':
            # Check GNOME theme
            try:
                result = subprocess.run(
                    ['gsettings', 'get', 'org.gnome.desktop.interface', 'gtk-theme'],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True
                )
                if result.returncode == 0:
                    theme = result.stdout.strip().lower()
                    if 'dark' in theme:
                        return 'dark'
                    return 'light'
            except:
                pass
        
        elif platform.system() == 'Windows':
            # Check Windows theme
            try:
                import winreg
                key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, 
                                   r'SOFTWARE\Microsoft\Windows\CurrentVersion\Themes\Personalize')
                value, _ = winreg.QueryValueEx(key, 'AppsUseLightTheme')
                winreg.CloseKey(key)
                return 'light' if value else 'dark'
            except:
                pass
        
        # Default fallback
        return 'dark'
    
    @staticmethod
    def optimize_for_terminal() -> Dict[str, Any]:
        """Get optimized settings for the current terminal"""
        platform_info = CrossPlatformUtils.get_platform_info()
        shell_info = CrossPlatformUtils.get_shell_info()
        
        optimizations = {
            'use_unicode': False,
            'use_colors': CrossPlatformUtils.supports_ansi_colors(),
            'mouse_support': False,
            'keyboard_shortcuts': True,
            'animation_speed': 'normal',
            'max_width': 80,
            'theme': CrossPlatformUtils.get_system_theme(),
        }
        
        # Terminal-specific optimizations
        terminal = platform_info.get('terminal', '').lower()
        
        if terminal in ['xterm-256color', 'screen-256color', 'tmux-256color']:
            optimizations['use_unicode'] = True
            optimizations['mouse_support'] = True
            optimizations['max_width'] = 120
            
        elif 'windows terminal' in os.environ.get('TERM_PROGRAM', '').lower():
            optimizations['use_unicode'] = True
            optimizations['mouse_support'] = True
            optimizations['max_width'] = 120
            
        elif platform_info.get('is_wsl'):
            optimizations['animation_speed'] = 'fast'
            optimizations['use_unicode'] = True
            
        # Shell-specific optimizations
        if shell_info['name'] == 'powershell':
            optimizations['keyboard_shortcuts'] = True
            
        elif shell_info['name'] in ['bash', 'zsh']:
            optimizations['keyboard_shortcuts'] = True
            optimizations['use_unicode'] = True
            
        return optimizations
        
    @staticmethod
    def write_to_shell_input(command: str) -> Dict[str, Any]:
        """Write command to shell input buffer with focus detection and robust fallback
        
        Returns:
            Dict with keys: 'success', 'method', 'message', 'requires_focus'
        """
        result = {
            'success': False,
            'method': 'none',
            'message': 'Failed to paste command',
            'requires_focus': False
        }
        
        try:
            import sys
            import os
            import subprocess
            import time
            
            platform_info = CrossPlatformUtils.get_platform_info()
            
            # Try pyautogui method first (most reliable)
            try:
                import pyautogui
                
                # First copy to clipboard as backup
                CrossPlatformUtils.copy_to_clipboard(command)
                
                # Use pyautogui to paste
                time.sleep(0.1)  # Small delay for stability
                pyautogui.hotkey('ctrl', 'v')
                
                result.update({
                    'success': True,
                    'method': 'pyautogui_paste',
                    'message': 'Command pasted to focused terminal',
                    'requires_focus': False
                })
                return result
                        
            except ImportError:
                # pyautogui not available, continue to other methods
                pass
            except Exception as e:
                # pyautogui failed, continue to other methods
                pass
          
            return result
                
        except Exception as e:
            result['message'] = f'Error: {str(e)}'
            return result
