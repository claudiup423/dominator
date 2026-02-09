@echo off
REM ============================================
REM  DominanceBot Build Script
REM  Creates installer: installer/DominanceBotSetup.exe
REM ============================================
echo.
echo  ==========================================
echo   DominanceBot Build Pipeline
echo  ==========================================
echo.

REM --- Step 1: Check dependencies ---
echo [1/4] Checking dependencies...
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found. Install Python 3.10+ first.
    pause
    exit /b 1
)

pip show pyinstaller >nul 2>&1
if errorlevel 1 (
    echo Installing PyInstaller...
    pip install pyinstaller
)

pip show rlbot >nul 2>&1
if errorlevel 1 (
    echo Installing rlbot...
    pip install rlbot --pre
)

pip show requests >nul 2>&1
if errorlevel 1 (
    echo Installing requests...
    pip install requests
)

echo Dependencies OK.
echo.

REM --- Step 2: Clean previous build ---
echo [2/4] Cleaning previous build...
if exist dist rmdir /s /q dist
if exist build rmdir /s /q build
echo Clean.
echo.

REM --- Step 3: Build with PyInstaller ---
echo [3/4] Building with PyInstaller...
echo     This may take 1-3 minutes...
pyinstaller DominanceBot.spec --noconfirm
if errorlevel 1 (
    echo ERROR: PyInstaller build failed!
    pause
    exit /b 1
)
echo PyInstaller build complete.
echo.

REM --- Step 4: Create installer with Inno Setup ---
echo [4/4] Creating installer with Inno Setup...

REM Try common Inno Setup paths
set ISCC=""
if exist "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" (
    set ISCC="C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
)
if exist "C:\Program Files\Inno Setup 6\ISCC.exe" (
    set ISCC="C:\Program Files\Inno Setup 6\ISCC.exe"
)

if %ISCC%=="" (
    echo.
    echo  Inno Setup not found!
    echo  Option A: Install from https://jrsoftware.org/isdl.php
    echo            Then re-run this script.
    echo  Option B: Open installer.iss manually in Inno Setup Compiler.
    echo.
    echo  PyInstaller output is ready in: dist\DominanceBot\
    echo  You can distribute this folder as-is (no installer needed).
    echo.
    pause
    exit /b 0
)

if not exist installer mkdir installer
%ISCC% installer.iss
if errorlevel 1 (
    echo ERROR: Inno Setup build failed!
    pause
    exit /b 1
)

echo.
echo  ==========================================
echo   BUILD COMPLETE!
echo   Installer: installer\DominanceBotSetup.exe
echo  ==========================================
echo.
pause
