param([Parameter(Mandatory=$true)][string]$Proof)
$ErrorActionPreference='Stop'
function Get-ReleaseFileHash([string]$File){
 $taskStream=[IO.File]::OpenRead($File);$taskHash=[Security.Cryptography.SHA256]::Create()
 try{return [BitConverter]::ToString($taskHash.ComputeHash($taskStream)).Replace('-','').ToLowerInvariant()}finally{$taskStream.Dispose();$taskHash.Dispose()}
}
$taskProof=Get-Content -LiteralPath $Proof -Raw | ConvertFrom-Json
$taskOut=[IO.Path]::GetFullPath($taskProof.out)
$taskBase='F:\Agentopia\.supabase\desktop-release-04448\'
if(-not $taskOut.StartsWith($taskBase,[StringComparison]::OrdinalIgnoreCase) -or $taskProof.version -ne '0.44.48'){throw 'Unexpected release workspace.'}
$taskUpgrade=Get-Content -LiteralPath (Join-Path $taskOut 'database-upgrade-accepted.json') -Raw | ConvertFrom-Json
$taskInstaller=Get-Content -LiteralPath (Join-Path $taskOut 'installer-verified.json') -Raw | ConvertFrom-Json
if(-not $taskUpgrade.success -or -not $taskInstaller.success){throw 'Retain unverified workspaces for investigation.'}
$taskTargets=@((Join-Path $taskOut 'installer-build\input'),(Join-Path $taskOut 'upgrade-acceptance\program'))
$taskRecords=@()
foreach($taskTarget in $taskTargets){
 $taskResolved=(Resolve-Path -LiteralPath $taskTarget).ProviderPath
 if($taskResolved -ne [IO.Path]::GetFullPath($taskTarget) -or -not $taskResolved.StartsWith($taskOut+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Workspace target resolves outside the release.'}
 $taskCurrent=Get-Item -LiteralPath $taskResolved -Force
 while($null -ne $taskCurrent){if(($taskCurrent.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'Linked workspace ancestor.'};$taskCurrent=$taskCurrent.Parent}
 if(@(Get-ChildItem -LiteralPath $taskResolved -Recurse -Force -Attributes ReparsePoint).Count -ne 0){throw 'Linked workspace content.'}
 $taskProcesses=@(Get-CimInstance Win32_Process -Filter "Name='Agentopia.exe'" | Where-Object {$_.ExecutablePath -and $_.ExecutablePath.StartsWith($taskResolved+'\',[StringComparison]::OrdinalIgnoreCase)})
 if($taskProcesses.Count -ne 0){throw 'The owned test application is still running.'}
 if((Get-ReleaseFileHash (Join-Path $taskResolved 'resources\app.asar')) -ne $taskProof.imageSha256){throw 'Workspace does not contain the accepted release image.'}
 $taskFiles=@(Get-ChildItem -LiteralPath $taskResolved -Recurse -Force -File)
 $taskRecords+=@{path=$taskResolved;files=$taskFiles.Count;logicalBytes=($taskFiles|Measure-Object -Property Length -Sum).Sum}
}
# Every absolute target above has been checked before either recursive deletion.
foreach($taskTarget in $taskTargets){Remove-Item -LiteralPath $taskTarget -Recurse -Force;if(Test-Path -LiteralPath $taskTarget){throw 'Workspace cleanup did not finish.'}}
@{success=$true;removed=@($taskRecords);releaseProgramRetained=$taskProof.program;installerRetained=$taskInstaller.installer;physicalBytesFreedNotMeasured=$true}|ConvertTo-Json -Depth 5 -Compress
