param([Parameter(Mandatory=$true)][string]$Work)
$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\.supabase\desktop-presentation-ui'))
$taskWork=[IO.Path]::GetFullPath($Work)
if ((Split-Path $taskWork -Parent) -cne $taskRoot -or (Split-Path $taskWork -Leaf) -notmatch '^\d{13}$') {throw 'Only a generated presentation fixture is accepted'}
if (Get-Process POWERPNT -ErrorAction SilentlyContinue) {throw 'PowerPoint is in use; preserve that session'}
$taskSource=Join-Path $taskWork 'documents\rich.pptx'
$taskOut=Join-Path $taskWork 'native-oracle'
New-Item -ItemType Directory -Path $taskOut -ErrorAction Stop | Out-Null
function FixtureHash([string]$File){$taskStream=[IO.File]::OpenRead($File);$taskHasher=[Security.Cryptography.SHA256]::Create();try{return ([BitConverter]::ToString($taskHasher.ComputeHash($taskStream))).Replace('-','').ToLowerInvariant()}finally{$taskStream.Dispose();$taskHasher.Dispose()}}
$taskBefore=FixtureHash $taskSource
$taskPowerPoint=New-Object -ComObject PowerPoint.Application
$taskDeck=$null
try {
 $taskDeck=$taskPowerPoint.Presentations.Open($taskSource,-1,0,0)
 $taskDeck.Slides.Item(1).Export((Join-Path $taskOut 'slide-1.png'),'PNG',1280,720)
 $taskDeck.Slides.Item(2).Export((Join-Path $taskOut 'slide-2.png'),'PNG',1280,720)
 if ((FixtureHash $taskSource) -cne $taskBefore) {throw 'The read-only fixture changed'}
 @{success=$true;at=[DateTime]::UtcNow.ToString('o');source=$taskSource;sourceSha256=$taskBefore;slides=$taskDeck.Slides.Count;powerPointVersion=$taskPowerPoint.Version;readOnly=$true;generatedFixtureOnly=$true;providerRequests=0} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskOut 'evidence.json') -Encoding utf8
} finally {if ($taskDeck) {$taskDeck.Close()};if ($taskPowerPoint.Presentations.Count -eq 0) {$taskPowerPoint.Quit()}}
