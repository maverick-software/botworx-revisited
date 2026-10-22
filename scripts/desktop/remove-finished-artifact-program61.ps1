$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath('F:/Agentopia/.supabase/desktop-live-artifacts61/1792627868210')
$taskTarget=[IO.Path]::GetFullPath((Join-Path $taskRoot 'private-program'))
if ($taskTarget -cne 'F:\Agentopia\.supabase\desktop-live-artifacts61\1792627868210\private-program') {throw 'Unexpected cleanup scope'}
$taskOriginal=Get-Content -LiteralPath (Join-Path $taskRoot 'evidence.json') -Raw | ConvertFrom-Json
$taskAccepted=Get-Content -LiteralPath (Join-Path $taskRoot 'artifact-content-accepted.json') -Raw | ConvertFrom-Json
$taskRetired=Get-Content -LiteralPath (Join-Path $taskRoot 'fixtures-retired.json') -Raw | ConvertFrom-Json
if (-not $taskAccepted.success -or -not $taskAccepted.coldNoReplay -or -not $taskAccepted.cleanup.leaseRemoved -or $taskAccepted.totalModelRequests -ne 8 -or -not $taskRetired.qaRuntimeStopped -or -not $taskRetired.generatedAgentsRetired) {throw 'Completed and stopped artifact fixtures required'}
for ($taskAncestor=Get-Item -LiteralPath $taskTarget;$null -ne $taskAncestor;$taskAncestor=$taskAncestor.Parent) {if ($taskAncestor.Attributes -band [IO.FileAttributes]::ReparsePoint) {throw 'Linked cleanup ancestor'}}
if (@(Get-CimInstance Win32_Process | Where-Object {$_.ExecutablePath -and $_.ExecutablePath.StartsWith($taskTarget+'\',[StringComparison]::OrdinalIgnoreCase)}).Count) {throw 'Test program is still running'}
$taskRows=@(Get-ChildItem -LiteralPath $taskTarget -Recurse -Force)
if (@($taskRows | Where-Object {$_.Attributes -band [IO.FileAttributes]::ReparsePoint}).Count) {throw 'Linked cleanup child'}
$taskCurrent='C:/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.61/resources/app.asar'
$taskQualified='F:/Agentopia/.supabase/desktop-image-attachment-release61/1792625224507/program/resources/app.asar'
foreach ($taskFile in @((Join-Path $taskTarget 'resources/app.asar'),$taskCurrent,$taskQualified)) {if ((Get-FileHash -LiteralPath $taskFile -Algorithm SHA256).Hash.ToLower() -cne $taskOriginal.imageSha256) {throw 'Current or test image differs'}}
$taskFiles=@($taskRows | Where-Object {-not $_.PSIsContainer})
Remove-Item -LiteralPath $taskTarget -Recurse -Force
if (Test-Path -LiteralPath $taskTarget) {throw 'Finished test program remains'}
foreach ($taskFile in @($taskCurrent,$taskQualified)) {if ((Get-FileHash -LiteralPath $taskFile -Algorithm SHA256).Hash.ToLower() -cne $taskOriginal.imageSha256) {throw 'Current image changed during cleanup'}}
$taskResult=@{success=$true;at=[DateTime]::UtcNow.ToString('o');removed=$taskTarget;files=$taskFiles.Count;logicalFileBytes=($taskFiles | Measure-Object Length -Sum).Sum;logicalBytesMayShareHardlinks=$true;currentInstalledAndQualifiedProgramsPreserved=$true;qaProfileRuntimeOutputsAndEvidenceRetained=$true}
$taskResult | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskRoot 'finished-program-cleanup.json') -Encoding utf8
$taskResult | ConvertTo-Json -Compress
