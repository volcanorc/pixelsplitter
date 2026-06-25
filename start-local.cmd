@echo off
setlocal
title 32x32 Minecraft Image Slicer

set "APP_DIR=%~dp0"
set "NODE_EXE="

for /f "delims=" %%I in ('where node 2^>nul') do (
  if not defined NODE_EXE set "NODE_EXE=%%I"
)

if not defined NODE_EXE (
  set "BUNDLED_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
  if exist "%BUNDLED_NODE%" set "NODE_EXE=%BUNDLED_NODE%"
)

echo Starting local site...
echo Close this window to stop it.
echo.

if defined NODE_EXE (
  "%NODE_EXE%" "%APP_DIR%server.js" --open
) else (
  echo Node.js was not found. Using the built-in Windows PowerShell server instead.
  echo.
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%APP_DIR%server.ps1" -Open
)
