"""
Slack Bolt integration module handling app mentions, slash commands,
and threaded status updates.
Date: 2026-08-07
"""

import threading
from typing import Dict, Any
from config import AppConfig
from agent_engine import AgentEngine

try:
    from slack_bolt import App
    from slack_bolt.adapter.socket_mode import SocketModeHandler
    SLACK_BOLT_AVAILABLE = True
except ImportError:
    SLACK_BOLT_AVAILABLE = False


def create_slack_app(config: AppConfig, agent_engine: AgentEngine):
    """
    Initializes and configures the Slack Bolt App listeners.
    Returns (app, handler) tuple.
    """
    if not SLACK_BOLT_AVAILABLE:
        print("[WARNING] 'slack-bolt' package is not installed. Slack listeners will be disabled.")
        return None, None

    app = App(token=config.slack_bot_token, signing_secret=config.slack_signing_secret)

    @app.event("app_mention")
    def handle_app_mentions(event: Dict[str, Any], say: Any):
        """
        Handles app mention events (e.g. `@Slack PR Bot create feature X`).
        Executes code generation and PR creation asynchronously in a worker thread.
        """
        user_id = event.get("user", "UNKNOWN_USER")
        text = event.get("text", "")
        thread_ts = event.get("thread_ts") or event.get("ts")
        channel_id = event.get("channel")

        # Strip bot mention tag (e.g. <@U123456>)
        cleaned_instruction = text.split(">", 1)[-1].strip() if ">" in text else text.strip()

        say(
            text=f"👋 Hi <@{user_id}>! I received your request: *\"{cleaned_instruction}\"*\n"
                 f"⚙️ Creating a feature branch, implementing code changes, and opening a Pull Request...",
            thread_ts=thread_ts
        )

        def worker_task():
            try:
                pr_result = agent_engine.execute_slack_pr_workflow(
                    user_instruction=cleaned_instruction,
                    slack_user_id=user_id
                )

                pr_url = pr_result.get("url", "#")
                pr_num = pr_result.get("number", "N/A")
                pr_title = pr_result.get("title", "Pull Request")
                head_branch = pr_result.get("branch", "feature-branch")

                say(
                    text=f"🎉 **Pull Request #{pr_num} Created!**\n\n"
                         f"• **Title**: *{pr_title}*\n"
                         f"• **Branch**: `{head_branch}`\n"
                         f"• **PR Link**: <{pr_url}|View Pull Request on GitHub>\n\n"
                         f"Please review the PR and merge when approved! 🚀",
                    thread_ts=thread_ts
                )
            except Exception as exc:
                print(f"[ERROR] Error executing PR workflow: {exc}")
                say(
                    text=f"❌ **Failed to create Pull Request**\n"
                         f"Error: `{str(exc)}`\n"
                         f"Please check server logs and configuration.",
                    thread_ts=thread_ts
                )

        # Launch worker thread to avoid blocking Slack response timeout (3 seconds limit)
        thread = threading.Thread(target=worker_task)
        thread.start()

    @app.command("/create-pr")
    def handle_create_pr_command(ack: Any, command: Dict[str, Any], say: Any):
        """
        Slash command handler `/create-pr [instruction]`.
        """
        ack()  # Acknowledge command within 3s threshold
        user_id = command.get("user_id")
        user_text = command.get("text", "").strip()

        if not user_text:
            say(text="⚠️ Please provide an instruction. Example: `/create-pr Add logging to auth module`")
            return

        say(
            text=f"🤖 Processing `/create-pr` request: *\"{user_text}\"*\n"
                 f"Working on your pull request now..."
        )

        def worker_task():
            try:
                pr_result = agent_engine.execute_slack_pr_workflow(
                    user_instruction=user_text,
                    slack_user_id=user_id
                )
                pr_url = pr_result.get("url", "#")
                pr_num = pr_result.get("number", "N/A")

                say(
                    text=f"✅ **Pull Request #{pr_num} opened**: <{pr_url}|Click here to review PR on GitHub>"
                )
            except Exception as exc:
                say(text=f"❌ Error creating PR: `{str(exc)}`")

        thread = threading.Thread(target=worker_task)
        thread.start()

    socket_handler = SocketModeHandler(app, config.slack_app_token)
    return app, socket_handler
