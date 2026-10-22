$ErrorActionPreference='Stop'
$repo=(Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$destination=Join-Path $env:APPDATA 'Agentopia/migration-input'
if(Test-Path (Join-Path $env:APPDATA 'Agentopia/migration-complete.json')){throw 'An installation migration has already completed. Use the recovery process for an existing desktop database.'}
New-Item -ItemType Directory -Force $destination | Out-Null
$exports=@(
 @{Name='recovery.dump';Args=@()},
 @{Name='auth.dump';Args=@('--data-only','-n','auth','--exclude-table=auth.schema_migrations')},
 @{Name='application.dump';Args=@('-n','public','-n','agentopia_local_setup')},
 @{Name='vault.dump';Args=@('--data-only','-n','pgsodium','-n','vault')}
)
foreach($export in $exports){
 $file='/tmp/agentopia-desktop-'+$export.Name
 & docker exec supabase_db_agentopia-local pg_dump -U postgres -d postgres -Fc @($export.Args) -f $file
 if($LASTEXITCODE -ne 0){throw "Database export failed: $($export.Name)"}
 & docker cp "supabase_db_agentopia-local:$file" (Join-Path $destination $export.Name)
 if($LASTEXITCODE -ne 0){throw 'Database export copy failed'}
}
docker cp supabase_db_agentopia-local:/etc/postgresql-custom/pgsodium_root.key (Join-Path $destination 'pgsodium_root.key')
if($LASTEXITCODE -ne 0){throw 'Encryption root backup failed'}
$files=Get-ChildItem $destination -File | ForEach-Object {@{name=$_.Name;sha256=(Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower()}}
@{format=1;created=(Get-Date).ToUniversalTime().ToString('o');source='agentopia-local';files=$files} | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 (Join-Path $destination 'manifest.json')
Write-Output "Prepared private migration files in $destination. The source database remains available."
