$ErrorActionPreference = 'Stop'

# Read environment
# Map from VITE_* fallbacks if plain env not set
if (-not $env:SUPABASE_URL -and $env:VITE_SUPABASE_URL) { $env:SUPABASE_URL = $env:VITE_SUPABASE_URL }
if (-not $env:SUPABASE_ANON_KEY -and $env:VITE_SUPABASE_ANON_KEY) { $env:SUPABASE_ANON_KEY = $env:VITE_SUPABASE_ANON_KEY }
if (-not $env:SUPABASE_SERVICE_ROLE_KEY -and $env:VITE_SUPABASE_SERVICE_ROLE_KEY) { $env:SUPABASE_SERVICE_ROLE_KEY = $env:VITE_SUPABASE_SERVICE_ROLE_KEY }

if (-not $env:SUPABASE_URL -or -not $env:SUPABASE_ANON_KEY) {
  Write-Error "Missing SUPABASE_URL / SUPABASE_ANON_KEY (check VITE_* fallbacks)."
}

$supabaseUrl = $env:SUPABASE_URL
$anonKey = $env:SUPABASE_ANON_KEY
$serviceKey = $env:SUPABASE_SERVICE_ROLE_KEY

$uri = [Uri]$supabaseUrl
$projectRef = $uri.Host.Split('.')[0]
$restBase = "https://$projectRef.supabase.co/rest/v1"
$fnUrl = "https://$projectRef.functions.supabase.co/graph-ingestion"

$svcHeaders = if ($serviceKey) { @{ "apikey" = $serviceKey; "Authorization" = "Bearer $serviceKey"; "Content-Type" = "application/json" } } else { $null }
$fnHeaders = @{ "Authorization" = "Bearer $anonKey"; "Content-Type" = "application/json"; "X-Agentopia-Service" = "task-executor" }

Write-Host "ProjectRef: $projectRef"

# 1) Ensure an account graph exists
$graph = $null
try {
  if ($svcHeaders) { $graph = Invoke-RestMethod -Method Get -Uri "$restBase/account_graphs?select=id,user_id&limit=1" -Headers $svcHeaders }
} catch {}

if (-not $graph -or $graph.Count -eq 0) {
  Write-Host "No account_graphs found. Attempting to create from active GetZep connection..."
  if (-not $svcHeaders) { Write-Error "Service role key required to auto-create account_graphs. Set SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_SERVICE_ROLE_KEY." }
  $providers = Invoke-RestMethod -Method Get -Uri "$restBase/oauth_providers?select=id,name&name=eq.getzep" -Headers $svcHeaders
  if ($providers.Count -eq 0) { Write-Error "GetZep provider not found" }
  $provId = $providers[0].id
  $conns = Invoke-RestMethod -Method Get -Uri "$restBase/user_oauth_connections?select=id,user_id,connection_metadata,connection_status&oauth_provider_id=eq.$provId&connection_status=eq.active&limit=1" -Headers $svcHeaders
  if ($conns.Count -eq 0) { Write-Error "No active GetZep connections found" }
  $conn = $conns[0]
  $settings = @{ }
  if ($conn.connection_metadata -and $conn.connection_metadata.project_id) { $settings.project_id = $conn.connection_metadata.project_id }
  if ($conn.connection_metadata -and $conn.connection_metadata.account_id) { $settings.account_id = $conn.connection_metadata.account_id }
  $body = @{ user_id = $conn.user_id; provider = 'getzep'; connection_id = $conn.id; settings = $settings; status = 'active' } | ConvertTo-Json -Depth 6
  $created = Invoke-RestMethod -Method Post -Uri "$restBase/account_graphs?select=id,user_id" -Headers $svcHeaders -Body $body
  $graph = $created
}

$graphId = $graph[0].id
$graphUser = $graph[0].user_id
Write-Host "Using account_graph_id: $graphId (user: $graphUser)"

# 2) Find an agent for the user
$agents = Invoke-RestMethod -Method Get -Uri "$restBase/agents?select=id,user_id&user_id=eq.$graphUser&limit=1" -Headers $svcHeaders
if ($agents.Count -eq 0) {
  $agents = Invoke-RestMethod -Method Get -Uri "$restBase/agents?select=id,user_id&limit=1" -Headers $svcHeaders
}
if ($agents.Count -eq 0) { Write-Error "No agents found" }
$agentId = $agents[0].id
Write-Host "Using agent: $agentId"

# 3) Seed queue row
$payload = @{ 
  account_graph_id = $graphId
  payload = @{ source_kind = 'message'; source_id = [guid]::NewGuid().ToString(); agent_id = $agentId; user_id = $graphUser; messages = @(@{ role='user'; content = @{ type='text'; text='Hello from e2e test' } }) }
  status = 'queued'
} | ConvertTo-Json -Depth 6
Invoke-RestMethod -Method Post -Uri "$restBase/graph_ingestion_queue" -Headers $svcHeaders -Body $payload | Out-Null
Write-Host "Queued test message."

# 4) Trigger ingestion
Invoke-RestMethod -Method Post -Uri $fnUrl -Headers $fnHeaders -Body '{}' | Out-Null
Write-Host "Triggered graph-ingestion function."

# 5) Poll queue until processed (max 10 attempts)
for ($i=0; $i -lt 10; $i++) {
  Start-Sleep -Seconds 2
  $queued = Invoke-RestMethod -Method Get -Uri "$restBase/graph_ingestion_queue?account_graph_id=eq.$graphId&status=eq.queued&select=id&count=exact" -Headers $svcHeaders
  $processing = Invoke-RestMethod -Method Get -Uri "$restBase/graph_ingestion_queue?account_graph_id=eq.$graphId&status=eq.processing&select=id&count=exact" -Headers $svcHeaders
  $errors = Invoke-RestMethod -Method Get -Uri "$restBase/graph_ingestion_queue?account_graph_id=eq.$graphId&status=eq.error&select=id&count=exact" -Headers $svcHeaders
  if (($queued.Count -eq 0) -and ($processing.Count -eq 0)) { break }
}

# 6) Print metrics
$nodes = Invoke-RestMethod -Method Get -Uri "$restBase/graph_nodes?account_graph_id=eq.$graphId&select=id&count=exact" -Headers $svcHeaders
$edges = Invoke-RestMethod -Method Get -Uri "$restBase/graph_edges?account_graph_id=eq.$graphId&select=id&count=exact" -Headers $svcHeaders
Write-Host "Nodes:" $nodes.Count
Write-Host "Edges:" $edges.Count


