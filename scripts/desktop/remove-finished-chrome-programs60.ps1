$ErrorActionPreference='Stop'
$current='F:\Agentopia\.supabase\desktop-chrome-context-release60\1792622029563'
$accepted=Get-Content -LiteralPath (Join-Path $current 'delivery-accepted.json') -Raw | ConvertFrom-Json
$imageCase='F:\Agentopia\.supabase\desktop-live-image-edit60\1792620802834'
$image=Get-Content -LiteralPath (Join-Path $imageCase 'live-edit-accepted.json') -Raw | ConvertFrom-Json
$early='F:\Agentopia\.supabase\desktop-chrome-context-release60\1792621590649'
$earlyProof=Get-Content -LiteralPath (Join-Path $early 'package-proof.json') -Raw | ConvertFrom-Json
$receipt=Join-Path $current 'finished-private-program-cleanup.json'
if(Test-Path -LiteralPath $receipt){throw 'Finished cleanup receipt is immutable'}
if(-not $accepted.success -or -not $accepted.installed -or -not $accepted.ordinaryReopened -or -not $image.success -or -not $image.qaRuntimeStopped){throw 'Accepted application and completed image check required'}
$installed='C:\Users\charl\AppData\Local\AgentopiaDesktop\app-0.44.60\resources\app.asar'
if((Get-FileHash -LiteralPath $installed -Algorithm SHA256).Hash.ToLowerInvariant() -ne $accepted.imageSha256){throw 'Current installed image changed'}
$targets=@(@{path=(Join-Path $imageCase 'private-program');sha=$image.imageSha256},@{path=(Join-Path $early 'program');sha=$earlyProof.imageSha256})
foreach($case in @('packaged-1792622353164','packaged-1792622496331','packaged-1792622717059')){$targets+=@{path=(Join-Path $current ($case+'\private-program'));sha=$accepted.imageSha256}}
$processes=@(Get-CimInstance Win32_Process);$files=0L;$bytes=0L
foreach($row in $targets){
 $target=$row.path
 if([IO.Path]::GetFullPath($target) -ne $target -or -not $target.StartsWith('F:\Agentopia\.supabase\',[StringComparison]::OrdinalIgnoreCase) -or -not ([IO.Path]::GetFileName($target) -eq 'private-program' -or $target -eq (Join-Path $early 'program'))){throw 'Unexpected final inactive-program target'}
 if(-not (Test-Path -LiteralPath $target)){continue}
 if((Resolve-Path -LiteralPath $target).ProviderPath -ne $target){throw 'Inactive program resolves elsewhere'}
 $ancestor=[IO.DirectoryInfo]::new($target)
 while($null -ne $ancestor){if((Get-Item -LiteralPath $ancestor.FullName -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Inactive program ancestor is a redirect'};$ancestor=$ancestor.Parent}
 if(@($processes | Where-Object {($_.ExecutablePath -and $_.ExecutablePath.StartsWith($target+'\',[StringComparison]::OrdinalIgnoreCase)) -or ($_.CommandLine -and $_.CommandLine.IndexOf($target,[StringComparison]::OrdinalIgnoreCase) -ge 0)}).Count){throw 'Inactive program is still in use'}
 if((Get-FileHash -LiteralPath (Join-Path $target 'resources\app.asar') -Algorithm SHA256).Hash.ToLowerInvariant() -ne $row.sha){throw 'Inactive program bytes are unexpected'}
 Get-ChildItem -LiteralPath $target -Force -Recurse | ForEach-Object {if($_.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Inactive program child is a redirect'};if(-not $_.PSIsContainer){$script:files++;$script:bytes+=$_.Length}}
}
# Exact resolved targets and all children are verified before any removal.
$before=(Get-PSDrive -Name F).Free
foreach($row in $targets){if(Test-Path -LiteralPath $row.path){Remove-Item -LiteralPath $row.path -Recurse -Force};if(Test-Path -LiteralPath $row.path){throw 'Inactive program remains'}}
if((Get-FileHash -LiteralPath $installed -Algorithm SHA256).Hash.ToLowerInvariant() -ne $accepted.imageSha256){throw 'Current installed image changed during cleanup'}
$json=@{success=$true;at=[DateTime]::UtcNow.ToString('o');targets=@($targets | ForEach-Object {$_.path});files=$files;logicalFileBytes=$bytes;fFreeBefore=$before;fFreeAfter=(Get-PSDrive -Name F).Free;installedImagePreserved=$true;privateProfilesAndRuntimesUntouched=$true;evidenceAndGeneratedImagesPreserved=$true;qualifiedCurrentProgramAndInstallerPreserved=$true} | ConvertTo-Json -Depth 4
[IO.File]::WriteAllText($receipt,$json,[Text.UTF8Encoding]::new($false));$json
