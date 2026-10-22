param([Parameter(Mandatory=$true)][string]$LegacyHelper)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'import-backup.ps1')
$taskRoot=Join-Path (Split-Path (Split-Path $PSScriptRoot)) '.supabase\notification-launcher-tests'
$taskOut=Join-Path $taskRoot ([guid]::NewGuid().ToString());$source=Join-Path $taskOut 'bundle';$null=New-Item -ItemType Directory -Path $source
$descriptor=[ordered]@{format=2;kind='agentopia-desktop-recovery';requiresDesktopRecoveryFormat=8;codex='0.163.0'}
$fields=@('databaseManifest','profileArchive','profileManifest','publicArchive','publicManifest','references','clipboardArchive','clipboardManifest','settingsManifest','externalArchive','externalManifest','layoutsManifest')
foreach($field in $fields){$name=$field+'.bin';$file=Join-Path $source $name;[IO.File]::WriteAllText($file,'GENERATED '+$field);$descriptor[$field]=@{file=$name;sha256=Get-AgentopiaRecoveryHash $file}}
function Save-Descriptor {$descriptor|ConvertTo-Json -Depth 5|Set-Content -LiteralPath (Join-Path $source 'desktop-recovery.json') -Encoding utf8}
function Assert-Refused([scriptblock]$Action){$refused=$false;try{& $Action|Out-Null}catch{$refused=$true};if(-not $refused){throw 'Expected invalid notification recovery refusal.'}}
Save-Descriptor;$result=Read-AgentopiaDesktopRecoveryDescriptor $source;if($result.descriptor.requiresDesktopRecoveryFormat -ne 8){throw 'Notification recovery capability lost.'}
$checks=[Collections.Generic.List[string]]::new();$checks.Add('Capability 8 checks all twelve required resources.')
$file=Join-Path $source 'settingsManifest.bin';[IO.File]::AppendAllText($file,'CHANGED');Assert-Refused {Read-AgentopiaDesktopRecoveryDescriptor $source};[IO.File]::WriteAllText($file,'GENERATED settingsManifest');$checks.Add('Changed preference metadata is refused.')
$descriptor.requiresDesktopRecoveryFormat=10;Save-Descriptor;Assert-Refused {Read-AgentopiaDesktopRecoveryDescriptor $source};$descriptor.requiresDesktopRecoveryFormat=8;Save-Descriptor;$checks.Add('An unsupported future capability is refused.')
$child=Join-Path $taskOut 'legacy-check.ps1';[IO.File]::WriteAllText($child,@'
param($Helper,$Source)
$ErrorActionPreference='Stop'
. $Helper
try {$null=Read-AgentopiaDesktopRecoveryDescriptor $Source} catch {if($_.Exception.Message -match 'compatible Agentopia'){exit 0};throw}
throw 'The capability-7 helper silently accepted notification preferences.'
'@)
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $child $LegacyHelper $source;if($LASTEXITCODE -ne 0){throw 'Legacy helper refusal failed.'};$checks.Add('The qualified 0.44.49 helper refuses a capability-8 bundle.')
$receipt=@{success=$true;out=$taskOut;groups=$checks.Count;checks=@($checks);providerRequests=0;productionChanged=$false};$receipt|ConvertTo-Json -Depth 5|Set-Content -LiteralPath (Join-Path $taskOut 'evidence.json') -Encoding utf8;$receipt|ConvertTo-Json -Depth 5 -Compress
