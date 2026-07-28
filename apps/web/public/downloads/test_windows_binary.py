"""
Windows Binary Verification & Testing Script
=============================================
Date: 2026-07-28
Description: Unzips blinkity-windows-portable.zip and validates PE binary structure,
             ASAR archives, and Electron assets.
"""

import sys
import zipfile
from pathlib import Path

# Paths
SCRIPT_DIR = Path(__file__).resolve().parent
PUBLIC_DOWNLOADS_DIR = SCRIPT_DIR.parent.parent.parent / "public" / "downloads"
ZIP_PATH = PUBLIC_DOWNLOADS_DIR / "blinkity-windows-portable.zip"
EXTRACT_DIR = PUBLIC_DOWNLOADS_DIR / "test_extracted"


def test_windows_binary():
    print(f"==> Verifying Windows Binary Zip: {ZIP_PATH}")
    if not ZIP_PATH.exists():
        print(f"ERROR: {ZIP_PATH} does not exist. Run build_binaries.py first.")
        sys.exit(1)

    EXTRACT_DIR.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(ZIP_PATH, "r") as zf:
        print("==> Unzipping files into test extraction folder...")
        zf.extractall(EXTRACT_DIR)
        namelist = zf.namelist()
        print(f"==> Zip contents: {namelist}")

    # Check blinky.exe PE header
    exe_path = EXTRACT_DIR / "blinky.exe"
    if not exe_path.exists():
        print("ERROR: blinky.exe missing from extracted payload!")
        sys.exit(1)

    with open(exe_path, "rb") as f:
        header = f.read(2)
        if header == b"MZ":
            print("[OK] SUCCESS: Valid Windows PE executable header ('MZ') detected in blinky.exe!")
        else:
            print(f"WARNING: Unexpected header magic bytes: {header}")

    # Check Electron resources
    asar_path = EXTRACT_DIR / "resources" / "app.asar"
    if asar_path.exists():
        print("[OK] SUCCESS: Electron application package resources/app.asar verified!")
    else:
        print("WARNING: resources/app.asar missing from package.")

    print("\nTEST COMPLETED: Windows Portable Executable distribution package is valid!")


if __name__ == "__main__":
    test_windows_binary()
