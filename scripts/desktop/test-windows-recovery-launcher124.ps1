$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'import-backup.ps1')
$fixtureOut124=Join-Path 'F:/Agentopia-Acceptance/credential-launcher124' ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds().ToString());$null=New-Item -ItemType Directory -Path $fixtureOut124
$receipt124=@{success=$false;out=$fixtureOut124;productionAccess=$false;providerRequests=0;checks=@();helperSha256=Get-AgentopiaRecoveryHash (Join-Path $PSScriptRoot 'import-backup.ps1')}
try{
 $descriptor124=[ordered]@{format=2;kind='agentopia-desktop-recovery';codex='0.163.0';requiresDesktopRecoveryFormat=18}
 foreach($field124 in @('databaseManifest','profileArchive','profileManifest','publicArchive','publicManifest','references','clipboardArchive','clipboardManifest','settingsManifest','externalArchive','externalManifest','layoutsManifest','windowsProfileManifest')){$file124=Join-Path $fixtureOut124 ($field124+'.bin');[IO.File]::WriteAllText($file124,'GENERATED LAUNCHER RESOURCE '+$field124);$descriptor124[$field124]=@{file=$field124+'.bin';sha256=Get-AgentopiaRecoveryHash $file124}}
 $descriptor124|ConvertTo-Json -Depth 5|Set-Content -LiteralPath (Join-Path $fixtureOut124 'desktop-recovery.json') -Encoding utf8
 $null=Read-AgentopiaDesktopRecoveryDescriptor $fixtureOut124;$receipt124.checks+=@('Capability18 accepts the complete hash-sealed Windows checkpoint resource.')
 $descriptor124.requiresDesktopRecoveryFormat=17;$descriptor124|ConvertTo-Json -Depth 5|Set-Content -LiteralPath (Join-Path $fixtureOut124 'desktop-recovery.json') -Encoding utf8
 $refused124=$false;try{$null=Read-AgentopiaDesktopRecoveryDescriptor $fixtureOut124}catch{if($_.Exception.Message -notmatch 'newer recovery capability'){throw};$refused124=$true};if(-not $refused124){throw 'A downgraded Windows credential checkpoint was accepted by launcher validation.'};$receipt124.checks+=@('A Windows checkpoint cannot be hidden under a pre18 capability.')
 $receipt124.success=$true
}catch{$receipt124.error=$_.Exception.Message}
$receipt124|ConvertTo-Json -Depth 5|Set-Content -LiteralPath (Join-Path $fixtureOut124 'evidence.json') -Encoding utf8
$receipt124|ConvertTo-Json -Depth 5 -Compress
if(-not $receipt124.success){exit 1}
