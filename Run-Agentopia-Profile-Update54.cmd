@echo off
setlocal
set "ELECTRON_RUN_AS_NODE="
set "NODE_OPTIONS="
powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -Command "Start-Process -FilePath 'C:\Program Files\nodejs\node.exe' -ArgumentList @('F:\Agentopia\scripts\desktop\run-normal-maintenance54.mjs') -WorkingDirectory 'F:\Agentopia' -RedirectStandardOutput 'F:\Agentopia\.supabase\desktop-profile-release54\1792578806223\normal-install-controller\stdout.log' -RedirectStandardError 'F:\Agentopia\.supabase\desktop-profile-release54\1792578806223\normal-install-controller\stderr.log' -WindowStyle Hidden"
exit /b %errorlevel%
