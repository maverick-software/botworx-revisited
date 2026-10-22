param([Parameter(Mandatory=$true)][string]$OutputDirectory, [switch]$Execute)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$taskRoot = 'C:\Users\charl\AppData\Local\AgentopiaDesktop'
$taskCacheRoot = 'C:\Users\charl\AppData\Local\Packages\OpenAI.Codex_2p2nqsd0c76g0\LocalCache\Local\AgentopiaDesktop'
$taskCurrent = Join-Path $taskRoot 'app-0.44.52'
$taskRollbackFile = 'F:\Agentopia\.supabase\desktop-normal-maintenance\1792564329748\program-rollback.json'
$taskExpectedImage = '44e2b1f486068f71e37aac98e07eae5ccc295755a548615dbf9c3158dc321191'
$taskOutput = [IO.Path]::GetFullPath($OutputDirectory)
if ([IO.Path]::GetDirectoryName($taskOutput) -cne 'F:\Agentopia\.supabase\desktop-obsolete-builds52' -or [IO.Path]::GetFileName($taskOutput) -notmatch '^\d{13}$') { throw 'The cleanup record must be in its named F-drive job.' }
if (-not (Test-Path -LiteralPath $taskOutput -PathType Container)) { throw 'Prepare the private output directory first.' }
function Get-TaskHash([string]$TaskFile) {
    $taskStream = [IO.FileStream]::new($TaskFile,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read,262144,[IO.FileOptions]::SequentialScan)
    $taskAlgorithm = [Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($taskAlgorithm.ComputeHash($taskStream))).Replace('-','').ToLowerInvariant() }
    finally { $taskStream.Dispose(); $taskAlgorithm.Dispose() }
}
function Assert-PlainDirectory([string]$Directory) {
    $taskItem = Get-Item -LiteralPath $Directory -Force
    if (-not $taskItem.PSIsContainer -or ($taskItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or [IO.Path]::GetFullPath($taskItem.FullName) -cne [IO.Path]::GetFullPath($Directory)) { throw "Linked or unexpected directory: $Directory" }
}
function Assert-Inactive {
    $taskProcesses = @(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and ($_.ExecutablePath.StartsWith((Join-Path $taskRoot 'app-0.44.43')+'\', [StringComparison]::OrdinalIgnoreCase) -or $_.ExecutablePath.StartsWith((Join-Path $taskCacheRoot 'app-0.44.43')+'\', [StringComparison]::OrdinalIgnoreCase) -or $_.ExecutablePath.StartsWith((Join-Path $taskRoot 'app-0.44.51')+'\', [StringComparison]::OrdinalIgnoreCase) -or $_.ExecutablePath.Equals((Join-Path $taskRoot 'Update.exe'), [StringComparison]::OrdinalIgnoreCase)) })
    if ($taskProcesses.Count -ne 0) { throw 'An old program or the updater is still running. No process will be terminated.' }
    if ((Get-FileHash -LiteralPath (Join-Path $taskCurrent 'resources\app.asar') -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskExpectedImage) { throw 'The current installed application changed.' }
}
Assert-PlainDirectory $taskOutput
foreach ($taskAncestor in @('C:\Users','C:\Users\charl','C:\Users\charl\AppData','C:\Users\charl\AppData\Local',$taskRoot,$taskCurrent,'C:\Users\charl\AppData\Local\Packages','C:\Users\charl\AppData\Local\Packages\OpenAI.Codex_2p2nqsd0c76g0','C:\Users\charl\AppData\Local\Packages\OpenAI.Codex_2p2nqsd0c76g0\LocalCache','C:\Users\charl\AppData\Local\Packages\OpenAI.Codex_2p2nqsd0c76g0\LocalCache\Local',$taskCacheRoot)) { Assert-PlainDirectory $taskAncestor }
Assert-Inactive
$taskRollback = Get-Content -LiteralPath $taskRollbackFile -Raw | ConvertFrom-Json
if (-not $taskRollback.success -or $taskRollback.source -cne 'C:/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.51' -or $taskRollback.destination -cne 'F:\Agentopia\.supabase\desktop-normal-maintenance\1792564329748\rollback\program') { throw 'The independently retained rollback record does not match the inactive 0.44.51 program.' }
Assert-PlainDirectory $taskRollback.destination
$taskExpectedNames = @{}
$taskVerified = 0
foreach ($taskEntry in $taskRollback.files.PSObject.Properties) {
    if ([IO.Path]::IsPathRooted($taskEntry.Name) -or $taskEntry.Name.Split('/') -contains '..') { throw 'Unsafe rollback entry.' }
    $taskExpectedNames[$taskEntry.Name] = $true
    foreach ($taskBase in @($taskRollback.destination,(Join-Path $taskRoot 'app-0.44.51'))) {
        $taskFile = Join-Path $taskBase $taskEntry.Name.Replace('/','\')
        $taskInfo = Get-Item -LiteralPath $taskFile -Force
        if ($taskInfo.PSIsContainer -or ($taskInfo.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or (Get-TaskHash $taskFile) -cne $taskEntry.Value) { throw "The rollback or inactive file differs: $($taskEntry.Name)" }
    }
    $taskVerified++
    if ($taskVerified % 256 -eq 0) {
        @{at=[DateTime]::UtcNow.ToString('o');checked=$taskVerified;total=7328;execute=$Execute.IsPresent;phase='verifying-existing-rollback'} | ConvertTo-Json -Compress | Set-Content -LiteralPath (Join-Path $taskOutput 'progress.json') -Encoding UTF8
    }
}
if ($taskVerified -ne 7328) { throw 'The retained rollback file count differs.' }
$taskCandidates = @()
foreach ($taskName in @('app-0.44.43','app-0.44.51')) {
    $taskParent = if ($taskName -ceq 'app-0.44.43') { $taskCacheRoot } else { $taskRoot }
    $taskDirectory = [IO.Path]::GetFullPath((Join-Path $taskParent $taskName))
    if ([IO.Path]::GetDirectoryName($taskDirectory) -cne $taskParent -or $taskDirectory -ceq $taskCurrent) { throw 'The final deletion target escaped the named inactive build.' }
    Assert-PlainDirectory $taskDirectory
    $taskItems = @(Get-ChildItem -LiteralPath $taskDirectory -Recurse -Force)
    if (@($taskItems | Where-Object { ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 }).Count -ne 0) { throw 'A linked inactive-build entry needs inspection.' }
    $taskFiles = @($taskItems | Where-Object { -not $_.PSIsContainer })
    if ($taskName -ceq 'app-0.44.51') {
        foreach ($taskFile in $taskFiles) {
            $taskRelative = $taskFile.FullName.Substring($taskDirectory.Length+1).Replace('\','/')
            if (-not $taskExpectedNames.ContainsKey($taskRelative) -and $taskRelative -cne 'Squirrel-UpdateSelf.log') { throw "Unexpected inactive-build file: $taskRelative" }
        }
    }
    if (-not (Test-Path -LiteralPath (Join-Path $taskDirectory 'resources\app.asar') -PathType Leaf)) { throw 'The target does not have the expected installed-program layout.' }
    $taskCandidates += [pscustomobject]@{path=$taskDirectory;files=$taskFiles.Count;bytes=[long](($taskFiles | Measure-Object -Property Length -Sum).Sum)}
}
$taskEvidence = [ordered]@{success=$false;executed=$Execute.IsPresent;scriptSha256=(Get-FileHash -LiteralPath $PSCommandPath -Algorithm SHA256).Hash.ToLowerInvariant();at=[DateTime]::UtcNow.ToString('o');output=$taskOutput;targets=$taskCandidates;retainedRollback=$taskRollback.destination;rollbackFilesVerified=$taskVerified;activeVersion='0.44.52';currentImageSha256=$taskExpectedImage;beforeFreeBytes=([IO.DriveInfo]::new('C:\')).AvailableFreeSpace;deleted=@();providerRequests=0;profileTouched=$false;runtimeTouched=$false}
if (-not $Execute) {
    $taskEvidence.success = $true
    $taskEvidence | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $taskOutput 'plan.json') -Encoding UTF8
    $taskEvidence | ConvertTo-Json -Depth 6 -Compress
    return
}
$taskRecord = Join-Path $taskOutput 'evidence.json'
$taskEvidence | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $taskRecord -Encoding UTF8
foreach ($taskCandidate in $taskCandidates) {
    Assert-Inactive
    Assert-PlainDirectory $taskCandidate.path
    if ($taskCandidate.path -cnotin @('C:\Users\charl\AppData\Local\Packages\OpenAI.Codex_2p2nqsd0c76g0\LocalCache\Local\AgentopiaDesktop\app-0.44.43','C:\Users\charl\AppData\Local\AgentopiaDesktop\app-0.44.51')) { throw 'The final literal deletion target is not approved.' }
    Remove-Item -LiteralPath $taskCandidate.path -Recurse -Force
    if (Test-Path -LiteralPath $taskCandidate.path) { throw 'An inactive directory remains.' }
    $taskEvidence.deleted += $taskCandidate.path
    $taskEvidence | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $taskRecord -Encoding UTF8
}
Assert-Inactive
$taskEvidence.afterFreeBytes = ([IO.DriveInfo]::new('C:\')).AvailableFreeSpace
$taskEvidence.deletedFileBytes = [long](($taskCandidates | Measure-Object -Property bytes -Sum).Sum)
$taskEvidence.success = $true
$taskEvidence | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $taskRecord -Encoding UTF8
$taskEvidence | ConvertTo-Json -Depth 6 -Compress
