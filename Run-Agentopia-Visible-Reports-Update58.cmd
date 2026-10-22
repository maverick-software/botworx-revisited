@echo off
setlocal
cd /d "F:\Agentopia"
echo Installing the verified Agentopia update with fresh recovery.
"C:\Program Files\nodejs\node.exe" "F:\Agentopia\scripts\desktop\run-normal-maintenance58.mjs"
set "agentopiaExit=%ERRORLEVEL%"
echo.
if not "%agentopiaExit%"=="0" echo The update stopped. Keep the recovery folder and the message above.
pause
exit /b %agentopiaExit%
