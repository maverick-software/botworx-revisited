$ErrorActionPreference='Stop'
$caseRoot=[IO.Path]::GetFullPath('F:\Agentopia\.supabase\desktop-live-vision61\1792626948504')
$target=[IO.Path]::GetFullPath((Join-Path $caseRoot 'private-program'))
if($target -ne 'F:\Agentopia\.supabase\desktop-live-vision61\1792626948504\private-program'){throw 'Unexpected cleanup scope'}
$accepted=Get-Content -LiteralPath (Join-Path $caseRoot 'live-vision-accepted.json') -Raw | ConvertFrom-Json
if(-not $accepted.success -or -not $accepted.qaRuntimeStopped -or -not $accepted.leaseCleanup.restored -or $accepted.modelRequests -ne 1){throw 'Completed live acceptance required'}
for($ancestor=Get-Item -LiteralPath $target;$null -ne $ancestor;$ancestor=$ancestor.Parent){if($ancestor.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Linked cleanup ancestor'}}
$running=@(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($target+'\',[StringComparison]::OrdinalIgnoreCase) })
if($running.Count){throw 'Test program still has a running process'}
$rows=@(Get-ChildItem -LiteralPath $target -Recurse -Force)
if(@($rows | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }).Count){throw 'Linked cleanup child'}
if((Get-FileHash -LiteralPath (Join-Path $target 'resources\app.asar') -Algorithm SHA256).Hash.ToLower() -ne $accepted.imageSha256){throw 'Test image hash differs'}
$current='C:\Users\charl\AppData\Local\AgentopiaDesktop\app-0.44.61\resources\app.asar'
$qualified='F:\Agentopia\.supabase\desktop-image-attachment-release61\1792625224507\program\resources\app.asar'
foreach($file in @($current,$qualified)){if((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLower() -ne $accepted.imageSha256){throw 'Current image differs'}}
$files=@($rows | Where-Object {-not $_.PSIsContainer});$logicalBytes=($files | Measure-Object Length -Sum).Sum
Remove-Item -LiteralPath $target -Recurse -Force
if(Test-Path -LiteralPath $target){throw 'Finished test program remains'}
foreach($file in @($current,$qualified)){if((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLower() -ne $accepted.imageSha256){throw 'Current image changed during cleanup'}}
$result=@{success=$true;at=[DateTime]::UtcNow.ToString('o');removed=$target;files=$files.Count;logicalFileBytes=$logicalBytes;logicalBytesMayShareHardlinks=$true;currentInstalledAndQualifiedProgramsPreserved=$true;qaProfileRuntimeAndEvidenceRetained=$true}
$result | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $caseRoot 'finished-program-cleanup.json') -Encoding utf8
$result | ConvertTo-Json -Compress
