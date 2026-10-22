param([Parameter(Mandatory=$true)][string]$Job)
$ErrorActionPreference='Stop'
if([IO.Path]::GetFullPath($Job) -notmatch '^F:\\Agentopia\\\.supabase\\desktop-roaming-cleanup55\\[0-9]{13}$'){throw 'Unexpected ordinary cleanup job'}
$taskIntent=Get-Content -LiteralPath (Join-Path $Job 'intent.json') -Raw|ConvertFrom-Json
if($taskIntent.name -notmatch '^\.agentopia-context-[a-f0-9]{32}\.tmp$' -or $taskIntent.token -notmatch '^[a-f0-9]{64}$'){throw 'Invalid disposable directory'}
$taskProbe=Join-Path 'C:\Users\charl\AppData\Roaming\Agentopia' $taskIntent.name
function Task-Wait([string]$Name){$taskUntil=[DateTime]::UtcNow.AddSeconds(90);while(-not(Test-Path -LiteralPath (Join-Path $Job $Name))){if([DateTime]::UtcNow -gt $taskUntil){throw ('Timed out waiting for '+$Name)};Start-Sleep -Milliseconds 100}}
try{
 [IO.Directory]::CreateDirectory($taskProbe)|Out-Null
 [IO.File]::WriteAllText((Join-Path $taskProbe 'probe.txt'),$taskIntent.token,[Text.UTF8Encoding]::new($false))
 @{success=$true;pid=$PID;probe=$taskProbe}|ConvertTo-Json -Compress|Set-Content -LiteralPath (Join-Path $Job 'ready.json') -Encoding utf8NoBOM
 Task-Wait 'probe-delete'
 Remove-Item -LiteralPath $taskProbe -Recurse -Force
 @{success=$true}|ConvertTo-Json -Compress|Set-Content -LiteralPath (Join-Path $Job 'probe-deleted.json') -Encoding utf8NoBOM
 Task-Wait 'physical-context-accepted.json'
 $taskApproval=Get-Content -LiteralPath (Join-Path $Job 'physical-context-accepted.json') -Raw|ConvertFrom-Json
 if(-not $taskApproval.success -or -not $taskApproval.ordinaryWriteVerified -or -not $taskApproval.ordinaryDirectoryDeletionVerified){throw 'Physical write and directory removal checks are required'}
 & 'F:\Agentopia\scripts\desktop\remove-retired-native55.ps1' -Job 'F:\Agentopia\.supabase\desktop-cleanup55\1792599907730' *> (Join-Path $Job 'console.txt')
 $taskResult=Get-Content -LiteralPath 'F:\Agentopia\.supabase\desktop-cleanup55\1792599907730\bulk-cleanup.json' -Raw|ConvertFrom-Json
 if(-not $taskResult.success){throw 'Checked-tree removal did not finish'}
 @{success=$true;pid=$PID;finishedAt=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json -Compress|Set-Content -LiteralPath (Join-Path $Job 'result.json') -Encoding utf8NoBOM
}catch{
 @{success=$false;error=$_.Exception.Message;pid=$PID;at=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json -Compress|Set-Content -LiteralPath (Join-Path $Job 'result.json') -Encoding utf8NoBOM
 throw
}finally{
 if([IO.Directory]::Exists($taskProbe)){
  $taskFiles=@([IO.DirectoryInfo]::new($taskProbe).EnumerateFileSystemInfos())
  if($taskFiles.Count -eq 1 -and $taskFiles[0].Name -ceq 'probe.txt' -and [IO.File]::ReadAllText($taskFiles[0].FullName) -ceq $taskIntent.token){[IO.File]::Delete($taskFiles[0].FullName);[IO.Directory]::Delete($taskProbe)}
 }
}
