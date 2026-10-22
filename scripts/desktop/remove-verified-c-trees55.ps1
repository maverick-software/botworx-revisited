param([Parameter(Mandatory=$true)][string]$Job,[switch]$Fixture)
$ErrorActionPreference='Stop'
if($PSVersionTable.PSVersion.Major -lt 7){throw 'Use the qualified PowerShell 7 runtime'}
$taskJob=[IO.Path]::GetFullPath($Job)
if($Fixture){
 if($taskJob -notmatch '^F:\\Agentopia\\\.supabase\\desktop-fast-delete55-tests\\[0-9]{13}$'){throw 'Unexpected fixture directory'}
 $taskRoots=@((Join-Path $taskJob 'candidate'))
}else{
 if($taskJob -cne 'F:\Agentopia\.supabase\desktop-cleanup55\1792599907730'){throw 'Unexpected preservation job'}
 $taskEligible=Get-Content -LiteralPath (Join-Path $taskJob 'eligible.json') -Raw | ConvertFrom-Json
 if(-not $taskEligible.success -or -not $taskEligible.everyDestinationByteVerifiedDuringCopy -or -not $taskEligible.legacySourceRehashedIndependently -or -not $taskEligible.destinationPathsSizesTimesLinksComparedIndependently -or -not $taskEligible.programRollbackVerified){throw 'Completed preservation checks are required'}
 if((Get-FileHash -LiteralPath 'C:\Users\charl\.agentopia\desktop\profile-location.json' -Algorithm SHA256).Hash.ToLower() -ne $taskEligible.selectorSha256){throw 'The selected F profile changed'}
 if(@(Get-Process Agentopia,AgentopiaSetup -ErrorAction SilentlyContinue).Count -ne 0){throw 'Close Agentopia normally before removing old builds'}
 $taskRoots=@('C:\Users\charl\.agentopia\desktop\profile','C:\Users\charl\AppData\Roaming\Agentopia','C:\Users\charl\AppData\Local\AgentopiaDesktop\app-0.44.52','C:\Users\charl\AppData\Local\AgentopiaDesktop\app-0.44.53','C:\Users\charl\AppData\Local\AgentopiaDesktop\app-0.44.54')
}
$taskResult=@{success=$false;at=[DateTime]::UtcNow.ToString('o');deletedFiles=0;deletedBytes=0;retainedRedirects=@();roots=@();providerRequests=0;priorPartialDeletionNotIncludedInCounts=(-not $Fixture)}
function Task-Save { $taskResult | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath (Join-Path $taskJob 'bulk-cleanup.json') -Encoding utf8NoBOM }
function Task-Within([string]$Value,[string]$Boundary){
 $taskFull=[IO.Path]::GetFullPath($Value)
 if($taskFull -cne $Value -or ($taskFull -cne $Boundary -and -not $taskFull.StartsWith($Boundary+'\',[StringComparison]::OrdinalIgnoreCase))){throw 'A deletion target escaped its explicit root'}
}
function Task-Physical([string]$Value){
 $taskItem=Get-Item -LiteralPath $Value -Force
 while($null -ne $taskItem){
  if(($taskItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'The deletion root or its parent is redirected'}
  if($taskItem -is [IO.FileInfo]){$taskItem=$taskItem.Directory}else{$taskItem=$taskItem.Parent}
 }
}
function Task-Unused([string]$Value){
 $taskNeedle=$Value.ToLowerInvariant()
 if(@(Get-CimInstance Win32_Process | Where-Object { ($_.ExecutablePath -and $_.ExecutablePath.ToLowerInvariant().Contains($taskNeedle)) -or ($_.CommandLine -and $_.CommandLine.ToLowerInvariant().Contains($taskNeedle)) }).Count -gt 0){throw ('A process references '+$Value)}
}
function Task-Plan([string]$Value,[string]$Boundary){
 Task-Within $Value $Boundary;Task-Physical $Value
 $taskPlan=@{files=0;bytes=0;links=0}
 $taskPending=[Collections.Generic.Stack[IO.DirectoryInfo]]::new();$taskPending.Push([IO.DirectoryInfo]::new($Value))
 while($taskPending.Count -gt 0){
  foreach($taskEntry in $taskPending.Pop().EnumerateFileSystemInfos()){
   Task-Within $taskEntry.FullName $Boundary
   if(($taskEntry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){$taskPlan.links++;continue}
   if(($taskEntry.Attributes -band [IO.FileAttributes]::Directory) -ne 0){$taskPending.Push([IO.DirectoryInfo]$taskEntry)}else{$taskPlan.files++;$taskPlan.bytes+=([IO.FileInfo]$taskEntry).Length}
  }
 }
 return $taskPlan
}
function Task-Remove([string]$Value,[string]$Boundary){
 Task-Within $Value $Boundary
 if(-not (Test-Path -LiteralPath $Value)){return}
 $taskEntry=Get-Item -LiteralPath $Value -Force
 if(($taskEntry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){$taskResult.retainedRedirects+=@{path=$Value;target=@($taskEntry.Target)};Task-Save;return}
 Task-Physical $Value
 if(-not $taskEntry.PSIsContainer){$taskBytes=$taskEntry.Length;Remove-Item -LiteralPath $Value -Force;$taskResult.deletedFiles++;$taskResult.deletedBytes+=$taskBytes;return}
 $taskPlan=Task-Plan $Value $Boundary
 if($taskPlan.links -eq 0){
  Task-Unused $Boundary
  Remove-Item -LiteralPath $Value -Recurse -Force
  if(Test-Path -LiteralPath $Value){throw 'A checked directory was not fully removed'}
  $taskResult.deletedFiles+=$taskPlan.files;$taskResult.deletedBytes+=$taskPlan.bytes;Task-Save
  Write-Output ('Removed checked obsolete tree '+$Value)
 }else{
  foreach($taskChild in @([IO.DirectoryInfo]::new($Value).EnumerateFileSystemInfos())){Task-Remove $taskChild.FullName $Boundary}
  if(@([IO.DirectoryInfo]::new($Value).EnumerateFileSystemInfos()).Count -eq 0){Remove-Item -LiteralPath $Value -Force}
 }
}
try{
 Task-Save
 foreach($taskRoot in $taskRoots){
  if(Test-Path -LiteralPath $taskRoot){Task-Unused $taskRoot;Task-Remove $taskRoot $taskRoot}
  $taskResult.roots+=@{path=$taskRoot;removed=(-not (Test-Path -LiteralPath $taskRoot))};Task-Save
 }
 $taskResult.success=$true;$taskResult.finishedAt=[DateTime]::UtcNow.ToString('o');Task-Save
 $taskResult | ConvertTo-Json -Depth 7
}catch{$taskResult.error=$_.Exception.Message;Task-Save;throw}
