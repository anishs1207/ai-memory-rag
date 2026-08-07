"""
Slack PR Bot Main Entrypoint.
Date: 2026-08-07

Initializes services, checks configuration, and launches the Slack Socket Mode daemon.
"""

import sys
import io
import time
from config import AppConfig
from github_service import GitHubService
from agent_engine import AgentEngine
from slack_handler import create_slack_app

# Enforce UTF-8 encoding on standard output streams to prevent Windows console cp1252 encoding crashes
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
if sys.stderr.encoding != 'utf-8':
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')


def main():
    """Main application startup procedure."""
    print("=" * 60)
    print("Starting Slack PR Bot (Agent Factory)...")
    print("=" * 60)

    # Step 1: Load and validate environment configuration
    config = AppConfig.load_from_environment()
    valid = config.validate_required_tokens()

    if not valid:
        print("[WARNING] Starting in DRY-RUN / DEMO mode due to missing API keys.")

    # Step 2: Initialize services
    github_service = GitHubService(config)
    agent_engine = AgentEngine(config, github_service)

    # Step 3: Initialize Slack Bolt socket app
    app, socket_handler = create_slack_app(config, agent_engine)

    if socket_handler:
        print("[SUCCESS] Connecting to Slack Socket Mode WebSocket...")
        print("[INFO] Bot is active! Mention the bot in Slack or use `/create-pr` to trigger PR generation.")
        try:
            socket_handler.start()
        except KeyboardInterrupt:
            print("\n[INFO] Shutting down Slack PR Bot. Goodbye!")
            sys.exit(0)
    else:
        print("[INFO] Running interactive CLI demonstration mode...")
        sample_prompt = "Add logging and error boundary to server module"
        print(f"[DEMO] Simulating Slack instruction: '{sample_prompt}'")
        
        if config.github_token:
            result = agent_engine.execute_slack_pr_workflow(
                user_instruction=sample_prompt,
                slack_user_id="U_DEMO_USER"
            )
            print(f"[DEMO SUCCESS] Pull Request result: {result}")
        else:
            print("[DEMO] Skipping GitHub upload (GITHUB_TOKEN missing). Setup .env to enable live PR creation.")


if __name__ == "__main__":
    main()
