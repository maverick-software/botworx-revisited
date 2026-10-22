$ErrorActionPreference='Stop'
$current='F:\Agentopia\.supabase\desktop-parent-report-release58\1792616966996'
$prior='F:\Agentopia\.supabase\desktop-agent-report-release57\1792613505169'
$accepted=Get-Content -LiteralPath (Join-Path $current 'delivery-accepted.json') -Raw | ConvertFrom-Json
$live=Get-Content -LiteralPath (Join-Path $prior 'live-named-report-accepted.json') -Raw | ConvertFrom-Json
$packaged=Get-Content -LiteralPath (Join-Path $current 'packaged-accepted.json') -Raw | ConvertFrom-Json
if(-not $accepted.success -or -not $accepted.installed -or -not $accepted.ordinaryReopened -or -not $live.success -or -not $live.qaRuntimeStopped -or -not $packaged.success -or -not $packaged.coldReopening){throw 'Accepted delivery and completed QA required'}
$image='C:\Users\charl\AppData\Local\AgentopiaDesktop\app-0.44.58\resources\app.asar'
if((Get-FileHash -LiteralPath $image -Algorithm SHA256).Hash.ToLowerInvariant() -ne $accepted.imageSha256){throw 'Installed image changed'}
$targets=@(
 @{path=(Join-Path $prior 'live-report-1792616261470\private-program');sha=$live.imageSha256},
 @{path=(Join-Path $prior 'live-report-1792616310880\private-program');sha=$live.imageSha256},
 @{path=(Join-Path $prior 'live-report-1792616428861\private-program');sha=$live.imageSha256},
 @{path=(Join-Path $current 'packaged-1792617187913\private-program');sha=$accepted.imageSha256},
 @{path=(Join-Path $current 'packaged-1792617390100\private-program');sha=$accepted.imageSha256}
)
$processes=@(Get-CimInstance Win32_Process);$files=0L;$bytes=0L
foreach($row in $targets){
 $target=$row.path
 if([IO.Path]::GetFullPath($target) -ne $target -or [IO.Path]::GetFileName($target) -ne 'private-program' -or -not ($target.StartsWith($prior+'\live-report-',[StringComparison]::OrdinalIgnoreCase) -or $target.StartsWith($current+'\packaged-',[StringComparison]::OrdinalIgnoreCase))){throw 'Unexpected final program-copy target'}
 if(-not (Test-Path -LiteralPath $target)){continue}
 if((Resolve-Path -LiteralPath $target).ProviderPath -ne $target){throw 'Program target resolves elsewhere'}
 $ancestor=[IO.DirectoryInfo]::new($target)
 while($null -ne $ancestor){if((Get-Item -LiteralPath $ancestor.FullName -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Program ancestor is a redirect'};$ancestor=$ancestor.Parent}
 if(@($processes | Where-Object {($_.ExecutablePath -and $_.ExecutablePath.StartsWith($target+'\',[StringComparison]::OrdinalIgnoreCase)) -or ($_.CommandLine -and $_.CommandLine.IndexOf($target,[StringComparison]::OrdinalIgnoreCase) -ge 0)}).Count){throw 'Program copy remains in use'}
 if((Get-FileHash -LiteralPath (Join-Path $target 'resources\app.asar') -Algorithm SHA256).Hash.ToLowerInvariant() -ne $row.sha){throw 'Program copy has unexpected bytes'}
 Get-ChildItem -LiteralPath $target -Force -Recurse | ForEach-Object {if($_.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Program child is a redirect'};if(-not $_.PSIsContainer){$script:files++;$script:bytes+=$_.Length}}
}
# All five exact absolute targets, ancestors and descendants are checked first.
$before=(Get-PSDrive -Name F).Free
foreach($row in $targets){if(Test-Path -LiteralPath $row.path){Remove-Item -LiteralPath $row.path -Recurse -Force};if(Test-Path -LiteralPath $row.path){throw 'Program copy remains'}}
if((Get-FileHash -LiteralPath $image -Algorithm SHA256).Hash.ToLowerInvariant() -ne $accepted.imageSha256){throw 'Installed image changed during cleanup'}
$json=@{success=$true;at=[DateTime]::UtcNow.ToString('o');targets=@($targets | ForEach-Object {$_.path});files=$files;fileBytes=$bytes;fFreeBefore=$before;fFreeAfter=(Get-PSDrive -Name F).Free;installedImagePreserved=$true;privateProfileAndRuntimeUntouched=$true;evidencePreserved=$true;currentQualifiedProgramPreserved=$true} | ConvertTo-Json -Depth 4
[IO.File]::WriteAllText((Join-Path $current 'finished-report-program-cleanup.json'),$json,[Text.UTF8Encoding]::new($false))
$json
