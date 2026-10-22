param([Parameter(Mandatory=$true)][string]$Job)
if($PSVersionTable.PSVersion.Major -lt 7){
 $taskPwsh='F:\Agentopia\.supabase\desktop-plugin-release55\1792598853555\program\resources\resources\code-tools\powershell-7.6.7\pwsh.exe'
 $taskStream=[IO.File]::OpenRead($taskPwsh);try{$taskDigest=[BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash($taskStream)).Replace('-','').ToLowerInvariant()}finally{$taskStream.Dispose()}
 if($taskDigest -ne 'fa2c8bb1e35cdd62ad15cd06a1d8f2c5961e9725a9bfa1e7cfd2c322f49e9619'){throw 'The qualified long-path shell changed'}
 & $taskPwsh -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $PSCommandPath -Job $Job
 exit $LASTEXITCODE
}
$ErrorActionPreference='Stop'
$taskJob=[IO.Path]::GetFullPath($Job)
if($taskJob -notmatch '^F:\\Agentopia\\\.supabase\\desktop-cleanup55\\[0-9]{13}$'){throw 'Unexpected cleanup job'}
$taskEligible=Get-Content -LiteralPath (Join-Path $taskJob 'eligible.json') -Raw | ConvertFrom-Json
if(-not $taskEligible.success -or -not $taskEligible.programRollbackVerified){throw 'Independent preservation checks are required'}
if(@(Get-Process Agentopia,AgentopiaSetup -ErrorAction SilentlyContinue).Count -ne 0){throw 'Agentopia must be closed normally before cleanup'}
$taskSelector='C:\Users\charl\.agentopia\desktop\profile-location.json'
if((Get-FileHash -LiteralPath $taskSelector -Algorithm SHA256).Hash.ToLower() -ne $taskEligible.selectorSha256){throw 'Profile selector changed'}
$taskResult=@{success=$false;at=[DateTime]::UtcNow.ToString('o');deletedFiles=0;deletedBytes=0;roots=@();retainedRedirects=@();providerRequests=0}
function Save-TaskReceipt { $taskResult | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath (Join-Path $taskJob 'cleanup.json') -Encoding UTF8 }
function Assert-PhysicalPath([string]$Value){
 $taskPath=[IO.Path]::GetFullPath($Value)
 if($taskPath -cne $Value){throw 'Cleanup paths must be absolute and canonical'}
 $taskAncestor=Get-Item -LiteralPath $taskPath -Force
 while($null -ne $taskAncestor){
  if(($taskAncestor.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'Cleanup root or ancestor is redirected'}
  if($taskAncestor -is [IO.FileInfo]){$taskAncestor=$taskAncestor.Directory}else{$taskAncestor=$taskAncestor.Parent}
 }
}
function Assert-Unused([string]$Value){
 $taskNeedle=$Value.ToLowerInvariant()
 $taskRefs=@(Get-CimInstance Win32_Process | Where-Object { ($_.ExecutablePath -and $_.ExecutablePath.ToLowerInvariant().Contains($taskNeedle)) -or ($_.CommandLine -and $_.CommandLine.ToLowerInvariant().Contains($taskNeedle)) })
 if($taskRefs.Count -gt 0){throw ('A process still references cleanup root '+$Value)}
}
function Remove-TaskTree([string]$Value){
 if(-not (Test-Path -LiteralPath $Value)){return}
 Assert-PhysicalPath $Value; Assert-Unused $Value
 $taskAllowed=@('C:\Users\charl\.agentopia\desktop\profile','C:\Users\charl\AppData\Roaming\Agentopia','C:\Users\charl\AppData\Local\AgentopiaDesktop\app-0.44.52','C:\Users\charl\AppData\Local\AgentopiaDesktop\app-0.44.53','C:\Users\charl\AppData\Local\AgentopiaDesktop\app-0.44.54')
 if($Value -cnotin $taskAllowed){throw 'Root is outside the explicit obsolete-copy list'}
 $taskDirectories=New-Object 'System.Collections.Generic.List[string]'
 $taskFiles=New-Object 'System.Collections.Generic.List[object]'
 $taskPending=New-Object 'System.Collections.Generic.Stack[string]';$taskPending.Push($Value)
 while($taskPending.Count -gt 0){
  $taskDirectory=$taskPending.Pop();$taskDirectories.Add($taskDirectory)
  foreach($taskEntry in Get-ChildItem -LiteralPath $taskDirectory -Force){
   $taskFull=[IO.Path]::GetFullPath($taskEntry.FullName)
   if(-not $taskFull.StartsWith($Value+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'A descendant escaped the explicit root'}
   if(($taskEntry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){$taskResult.retainedRedirects+=@{path=$taskFull;target=@($taskEntry.Target)};continue}
   if($taskEntry.PSIsContainer){$taskPending.Push($taskFull)}else{$taskFiles.Add(@{path=$taskFull;bytes=$taskEntry.Length})}
  }
 }
 Assert-Unused $Value
 foreach($taskFile in $taskFiles){
  $taskEntry=Get-Item -LiteralPath $taskFile.path -Force
  if(($taskEntry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or $taskEntry.Length -ne $taskFile.bytes){throw 'A deletion candidate changed'}
  Remove-Item -LiteralPath $taskFile.path -Force
  $taskResult.deletedFiles++;$taskResult.deletedBytes+=$taskFile.bytes
 }
 for($taskIndex=$taskDirectories.Count-1;$taskIndex -ge 0;$taskIndex--){
  $taskDirectory=$taskDirectories[$taskIndex]
  if(@(Get-ChildItem -LiteralPath $taskDirectory -Force).Count -eq 0){Remove-Item -LiteralPath $taskDirectory -Force}
 }
 $taskResult.roots+=@{path=$Value;removed=(-not (Test-Path -LiteralPath $Value));files=$taskFiles.Count}
 Save-TaskReceipt
 Write-Output ('Removed obsolete files from '+$Value)
}
try{
 Save-TaskReceipt
 Remove-TaskTree 'C:\Users\charl\.agentopia\desktop\profile'
 Remove-TaskTree 'C:\Users\charl\AppData\Roaming\Agentopia'
 foreach($taskVersion in @('0.44.52','0.44.53','0.44.54')){Remove-TaskTree ('C:\Users\charl\AppData\Local\AgentopiaDesktop\app-'+$taskVersion)}
 $taskPackages='C:\Users\charl\AppData\Local\AgentopiaDesktop\packages'
 Assert-PhysicalPath $taskPackages
 $taskReleases=Get-Content -LiteralPath (Join-Path $taskPackages 'RELEASES') -Raw
 foreach($taskVersion in @('0.44.52','0.44.53','0.44.54')){
  $taskName='AgentopiaDesktop-'+$taskVersion+'-full.nupkg';$taskFile=Join-Path $taskPackages $taskName
  if((Test-Path -LiteralPath $taskFile) -and -not $taskReleases.Contains($taskName)){
   Assert-PhysicalPath $taskFile;Assert-Unused $taskFile;$taskBytes=(Get-Item -LiteralPath $taskFile).Length
   Remove-Item -LiteralPath $taskFile -Force;$taskResult.deletedFiles++;$taskResult.deletedBytes+=$taskBytes
  }
 }
 $taskResult.success=$true;$taskResult.completedAt=[DateTime]::UtcNow.ToString('o');Save-TaskReceipt
 $taskResult | ConvertTo-Json -Depth 7
}catch{$taskResult.error=$_.Exception.Message;Save-TaskReceipt;throw}
