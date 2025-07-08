#!/usr/bin/env python3

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

"""
Launcher that can fall back to the original assistant if needed
"""

import sys
import os
import platform
from typing import Optional

def detect_terminal_capabilities() -> dict:
    """Detect terminal capabilities for optimal experience"""
    capabilities = {
        'is_interactive': sys.stdin.isatty() and sys.stdout.isatty(),
        'supports_color': False,
        'supports_unicode': False,
        'terminal_type': os.environ.get('TERM', 'unknown'),
        'platform': platform.system(),
    }
    
    # Basic color support detection
    if capabilities['is_interactive']:
        term = capabilities['terminal_type'].lower()
        if 'color' in term or term in ['xterm', 'xterm-256color', 'screen', 'tmux']:
            capabilities['supports_color'] = True
        elif os.environ.get('COLORTERM'):
            capabilities['supports_color'] = True
        elif platform.system() == 'Windows':
            # Windows Terminal or VS Code
            if os.environ.get('WT_SESSION') or os.environ.get('TERM_PROGRAM') == 'vscode':
                capabilities['supports_color'] = True
    
    return capabilities

def print_colored(text: str, color_code: str = "", capabilities: dict = None) -> None:
    """Print colored text if terminal supports it"""
    if capabilities and capabilities.get('supports_color', False):
        print(f"\033[{color_code}m{text}\033[0m")
    else:
        print(text)

def test_ui_availability() -> bool:
    """Test if UI components are available and working"""
    try:
        # Try importing essential components
        from ui import InteractiveCommandInterface, TerminalCapabilities
        from cross_platform_utils import CrossPlatformUtils
        from assistant import AIAssistant
        
        # Quick capability test
        caps = TerminalCapabilities()
        utils_test = CrossPlatformUtils.get_platform_info()
        
        return True
    except ImportError as e:
        return False
    except Exception as e:
        return False

def show_version_info(capabilities: dict) -> None:
    """Show version and capability information"""
    print_colored("CLI AI Assistant Launcher", "36;1", capabilities)
    print_colored(f"Platform: {capabilities['platform']}", "90", capabilities)
    print_colored(f"Terminal: {capabilities['terminal_type']}", "90", capabilities)
    if capabilities['supports_color']:
        print_colored("✓ Color support enabled", "32", capabilities)
    else:
        print("• Basic terminal mode")

def main():
    """Main launcher function with detection and fallback"""
    capabilities = detect_terminal_capabilities()
    
    # Handle version/info requests
    if len(sys.argv) > 1 and sys.argv[1] in ['--version', '--info', '--capabilities']:
        show_version_info(capabilities)
        sys.exit(0)
    
    # Test UI availability
    ui_available = test_ui_availability()
    
    if ui_available and capabilities['is_interactive']:
        try:
            # Use assistant for interactive sessions
            from assistant import main as main
            main()
        except Exception as e:
            print_colored(f"UI error: {e}", "33", capabilities)
            print_colored("Falling back to original assistant...", "90", capabilities)
            try:
                from ai_assistant import main as original_main
                original_main()
            except Exception as e2:
                print_colored(f"Fallback error: {e2}", "31", capabilities)
                sys.exit(1)
    else:
        # Use original assistant for non-interactive or when UI unavailable
        if not ui_available:
            print_colored("UI not available, using original assistant", "33", capabilities)
        
        try:
            from ai_assistant import main as original_main
            original_main()
        except ImportError as e:
            print_colored(f"Error: Could not load any assistant: {e}", "31", capabilities)
            print_colored("Please run the setup script again.", "33", capabilities)
            sys.exit(1)
        except Exception as e:
            print_colored(f"Error in assistant: {e}", "31", capabilities)
            sys.exit(1)

if __name__ == "__main__":
    main()