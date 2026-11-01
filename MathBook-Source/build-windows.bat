@echo off
setlocal
cd /d "%~dp0"
title Sajel - build Windows installer

echo ============================================
echo   Sajel - building the Windows installer
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed.
  echo Install Node.js 22 LTS from https://nodejs.org then run this file again.
  pause
  exit /b 1
)

where pnpm >nul 2>nul
if errorlevel 1 (
  echo [1/4] Installing pnpm...
  call npm install -g pnpm@9.12.0
  if errorlevel 1 (
    echo [ERROR] Could not install pnpm. Try running this file as Administrator.
    pause
    exit /b 1
  )
) else (
  echo [1/4] pnpm found.
)

echo.
echo [2/4] Installing app dependencies (first time takes a few minutes)...
call pnpm install --frozen-lockfile
if errorlevel 1 (
  echo First attempt failed, retrying without the frozen lockfile...
  call pnpm install
  if errorlevel 1 (
    echo [ERROR] Dependency install failed. Check your internet and try again.
    pause
    exit /b 1
  )
)

echo.
echo [3/4] Installing desktop dependencies...
cd desktop
rem Older copies of the project contain a desktop\pnpm-workspace.yaml that pnpm 9 rejects ("packages field missing"). Remove it.
if exist pnpm-workspace.yaml del /q pnpm-workspace.yaml
rem desktop is NOT part of the root workspace, so it must be installed on its own (otherwise electron-builder is not found).
call pnpm install --ignore-workspace --no-frozen-lockfile
if errorlevel 1 (
  echo [ERROR] Desktop dependency install failed.
  pause
  exit /b 1
)

echo.
echo [4/4] Building the installer (exports the web UI, then packages with Electron)...
set CSC_IDENTITY_AUTO_DISCOVERY=false
call pnpm run build:win
if errorlevel 1 (
  echo.
  echo [ERROR] Build failed.
  echo - If the message mentions "symbolic link": right-click this file and choose "Run as administrator",
  echo   or enable Developer Mode in Windows Settings, then run it again.
  echo - If it mentions a file being used by another process: close antivirus scanning for this folder and retry.
  pause
  exit /b 1
)

cd ..
echo.
echo ============================================
echo   Done. Opening the output folder...
echo   Installer: artifacts\windows\Sajel-Setup-1.0.0-x64.exe
echo ============================================
if exist "artifacts\windows" start "" "artifacts\windows"
pause
endlocal
