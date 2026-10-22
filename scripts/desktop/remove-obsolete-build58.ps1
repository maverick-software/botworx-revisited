param([Parameter(Mandatory=$true)][string]$Job)
$ErrorActionPreference='Stop'
$jobPath=[IO.Path]::GetFullPath($Job)
if($jobPath -notmatch '^F:\\Agentopia\\\.supabase\\desktop-normal-maintenance\\\d{13}$'){throw 'Unexpected accepted maintenance folder'}
$accepted=Get-Content -LiteralPath (Join-Path $jobPath 'installed-data-accepted.json') -Raw | ConvertFrom-Json
$intent=Get-Content -LiteralPath (Join-Path $jobPath 'intent.json') -Raw | ConvertFrom-Json
$rollback=Get-Content -LiteralPath (Join-Path $jobPath 'physical-rollback.json') -Raw | ConvertFrom-Json
if(-not $accepted.success -or $accepted.version -ne '0.44.58' -or -not $accepted.ordinaryFProfileSelected -or -not $rollback.success){throw 'Installed account and rollback verification is required'}
function FileDigest([string]$File){$stream=[IO.File]::OpenRead($File);try{return [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($stream)).ToLowerInvariant()}finally{$stream.Dispose()}}
$oldRoot='C:\Users\charl\AppData\Local\AgentopiaDesktop\app-0.44.57'
$currentRoot='C:\Users\charl\AppData\Local\AgentopiaDesktop\app-0.44.58'
$currentExe=Join-Path $currentRoot 'Agentopia.exe'
$mains=@(Get-CimInstance Win32_Process -Filter "Name='Agentopia.exe'" | Where-Object {$_.CommandLine -notmatch '--type='})
if($mains.Count -ne 1 -or $mains[0].ExecutablePath -ne $currentExe -or -not (Get-Process -Id $mains[0].ProcessId).Responding){throw 'The verified new app must be running normally'}
if((FileDigest (Join-Path $currentRoot 'resources/app.asar')) -ne $accepted.imageSha256){throw 'The new installed image changed'}
if((FileDigest (Join-Path $jobPath 'rollback/program/resources/app.asar')) -ne $intent.sourceImageSha256){throw 'The retained rollback image changed'}
$before=(Get-PSDrive -Name C).Free
$files=0L;$bytes=0L;$removed=$false
if(Test-Path -LiteralPath $oldRoot){
 $resolved=(Resolve-Path -LiteralPath $oldRoot).ProviderPath
 if($resolved -ne $oldRoot -or [IO.Path]::GetFullPath($resolved) -ne $oldRoot){throw 'Unexpected resolved old-build path'}
 $ancestor=[IO.DirectoryInfo]::new($oldRoot)
 while($null -ne $ancestor){if((Get-Item -LiteralPath $ancestor.FullName -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'An old-build ancestor is a redirect'};$ancestor=$ancestor.Parent}
 if(@(Get-CimInstance Win32_Process | Where-Object {$_.ExecutablePath -and $_.ExecutablePath.StartsWith($oldRoot+'\',[StringComparison]::OrdinalIgnoreCase)}).Count){throw 'An old-build process is still running'}
 Get-ChildItem -LiteralPath $oldRoot -Force -Recurse | ForEach-Object {if($_.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'An old-build child is a redirect'};if(-not $_.PSIsContainer){$script:files++;$script:bytes+=$_.Length}}
 if((FileDigest (Join-Path $oldRoot 'resources/app.asar')) -ne $intent.sourceImageSha256){throw 'The obsolete image differs from its verified rollback'}
 Remove-Item -LiteralPath $oldRoot -Recurse -Force
 $removed=$true
}
if(Test-Path -LiteralPath $oldRoot){throw 'Old installed build remains'}
if((FileDigest (Join-Path $currentRoot 'resources/app.asar')) -ne $accepted.imageSha256){throw 'The new image changed during cleanup'}
$result=@{success=$true;target=$oldRoot;version='0.44.58';removed=$removed;alreadyAbsent=(-not $removed);files=$files;bytes=$bytes;cFreeBefore=$before;cFreeAfter=(Get-PSDrive -Name C).Free;currentAppPreserved=$true;rollbackOnFVerified=$true}
$json=$result | ConvertTo-Json -Depth 5
[IO.File]::WriteAllText((Join-Path $jobPath 'obsolete-build57-cleanup.json'),$json,[Text.UTF8Encoding]::new($false))
$json
