$ErrorActionPreference='Stop'
$taskSource=[IO.Path]::GetFullPath('F:/Agentopia-Acceptance/live-artifacts61-1792627868210/workspace/artifact-workbook.xlsx')
$taskRoot=[IO.Path]::GetFullPath('F:/Agentopia/.supabase/desktop-live-artifacts61/1792627868210')
if (Get-Process EXCEL -ErrorAction SilentlyContinue) {throw 'Excel has an existing session; preserve it'}
$taskOut=Join-Path $taskRoot ('excel-oracle-'+[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
New-Item -ItemType Directory -Path $taskOut -ErrorAction Stop | Out-Null
$taskBefore=(Get-FileHash -LiteralPath $taskSource -Algorithm SHA256).Hash
if ($taskBefore -cne '5BBE971E9DB5C41EFF9C7C53859878D92E81F71AA2177A345F11D259EA05D885') {throw 'The generated workbook changed'}
$taskApp=New-Object -ComObject Excel.Application
$taskBook=$null
try {
 $taskApp.AutomationSecurity=3
 $taskApp.EnableEvents=$false
 $taskApp.DisplayAlerts=$false
 $taskApp.AskToUpdateLinks=$false
 $taskBook=$taskApp.Workbooks.Open($taskSource,0,$true)
 if (-not $taskBook.ReadOnly) {throw 'Excel did not open the generated workbook read-only'}
 $taskApp.CalculateFullRebuild()
 $taskItems=$taskBook.Worksheets.Item('Items')
 $taskSummary=$taskBook.Worksheets.Item('Summary')
 if ($taskItems.Range('D6').Formula -cne '=SUM(D2:D4)' -or $taskSummary.Range('B2').Formula -cne '=Items!D6') {throw 'The original formulas are missing'}
 if ([decimal]$taskItems.Range('D6').Value2 -ne 675.25 -or [decimal]$taskSummary.Range('B2').Value2 -ne 675.25) {throw 'Native Excel recalculation returned an incorrect total'}
 $taskAmounts=@($taskItems.Range('D2').Value2,$taskItems.Range('D3').Value2,$taskItems.Range('D4').Value2)
 if (($taskAmounts -join ',') -cne '376.5,127.75,171') {throw 'Native Excel recalculation returned incorrect amounts'}
 if ((Get-FileHash -LiteralPath $taskSource -Algorithm SHA256).Hash -cne $taskBefore) {throw 'Read-only workbook changed'}
 $taskEvidence=@{success=$true;at=[DateTime]::UtcNow.ToString('o');source=$taskSource;sourceSha256=$taskBefore;excelVersion=$taskApp.Version;readOnly=$true;fullRebuild=$true;amounts=$taskAmounts;total=$taskItems.Range('D6').Value2;linkedSummary=$taskSummary.Range('B2').Value2;providerRequests=0;out=$taskOut}
 $taskEvidence | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskOut 'evidence.json') -Encoding utf8
 $taskEvidence | ConvertTo-Json -Compress
} finally {
 if ($taskBook) {$taskBook.Close($false)}
 if ($taskApp.Workbooks.Count -eq 0) {$taskApp.Quit()}
}
