#!/usr/bin/env bash

# Top-level install script wrapper for AgentOS CLI
# Delegates to apps/agentos/scripts/install.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_SCRIPT="$SCRIPT_DIR/../apps/agentos/scripts/install.sh"

if [ -f "$TARGET_SCRIPT" ]; then
    bash "$TARGET_SCRIPT" "$@"
else
    # Fallback to fetching directly from GitHub repository if run standalone
    INSTALLER_URL="https://raw.githubusercontent.com/anishs1207/inqora/main/apps/agentos/scripts/install.sh"
    echo "Delegating to AgentOS installer from ${INSTALLER_URL}..."
    curl -fsSL "$INSTALLER_URL" | bash
fi
