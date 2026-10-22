$ErrorActionPreference = 'Stop'

param(
  [Parameter(Mandatory=$true)][string]$ProjectRef,
  [Parameter(Mandatory=$true)][string]$AnonKey
)

$functionsUrl = "https://$ProjectRef.functions.supabase.co/graph-ingestion"
$headers = @{ "Authorization" = "Bearer $AnonKey"; "Content-Type" = "application/json"; "X-Agentopia-Service" = "task-executor" }

Write-Host "Triggering graph-ingestion..."
Invoke-RestMethod -Method Post -Uri $functionsUrl -Headers $headers -Body '{}' | ConvertTo-Json -Depth 5
Write-Host "Done."


