$ErrorActionPreference = 'Stop'

param(
  [Parameter(Mandatory=$true)][string]$ProjectRef,
  [Parameter(Mandatory=$true)][string]$ServiceRoleKey,
  [Parameter(Mandatory=$true)][string]$AccountGraphId,
  [Parameter(Mandatory=$true)][string]$AgentId,
  [Parameter(Mandatory=$true)][string]$UserId
)

$restBase = "https://$ProjectRef.supabase.co/rest/v1"
$headers = @{ "apikey" = $ServiceRoleKey; "Authorization" = "Bearer $ServiceRoleKey"; "Content-Type" = "application/json" }

$payload = @{ 
  account_graph_id = $AccountGraphId
  payload = @{ source_kind = 'message'; source_id = [guid]::NewGuid().ToString(); agent_id = $AgentId; user_id = $UserId; messages = @(@{ role='user'; content = @{ type='text'; text='Hello from test' } }) }
  status = 'queued'
} | ConvertTo-Json -Depth 6

Write-Host "Inserting test queue row into graph_ingestion_queue..."
Invoke-RestMethod -Method Post -Uri "$restBase/graph_ingestion_queue" -Headers $headers -Body $payload | Out-Null
Write-Host "Done."


