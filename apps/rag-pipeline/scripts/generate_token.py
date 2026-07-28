"""
Google OAuth Token Generator Script
====================================
Date: 2026-07-28
Description: Generates token.json from credentials/credentials.json using Google OAuth InstalledAppFlow.
"""

import os
import sys
from pathlib import Path

# Allow relaxed OAuth scope verification when Google returns modified scopes
os.environ["OAUTHLIB_RELAX_TOKEN_SCOPE"] = "1"

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow

# Add parent directory to path to enable settings imports
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
sys.path.append(str(PROJECT_ROOT))

try:
    from config import settings
    CREDENTIALS_FILE = Path(settings.GMAIL_CREDENTIALS_FILE)
    TOKEN_FILE = Path(settings.GMAIL_TOKEN_FILE)
except Exception:
    CREDENTIALS_FILE = PROJECT_ROOT / "credentials" / "credentials.json"
    TOKEN_FILE = PROJECT_ROOT / "credentials" / "token.json"

# Scopes required for Gmail API access
SCOPES = [
    "https://www.googleapis.com/auth/gmail.modify",
]


def generate_token():
    """Execute OAuth flow using credentials.json and save authorized token.json."""
    creds = None

    # Ensure credentials directory exists
    TOKEN_FILE.parent.mkdir(parents=True, exist_ok=True)

    # Load existing authorized token if available and non-empty
    target_token_file = None
    if TOKEN_FILE.exists() and TOKEN_FILE.stat().st_size > 0:
        target_token_file = TOKEN_FILE
    elif (PROJECT_ROOT / "token.json").exists() and (PROJECT_ROOT / "token.json").stat().st_size > 0:
        target_token_file = PROJECT_ROOT / "token.json"

    if target_token_file:
        print(f"==> Loading existing token from: {target_token_file}")
        try:
            creds = Credentials.from_authorized_user_file(str(target_token_file), SCOPES)
        except Exception as err:
            print(f"WARNING: Failed to parse token file '{target_token_file}' ({err}). Proceeding to re-authorize.")
            creds = None

    # Refresh or run local server flow if credentials missing or expired
    if not creds or not creds.valid:
        cred_path = CREDENTIALS_FILE
        if not cred_path.exists() and (PROJECT_ROOT / "credentials.json").exists():
            cred_path = PROJECT_ROOT / "credentials.json"

        if not cred_path.exists():
            print(f"ERROR: Client secrets file not found at '{CREDENTIALS_FILE}'. Please place credentials.json in the credentials/ folder.")
            sys.exit(1)

        print(f"==> Initiating Google OAuth authorization flow using: {cred_path}")
        flow = InstalledAppFlow.from_client_secrets_file(str(cred_path), SCOPES)
        creds = flow.run_local_server(port=0)

        # Write generated token to token.json
        with open(TOKEN_FILE, "w", encoding="utf-8") as token_file:
            token_file.write(creds.to_json())

        print(f"==> SUCCESS: Authorized token saved to: {TOKEN_FILE}")
    else:
        print(f"==> Token is valid and ready for use.")


if __name__ == "__main__":
    generate_token()