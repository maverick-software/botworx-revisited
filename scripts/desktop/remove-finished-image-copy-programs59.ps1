$ErrorActionPreference='Stop'
$current='F:\Agentopia\.supabase\desktop-report-copy-release59\1792619036422'
$imageCase='F:\Agentopia\.supabase\desktop-image-readiness59\live-1792618573942'
$accepted=Get-Content -LiteralPath (Join-Path $current 'delivery-accepted.json') -Raw | ConvertFrom-Json
$image=Get-Content -LiteralPath (Join-Path $imageCase 'live-image-accepted.json') -Raw | ConvertFrom-Json
$packaged=Get-Content -LiteralPath (Join-Path $current 'packaged-accepted.json') -Raw | ConvertFrom-Json
$receipt=Join-Path $current 'finished-qa-program-cleanup.json'
if(Test-Path -LiteralPath $receipt){throw 'The completed cleanup receipt is immutable'}
if(-not $accepted.success -or -not $accepted.installed -or -not $accepted.ordinaryReopened -or -not $image.success -or -not $image.qaRuntimeStopped -or -not $packaged.success -or -not $packaged.coldReopening){throw 'Accepted delivery and completed QA required'}
$installed='C:\Users\charl\AppData\Local\AgentopiaDesktop\app-0.44.59\resources\app.asar'
if((Get-FileHash -LiteralPath $installed -Algorithm SHA256).Hash.ToLowerInvariant() -ne $accepted.imageSha256){throw 'Installed image changed'}
$targets=@(@{path=(Join-Path $imageCase 'private-program');sha=$image.imageSha256},@{path=(Join-Path $current 'packaged-1792619381401\private-program');sha=$accepted.imageSha256})
$processes=@(Get-CimInstance Win32_Process);$files=0L;$bytes=0L
foreach($row in $targets){
 $target=$row.path
 if([IO.Path]::GetFullPath($target) -ne $target -or [IO.Path]::GetFileName($target) -ne 'private-program' -or -not ($target.StartsWith($imageCase+'\',[StringComparison]::OrdinalIgnoreCase) -or $target.StartsWith($current+'\packaged-1792619381401\',[StringComparison]::OrdinalIgnoreCase))){throw 'Unexpected final program target'}
 if(-not (Test-Path -LiteralPath $target)){continue}
 if((Resolve-Path -LiteralPath $target).ProviderPath -ne $target){throw 'Program target resolves elsewhere'}
 $ancestor=[IO.DirectoryInfo]::new($target)
 while($null -ne $ancestor){if((Get-Item -LiteralPath $ancestor.FullName -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Program ancestor is a redirect'};$ancestor=$ancestor.Parent}
 if(@($processes | Where-Object {($_.ExecutablePath -and $_.ExecutablePath.StartsWith($target+'\',[StringComparison]::OrdinalIgnoreCase)) -or ($_.CommandLine -and $_.CommandLine.IndexOf($target,[StringComparison]::OrdinalIgnoreCase) -ge 0)}).Count){throw 'Program copy remains in use'}
 if((Get-FileHash -LiteralPath (Join-Path $target 'resources\app.asar') -Algorithm SHA256).Hash.ToLowerInvariant() -ne $row.sha){throw 'Program copy has unexpected bytes'}
 Get-ChildItem -LiteralPath $target -Force -Recurse | ForEach-Object {if($_.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Program child is a redirect'};if(-not $_.PSIsContainer){$script:files++;$script:bytes+=$_.Length}}
}
# Both exact final paths and all descendants are validated before removal.
$before=(Get-PSDrive -Name F).Free
foreach($row in $targets){if(Test-Path -LiteralPath $row.path){Remove-Item -LiteralPath $row.path -Recurse -Force};if(Test-Path -LiteralPath $row.path){throw 'Program copy remains'}}
if((Get-FileHash -LiteralPath $installed -Algorithm SHA256).Hash.ToLowerInvariant() -ne $accepted.imageSha256){throw 'Installed image changed during cleanup'}
$json=@{success=$true;at=[DateTime]::UtcNow.ToString('o');targets=@($targets | ForEach-Object {$_.path});files=$files;fileBytes=$bytes;fFreeBefore=$before;fFreeAfter=(Get-PSDrive -Name F).Free;installedImagePreserved=$true;privateProfilesAndRuntimesUntouched=$true;evidenceAndGeneratedImagePreserved=$true;currentQualifiedProgramPreserved=$true} | ConvertTo-Json -Depth 4
[IO.File]::WriteAllText($receipt,$json,[Text.UTF8Encoding]::new($false))
$json
