"""
Configuration loader for the Slack PR Bot.
Date: 2026-08-07

Loads environment parameters for Slack Socket Mode tokens, GitHub credentials,
repository information, and Gemini API keys.
"""

import os
from dataclasses import dataclass
from dotenv import load_dotenv

# Load variables from .env file if available
load_dotenv()


@dataclass
class AppConfig:
    """Holds configuration parameters for Slack, GitHub, and LLM services."""
    slack_bot_token: str
    slack_app_token: str
    slack_signing_secret: str
    github_token: str
    github_repository: str
    base_branch: str
    gemini_api_key: str
    port: int

    @classmethod
    def load_from_environment(cls) -> "AppConfig":
        """
        Loads configuration values from environment variables.
        Prefers explicit, descriptive variable names over abbreviated ones.
        """
        # Step 1: Extract Slack configuration tokens
        slack_bot_token = os.getenv("SLACK_BOT_TOKEN", "")
        slack_app_token = os.getenv("SLACK_APP_TOKEN", "")
        slack_signing_secret = os.getenv("SLACK_SIGNING_SECRET", "")

        # Step 2: Extract GitHub repository access settings
        github_token = os.getenv("GITHUB_TOKEN", "")
        github_repository = os.getenv("GITHUB_REPOSITORY", "anishs1207/inqora")
        base_branch = os.getenv("GITHUB_BASE_BRANCH", "main")

        # Step 3: Extract LLM and server runtime settings
        gemini_api_key = os.getenv("GEMINI_API_KEY", "")
        server_port = int(os.getenv("PORT", "3000"))

        return cls(
            slack_bot_token=slack_bot_token,
            slack_app_token=slack_app_token,
            slack_signing_secret=slack_signing_secret,
            github_token=github_token,
            github_repository=github_repository,
            base_branch=base_branch,
            gemini_api_key=gemini_api_key,
            port=server_port,
        )

    def validate_required_tokens(self) -> bool:
        """
        Validates whether mandatory API tokens are set.
        Logs warning messages if essential keys are missing.
        """
        missing_keys = []

        if not self.slack_bot_token:
            missing_keys.append("SLACK_BOT_TOKEN")
        if not self.slack_app_token:
            missing_keys.append("SLACK_APP_TOKEN")
        if not self.github_token:
            missing_keys.append("GITHUB_TOKEN")
        if not self.gemini_api_key:
            missing_keys.append("GEMINI_API_KEY")

        if missing_keys:
            print(f"[WARNING] Missing required environment variables: {', '.join(missing_keys)}")
            print("[INFO] Please copy .env.example to .env and fill in the missing API credentials.")
            return False

        print("[SUCCESS] All required environment configurations loaded successfully.")
        return True
