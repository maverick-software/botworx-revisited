param([string]$LegacyHelper)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'import-backup.ps1')
$taskRoot=Join-Path (Split-Path (Split-Path $PSScriptRoot)) '.supabase\layout-launcher-tests'
$taskOut=Join-Path $taskRoot ([guid]::NewGuid().ToString());$source=Join-Path $taskOut 'bundle';$null=New-Item -ItemType Directory -Path $source
$descriptor=[ordered]@{format=2;kind='agentopia-desktop-recovery';requiresDesktopRecoveryFormat=6;codex='0.163.0'}
$fields=@('databaseManifest','profileArchive','profileManifest','publicArchive','publicManifest','references','clipboardArchive','clipboardManifest','settingsManifest','externalArchive','externalManifest','layoutsManifest')
foreach($field in $fields){$name=$field+'.bin';$file=Join-Path $source $name;[IO.File]::WriteAllText($file,'GENERATED '+$field);$descriptor[$field]=@{file=$name;sha256=Get-AgentopiaRecoveryHash $file}}
function Save-Descriptor {$descriptor|ConvertTo-Json -Depth 5|Set-Content -LiteralPath (Join-Path $source 'desktop-recovery.json') -Encoding utf8}
function Assert-Refused([scriptblock]$Action){$refused=$false;try{& $Action|Out-Null}catch{$refused=$true};if(-not $refused){throw 'Expected invalid layout recovery refusal.'}}
Save-Descriptor;$result=Read-AgentopiaDesktopRecoveryDescriptor $source;if($result.descriptor.requiresDesktopRecoveryFormat -ne 6){throw 'Layout recovery capability lost.'}
$checks=[Collections.Generic.List[string]]::new();$checks.Add('All twelve capability-6 resources are checked.')
$file=Join-Path $source 'layoutsManifest.bin';[IO.File]::AppendAllText($file,'CHANGED');Assert-Refused {Read-AgentopiaDesktopRecoveryDescriptor $source};[IO.File]::WriteAllText($file,'GENERATED layoutsManifest');$checks.Add('Changed layout metadata is refused.')
$entry=$descriptor.layoutsManifest;$descriptor.Remove('layoutsManifest');Save-Descriptor;Assert-Refused {Read-AgentopiaDesktopRecoveryDescriptor $source};$descriptor.layoutsManifest=$entry;Save-Descriptor;$checks.Add('Missing layout metadata is refused.')
$descriptor.requiresDesktopRecoveryFormat=5;Save-Descriptor;Assert-Refused {Read-AgentopiaDesktopRecoveryDescriptor $source};$descriptor.requiresDesktopRecoveryFormat=6;Save-Descriptor;$checks.Add('Downgraded capability cannot silently omit saved layouts.')
$homePath=Join-Path $taskOut 'fresh-home';$data=Join-Path $homePath 'AppData\Roaming';$null=New-Item -ItemType Directory -Path $data;$queued=New-AgentopiaDesktopRecoveryRequest $source $homePath $data @();if(-not $queued.queued){throw 'Layout recovery was not queued.'};$checks.Add('Verified resources queue only an isolated fresh-home request.')
if($LegacyHelper){$child=Join-Path $taskOut 'legacy-check.ps1';[IO.File]::WriteAllText($child,@'
param($Helper,$Source)
$ErrorActionPreference='Stop'
. $Helper
try {$null=Read-AgentopiaDesktopRecoveryDescriptor $Source} catch {if($_.Exception.Message -match 'compatible Agentopia'){exit 0};throw}
throw 'The older helper silently accepted portable layouts.'
'@);& pwsh -NoProfile -File $child $LegacyHelper $source;if($LASTEXITCODE -ne 0){throw 'Legacy helper refusal failed.'};$checks.Add('The actual installed revision-15 helper refuses capability 6.')}
$receipt=@{success=$true;out=$taskOut;groups=$checks.Count;checks=@($checks);providerRequests=0;productionChanged=$false};$receipt|ConvertTo-Json -Depth 5|Set-Content -LiteralPath (Join-Path $taskOut 'evidence.json') -Encoding utf8;$receipt|ConvertTo-Json -Depth 5 -Compress
