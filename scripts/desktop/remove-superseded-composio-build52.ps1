$ErrorActionPreference = 'Stop'
$workspace = [IO.Path]::GetFullPath('F:\Agentopia')
Set-Location -LiteralPath $workspace
$operationLockPath = "$workspace\desktop\.operation-lock"
if (Test-Path -LiteralPath $operationLockPath) { throw 'Finish the current desktop operation before cleanup.' }
$operationLockStream = [IO.File]::Open($operationLockPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::Read)
try {
    $operationLockBytes = [Text.Encoding]::UTF8.GetBytes((@{pid=$PID;kind='remove superseded Composio candidate build'} | ConvertTo-Json -Compress))
    $operationLockStream.Write($operationLockBytes, 0, $operationLockBytes.Length)
} finally { $operationLockStream.Dispose() }
try {
$oldRoot = [IO.Path]::GetFullPath("$workspace\.supabase\desktop-composio-candidate52\1792560089336")
$current = Get-Content -LiteralPath "$workspace\.supabase\desktop-composio-candidate52\current.json" -Raw | ConvertFrom-Json
$proof = Get-Content -LiteralPath $current.proof -Raw | ConvertFrom-Json
$accepted = Get-Content -LiteralPath "$($proof.out)\composio-recovery-dispatch-qualification.json" -Raw | ConvertFrom-Json
if (!$proof.success -or !$accepted.success -or $proof.out -eq $oldRoot -or $accepted.imageSha256 -ne $proof.imageSha256) { throw 'The replacement candidate is not qualified.' }
$targets = @('program','base-archive') | ForEach-Object { [IO.Path]::GetFullPath((Join-Path $oldRoot $_)) }
$processes = @(Get-CimInstance Win32_Process -Filter "Name = 'Agentopia.exe'" -ErrorAction Stop)
$records = @()
foreach ($target in $targets) {
    if (!$target.StartsWith($oldRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw "Cleanup target escaped the superseded candidate: $target" }
    if (!$target.StartsWith($workspace + '\', [StringComparison]::OrdinalIgnoreCase)) { throw "Cleanup target escaped the workspace: $target" }
    if (!(Test-Path -LiteralPath $target)) { $records += @{path=$target;alreadyAbsent=$true}; continue }
    $resolved = (Resolve-Path -LiteralPath $target).ProviderPath
    if ($resolved -ne $target) { throw "Unexpected target resolution: $resolved" }
    foreach ($process in $processes) {
        if ($process.ExecutablePath -and $process.ExecutablePath.StartsWith($target + '\', [StringComparison]::OrdinalIgnoreCase)) { throw "Superseded build is running: $target" }
    }
    $items = @((Get-Item -LiteralPath $target -Force)) + @(Get-ChildItem -LiteralPath $target -Recurse -Force)
    if (@($items | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }).Count) { throw "Refusing a build containing a junction or symbolic link: $target" }
    $files = @($items | Where-Object { !$_.PSIsContainer })
    $logicalBytes = ($files | Measure-Object -Property Length -Sum).Sum
    Remove-Item -LiteralPath $target -Recurse -Force
    if (Test-Path -LiteralPath $target) { throw "Cleanup did not remove $target" }
    $records += @{path=$target;removed=$true;files=$files.Count;logicalBytes=$logicalBytes}
}
$receipt = @{success=$true;at=(Get-Date).ToUniversalTime().ToString('o');targets=$records;preserved=@('superseded source and diagnostic evidence','current frozen candidate','retained QA application and runtime','capability-10 backup','ordinary production install and profile');movedFiles=$false;cDriveChanged=$false;physicalBytesFreedUnmeasured=$true}
$output = "$($proof.out)\superseded-build-cleanup.json"
$receipt | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $output -Encoding UTF8
$receipt | ConvertTo-Json -Depth 8
} finally {
    $operationOwner = Get-Content -LiteralPath $operationLockPath -Raw | ConvertFrom-Json
    if ($operationOwner.pid -eq $PID) { Remove-Item -LiteralPath $operationLockPath -Force }
}
