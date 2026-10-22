param([Parameter(Mandatory=$true)][string]$Job)
$ErrorActionPreference='Stop'
if([IO.Path]::GetFullPath($Job) -notmatch '^F:\\Agentopia\\\.supabase\\desktop-roaming-context55\\[0-9]{13}$'){throw 'Unexpected probe job'}
$taskIntent=Get-Content -LiteralPath (Join-Path $Job 'intent.json') -Raw | ConvertFrom-Json
if($taskIntent.name -notmatch '^\.agentopia-context-[a-f0-9]{32}\.tmp$' -or $taskIntent.token -notmatch '^[a-f0-9]{64}$'){throw 'Invalid disposable marker'}
$taskMarker=Join-Path 'C:\Users\charl\AppData\Roaming\Agentopia' $taskIntent.name
try{
 [IO.File]::WriteAllText($taskMarker,$taskIntent.token,[Text.UTF8Encoding]::new($false))
 @{success=$true;pid=$PID;roaming=[Environment]::GetFolderPath([Environment+SpecialFolder]::ApplicationData);marker=$taskMarker}|ConvertTo-Json -Compress|Set-Content -LiteralPath (Join-Path $Job 'ready.json') -Encoding utf8NoBOM
 $taskUntil=[DateTime]::UtcNow.AddSeconds(60)
 while(-not (Test-Path -LiteralPath (Join-Path $Job 'release')) -and [DateTime]::UtcNow -lt $taskUntil){Start-Sleep -Milliseconds 100}
}finally{
 if([IO.File]::Exists($taskMarker) -and [IO.File]::ReadAllText($taskMarker) -ceq $taskIntent.token){[IO.File]::Delete($taskMarker)}
 @{success=$true;finishedAt=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json -Compress|Set-Content -LiteralPath (Join-Path $Job 'done.json') -Encoding utf8NoBOM
}
