$ErrorActionPreference='Stop'
$current='F:\Agentopia\.supabase\desktop-agent-report-release57\1792613505169'
$accepted=Get-Content -LiteralPath (Join-Path $current 'agent-report-status-accepted.json') -Raw | ConvertFrom-Json
if(-not $accepted.success -or -not $accepted.normalExit -or -not $accepted.qaRuntimeStopped){throw 'Completed QA acceptance required'}
$image='C:\Users\charl\AppData\Local\AgentopiaDesktop\app-0.44.57\resources\app.asar'
if((Get-FileHash -LiteralPath $image -Algorithm SHA256).Hash.ToLowerInvariant() -ne $accepted.imageSha256){throw 'Installed image changed'}
$targets=@((Join-Path $current 'status-audit-1792615214590\private-program'),(Join-Path $current 'status-audit-1792615309790\private-program'))
$processes=@(Get-CimInstance Win32_Process);$files=0L;$bytes=0L
foreach($target in $targets){
 if([IO.Path]::GetFullPath($target) -ne $target -or -not $target.StartsWith($current+'\status-audit-',[StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($target) -ne 'private-program'){throw 'Unexpected program-copy target'}
 if(-not (Test-Path -LiteralPath $target)){continue}
 if((Resolve-Path -LiteralPath $target).ProviderPath -ne $target){throw 'Program-copy target resolves elsewhere'}
 $ancestor=[IO.DirectoryInfo]::new($target)
 while($null -ne $ancestor){if((Get-Item -LiteralPath $ancestor.FullName -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Program-copy ancestor is a redirect'};$ancestor=$ancestor.Parent}
 if(@($processes | Where-Object {($_.ExecutablePath -and $_.ExecutablePath.StartsWith($target+'\',[StringComparison]::OrdinalIgnoreCase)) -or ($_.CommandLine -and $_.CommandLine.IndexOf($target,[StringComparison]::OrdinalIgnoreCase) -ge 0)}).Count){throw 'QA program copy is still in use'}
 if((Get-FileHash -LiteralPath (Join-Path $target 'resources\app.asar') -Algorithm SHA256).Hash.ToLowerInvariant() -ne $accepted.imageSha256){throw 'QA program copy differs from the accepted image'}
 Get-ChildItem -LiteralPath $target -Force -Recurse | ForEach-Object {if($_.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Program-copy child is a redirect'};if(-not $_.PSIsContainer){$script:files++;$script:bytes+=$_.Length}}
}
# All final absolute targets and descendants are checked before recursive removal.
foreach($target in $targets){if(Test-Path -LiteralPath $target){Remove-Item -LiteralPath $target -Recurse -Force};if(Test-Path -LiteralPath $target){throw 'QA program copy remains'}}
if((Get-FileHash -LiteralPath $image -Algorithm SHA256).Hash.ToLowerInvariant() -ne $accepted.imageSha256){throw 'Installed image changed during cleanup'}
$json=@{success=$true;at=[DateTime]::UtcNow.ToString('o');targets=$targets;files=$files;fileBytes=$bytes;installedImagePreserved=$true;privateProfileAndRuntimeUntouched=$true;evidencePreserved=$true;currentQualifiedProgramPreserved=$true} | ConvertTo-Json -Depth 4
[IO.File]::WriteAllText((Join-Path $current 'report-status-qa-cleanup.json'),$json,[Text.UTF8Encoding]::new($false))
$json
