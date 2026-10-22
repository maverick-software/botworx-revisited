param([Parameter(Mandatory=$true)][string]$Job)
$ErrorActionPreference='Stop'
if([IO.Path]::GetFullPath($Job) -notmatch '^F:\\Agentopia\\\.supabase\\desktop-runtime-links55\\[0-9]{13}$'){throw 'Unexpected link-maintenance job'}
$taskTarget='F:\Agentopia-Data\runtime\legacy-AgentopiaRuntime'
if(-not [IO.Directory]::Exists($taskTarget) -or -not [IO.File]::Exists((Join-Path $taskTarget 'ext4.vhdx'))){throw 'The retained legacy disk is missing'}
$taskRoots=@('C:\Users\charl\AppData\Roaming\Agentopia','C:\Users\charl\AppData\Local\Packages\OpenAI.Codex_2p2nqsd0c76g0\LocalCache\Roaming\Agentopia')
$taskLinks=@()
try{
 foreach($taskRoot in $taskRoots){
  [IO.Directory]::CreateDirectory($taskRoot)|Out-Null
  $taskLink=Join-Path $taskRoot 'wsl'
  if(Test-Path -LiteralPath $taskLink){
   $taskItem=Get-Item -LiteralPath $taskLink -Force
   if(($taskItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0 -or @($taskItem.Target).Count -ne 1 -or [IO.Path]::GetFullPath(@($taskItem.Target)[0]) -cne $taskTarget){throw 'An existing runtime redirect differs from the verified retained disk'}
  }else{New-Item -ItemType Junction -Path $taskLink -Target $taskTarget|Out-Null}
  $taskLinks+=@{path=$taskLink;target=$taskTarget}
 }
 @{success=$true;links=$taskLinks;runtimeDataWrites=0;at=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json -Depth 5|Set-Content -LiteralPath (Join-Path $Job 'result.json') -Encoding utf8NoBOM
}catch{@{success=$false;error=$_.Exception.Message}|ConvertTo-Json -Compress|Set-Content -LiteralPath (Join-Path $Job 'result.json') -Encoding utf8NoBOM;throw}
