$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath('F:/Agentopia/.supabase/desktop-live-agents62/1792630528847')
$taskTarget=[IO.Path]::GetFullPath((Join-Path $taskRoot 'private-program'))
if ($taskTarget -cne 'F:\Agentopia\.supabase\desktop-live-agents62\1792630528847\private-program') {throw 'Unexpected cleanup scope'}
$taskPointer=Get-Content -LiteralPath (Join-Path $taskRoot 'final-acceptance.json') -Raw | ConvertFrom-Json
$taskAccepted=Get-Content -LiteralPath $taskPointer.evidence -Raw | ConvertFrom-Json
if (-not $taskAccepted.success -or -not $taskAccepted.coldNoReplay -or -not $taskAccepted.cleanup.leaseRemoved -or -not $taskAccepted.fixturesRetired -or -not $taskAccepted.qaRuntimeStopped -or $taskAccepted.totalModelRequests -ne 13 -or $taskAccepted.newModelRequestsDuringSavedAcceptance -ne 0) {throw 'Completed and stopped fixtures required'}
for ($taskAncestor=Get-Item -LiteralPath $taskTarget;$null -ne $taskAncestor;$taskAncestor=$taskAncestor.Parent) {if ($taskAncestor.Attributes -band [IO.FileAttributes]::ReparsePoint) {throw 'Linked cleanup ancestor'}}
if (@(Get-CimInstance Win32_Process | Where-Object {$_.ExecutablePath -and $_.ExecutablePath.StartsWith($taskTarget+'\',[StringComparison]::OrdinalIgnoreCase)}).Count) {throw 'Test program is still running'}
$taskRows=@(Get-ChildItem -LiteralPath $taskTarget -Recurse -Force)
if (@($taskRows | Where-Object {$_.Attributes -band [IO.FileAttributes]::ReparsePoint}).Count) {throw 'Linked cleanup child'}
$taskCurrent='C:/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.62/resources/app.asar'
$taskQualified='F:/Agentopia/.supabase/desktop-chart-format-release62/1792628986175/program/resources/app.asar'
foreach ($taskFile in @((Join-Path $taskTarget 'resources/app.asar'),$taskCurrent,$taskQualified)) {if ((Get-FileHash -LiteralPath $taskFile -Algorithm SHA256).Hash.ToLower() -cne $taskAccepted.imageSha256) {throw 'Current or test image differs'}}
$taskFiles=@($taskRows | Where-Object {-not $_.PSIsContainer})
Remove-Item -LiteralPath $taskTarget -Recurse -Force
if (Test-Path -LiteralPath $taskTarget) {throw 'Finished test program remains'}
foreach ($taskFile in @($taskCurrent,$taskQualified)) {if ((Get-FileHash -LiteralPath $taskFile -Algorithm SHA256).Hash.ToLower() -cne $taskAccepted.imageSha256) {throw 'Current image changed during cleanup'}}
$taskResult=@{success=$true;at=[DateTime]::UtcNow.ToString('o');removed=$taskTarget;files=$taskFiles.Count;logicalFileBytes=($taskFiles | Measure-Object Length -Sum).Sum;logicalBytesMayShareHardlinks=$true;currentInstalledAndQualifiedProgramsPreserved=$true;qaProfileRuntimeOutputsAndEvidenceRetained=$true}
$taskResult | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskRoot 'finished-program-cleanup.json') -Encoding utf8
$taskResult | ConvertTo-Json -Compress
