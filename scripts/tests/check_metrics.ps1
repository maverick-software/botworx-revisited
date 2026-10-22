$ErrorActionPreference = 'Stop'

param(
  [Parameter(Mandatory=$true)][string]$ProjectRef,
  [Parameter(Mandatory=$true)][string]$ServiceRoleKey,
  [Parameter(Mandatory=$true)][string]$AccountGraphId
)

$restBase = "https://$ProjectRef.supabase.co/rest/v1"
$headers = @{ "apikey" = $ServiceRoleKey; "Authorization" = "Bearer $ServiceRoleKey" }

Write-Host "Nodes:" (Invoke-RestMethod -Method Get -Uri "$restBase/graph_nodes?account_graph_id=eq.$AccountGraphId&select=id&count=exact" -Headers $headers).Count
Write-Host "Edges:" (Invoke-RestMethod -Method Get -Uri "$restBase/graph_edges?account_graph_id=eq.$AccountGraphId&select=id&count=exact" -Headers $headers).Count
Write-Host "Queue (queued):" (Invoke-RestMethod -Method Get -Uri "$restBase/graph_ingestion_queue?account_graph_id=eq.$AccountGraphId&status=eq.queued&select=id&count=exact" -Headers $headers).Count
Write-Host "Queue (errors):" (Invoke-RestMethod -Method Get -Uri "$restBase/graph_ingestion_queue?account_graph_id=eq.$AccountGraphId&status=eq.error&select=id&count=exact" -Headers $headers).Count


