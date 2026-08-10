#!/usr/bin/env bash

# Install script for AgentOS CLI on Linux and macOS
# Repository: https://github.com/anishs1207/inqora
# Path: apps/agentos

set -e

# Define color tokens for user feedback log messages
BOLD_CYAN='\033[1;36m'
BOLD_GREEN='\033[1;32m'
BOLD_RED='\033[1;31m'
BOLD_YELLOW='\033[1;33m'
RESET_COLOR='\033[0m'

echo -e "${BOLD_CYAN}=================================================="${RESET_COLOR}
echo -e "${BOLD_CYAN}         Installing AgentOS CLI Utility           "${RESET_COLOR}
echo -e "${BOLD_CYAN}=================================================="${RESET_COLOR}

# Target installation binary directory in user home
TARGET_INSTALL_DIR="$HOME/.agentos/bin"
TARGET_BINARY_PATH="$TARGET_INSTALL_DIR/agentos"
GITHUB_REPOSITORY_URL="https://github.com/anishs1207/inqora.git"
RAW_BASE_URL="https://raw.githubusercontent.com/anishs1207/inqora/main/apps/agentos"

echo -e "${BOLD_YELLOW}[Step 1/5] Detecting Operating System & Architecture...${RESET_COLOR}"
UNAME_OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
UNAME_ARCH="$(uname -m)"

case "$UNAME_OS" in
    linux*)
        PREBUILT_OS="linux"
        ;;
    darwin*)
        PREBUILT_OS="darwin"
        ;;
    *)
        echo -e "${BOLD_RED}Unsupported operating system: ${UNAME_OS}${RESET_COLOR}"
        exit 1
        ;;
esac

case "$UNAME_ARCH" in
    x86_64|amd64)
        PREBUILT_ARCH="amd64"
        ;;
    aarch64|arm64)
        PREBUILT_ARCH="arm64"
        ;;
    *)
        echo -e "${BOLD_RED}Unsupported architecture: ${UNAME_ARCH}${RESET_COLOR}"
        exit 1
        ;;
esac

echo "Detected OS: ${PREBUILT_OS}, Architecture: ${PREBUILT_ARCH}"

# Create target installation directory if it does not already exist
echo -e "${BOLD_YELLOW}[Step 2/5] Preparing installation directory at ${TARGET_INSTALL_DIR}...${RESET_COLOR}"
mkdir -p "$TARGET_INSTALL_DIR"

echo -e "${BOLD_YELLOW}[Step 3/5] Fetching AgentOS binary...${RESET_COLOR}"
PREBUILT_BINARY_NAME="agentos-${PREBUILT_OS}-${PREBUILT_ARCH}"
PREBUILT_DOWNLOAD_URL="${RAW_BASE_URL}/bin/${PREBUILT_BINARY_NAME}"
DOWNLOAD_SUCCESSFUL=false

echo "Attempting to download prebuilt binary from ${PREBUILT_DOWNLOAD_URL}..."

if command -v curl >/dev/null 2>&1; then
    if curl -fsSL "$PREBUILT_DOWNLOAD_URL" -o "$TARGET_BINARY_PATH" 2>/dev/null; then
        DOWNLOAD_SUCCESSFUL=true
    fi
elif command -v wget >/dev/null 2>&1; then
    if wget -q "$PREBUILT_DOWNLOAD_URL" -O "$TARGET_BINARY_PATH" 2>/dev/null; then
        DOWNLOAD_SUCCESSFUL=true
    fi
fi

if [ "$DOWNLOAD_SUCCESSFUL" = true ]; then
    chmod +x "$TARGET_BINARY_PATH"
    echo -e "${BOLD_GREEN}Successfully downloaded prebuilt binary '${PREBUILT_BINARY_NAME}'.${RESET_COLOR}"
else
    echo "Prebuilt binary not found or download failed. Falling back to Go source build..."
    if command -v go >/dev/null 2>&1; then
        BUILD_TEMPORARY_DIRECTORY="$(mktemp -d)"
        cleanup_temp() { rm -rf "$BUILD_TEMPORARY_DIRECTORY"; }
        trap cleanup_temp EXIT

        if command -v git >/dev/null 2>&1; then
            echo "Cloning latest repository source code..."
            git clone --depth 1 "$GITHUB_REPOSITORY_URL" "$BUILD_TEMPORARY_DIRECTORY/inqora"
            SOURCE_DIRECTORY="$BUILD_TEMPORARY_DIRECTORY/inqora/apps/agentos"
        else
            echo "Downloading repository archive..."
            curl -fsSL "https://github.com/anishs1207/inqora/archive/refs/heads/main.tar.gz" -o "$BUILD_TEMPORARY_DIRECTORY/source.tar.gz"
            mkdir -p "$BUILD_TEMPORARY_DIRECTORY/extracted"
            tar -xzf "$BUILD_TEMPORARY_DIRECTORY/source.tar.gz" -C "$BUILD_TEMPORARY_DIRECTORY/extracted" --strip-components=1
            SOURCE_DIRECTORY="$BUILD_TEMPORARY_DIRECTORY/extracted/apps/agentos"
        fi

        echo "Compiling AgentOS Go source..."
        (cd "$SOURCE_DIRECTORY" && go build -o "$TARGET_BINARY_PATH" .)
        chmod +x "$TARGET_BINARY_PATH"
    else
        echo -e "${BOLD_RED}Could not fetch prebuilt binary and Go compiler is not installed.${RESET_COLOR}"
        echo "Please install Go from https://go.dev/dl/ and re-run this script."
        exit 1
    fi
fi

echo -e "${BOLD_YELLOW}[Step 4/5] Updating Environment PATH configuration...${RESET_COLOR}"
if [[ ":$PATH:" != *":$TARGET_INSTALL_DIR:"* ]]; then
    EXPORT_COMMAND="export PATH=\"\$PATH:$TARGET_INSTALL_DIR\""
    
    if [ -n "$ZSH_VERSION" ] || [ -f "$HOME/.zshrc" ]; then
        PROFILE_FILE="$HOME/.zshrc"
    elif [ -f "$HOME/.bashrc" ]; then
        PROFILE_FILE="$HOME/.bashrc"
    else
        PROFILE_FILE="$HOME/.profile"
    fi

    if ! grep -q "$TARGET_INSTALL_DIR" "$PROFILE_FILE" 2>/dev/null; then
        echo "" >> "$PROFILE_FILE"
        echo "# AgentOS CLI PATH" >> "$PROFILE_FILE"
        echo "$EXPORT_COMMAND" >> "$PROFILE_FILE"
        echo "Added ${TARGET_INSTALL_DIR} to ${PROFILE_FILE}"
    fi

    export PATH="$PATH:$TARGET_INSTALL_DIR"
fi

echo -e "${BOLD_YELLOW}[Step 5/5] Validating AgentOS installation...${RESET_COLOR}"
if [ -f "$TARGET_BINARY_PATH" ]; then
    echo -e "${BOLD_GREEN}AgentOS CLI successfully installed at: ${TARGET_BINARY_PATH}${RESET_COLOR}"
    "$TARGET_BINARY_PATH" version || true
    echo ""
    echo -e "${BOLD_CYAN}To start using AgentOS, run:${RESET_COLOR}"
    echo "  agentos --help"
    echo "  agentos run"
    echo ""
    echo "Note: If 'agentos' is not recognized immediately, restart your shell or run:"
    echo "  source ${PROFILE_FILE:-~/.bashrc}"
else
    echo -e "${BOLD_RED}Installation failed: Binary was not found at ${TARGET_BINARY_PATH}.${RESET_COLOR}"
    exit 1
fi
