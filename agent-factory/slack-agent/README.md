# Slack PR Bot 🤖

> An automated SDE assistant bot connecting Slack workspaces to GitHub repositories. It listens for feature requests or issue instructions in Slack, uses LLM agents to generate code modifications, creates git feature branches, and submits GitHub Pull Requests for human review.

---

## 🌟 How It Works

```text
[ Slack Workspace User ]
         │
         │  1. `@Slack PR Bot create feature X` or `/create-pr ...`
         ▼
[ Slack PR Bot Daemon (Socket Mode) ]
         │
         │  2. Generate code diffs & PR plan via Gemini LLM
         ▼
[ GitHub REST API Service ]
         │
         │  3. Create branch `refs/heads/feature/...`
         │  4. Commit modified/created files
         │  5. Submit Pull Request targeting `main`
         ▼
[ GitHub Repo (Human Review) ] 🚀
```

---

## 🚀 Setup & Configuration Guide

### 1. Configure Slack App (Socket Mode)

1. Go to [Slack API Apps](https://api.slack.com/apps) and click **Create New App** -> **From an app manifest**.
2. Select your workspace.
3. Paste the following scopes in Manifest / Settings:
   - **Bot Token Scopes**:
     - `app_mentions:read`
     - `chat:write`
     - `commands`
4. Enable **Socket Mode** under *Settings -> Socket Mode*.
5. Generate an **App-Level Token** with scope `connections:write` (starts with `xapp-`).
6. Install the App to your workspace and copy the **Bot User OAuth Token** (starts with `xoxb-`).

### 2. Configure GitHub Token

1. Go to [GitHub Settings -> Personal Access Tokens](https://github.com/settings/tokens).
2. Generate a token with `repo` scope (`repo:status`, `public_repo` or full `repo`).
3. Note your target repository (e.g. `anishs1207/inqora`).

### 3. Install & Run Locally

1. Install Python dependencies:
   ```bash
   cd agent-factory/slack-agent
   pip install -r requirements.txt
   ```

2. Setup `.env` configuration:
   ```bash
   cp .env.example .env
   ```
   Fill in your `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, `GITHUB_TOKEN`, and `GEMINI_API_KEY`.

3. Launch the Slack PR Bot daemon:
   ```bash
   python main.py
   ```

---

## 💬 Usage Examples in Slack

### Mention the Bot in any channel:
```text
@Slack PR Bot create feature: add request rate limiting logging to apps/server/src/index.ts
```

### Slash Command:
```text
/create-pr Fix typo in README documentation and add installation troubleshooting section
```

The bot will acknowledge your message, create a feature branch, commit code, and post a direct link to the opened Pull Request in the thread for team review!
