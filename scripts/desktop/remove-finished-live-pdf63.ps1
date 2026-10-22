$ErrorActionPreference='Stop'
$caseRoot='F:\Agentopia\.supabase\desktop-live-pdf63\1792635481160'
$accepted=Get-Content -LiteralPath (Join-Path $caseRoot 'live-pdf-accepted.json') -Raw | ConvertFrom-Json
$final=Get-Content -LiteralPath (Join-Path $caseRoot 'final-acceptance.json') -Raw | ConvertFrom-Json
$intent=Get-Content -LiteralPath (Join-Path $caseRoot 'intent.json') -Raw | ConvertFrom-Json
$program='F:\Agentopia\.supabase\desktop-pdf-pages-release63\1792633720415\packaged-1792633872390\private-program'
if(-not $accepted.success -or -not $final.success -or -not $final.coldNoReplay -or -not $accepted.qaRuntimeStopped -or $accepted.modelRequests -ne 3 -or $accepted.requestId -ne 'eaaf62ad-399a-41ae-88ea-5244f07095bc' -or $intent.cfg.program -cne $program){throw 'Accepted exact PDF case required'}
$qualified='F:\Agentopia\.supabase\desktop-pdf-pages-release63\1792633720415\program\resources\app.asar'
$installed='C:\Users\charl\AppData\Local\AgentopiaDesktop\app-0.44.63\resources\app.asar'
foreach($file in @($qualified,$installed,(Join-Path $program 'resources\app.asar'))){if((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLower() -cne $accepted.imageSha256){throw 'The accepted image changed'}}
if([IO.Path]::GetFullPath($program) -cne $program -or (Resolve-Path -LiteralPath $program).ProviderPath -cne $program){throw 'Unexpected resolved cleanup target'}
for($ancestor=Get-Item -LiteralPath $program;$null -ne $ancestor;$ancestor=$ancestor.Parent){if($ancestor.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Linked cleanup ancestor'}}
if(@(Get-CimInstance Win32_Process | Where-Object {$_.ExecutablePath -and $_.ExecutablePath.StartsWith($program+'\',[StringComparison]::OrdinalIgnoreCase)}).Count){throw 'An owned program process remains active'}
$rows=@(Get-ChildItem -LiteralPath $program -Force -Recurse)
if(@($rows | Where-Object {$_.Attributes -band [IO.FileAttributes]::ReparsePoint}).Count){throw 'Linked cleanup child'}
$files=@($rows | Where-Object {-not $_.PSIsContainer})
$count=$files.Count;$bytes=($files | Measure-Object Length -Sum).Sum
Remove-Item -LiteralPath $program -Recurse -Force
if(Test-Path -LiteralPath $program){throw 'The finished QA program remains'}
foreach($file in @($qualified,$installed)){if((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLower() -cne $accepted.imageSha256){throw 'Current image changed during cleanup'}}
$receipt=@{success=$true;at=[DateTime]::UtcNow.ToString('o');target=$program;files=$count;logicalFileBytes=$bytes;logicalBytesMayShareHardlinks=$true;currentInstalledAndQualifiedProgramsPreserved=$true;profileRuntimeSourcePdfResultsAndEvidenceRetained=$true}
$receipt | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $caseRoot 'finished-program-cleanup.json') -Encoding utf8
$receipt | ConvertTo-Json -Depth 4 -Compress
