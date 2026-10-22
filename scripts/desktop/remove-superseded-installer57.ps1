$ErrorActionPreference='Stop'
$releaseRoot='F:\Agentopia\.supabase\desktop-agent-report-release57'
$currentRoot=Join-Path $releaseRoot '1792613505169'
$obsoleteRoot=Join-Path $releaseRoot '1792611488698\installer-build-short'
$current=Get-Content -LiteralPath (Join-Path $currentRoot 'delivery-accepted.json') -Raw | ConvertFrom-Json
$prior=Get-Content -LiteralPath (Join-Path $releaseRoot '1792611488698\installer-proof.json') -Raw | ConvertFrom-Json
if(-not $current.success -or -not $current.installed -or -not $current.ordinaryReopened -or $prior.installed -or $prior.imageSha256 -eq $current.imageSha256){throw 'Verified installed replacement and superseded installer identity required'}
$image='C:\Users\charl\AppData\Local\AgentopiaDesktop\app-0.44.57\resources\app.asar'
if((Get-FileHash -LiteralPath $image -Algorithm SHA256).Hash.ToLowerInvariant() -ne $current.imageSha256){throw 'Installed replacement changed'}
$targets=@('input','output','vendor' | ForEach-Object {Join-Path $obsoleteRoot $_})
$processes=@(Get-CimInstance Win32_Process)
$files=0L;$bytes=0L
foreach($target in $targets){
 if([IO.Path]::GetFullPath($target) -ne $target -or -not $target.StartsWith($obsoleteRoot+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Unexpected cleanup target'}
 if(-not (Test-Path -LiteralPath $target)){continue}
 if((Resolve-Path -LiteralPath $target).ProviderPath -ne $target){throw 'Cleanup target resolves elsewhere'}
 $ancestor=[IO.DirectoryInfo]::new($target)
 while($null -ne $ancestor){if((Get-Item -LiteralPath $ancestor.FullName -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Cleanup ancestor is a redirect'};$ancestor=$ancestor.Parent}
 if(@($processes | Where-Object {($_.ExecutablePath -and $_.ExecutablePath.StartsWith($target+'\',[StringComparison]::OrdinalIgnoreCase)) -or ($_.CommandLine -and $_.CommandLine.IndexOf($target,[StringComparison]::OrdinalIgnoreCase) -ge 0)}).Count){throw 'Superseded installer is still in use'}
 Get-ChildItem -LiteralPath $target -Force -Recurse | ForEach-Object {if($_.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Cleanup child is a redirect'};if(-not $_.PSIsContainer){$script:files++;$script:bytes+=$_.Length}}
}
# Every final absolute target is checked before the first recursive removal.
foreach($target in $targets){if(Test-Path -LiteralPath $target){Remove-Item -LiteralPath $target -Recurse -Force};if(Test-Path -LiteralPath $target){throw 'Superseded build remains'}}
if((Get-FileHash -LiteralPath $image -Algorithm SHA256).Hash.ToLowerInvariant() -ne $current.imageSha256){throw 'Installed image changed during cleanup'}
$receipt=@{success=$true;at=[DateTime]::UtcNow.ToString('o');targets=$targets;files=$files;fileBytes=$bytes;currentInstalledImagePreserved=$true;candidateEvidenceAndRendererPreserved=$true;privateProfilesUntouched=$true}
$json=$receipt | ConvertTo-Json -Depth 4
[IO.File]::WriteAllText((Join-Path $currentRoot 'obsolete-intermediate-installer-cleanup.json'),$json,[Text.UTF8Encoding]::new($false))
$json
