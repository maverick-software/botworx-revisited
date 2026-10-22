$ErrorActionPreference='Stop'
$taskSource=[IO.Path]::GetFullPath('F:/Agentopia-Acceptance/live-artifacts61-1792627868210/workspace/artifact-deck.pptx')
$taskRoot=[IO.Path]::GetFullPath('F:/Agentopia/.supabase/desktop-live-artifacts61/1792627868210')
if ((Get-Process POWERPNT -ErrorAction SilentlyContinue)) {throw 'PowerPoint has an existing session; preserve it'}
$taskOut=Join-Path $taskRoot ('native-oracle-'+[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
New-Item -ItemType Directory -Path $taskOut -ErrorAction Stop | Out-Null
$taskBefore=(Get-FileHash -LiteralPath $taskSource -Algorithm SHA256).Hash
$taskApp=New-Object -ComObject PowerPoint.Application
$taskDeck=$null
try {
 $taskDeck=$taskApp.Presentations.Open($taskSource,-1,0,0)
 for ($taskIndex=1;$taskIndex -le $taskDeck.Slides.Count;$taskIndex++) {
  $taskDeck.Slides.Item($taskIndex).Export((Join-Path $taskOut ('slide-'+$taskIndex+'.png')),'PNG',1280,720)
 }
 if ((Get-FileHash -LiteralPath $taskSource -Algorithm SHA256).Hash -cne $taskBefore) {throw 'Read-only presentation changed'}
 $taskEvidence=@{success=$true;at=[DateTime]::UtcNow.ToString('o');source=$taskSource;sourceSha256=$taskBefore;slides=$taskDeck.Slides.Count;powerPointVersion=$taskApp.Version;readOnly=$true;providerRequests=0;out=$taskOut}
 $taskEvidence | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskOut 'evidence.json') -Encoding utf8
 $taskEvidence | ConvertTo-Json -Compress
} finally {
 if ($taskDeck) {$taskDeck.Close()}
 if ($taskApp.Presentations.Count -eq 0) {$taskApp.Quit()}
}
