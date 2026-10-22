param([Parameter(Mandatory=$true)][string]$InspectionSha256)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$taskEvidenceRoot = Join-Path $taskRoot '.supabase\desktop-maintenance\navigation47-input'
$taskInspectionFile = Join-Path $taskEvidenceRoot 'inspection.json'
$taskHasher = [Security.Cryptography.SHA256]::Create()
$taskStream = [IO.File]::OpenRead($taskInspectionFile)
try { $taskActualHash = [BitConverter]::ToString($taskHasher.ComputeHash($taskStream)).Replace('-','').ToLowerInvariant() } finally { $taskStream.Dispose(); $taskHasher.Dispose() }
if ($taskActualHash -ne $InspectionSha256) { throw 'The inspected disposal plan changed.' }
$taskPlan = Get-Content -LiteralPath $taskInspectionFile -Raw | ConvertFrom-Json
$taskExpected = [IO.Path]::GetFullPath('C:\Users\charl\AgentopiaQA\navigation-rollup-installer\1792452552365\input')
$taskResolved = (Resolve-Path -LiteralPath $taskPlan.input).ProviderPath
if (-not ($taskPlan.success -and $taskPlan.ownedGeneratedInput -and $taskPlan.everyInputFileReproducible -and $taskPlan.finishedInstallerVerified -and $taskPlan.noRunningExecutableFromInput)) { throw 'The completed input has not been verified.' }
if ($taskResolved -ne $taskExpected -or (Split-Path -Parent $taskResolved) -ne 'C:\Users\charl\AgentopiaQA\navigation-rollup-installer\1792452552365') { throw 'The resolved disposal path is outside its exact owned input.' }
$taskReceiptFile = Join-Path $taskEvidenceRoot 'retired.json'
if (Test-Path -LiteralPath $taskReceiptFile) { throw 'A disposal receipt already exists; do not repeat the action.' }
foreach ($taskItem in @(Get-Item -LiteralPath $taskResolved -Force) + @(Get-ChildItem -LiteralPath $taskResolved -Force -Recurse)) {
 if (($taskItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'A linked input entry requires inspection.' }
 if (-not ($taskItem.FullName -eq $taskExpected -or $taskItem.FullName.StartsWith($taskExpected+'\',[StringComparison]::OrdinalIgnoreCase))) { throw 'An input entry resolves outside the owned path.' }
}
if (@(Get-Process | Where-Object {$_.Path -like ($taskExpected+'\*')}).Count -ne 0) { throw 'An input executable is still running.' }
$taskFreeBefore = [int64]([IO.DriveInfo]::new('C:\')).AvailableFreeSpace
Remove-Item -LiteralPath $taskResolved -Recurse -Force
if (Test-Path -LiteralPath $taskResolved) { throw 'The input remains; preserve its state for inspection.' }
$taskFreeAfter = [int64]([IO.DriveInfo]::new('C:\')).AvailableFreeSpace
$taskResult = [ordered]@{success=$true;at=[DateTime]::UtcNow.ToString('o');input=$taskExpected;inspectionSha256=$InspectionSha256;verifiedGeneratedFiles=$taskPlan.files;verifiedGeneratedBytes=$taskPlan.bytes;deleted=$true;freeBefore=$taskFreeBefore;freeAfter=$taskFreeAfter;finishedInstallerRetained=$true;frozenPayloadRetained=$true;userBackupsRetained=$true}
$taskResult | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $taskReceiptFile -Encoding utf8
$taskResult | ConvertTo-Json -Compress
