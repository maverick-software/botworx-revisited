param([Parameter(Mandatory=$true)][string]$Release)
$ErrorActionPreference='Stop'
$workspaceRoot=[IO.Path]::GetFullPath('F:\Agentopia')
$releaseRoot=[IO.Path]::GetFullPath($Release)
if($releaseRoot -ne 'F:\Agentopia\.supabase\desktop-image-attachment-release61\1792625224507'){throw 'Unexpected release'}
$accepted=Get-Content -LiteralPath (Join-Path $releaseRoot 'delivery-accepted.json') -Raw | ConvertFrom-Json
if(-not $accepted.success -or -not $accepted.installed -or $accepted.version -ne '0.44.61'){throw 'Installed acceptance is required'}
$current=Join-Path $releaseRoot 'program\resources\app.asar'
$installed='C:\Users\charl\AppData\Local\AgentopiaDesktop\app-0.44.61\resources\app.asar'
function Assert-Current {
 foreach($file in @($current,$installed)){if((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLower() -ne $accepted.imageSha256){throw 'Current program changed'}}
}
Assert-Current
$targets=@(
 @{path='F:\Agentopia\.supabase\desktop-image-attachment-release61\1792624844512\program';hash='8b10d651de472e9a1e0818983f373a8298f1333a0694374d4577b97467ee4e03'},
 @{path=Join-Path $releaseRoot 'packaged-1792625297065\private-program';hash=$accepted.imageSha256},
 @{path=Join-Path $releaseRoot 'installer-build-short\input';hash=$accepted.imageSha256}
)
$processRows=@(Get-CimInstance Win32_Process)
$results=@()
foreach($target in $targets){
 $absolute=[IO.Path]::GetFullPath($target.path)
 if(-not $absolute.StartsWith($workspaceRoot+'\',[StringComparison]::OrdinalIgnoreCase) -or $absolute -eq (Join-Path $releaseRoot 'program')){throw 'Cleanup target escapes its exact workspace scope'}
 if(-not (Test-Path -LiteralPath $absolute)){throw 'Expected finished build is absent; inspect before rerunning'}
 for($ancestor=Get-Item -LiteralPath $absolute;$null -ne $ancestor;$ancestor=$ancestor.Parent){if($ancestor.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Linked cleanup ancestor'}}
 if(@($processRows | Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($absolute+'\',[StringComparison]::OrdinalIgnoreCase) }).Count){throw 'Finished build still has a running process'}
 if((Get-FileHash -LiteralPath (Join-Path $absolute 'resources\app.asar') -Algorithm SHA256).Hash.ToLower() -ne $target.hash){throw 'Finished build hash differs'}
 $entries=@(Get-ChildItem -LiteralPath $absolute -Force -Recurse)
 if(@($entries | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }).Count){throw 'Linked child in finished build'}
 $files=@($entries | Where-Object { -not $_.PSIsContainer });$bytes=($files | Measure-Object Length -Sum).Sum
 Remove-Item -LiteralPath $absolute -Recurse -Force
 if(Test-Path -LiteralPath $absolute){throw 'Finished build remains'}
 Assert-Current
 $results+=@{path=$absolute;files=$files.Count;logicalFileBytes=$bytes;removed=$true}
}
$result=@{success=$true;at=[DateTime]::UtcNow.ToString('o');targets=$results;currentInstalledAndQualifiedProgramsPreserved=$true;privateProfilesAndRuntimesUntouched=$true;logicalBytesMayShareHardlinks=$true}
$result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $releaseRoot 'finished-build-cleanup.json') -Encoding utf8
$result | ConvertTo-Json -Depth 8 -Compress
