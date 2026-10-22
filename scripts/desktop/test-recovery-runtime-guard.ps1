param([ValidateSet('before','after')][string]$Phase='after')
$ErrorActionPreference='Stop'
$taskRoot=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$taskOut=Join-Path 'C:\Users\charl\AgentopiaQA\recovery-runtime-guard' ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds().ToString())
New-Item -ItemType Directory -Path $taskOut | Out-Null
$taskBackup=Join-Path $taskOut 'generated-backup';New-Item -ItemType Directory -Path $taskBackup | Out-Null
$taskFiles=@()
foreach($taskName in @('auth.dump','application.dump','vault.dump','pgsodium_root.key')){
 $taskPath=Join-Path $taskBackup $taskName;[IO.File]::WriteAllText($taskPath,'GENERATED-RECOVERY-GUARD-'+$taskName)
 $taskStream=[IO.File]::OpenRead($taskPath);$taskSha=[Security.Cryptography.SHA256]::Create()
 try{$taskDigest=([BitConverter]::ToString($taskSha.ComputeHash($taskStream))).Replace('-','').ToLowerInvariant()}finally{$taskStream.Dispose();$taskSha.Dispose()}
 $taskFiles+=@{name=$taskName;sha256=$taskDigest}
}
@{format=1;files=$taskFiles}|ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $taskBackup 'manifest.json') -Encoding utf8
$taskAppData=Join-Path $taskOut 'generated-home\AppData\Roaming';New-Item -ItemType Directory -Path $taskAppData | Out-Null
$taskSavedAppData=$env:APPDATA;$taskBlocked=$false;$taskError=$null
function global:wsl { $global:LASTEXITCODE=0; 'AgentopiaRuntime-11111111-1111-4111-8111-111111111111' }
try{
 $env:APPDATA=$taskAppData
 try{& (Join-Path $taskRoot 'scripts\desktop\import-backup.ps1') -BackupDirectory $taskBackup | Out-Null}catch{$taskBlocked=$true;$taskError=$_.Exception.Message}
}finally{$env:APPDATA=$taskSavedAppData;Remove-Item Function:\wsl}
$taskWritten=Test-Path -LiteralPath (Join-Path $taskAppData 'Agentopia\migration-input')
$taskResult=@{at=[DateTime]::UtcNow.ToString('o');phase=$Phase;out=$taskOut;registeredRuntime='AgentopiaRuntime-11111111-1111-4111-8111-111111111111';blocked=$taskBlocked;error=$taskError;generatedDestinationWritten=$taskWritten;productionChanged=$false;providerRequests=0}
$taskResult|ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskOut 'evidence.json') -Encoding utf8
$taskResult|ConvertTo-Json -Compress
if($Phase -eq 'before'){if($taskBlocked -or -not $taskWritten){throw 'The old-helper runtime-guard failure did not reproduce in the generated fixture.'}}
elseif(-not $taskBlocked -or $taskWritten -or $taskError -notmatch 'existing Agentopia runtime'){throw 'The current helper did not refuse the existing UUID runtime before writing.'}
