$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$localRoot = Join-Path $projectRoot '.supabase/local'
if (-not (Test-Path (Join-Path $localRoot 'supabase/config.toml'))) {
    throw 'Local Supabase setup is missing. See README/local-development.md.'
}
Push-Location $localRoot
try {
    # Run inside the local project: the installed CLI resolves linked project IDs
    # incorrectly when --workdir is used from the hosted project's root.
    & supabase start --exclude logflare,vector > startup.stdout.log 2> startup.stderr.log
    if ($LASTEXITCODE) { throw "Supabase startup failed. See $localRoot/startup.stderr.log and startup.stdout.log." }
    & supabase status --output json > status.json 2> status.stderr.log
    if ($LASTEXITCODE) { throw 'Could not read local Supabase status.' }
    $status = Get-Content status.json -Raw | ConvertFrom-Json
    $settings = Invoke-RestMethod -Uri ($status.API_URL + '/auth/v1/settings') -Headers @{apikey=$status.ANON_KEY} -TimeoutSec 15
    if (-not $settings.external.email) { throw 'Local email authentication is unavailable.' }
    Write-Output ('Local Supabase API: ' + $status.API_URL)
    Write-Output ('Database dashboard: ' + $status.STUDIO_URL)
    Write-Output 'Start the app with: npm run dev -- --host 127.0.0.1'
} finally {
    Pop-Location
}
