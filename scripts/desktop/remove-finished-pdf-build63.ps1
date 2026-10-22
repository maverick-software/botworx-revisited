$ErrorActionPreference='Stop'
$taskRoot='F:\Agentopia\.supabase\desktop-pdf-pages-release63\1792633720415'
$taskAccepted=Get-Content -LiteralPath (Join-Path $taskRoot 'delivery-accepted.json') -Raw | ConvertFrom-Json
if (-not $taskAccepted.success -or -not $taskAccepted.installed -or -not $taskAccepted.ordinaryReopened) {throw 'Accepted installed release required'}
$taskImage='C:\Users\charl\AppData\Local\AgentopiaDesktop\app-0.44.63\resources\app.asar'
$taskQualified=Join-Path $taskRoot 'program\resources\app.asar'
foreach ($taskFile in @($taskImage,$taskQualified)) {if ((Get-FileHash -LiteralPath $taskFile -Algorithm SHA256).Hash.ToLower() -cne $taskAccepted.imageSha256) {throw 'Current image changed'}}
$taskIntent=Get-Content -LiteralPath (Join-Path $taskRoot 'installer-build-short\intent.json') -Raw | ConvertFrom-Json
$taskScratch=[IO.Path]::GetDirectoryName($taskIntent.temp)
if($taskScratch -notmatch '^F:\\Agentopia-Tmp\\installer63-\d{13}$'){throw 'Unexpected installer scratch path'}
$taskTargets=@((Join-Path $taskRoot 'packaged-1792633787077\private-program'),(Join-Path $taskRoot 'installer-build-short\input'),(Join-Path $taskRoot 'application-source'),$taskScratch)
$taskPlans=@()
foreach ($taskTarget in $taskTargets) {
 if ([IO.Path]::GetFullPath($taskTarget) -cne $taskTarget -or $taskTarget -notmatch '^F:\\(?:Agentopia\\\.supabase\\desktop-pdf-pages-release63\\1792633720415\\|Agentopia-Tmp\\installer63-\d{13}$)') {throw 'Unexpected cleanup target'}
 if(-not (Test-Path -LiteralPath $taskTarget)){throw 'Inspect the cleanup history before repeating deletion'}
 if((Resolve-Path -LiteralPath $taskTarget).ProviderPath -cne $taskTarget){throw 'Unexpected resolved cleanup target'}
 for ($taskAncestor=Get-Item -LiteralPath $taskTarget;$null -ne $taskAncestor;$taskAncestor=$taskAncestor.Parent) {if ($taskAncestor.Attributes -band [IO.FileAttributes]::ReparsePoint) {throw 'Linked cleanup ancestor'}}
 if (@(Get-CimInstance Win32_Process | Where-Object {$_.ExecutablePath -and $_.ExecutablePath.StartsWith($taskTarget+'\',[StringComparison]::OrdinalIgnoreCase)}).Count) {throw 'A process still uses a cleanup tree'}
 $taskRows=@(Get-ChildItem -LiteralPath $taskTarget -Recurse -Force)
 if (@($taskRows | Where-Object {$_.Attributes -band [IO.FileAttributes]::ReparsePoint}).Count) {throw 'Linked cleanup child'}
 $taskFiles=@($taskRows | Where-Object {-not $_.PSIsContainer})
 $taskPlans += [pscustomobject]@{target=$taskTarget;files=$taskFiles.Count;logicalFileBytes=($taskFiles | Measure-Object Length -Sum).Sum}
}
foreach ($taskPlan in $taskPlans) {Remove-Item -LiteralPath $taskPlan.target -Recurse -Force; if (Test-Path -LiteralPath $taskPlan.target) {throw 'Finished build remains'}}
foreach ($taskFile in @($taskImage,$taskQualified)) {if ((Get-FileHash -LiteralPath $taskFile -Algorithm SHA256).Hash.ToLower() -cne $taskAccepted.imageSha256) {throw 'Current image changed during cleanup'}}
$taskResult=@{success=$true;at=[DateTime]::UtcNow.ToString('o');removed=$taskPlans;logicalBytesMayShareHardlinks=$true;currentInstalledAndQualifiedProgramsPreserved=$true;acceptedQaProgramRetainedForNextLivePdfTest=$true;recoveryProfilesRuntimeArtifactsAndEvidenceRetained=$true;installerAndFullPackageRetained=$true}
$taskResult | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $taskRoot 'finished-build-cleanup.json') -Encoding utf8
$taskResult | ConvertTo-Json -Depth 6 -Compress
