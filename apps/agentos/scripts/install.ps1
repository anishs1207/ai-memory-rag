# PowerShell Installation Script for AgentOS CLI on Windows
# Repository: https://github.com/anishs1207/inqora
# Path: apps/agentos

$ErrorActionPreference = "Stop"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "         Installing AgentOS CLI Utility           " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# Define installation target path in user profile
$TargetInstallDirectory = Join-Path $env:USERPROFILE ".agentos\bin"
$TargetBinaryPath = Join-Path $TargetInstallDirectory "agentos.exe"
$GitHubRepositoryUrl = "https://github.com/anishs1207/inqora.git"
$RawBaseUrl = "https://raw.githubusercontent.com/anishs1207/inqora/main/apps/agentos"

Write-Host "[Step 1/5] Checking system environment..." -ForegroundColor Yellow
$Architecture = $env:PROCESSOR_ARCHITECTURE
if ($Architecture -eq "ARM64") {
    $PrebuiltArch = "arm64"
} else {
    $PrebuiltArch = "amd64"
}
Write-Host "System Architecture: $Architecture (Target Arch: $PrebuiltArch)"

# Create target bin directory if not exists
Write-Host "[Step 2/5] Preparing target directory at '$TargetInstallDirectory'..." -ForegroundColor Yellow
if (-not (Test-Path $TargetInstallDirectory)) {
    New-Item -ItemType Directory -Path $TargetInstallDirectory -Force | Out-Null
}

Write-Host "[Step 3/5] Fetching AgentOS executable binary..." -ForegroundColor Yellow
$PrebuiltBinaryName = "agentos-windows-$PrebuiltArch.exe"
$PrebuiltDownloadUrl = "$RawBaseUrl/bin/$PrebuiltBinaryName"
$DownloadSuccessful = $false

Write-Host "Attempting to download prebuilt binary from $PrebuiltDownloadUrl..."

try {
    Invoke-WebRequest -Uri $PrebuiltDownloadUrl -OutFile $TargetBinaryPath -UseBasicParsing -ErrorAction Stop
    if ((Test-Path $TargetBinaryPath) -and ((Get-Item $TargetBinaryPath).Length -gt 100000)) {
        $DownloadSuccessful = $true
        Write-Host "Successfully downloaded prebuilt binary '$PrebuiltBinaryName'." -ForegroundColor Green
    }
} catch {
    Write-Host "Prebuilt binary download from remote repo returned error or binary not yet pushed." -ForegroundColor Yellow
}

if (-not $DownloadSuccessful) {
    Write-Host "Falling back to local binary check and Go source compilation..." -ForegroundColor Yellow
    $ScriptDirectory = $PSScriptRoot
    $LocalSourceDirectory = Resolve-Path (Join-Path $ScriptDirectory "..") -ErrorAction SilentlyContinue
    $LocalBinFile = Join-Path $LocalSourceDirectory "bin\$PrebuiltBinaryName"
    $LocalExeFile = Join-Path $LocalSourceDirectory "agentos.exe"

    if (Test-Path $LocalBinFile) {
        Write-Host "Found pre-built local binary at '$LocalBinFile'. Copying..." -ForegroundColor Green
        Copy-Item -Path $LocalBinFile -Destination $TargetBinaryPath -Force
    } elseif (Test-Path $LocalExeFile) {
        Write-Host "Found pre-built local executable at '$LocalExeFile'. Copying..." -ForegroundColor Green
        Copy-Item -Path $LocalExeFile -Destination $TargetBinaryPath -Force
    } else {
        # Check if Go compiler is available
        $GoCommand = Get-Command "go" -ErrorAction SilentlyContinue
        if ($GoCommand) {
            Write-Host "Found Go compiler. Compiling AgentOS from source..." -ForegroundColor Green
            $TemporaryFolder = Join-Path $env:TEMP ("agentos_install_" + [Guid]::NewGuid().ToString("N"))
            New-Item -ItemType Directory -Path $TemporaryFolder -Force | Out-Null
            try {
                if (Test-Path (Join-Path $LocalSourceDirectory "main.go")) {
                    Push-Location $LocalSourceDirectory
                    try {
                        & go build -o $TargetBinaryPath .
                    } finally {
                        Pop-Location
                    }
                } else {
                    $ZipDownloadUrl = "https://github.com/anishs1207/inqora/archive/refs/heads/main.zip"
                    $ZipFilePath = Join-Path $TemporaryFolder "source.zip"
                    Invoke-WebRequest -Uri $ZipDownloadUrl -OutFile $ZipFilePath -UseBasicParsing
                    Expand-Archive -Path $ZipFilePath -DestinationPath "$TemporaryFolder\extracted" -Force
                    $SourceDir = Join-Path $TemporaryFolder "extracted\inqora-main\apps\agentos"
                    Push-Location $SourceDir
                    try {
                        & go build -o $TargetBinaryPath .
                    } finally {
                        Pop-Location
                    }
                }
            } finally {
                if (Test-Path $TemporaryFolder) {
                    Remove-Item -Path $TemporaryFolder -Recurse -Force -ErrorAction SilentlyContinue
                }
            }
        } else {
            Write-Host "Could not download prebuilt binary and Go compiler was not found on PATH." -ForegroundColor Red
            Write-Host "Please install Go 1.24+ from https://go.dev/dl/ and re-run this script." -ForegroundColor Yellow
            exit 1
        }
    }
}

Write-Host "[Step 4/5] Configuring User Environment PATH variable..." -ForegroundColor Yellow
$CurrentUserPath = [Environment]::GetEnvironmentVariable("Path", "User")

if ($CurrentUserPath -notlike "*$TargetInstallDirectory*") {
    $NewUserPath = "$CurrentUserPath;$TargetInstallDirectory"
    [Environment]::SetEnvironmentVariable("Path", $NewUserPath, "User")
    $env:Path = "$env:Path;$TargetInstallDirectory"
    Write-Host "Successfully added '$TargetInstallDirectory' to User Environment PATH." -ForegroundColor Green
} else {
    Write-Host "Directory '$TargetInstallDirectory' is already configured in User PATH."
}

Write-Host "[Step 5/5] Validating AgentOS installation..." -ForegroundColor Yellow
if (Test-Path $TargetBinaryPath) {
    Write-Host "AgentOS CLI successfully installed at: $TargetBinaryPath" -ForegroundColor Green
    & "$TargetBinaryPath" version
    Write-Host ""
    Write-Host "To start using AgentOS, run:" -ForegroundColor Cyan
    Write-Host "  agentos --help"
    Write-Host "  agentos run"
    Write-Host ""
    Write-Host "Note: If 'agentos' command is not recognized in current terminal window, open a new terminal window to refresh your PATH environment." -ForegroundColor Yellow
} else {
    Write-Host "Installation failed: Executable binary was not found at '$TargetBinaryPath'." -ForegroundColor Red
    exit 1
}
