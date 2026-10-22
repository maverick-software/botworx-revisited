param([string]$LegacyHelper)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'import-backup.ps1')
$taskRoot=Join-Path (Split-Path (Split-Path $PSScriptRoot)) '.supabase\clipboard-launcher-tests';$taskOut=Join-Path $taskRoot ([guid]::NewGuid().ToString());$source=Join-Path $taskOut 'bundle';$null=New-Item -ItemType Directory -Path $source
$descriptor=[ordered]@{format=2;kind='agentopia-desktop-recovery';requiresDesktopRecoveryFormat=3;codex='0.163.0'}
$fields=@('databaseManifest','profileArchive','profileManifest','publicArchive','publicManifest','references','clipboardArchive','clipboardManifest')
foreach($field in $fields){$name=$field+'.bin';$file=Join-Path $source $name;[IO.File]::WriteAllText($file,'GENERATED '+$field);$descriptor[$field]=@{file=$name;sha256=Get-AgentopiaRecoveryHash $file}}
function Save-Descriptor { $descriptor|ConvertTo-Json -Depth 5|Set-Content -LiteralPath (Join-Path $source 'desktop-recovery.json') -Encoding utf8 }
function Assert-Refused([scriptblock]$Action){$refused=$false;try{& $Action|Out-Null}catch{$refused=$true};if(-not $refused){throw 'Expected damaged clipboard recovery refusal.'}}
Save-Descriptor;$result=Read-AgentopiaDesktopRecoveryDescriptor $source;if($result.descriptor.requiresDesktopRecoveryFormat -ne 3){throw 'Clipboard capability lost.'};$checks=[Collections.Generic.List[string]]::new();$checks.Add('All eight capability-3 resources are checked.')
$file=Join-Path $source 'clipboardArchive.bin';[IO.File]::AppendAllText($file,'CHANGED');Assert-Refused {Read-AgentopiaDesktopRecoveryDescriptor $source};[IO.File]::WriteAllText($file,'GENERATED clipboardArchive');$checks.Add('Changed clipboard archive bytes are refused.')
$entry=$descriptor.clipboardManifest;$descriptor.Remove('clipboardManifest');Save-Descriptor;Assert-Refused {Read-AgentopiaDesktopRecoveryDescriptor $source};$descriptor.clipboardManifest=$entry;Save-Descriptor;$checks.Add('An omitted clipboard manifest is refused.')
$homePath=Join-Path $taskOut 'fresh-home';$data=Join-Path $homePath 'AppData\Roaming';$null=New-Item -ItemType Directory -Path $data;$queued=New-AgentopiaDesktopRecoveryRequest $source $homePath $data @();if(-not $queued.queued){throw 'Clipboard recovery was not queued.'};$checks.Add('The complete image bundle queues only an isolated fresh-home request.')
if($LegacyHelper){$child=Join-Path $taskOut 'legacy-check.ps1';[IO.File]::WriteAllText($child,@'
param($Helper,$Source)
$ErrorActionPreference='Stop'
. $Helper
try { $null=Read-AgentopiaDesktopRecoveryDescriptor $Source } catch { if($_.Exception.Message -match 'compatible Agentopia'){exit 0};throw }
throw 'The older recovery helper silently accepted the newer image bundle.'
'@);& pwsh -NoProfile -File $child $LegacyHelper $source;if($LASTEXITCODE -ne 0){throw 'Legacy helper refusal check failed.'};$checks.Add('The actual installed revision-15 helper refuses the new image capability.')}
$receipt=@{success=$true;out=$taskOut;groups=$checks.Count;checks=@($checks);providerRequests=0;productionChanged=$false};$receipt|ConvertTo-Json -Depth 5|Set-Content -LiteralPath (Join-Path $taskOut 'evidence.json') -Encoding utf8;$receipt|ConvertTo-Json -Depth 5 -Compress
