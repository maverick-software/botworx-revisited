@echo off
setlocal
title Agentopia verified update
echo Agentopia 0.44.51 - verified recovery and update
echo Close Agentopia normally before continuing.
echo This window shows progress and stays open when the update finishes.
echo.
if not exist "C:\Program Files\nodejs\node.exe" (
  echo Node.js was not found at C:\Program Files\nodejs\node.exe.
  echo The installer has not been started.
  pause
  exit /b 1
)
"C:\Program Files\nodejs\node.exe" "%~dp0scripts\desktop\run-normal-maintenance51.mjs" %*
set "AgentopiaUpdateExit=%errorlevel%"
echo.
if not "%AgentopiaUpdateExit%"=="0" echo The update stopped. Read the message and records path above.
pause
exit /b %AgentopiaUpdateExit%
