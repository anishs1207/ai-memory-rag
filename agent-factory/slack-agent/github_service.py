"""
GitHub API integration service for creating feature branches, committing files,
and opening Pull Requests for human review.
Date: 2026-08-07
"""

import base64
import requests
from typing import Dict, List, Optional
from config import AppConfig


class GitHubService:
    """Encapsulates interaction with GitHub REST API for automated PR creation."""

    def __init__(self, config: AppConfig):
        self.config = config
        self.headers = {
            "Authorization": f"token {config.github_token}",
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "Slack-PR-Bot-Agent",
        }
        self.api_base_url = f"https://api.github.com/repos/{config.github_repository}"

    def get_latest_commit_sha(self, branch_name: Optional[str] = None) -> str:
        """
        Retrieves the latest commit SHA for a specified branch.
        Defaults to configured base_branch if branch_name is not provided.
        """
        target_branch = branch_name or self.config.base_branch
        url = f"{self.api_base_url}/git/ref/heads/{target_branch}"
        
        print(f"[LOG] Fetching latest commit SHA for branch '{target_branch}'...")
        response = requests.get(url, headers=self.headers)
        response.raise_for_status()
        
        commit_sha = response.json()["object"]["sha"]
        print(f"[LOG] Target branch '{target_branch}' current SHA: {commit_sha[:8]}")
        return commit_sha

    def create_feature_branch(self, feature_branch_name: str) -> str:
        """
        Creates a new git branch from the latest commit of the base branch.
        Returns the created branch name.
        """
        # Step 1: Obtain base commit SHA
        base_sha = self.get_latest_commit_sha(self.config.base_branch)

        # Step 2: Request git ref creation
        url = f"{self.api_base_url}/git/refs"
        payload = {
            "ref": f"refs/heads/{feature_branch_name}",
            "sha": base_sha,
        }

        print(f"[LOG] Creating feature branch 'refs/heads/{feature_branch_name}'...")
        response = requests.post(url, headers=self.headers, json=payload)
        
        if response.status_code == 422:
            print(f"[INFO] Branch '{feature_branch_name}' already exists. Reusing existing branch.")
            return feature_branch_name
            
        response.raise_for_status()
        print(f"[SUCCESS] Feature branch '{feature_branch_name}' created successfully.")
        return feature_branch_name

    def commit_and_push_files(
        self,
        feature_branch_name: str,
        file_changes: List[Dict[str, str]],
        commit_message: str
    ) -> List[str]:
        """
        Commits a list of file changes to the specified feature branch.
        Each file_change dictionary contains 'file_path' and 'content'.
        Returns list of modified file paths.
        """
        updated_files = []

        for change in file_changes:
            file_path = change["file_path"]
            new_content = change["content"]
            
            # Step 1: Check if file already exists on branch to obtain blob SHA (for updates)
            file_url = f"{self.api_base_url}/contents/{file_path}?ref={feature_branch_name}"
            get_response = requests.get(file_url, headers=self.headers)
            
            existing_blob_sha = None
            if get_response.status_code == 200:
                existing_blob_sha = get_response.json().get("sha")

            # Step 2: Base64 encode content for GitHub API upload
            encoded_content = base64.b64encode(new_content.encode("utf-8")).decode("utf-8")

            # Step 3: Send file commit payload
            put_payload = {
                "message": f"{commit_message}\n\nPath: {file_path}",
                "content": encoded_content,
                "branch": feature_branch_name,
            }
            if existing_blob_sha:
                put_payload["sha"] = existing_blob_sha

            print(f"[LOG] Uploading committed content for '{file_path}' on branch '{feature_branch_name}'...")
            put_response = requests.put(file_url, headers=self.headers, json=put_payload)
            put_response.raise_for_status()
            
            updated_files.append(file_path)
            print(f"[SUCCESS] Committed '{file_path}' to branch '{feature_branch_name}'.")

        return updated_files

    def create_pull_request(
        self,
        title: str,
        body: str,
        head_branch: str,
        draft: bool = False
    ) -> Dict[str, str]:
        """
        Opens a GitHub Pull Request comparing head_branch against config.base_branch.
        Returns a dictionary containing PR title, HTML URL, and PR number.
        """
        url = f"{self.api_base_url}/pulls"
        payload = {
            "title": title,
            "body": body,
            "head": head_branch,
            "base": self.config.base_branch,
            "draft": draft,
        }

        print(f"[LOG] Submitting Pull Request '{title}' from '{head_branch}' -> '{self.config.base_branch}'...")
        response = requests.post(url, headers=self.headers, json=payload)
        response.raise_for_status()

        pr_data = response.json()
        pr_info = {
            "title": pr_data["title"],
            "url": pr_data["html_url"],
            "number": str(pr_data["number"]),
            "branch": head_branch,
        }
        
        print(f"[SUCCESS] Pull Request #{pr_info['number']} opened: {pr_info['url']}")
        return pr_info
