"""
LLM Agent execution engine for parsing user instructions, generating feature code,
and submitting Pull Requests.
Date: 2026-08-07
"""

import json
import re
from typing import Dict, List, Any
from config import AppConfig
from github_service import GitHubService

try:
    from google import genai
    from google.genai import types
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False


class AgentEngine:
    """Core autonomous coding agent that interprets Slack requests and drafts PRs."""

    def __init__(self, config: AppConfig, github_service: GitHubService):
        self.config = config
        self.github_service = github_service
        self.gemini_client = None

        if GENAI_AVAILABLE and self.config.gemini_api_key:
            try:
                self.gemini_client = genai.Client(api_key=self.config.gemini_api_key)
                print("[SUCCESS] Gemini API client initialized for AgentEngine.")
            except Exception as exc:
                print(f"[WARNING] Failed to initialize Gemini API client: {exc}")

    def generate_feature_implementation(self, user_instruction: str, issue_reference: str = "") -> Dict[str, Any]:
        """
        Parses the user instruction from Slack and uses LLM reasoning to output structured code changes
        and a detailed PR title/description.
        """
        print(f"[LOG] Processing instruction: '{user_instruction}' (Issue ref: {issue_reference})")

        # Step 1: Default fallback structure if Gemini API is unavailable or offline
        if not self.gemini_client:
            return self._generate_fallback_response(user_instruction, issue_reference)

        # Step 2: Construct prompt for LLM agent
        prompt = f"""
You are an expert AI Software Development Engineer (SDE) tasked with implementing a feature or bug fix for the repository '{self.config.github_repository}'.

User Instruction from Slack: "{user_instruction}"
Issue Reference: "{issue_reference if issue_reference else 'N/A'}"

Please analyze the request and generate:
1. A suggested branch name (e.g. 'feature/short-slug' or 'fix/short-slug').
2. A concise PR title.
3. A detailed Pull Request description in Markdown format including summary, changes made, and review checklist.
4. A list of target file paths and their exact full content to create or update.

Respond strictly with a single valid JSON object adhering to this schema:
{{
  "branch_name": "feature/slack-task-1",
  "pr_title": "feat: add feature title",
  "pr_description": "## Description\\nConcise explanation...\\n\\n## Proposed Changes\\n- List changes...",
  "file_changes": [
    {{
      "file_path": "path/to/file.ext",
      "content": "Full code content here"
    }}
  ]
}}
Do NOT wrap the JSON in markdown code blocks or triple backticks.
"""

        try:
            print("[LOG] Querying Gemini model for code generation...")
            response = self.gemini_client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.2,
                )
            )

            raw_text = response.text.strip()
            # Clean up potential markdown JSON wrappers
            raw_text = re.sub(r"^```json\s*", "", raw_text, flags=re.MULTILINE)
            raw_text = re.sub(r"^```\s*", "", raw_text, flags=re.MULTILINE)

            parsed_data = json.loads(raw_text)
            print("[SUCCESS] Successfully parsed LLM generation output.")
            return parsed_data

        except Exception as err:
            print(f"[ERROR] LLM generation failed or returned invalid JSON: {err}")
            return self._generate_fallback_response(user_instruction, issue_reference)

    def execute_slack_pr_workflow(
        self,
        user_instruction: str,
        slack_user_id: str,
        issue_reference: str = ""
    ) -> Dict[str, str]:
        """
        Executes the end-to-end workflow:
        1. Generate feature branch and code payload via LLM.
        2. Create git feature branch on GitHub.
        3. Commit modified files.
        4. Submit Pull Request for human review.
        """
        print(f"[LOG] Starting Slack PR workflow requested by Slack user {slack_user_id}...")

        # Step 1: Generate plan & code modifications
        implementation_plan = self.generate_feature_implementation(user_instruction, issue_reference)

        raw_branch_name = implementation_plan.get("branch_name", "feature/slack-automation")
        # Sanitize branch name
        sanitized_slug = re.sub(r"[^a-zA-Z0-9\-_/]", "", raw_branch_name).lower()
        branch_name = f"{sanitized_slug}-{slack_user_id.lower()[:6]}"

        pr_title = implementation_plan.get("pr_title", f"feat: automated resolution for Slack request")
        pr_description = implementation_plan.get("pr_description", "")
        file_changes = implementation_plan.get("file_changes", [])

        # Enrich PR description with attribution metadata
        full_pr_body = (
            f"{pr_description}\n\n"
            f"---\n"
            f"🤖 *Automated Pull Request generated by Slack PR Bot*\n"
            f"• **Requested by**: <@{slack_user_id}>\n"
            f"• **Instruction**: `{user_instruction}`\n"
            f"• **Review Required**: Please review code before merging into `{self.config.base_branch}`."
        )

        # Step 2: Create feature branch on GitHub
        self.github_service.create_feature_branch(branch_name)

        # Step 3: Commit files
        if file_changes:
            self.github_service.commit_and_push_files(
                feature_branch_name=branch_name,
                file_changes=file_changes,
                commit_message=f"feat: implement requested feature via Slack PR bot ({user_instruction[:50]})"
            )

        # Step 4: Submit Pull Request
        pr_result = self.github_service.create_pull_request(
            title=pr_title,
            body=full_pr_body,
            head_branch=branch_name
        )

        return pr_result

    def _generate_fallback_response(self, user_instruction: str, issue_reference: str) -> Dict[str, Any]:
        """Provides a safe fallback template when LLM client is offline or unconfigured."""
        slug = re.sub(r"[^a-zA-Z0-9]+", "-", user_instruction.lower().strip())[:30]
        branch_name = f"feature/slack-{slug}"

        return {
            "branch_name": branch_name,
            "pr_title": f"feat: {user_instruction[:60]}",
            "pr_description": (
                f"## Overview\n"
                f"Automated resolution requested for: {user_instruction}\n\n"
                f"## Proposed Changes\n"
                f"- Implementation template created for Slack user request.\n"
                f"- Issue reference: {issue_reference if issue_reference else 'None'}\n\n"
                f"## Human Review Checklist\n"
                f"- [ ] Verify unit tests pass\n"
                f"- [ ] Review code quality and implementation details"
            ),
            "file_changes": [
                {
                    "file_path": "docs/slack-pr-requests.md",
                    "content": f"# Slack Automated Request\n\n- Instruction: {user_instruction}\n- Status: Pending Review\n"
                }
            ]
        }
