param([Parameter(Mandatory=$true)][string]$Job)
if($PSVersionTable.PSVersion.Major -lt 7){
 $taskPwsh='F:\Agentopia\.supabase\desktop-plugin-release55\1792598853555\program\resources\resources\code-tools\powershell-7.6.7\pwsh.exe'
 $taskStream=[IO.File]::OpenRead($taskPwsh);try{$taskDigest=[BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash($taskStream)).Replace('-','').ToLowerInvariant()}finally{$taskStream.Dispose()}
 if($taskDigest -ne 'fa2c8bb1e35cdd62ad15cd06a1d8f2c5961e9725a9bfa1e7cfd2c322f49e9619'){throw 'The qualified shell changed'}
 & $taskPwsh -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $PSCommandPath -Job $Job
 exit $LASTEXITCODE
}
$ErrorActionPreference='Stop'
if([IO.Path]::GetFullPath($Job) -notmatch '^F:\\Agentopia\\\.supabase\\desktop-test-disk-cleanup55\\[0-9]{13}$'){throw 'Unexpected test-disk cleanup job'}
$taskSpec=@(
 @{name='AgentopiaRuntime-da60b030-acf4-4788-bb65-3219cc240f61';root='C:\Users\charl\AgentopiaQA\plugin-compatibility\1792385923176\wsl'},
 @{name='AgentopiaRuntime-79a96692-29b9-45d2-ad35-a94c21f39077';root='C:\Users\charl\AgentopiaQA\plugin-compatibility\1792387134890\wsl'},
 @{name='AgentopiaRuntime-a832b112-8c68-471a-bcb8-de3ab476b8f4';root='C:\Users\charl\AgentopiaQA\plugin-compatibility\1792394462346\wsl'}
)
function Task-Registry {
 @(Get-ChildItem -LiteralPath HKCU:/Software/Microsoft/Windows/CurrentVersion/Lxss | ForEach-Object { $taskRecord=Get-ItemProperty -LiteralPath $_.PSPath; @{name=$taskRecord.DistributionName;root=($taskRecord.BasePath -replace '^\\\\\?\\','').TrimEnd('\')} })
}
function Assert-TaskPhysical([string]$Value){
 for($taskAncestor=Get-Item -LiteralPath $Value -Force;$null -ne $taskAncestor;$taskAncestor=$taskAncestor.Parent){if(($taskAncestor.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'The obsolete test root is redirected'}}
}
$taskRegistry=Task-Registry
$taskProduction=@($taskRegistry | Where-Object { $_.name -eq 'AgentopiaRuntime-a91a4800-e08f-4440-a4ec-588762d01bfd' })
if($taskProduction.Count -ne 1 -or $taskProduction[0].root -cne 'F:\Agentopia-Data\runtime\a91a4800-e08f-4440-a4ec-588762d01bfd'){throw 'Production runtime location changed'}
$taskResult=@{success=$false;at=[DateTime]::UtcNow.ToString('o');removed=@();providerRequests=0;productionRuntimeUntouched=$true;forceStops=0}
function Task-Save { $taskResult | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath (Join-Path $Job 'evidence.json') -Encoding UTF8 }
Task-Save
try{
 foreach($taskItem in $taskSpec){
  $taskRegistered=@((Task-Registry) | Where-Object { $_.name -ceq $taskItem.name })
  if($taskRegistered.Count -ne 1 -or $taskRegistered[0].root -cne $taskItem.root){throw 'An old test registration no longer matches its exact C root'}
  Assert-TaskPhysical $taskItem.root
  $taskRunning=(wsl.exe --list --running --quiet | Out-String).Replace([string][char]0,'');if($LASTEXITCODE -ne 0){throw 'Cannot check running runtimes'}
  if($taskRunning.Contains($taskItem.name)){throw 'Leave the running test runtime alone'}
  $taskUsers=@(Get-CimInstance Win32_Process | Where-Object { ($_.ExecutablePath -and $_.ExecutablePath.StartsWith($taskItem.root,[StringComparison]::OrdinalIgnoreCase)) -or ($_.CommandLine -and $_.CommandLine.Contains($taskItem.root)) })
  if($taskUsers.Count -gt 0){throw 'A process still references the old test disk'}
  $taskDisk=Join-Path $taskItem.root 'ext4.vhdx';$taskInfo=Get-Item -LiteralPath $taskDisk -Force
  if($taskInfo.PSIsContainer -or ($taskInfo.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'Unexpected test disk entry'}
  $taskBytes=$taskInfo.Length
  & wsl.exe --unregister $taskItem.name
  if($LASTEXITCODE -ne 0){throw 'Obsolete test runtime removal failed'}
  if(@((Task-Registry) | Where-Object { $_.name -ceq $taskItem.name }).Count -ne 0 -or (Test-Path -LiteralPath $taskDisk)){throw 'Test runtime removal did not complete'}
  $taskResult.removed+=@{name=$taskItem.name;root=$taskItem.root;diskBytes=$taskBytes;wasStopped=$true};Task-Save
 }
 $taskResult.success=$true;$taskResult.finishedAt=[DateTime]::UtcNow.ToString('o');Task-Save
 $taskResult | ConvertTo-Json -Depth 7
}catch{$taskResult.error=$_.Exception.Message;Task-Save;throw}
