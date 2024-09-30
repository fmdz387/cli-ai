import os
import sys
import subprocess
import anthropic
import threading
import time
import keyring

# Retrieve the API key
api_key = keyring.get_password("cli_ai_assistant", "anthropic_api_key")

if api_key is None:
    print("\033[91mError: API key not found. Please run the setup script first.\033[0m")
    sys.exit(1)

os.environ["ANTHROPIC_API_KEY"] = api_key
SKIP_CONFIRM_ENV_VAR = "AI_ASSISTANT_SKIP_CONFIRM"

client = anthropic.Anthropic()

# Loader animation
def loader_animation(stop_event):
    chars = "/—\\|"
    while not stop_event.is_set():
        for char in chars:
            if stop_event.is_set():
                break
            sys.stdout.write('\r' + 'Thinking... ' + char)
            time.sleep(0.1)
            sys.stdout.flush()
    sys.stdout.write('\r' + ' ' * 20 + '\r')  # Clear the loading line

# Function to get the AI suggestion
def get_ai_suggestion(user_input):
    prompt = f"""Your Role: You are an AI assistant for Linux command line, translating natural language into commands.
    
    Your Task: Translate the following natural language input into an appropriate working command:
    <natural language input>
    {user_input}
    </natural language input>
    
    Respond with only the command, without any explanation or additional text, as the command will be executed immediately in Linux terminal.
    Review the command and ensure it is correct and will work as intended for Linux environment, if not, modify it to make it work."""
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
    if len(sys.argv) < 2:
        print("Usage: s <natural language command>")
        sys.exit(1)

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

    skip_confirm = os.getenv(SKIP_CONFIRM_ENV_VAR, "").lower() in ('true', '1', 'yes')
    
    if skip_confirm:
        sys.stdout.write(f"{suggested_command}")
        next_input = input()

        if next_input.strip() == "":
            # Execute the command
            subprocess.run(suggested_command, shell=True)
        else:
            # If something else is entered, we ignore it or handle as needed
            sys.stdout.write(f"Execution skipped: {next_input}\n")
    else:
        confirm = input("Do you want to execute this command? (y/n): ")
        if confirm.lower() == 'y':
            try:
                result = subprocess.run(suggested_command, shell=True, check=True, text=True, capture_output=True)
                print(result.stdout)
            except subprocess.CalledProcessError as e:
                print(f"Error executing command: {e}")
                print(e.stderr)

if __name__ == "__main__":
    main()