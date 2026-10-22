param([Parameter(Mandatory=$true)][string]$OutputDirectory)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$taskTarget='C:\Users\charl\AppData\Local\Packages\OpenAI.Codex_2p2nqsd0c76g0\LocalCache\Local\AgentopiaDesktop'
$taskCurrent='C:\Users\charl\AppData\Local\AgentopiaDesktop'
$taskOutput=[IO.Path]::GetFullPath($OutputDirectory)
if([IO.Path]::GetDirectoryName($taskOutput) -cne 'F:\Agentopia\.supabase\desktop-obsolete-package43' -or [IO.Path]::GetFileName($taskOutput) -notmatch '^\d{13}$'){throw 'Unexpected F-drive cleanup record.'}
if(-not (Test-Path -LiteralPath $taskOutput -PathType Container)){throw 'Prepare the output directory first.'}
foreach($taskDirectory in @($taskTarget,(Join-Path $taskTarget 'packages'),$taskOutput)){
 $taskInfo=Get-Item -LiteralPath $taskDirectory -Force
 if(-not $taskInfo.PSIsContainer -or ($taskInfo.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or [IO.Path]::GetFullPath($taskInfo.FullName) -cne $taskDirectory){throw 'A cleanup directory is linked or unexpected.'}
}
$taskAllowed=@('Agentopia.exe','app.ico','Squirrel-Shortcut.log','Update.exe','packages\AgentopiaDesktop-0.44.43-full.nupkg','packages\RELEASES')
$taskItems=@(Get-ChildItem -LiteralPath $taskTarget -Recurse -Force)
if(@($taskItems|Where-Object{($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0}).Count){throw 'A linked cache entry needs inspection.'}
$taskFiles=@($taskItems|Where-Object{-not $_.PSIsContainer})
if($taskFiles.Count -ne $taskAllowed.Count){throw 'The cache contains additional files.'}
foreach($taskFile in $taskFiles){if($taskFile.FullName.Substring($taskTarget.Length+1) -cnotin $taskAllowed){throw 'The cache contains an unexpected file.'}}
if(@(Get-CimInstance Win32_Process|Where-Object{$_.ExecutablePath -and ($_.ExecutablePath.StartsWith($taskTarget+'\',[StringComparison]::OrdinalIgnoreCase) -or $_.ExecutablePath.StartsWith($taskCurrent+'\app-0.44.43\',[StringComparison]::OrdinalIgnoreCase) -or $_.ExecutablePath.Equals($taskCurrent+'\Update.exe',[StringComparison]::OrdinalIgnoreCase))}).Count){throw 'An old cached program or the updater is running.'}
$taskImage=Join-Path $taskCurrent 'app-0.44.52\resources\app.asar'
if((Get-FileHash -LiteralPath $taskImage -Algorithm SHA256).Hash.ToLowerInvariant() -cne '44e2b1f486068f71e37aac98e07eae5ccc295755a548615dbf9c3158dc321191'){throw 'The current app changed.'}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$taskArchive=[IO.Compression.ZipFile]::OpenRead((Join-Path $taskTarget 'packages\AgentopiaDesktop-0.44.43-full.nupkg'))
try{
 $taskEntry=$taskArchive.GetEntry('AgentopiaDesktop.nuspec')
 if($null -eq $taskEntry -or $taskEntry.Length -gt 65536){throw 'The expected old-package metadata is missing.'}
 $taskReader=[IO.StreamReader]::new($taskEntry.Open())
 try{$taskMetadata=$taskReader.ReadToEnd()}finally{$taskReader.Dispose()}
 $taskSettings=[Xml.XmlReaderSettings]::new();$taskSettings.DtdProcessing=[Xml.DtdProcessing]::Prohibit;$taskSettings.XmlResolver=$null
 $taskXmlReader=[Xml.XmlReader]::Create([IO.StringReader]::new($taskMetadata),$taskSettings)
 try{$taskDocument=[Xml.XmlDocument]::new();$taskDocument.XmlResolver=$null;$taskDocument.Load($taskXmlReader)}finally{$taskXmlReader.Dispose()}
 $taskVersion=$taskDocument.SelectSingleNode("//*[local-name()='metadata']/*[local-name()='version']").InnerText
 if($taskVersion -cne '0.44.43'){throw 'This cached package is not the obsolete version.'}
}finally{$taskArchive.Dispose()}
if((Get-Content -LiteralPath (Join-Path $taskTarget 'packages\RELEASES') -Raw) -notmatch 'AgentopiaDesktop-0\.44\.43-full\.nupkg'){throw 'The cached release index differs.'}
$taskBytes=[long](($taskFiles|Measure-Object -Property Length -Sum).Sum)
$taskEvidence=[ordered]@{success=$false;at=[DateTime]::UtcNow.ToString('o');target=$taskTarget;files=$taskFiles.Count;bytes=$taskBytes;packageVersion=$taskVersion;sourceFiles=$taskAllowed;beforeFreeBytes=([IO.DriveInfo]::new('C:\')).AvailableFreeSpace;accountDataTouched=$false;cachedRuntimeTouched=$false;activePackageRetained=(Test-Path -LiteralPath (Join-Path $taskCurrent 'packages\AgentopiaDesktop-0.44.52-full.nupkg'));providerRequests=0}
if(-not $taskEvidence.activePackageRetained){throw 'The active updater package must be retained.'}
$taskRecord=Join-Path $taskOutput 'evidence.json';$taskEvidence|ConvertTo-Json -Depth 6|Set-Content -LiteralPath $taskRecord -Encoding UTF8
if([IO.Path]::GetFullPath((Get-Item -LiteralPath $taskTarget).FullName) -cne 'C:\Users\charl\AppData\Local\Packages\OpenAI.Codex_2p2nqsd0c76g0\LocalCache\Local\AgentopiaDesktop'){throw 'The final literal deletion target differs.'}
Remove-Item -LiteralPath $taskTarget -Recurse -Force
if(Test-Path -LiteralPath $taskTarget){throw 'The obsolete code cache remains.'}
if(-not (Test-Path -LiteralPath (Join-Path $taskCurrent 'packages\AgentopiaDesktop-0.44.52-full.nupkg')) -or (Get-FileHash -LiteralPath $taskImage -Algorithm SHA256).Hash.ToLowerInvariant() -cne '44e2b1f486068f71e37aac98e07eae5ccc295755a548615dbf9c3158dc321191'){throw 'The active installation changed.'}
$taskEvidence.afterFreeBytes=([IO.DriveInfo]::new('C:\')).AvailableFreeSpace;$taskEvidence.success=$true
$taskEvidence|ConvertTo-Json -Depth 6|Set-Content -LiteralPath $taskRecord -Encoding UTF8
$taskEvidence|ConvertTo-Json -Depth 6 -Compress
