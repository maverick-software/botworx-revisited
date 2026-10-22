$ErrorActionPreference='Stop'
$taskRoot='F:\Agentopia\.supabase\desktop-chart-format-release62\1792628986175'
$taskAccepted=Get-Content -LiteralPath (Join-Path $taskRoot 'delivery-accepted.json') -Raw | ConvertFrom-Json
if (-not $taskAccepted.success -or -not $taskAccepted.installed -or -not $taskAccepted.ordinaryReopened) {throw 'Accepted installed release required'}
$taskImage='C:\Users\charl\AppData\Local\AgentopiaDesktop\app-0.44.62\resources\app.asar'
$taskQualified=Join-Path $taskRoot 'program\resources\app.asar'
foreach ($taskFile in @($taskImage,$taskQualified)) {if ((Get-FileHash -LiteralPath $taskFile -Algorithm SHA256).Hash.ToLower() -cne $taskAccepted.imageSha256) {throw 'Current image changed'}}
$taskTargets=@(
 (Join-Path $taskRoot 'packaged-1792629074201\private-program'),
 (Join-Path $taskRoot 'installer-build-short\input'),
 (Join-Path $taskRoot 'application-source'),
 'F:\Agentopia-Tmp\installer62-1792629250134',
 'F:\Agentopia\.supabase\desktop-chart-format62\1792628673662\ui',
 'F:\Agentopia\.supabase\desktop-chart-format62\1792628737190\ui'
)
$taskPlans=@()
foreach ($taskTarget in $taskTargets) {
 if ([IO.Path]::GetFullPath($taskTarget) -cne $taskTarget -or $taskTarget -notmatch '^F:\\(?:Agentopia\\\.supabase\\desktop-chart-format(?:-release)?62\\\d{13}\\|Agentopia-Tmp\\installer62-\d{13}$)') {throw 'Unexpected cleanup target'}
 for ($taskAncestor=Get-Item -LiteralPath $taskTarget;$null -ne $taskAncestor;$taskAncestor=$taskAncestor.Parent) {if ($taskAncestor.Attributes -band [IO.FileAttributes]::ReparsePoint) {throw 'Linked cleanup ancestor'}}
 if (@(Get-CimInstance Win32_Process | Where-Object {$_.ExecutablePath -and $_.ExecutablePath.StartsWith($taskTarget+'\',[StringComparison]::OrdinalIgnoreCase)}).Count) {throw 'An owned build process still uses a cleanup tree'}
 $taskRows=@(Get-ChildItem -LiteralPath $taskTarget -Recurse -Force)
 if (@($taskRows | Where-Object {$_.Attributes -band [IO.FileAttributes]::ReparsePoint}).Count) {throw 'Linked cleanup child'}
 $taskFiles=@($taskRows | Where-Object {-not $_.PSIsContainer})
 $taskPlans += [pscustomobject]@{target=$taskTarget;files=$taskFiles.Count;logicalFileBytes=($taskFiles | Measure-Object Length -Sum).Sum}
}
foreach ($taskPlan in $taskPlans) {Remove-Item -LiteralPath $taskPlan.target -Recurse -Force; if (Test-Path -LiteralPath $taskPlan.target) {throw 'Finished build remains'}}
foreach ($taskFile in @($taskImage,$taskQualified)) {if ((Get-FileHash -LiteralPath $taskFile -Algorithm SHA256).Hash.ToLower() -cne $taskAccepted.imageSha256) {throw 'Current image changed during cleanup'}}
$taskResult=@{success=$true;at=[DateTime]::UtcNow.ToString('o');removed=$taskPlans;logicalBytesMayShareHardlinks=$true;currentInstalledAndQualifiedProgramsPreserved=$true;recoveryProfilesRuntimeArtifactsAndEvidenceRetained=$true;installerAndFullPackageRetained=$true}
$taskResult | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $taskRoot 'finished-build-cleanup.json') -Encoding utf8
$taskResult | ConvertTo-Json -Depth 6 -Compress
