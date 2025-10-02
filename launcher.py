#!/usr/bin/env python3
# Shebang will be ignored when using explicit python path from alias

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
    """Main launcher function that directly uses assistant.py"""
    capabilities = detect_terminal_capabilities()
    
    # Handle version/info requests
    if len(sys.argv) > 1 and sys.argv[1] in ['--version', '--info', '--capabilities']:
        show_version_info(capabilities)
        sys.exit(0)
    
    # Directly use assistant.py
    try:
        from assistant import main as assistant_main
        assistant_main()
    except ImportError as e:
        print_colored(f"Error: Could not load assistant: {e}", "31", capabilities)
        print_colored("Please ensure assistant.py is available.", "33", capabilities)
        sys.exit(1)
    except Exception as e:
        print_colored(f"Error in assistant: {e}", "31", capabilities)
        sys.exit(1)

if __name__ == "__main__":
    main()