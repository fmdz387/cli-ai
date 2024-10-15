import os
import sys
import anthropic
import threading
from utils import (
    get_config,
    update_config,
    loader_animation,
    display_help,
    execute_command,
    get_api_key,
    get_current_directory_tree,
    determine_shell_environment,
    execute_command
)

# Retrieve the API key
api_key = get_api_key()
config = get_config()
os.environ["ANTHROPIC_API_KEY"] = api_key

client = anthropic.Anthropic()

# Function to get the AI suggestion
def get_ai_suggestion(user_input):
    # Determine the shell environment
    shell_environment = determine_shell_environment()

    prompt = f"""Your Role: You are an AI assistant for {shell_environment}, translating natural language into commands.
    Your Task: Translate the following natural language input into an appropriate working command for a {shell_environment}:
    <natural_language_input>
    {user_input}
    </natural_language_input>
    
    Respond with only the command, without any explanation or additional text, as the command will be executed immediately in the {shell_environment}.
    Review the command and ensure it is correct and will work as intended for the {shell_environment} environment, if not, modify it to make it work."""

    directory_tree_context_enabled = config.get('AI_DIRECTORY_TREE_CONTEXT', 'false') == 'true'
    if directory_tree_context_enabled:
        directory_tree = get_current_directory_tree()
        prompt += f"""
        While translating the natural language input into command, consider the following directory structure of the current directory:
        <current_directory_tree>
        {directory_tree}
        </current_directory_tree>
        """
        
    message = client.messages.create(
        model="claude-3-5-sonnet-20240620",
        max_tokens=100,
        temperature=0,
        system="You are an Expert AI assistant that translates natural language into commands.",
        messages=[
            {"role": "user", "content": prompt}
        ]
    )

    # Extract the command from the response
    if isinstance(message.content, list) and len(message.content) > 0:
        command = message.content[0].text.strip()
    else:
        raise ValueError("Unexpected response format")

    return command

# Main function
def main():
    try:
        if len(sys.argv) < 2:
            print("Usage: s <natural language command>")
            sys.exit(1)
        
        # Check if the command is for displaying help
        if sys.argv[1] == "help":
            display_help()
            sys.exit(0)

        # Check if the command is for updating config
        if sys.argv[1] == "config-set" and len(sys.argv) == 3:
            key_value = sys.argv[2]
            if '=' in key_value:
                key, value = key_value.split('=', 1)  # Split only on the first '='
                update_config(key, value)
                print(f"Configuration updated: {key}={value}")
            else:
                print("Error: Invalid format. Use 'key=value'.")
            sys.exit(0)

        user_input = " ".join(sys.argv[1:])
        
        # Show loader animation while waiting for AI response
        stop_event = threading.Event()
        loader_thread = threading.Thread(target=loader_animation, args=(stop_event,))
        loader_thread.start()

        try:
            suggested_command = get_ai_suggestion(user_input)
        except Exception as e:
            print(f"Error: Failed to get AI suggestion. {e}")
            sys.exit(1)
        finally:
            # Stop loader animation
            stop_event.set()
            loader_thread.join()

        # Reload configuration to get the latest values
        config = get_config()
        skip_confirm = config.get('AI_ASSISTANT_SKIP_CONFIRM', 'false') == 'true'

        if skip_confirm:
            sys.stdout.write(f"{suggested_command}")
            next_input = input()

            if next_input.strip() == "":
                # Execute the command
                result = execute_command(suggested_command)
                sys.stdout.write(result)
            else:
                # If something else is entered, we ignore it or handle as needed
                sys.stdout.write(f"Execution skipped: {next_input}\n")
        else:
            confirm = input("Do you want to execute this command? (y/n): ")
            if confirm.lower() == 'y':
                result = execute_command(suggested_command)
                sys.stdout.write(result)
        pass
    except KeyboardInterrupt:
        print("\nExiting...")
        sys.exit(0)

if __name__ == "__main__":
    main()
