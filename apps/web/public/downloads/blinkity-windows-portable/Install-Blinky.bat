@echo off
echo =========================================================
echo  Blinky Desktop App - 1-Click Windows Auto-Installer
echo =========================================================
set INSTALL_DIR=%LOCALAPPDATA%\Programs\Blinky
mkdir "%INSTALL_DIR%" 2>nul

echo Installing Blinky files to %INSTALL_DIR%...
xcopy /E /Y "%~dp0*" "%INSTALL_DIR%\" >nul

echo Creating Desktop Shortcut...
powershell -Command "$s=(New-Object -COM WScript.Shell).CreateShortcut('%USERPROFILE%\Desktop\Blinky.lnk');$s.TargetPath='%INSTALL_DIR%\blinky.exe';$s.Save()"

echo Creating Start Menu Shortcut...
powershell -Command "$s=(New-Object -COM WScript.Shell).CreateShortcut('%APPDATA%\Microsoft\Windows\Start Menu\Programs\Blinky.lnk');$s.TargetPath='%INSTALL_DIR%\blinky.exe';$s.Save()"

echo =========================================================
echo  Installation Complete! Launching Blinky...
echo =========================================================
start "" "%INSTALL_DIR%\blinky.exe"
