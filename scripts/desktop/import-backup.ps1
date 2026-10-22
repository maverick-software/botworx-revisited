param([string]$BackupDirectory=$PSScriptRoot,[switch]$CheckOnly)
$ErrorActionPreference='Stop'

function Get-AgentopiaRecoveryHash([string]$LiteralPath){
 $stream=[IO.File]::OpenRead($LiteralPath);$hash=[Security.Cryptography.SHA256]::Create()
 try{return ([BitConverter]::ToString($hash.ComputeHash($stream))).Replace('-','').ToLowerInvariant()}finally{$stream.Dispose();$hash.Dispose()}
}

function Read-AgentopiaRecoveryManifest([string]$Source){
 if(Test-Path -LiteralPath (Join-Path $Source 'BACKUP-INCOMPLETE.txt')){throw 'This recovery backup is incomplete. Keep the original profile and inspect the retained files.'}
 $manifest=Get-Content -LiteralPath (Join-Path $Source 'manifest.json') -Raw | ConvertFrom-Json
 if($manifest.format -ne 1){throw 'Unsupported recovery backup format'}
 $allowed=@('auth.dump','application.dump','vault.dump','database.dump','recovery.dump','pgsodium_root.key')
 $entries=@($manifest.files);$seen=@{}
 if($entries.Count -lt 4 -or $entries.Count -gt $allowed.Count){throw 'Invalid recovery resource count'}
 foreach($entry in $entries){
  if($entry.name -isnot [string] -or $entry.name -cnotin $allowed -or $seen.ContainsKey($entry.name) -or $entry.sha256 -isnot [string] -or $entry.sha256 -cnotmatch '^[a-f0-9]{64}$'){throw 'Invalid or duplicate recovery resource'}
  $seen[$entry.name]=$true;$file=Get-Item -LiteralPath (Join-Path $Source $entry.name) -Force
  if($file.PSIsContainer -or ($file.Attributes -band [IO.FileAttributes]::ReparsePoint) -or (Get-AgentopiaRecoveryHash $file.FullName) -cne $entry.sha256){throw "Recovery backup is incomplete or changed: $($entry.name)"}
 }
 foreach($name in @('auth.dump','application.dump','vault.dump','pgsodium_root.key')){if(-not $seen.ContainsKey($name)){throw "Recovery backup is missing: $name"}}
 return $manifest
}

function Get-AgentopiaRecoveryDestination([string]$HomeDirectory,[string]$AppDataDirectory,[string[]]$RegisteredDistributions){
 if(@($RegisteredDistributions|Where-Object {$_.Trim() -match '^AgentopiaRuntime(?:-|$)'}).Count){throw 'An existing Agentopia runtime was found. This recovery command is for a fresh installation. Preserve the existing runtime and use a fresh Windows user profile or another computer to verify recovery.'}
 if(-not [IO.Path]::IsPathRooted($HomeDirectory) -or -not [IO.Path]::IsPathRooted($AppDataDirectory)){throw 'Recovery requires absolute Windows profile paths'}
 $private=Join-Path $HomeDirectory '.agentopia\desktop'
 foreach($name in @('profile-location.json','migration.lock','profile')){if(Test-Path -LiteralPath (Join-Path $private $name)){throw 'An existing or staged private Agentopia profile was found. Preserve it before recovery.'}}
 $profile=Join-Path $AppDataDirectory 'Agentopia'
 foreach($name in @('migration-complete.json','migration-input','runtime-binding.json','credentials.bin')){if(Test-Path -LiteralPath (Join-Path $profile $name)){throw 'Existing Agentopia profile or migration data was found. Use a fresh installation for recovery.'}}
 $destination=Join-Path $profile 'migration-input'
 $ancestor=[IO.DirectoryInfo]::new($profile)
 while($null -ne $ancestor){if(Test-Path -LiteralPath $ancestor.FullName){$item=Get-Item -LiteralPath $ancestor.FullName -Force;if(($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or -not $item.PSIsContainer){throw 'Recovery destination contains a redirected or invalid directory'}};$ancestor=$ancestor.Parent}
 return $destination
}

function Read-AgentopiaDesktopRecoveryDescriptor([string]$Source){
 foreach($marker in @('BACKUP-INCOMPLETE.txt','WORKSPACE-BACKUP-INCOMPLETE.txt')){if(Test-Path -LiteralPath (Join-Path $Source $marker)){throw 'This desktop backup is incomplete. Preserve the original files and use a verified complete recovery.'}}
 $descriptorPath=Join-Path $Source 'desktop-recovery.json'
 $descriptorItem=Get-Item -LiteralPath $descriptorPath -Force;if($descriptorItem.PSIsContainer -or ($descriptorItem.Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'The desktop recovery descriptor is linked or invalid.'}
 $descriptor=Get-Content -LiteralPath $descriptorPath -Raw | ConvertFrom-Json
 if($descriptor.format -ne 2 -or $descriptor.kind -ne 'agentopia-desktop-recovery' -or $descriptor.requiresDesktopRecoveryFormat -notin @(2,3,4,5,6,7,8,9,10,11,12) -or $descriptor.codex -ne '0.163.0'){throw 'This bundle requires a compatible Agentopia desktop recovery release.'}
 if($descriptor.requiresDesktopRecoveryFormat -lt 12 -and ($descriptor.PSObject.Properties.Name -contains 'workspaceArchive' -or $descriptor.PSObject.Properties.Name -contains 'workspaceManifest')){throw 'Scheduled workspace files require a newer recovery capability.'}
 if($descriptor.requiresDesktopRecoveryFormat -lt 6 -and $descriptor.PSObject.Properties.Name -contains 'layoutsManifest'){throw 'Workspace layouts require a newer recovery capability.'}
 if($descriptor.requiresDesktopRecoveryFormat -lt 5 -and ($descriptor.PSObject.Properties.Name -contains 'externalArchive' -or $descriptor.PSObject.Properties.Name -contains 'externalManifest')){throw 'External files require a newer recovery capability.'}
 if($descriptor.requiresDesktopRecoveryFormat -lt 4 -and $descriptor.PSObject.Properties.Name -contains 'settingsManifest'){throw 'Portable settings require a newer recovery capability.'}
 $prefix=[IO.Path]::GetFullPath($Source).TrimEnd([IO.Path]::DirectorySeparatorChar)+[IO.Path]::DirectorySeparatorChar
 $fields=@('databaseManifest','profileArchive','profileManifest','publicArchive','publicManifest','references');if($descriptor.requiresDesktopRecoveryFormat -ge 3){$fields+=@('clipboardArchive','clipboardManifest')};if($descriptor.requiresDesktopRecoveryFormat -ge 4){$fields+=@('settingsManifest')};if($descriptor.requiresDesktopRecoveryFormat -ge 5){$fields+=@('externalArchive','externalManifest')};if($descriptor.requiresDesktopRecoveryFormat -ge 6){$fields+=@('layoutsManifest')}
 if($descriptor.requiresDesktopRecoveryFormat -ge 12){$fields+=@('workspaceManifest','workspaceArchive')}
 foreach($field in $fields){
  $entry=$descriptor.$field
  if($entry.file -isnot [string] -or -not $entry.file -or [IO.Path]::IsPathRooted($entry.file) -or $entry.file -match '[\x00-\x1f\x7f<>:"|?*]' -or @($entry.file -split '[\\/]'|Where-Object {$_ -eq '..' -or $_ -eq '.' -or -not $_}).Count -or $entry.sha256 -isnot [string] -or $entry.sha256 -cnotmatch '^[a-f0-9]{64}$'){throw 'Invalid desktop recovery resource.'}
  $file=[IO.Path]::GetFullPath((Join-Path $Source $entry.file));if(-not $file.StartsWith($prefix,[StringComparison]::OrdinalIgnoreCase)){throw 'Desktop recovery resource left its backup directory.'}
  $current=[IO.FileInfo]::new($file)
  while($null -ne $current){if(Test-Path -LiteralPath $current.FullName){$item=Get-Item -LiteralPath $current.FullName -Force;if($item.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Linked desktop recovery resources are refused.'}};$current=if($current -is [IO.FileInfo]){$current.Directory}else{$current.Parent}}
  $item=Get-Item -LiteralPath $file -Force;if($item.PSIsContainer -or (Get-AgentopiaRecoveryHash $file) -cne $entry.sha256){throw 'A desktop recovery resource is missing or changed.'}
 }
 return @{descriptor=$descriptor;sha256=Get-AgentopiaRecoveryHash $descriptorPath}
}

function New-AgentopiaDesktopRecoveryRequest([string]$Source,[string]$HomeDirectory,[string]$AppDataDirectory,[string[]]$RegisteredDistributions,[switch]$ValidateOnly){
 if(-not [IO.Path]::IsPathRooted($HomeDirectory) -or -not [IO.Path]::IsPathRooted($AppDataDirectory)){throw 'Recovery requires absolute Windows profile paths.'}
 $sealed=Read-AgentopiaDesktopRecoveryDescriptor $Source
 if(@($RegisteredDistributions|Where-Object {$_.Trim() -match '^AgentopiaRuntime(?:-|$)'}).Count){throw 'An existing Agentopia runtime was found. Use a fresh Windows account for recovery.'}
 $homePath=[IO.Path]::GetFullPath($HomeDirectory);$appDataPath=[IO.Path]::GetFullPath($AppDataDirectory);$profile=Join-Path $appDataPath 'Agentopia';$folder=Join-Path $homePath '.agentopia';$requestPath=Join-Path $folder 'recovery-request.json'
 if(-not $appDataPath.StartsWith($homePath.TrimEnd([IO.Path]::DirectorySeparatorChar)+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Recovery application data must belong to this Windows home.'}
 if(Test-Path -LiteralPath $requestPath){
  $item=Get-Item -LiteralPath $requestPath -Force;if($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'The existing recovery request is invalid.'}
  $saved=Get-Content -LiteralPath $requestPath -Raw|ConvertFrom-Json
  if($saved.format -ne 2 -or $saved.kind -ne 'agentopia-desktop-recovery-request' -or $saved.home -ine $homePath -or $saved.appData -ine $appDataPath -or $saved.profile -ine $profile -or $saved.bundle -ine $Source -or $saved.descriptorSha256 -cne $sealed.sha256){throw 'A different recovery request already exists. Preserve it before continuing.'}
  return @{success=$true;alreadyQueued=$true;request=$requestPath;writes=0}
 }
 $null=Get-AgentopiaRecoveryDestination $homePath $appDataPath $RegisteredDistributions
 if((Test-Path -LiteralPath $profile) -or (Test-Path -LiteralPath (Join-Path $homePath 'Agentopia Files')) -or (Test-Path -LiteralPath (Join-Path $folder 'recovery-state.json'))){throw 'Existing desktop or recovery data must be preserved before queuing a fresh recovery.'}
 $ancestor=[IO.DirectoryInfo]::new($folder);while($null -ne $ancestor){if(Test-Path -LiteralPath $ancestor.FullName){$item=Get-Item -LiteralPath $ancestor.FullName -Force;if(-not $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'The recovery request directory is redirected or invalid.'}};$ancestor=$ancestor.Parent}
 if($ValidateOnly){return @{success=$true;checkOnly=$true;request=$requestPath;writes=0}}
 $id=[Guid]::NewGuid().ToString();$request=[ordered]@{format=2;kind='agentopia-desktop-recovery-request';id=$id;home=$homePath;appData=$appDataPath;profile=$profile;bundle=$Source;descriptorSha256=$sealed.sha256}
 $null=New-Item -ItemType Directory -Path $folder -Force
 $temporary=Join-Path $folder ('recovery-request-'+$id+'.tmp');[IO.File]::WriteAllText($temporary,($request|ConvertTo-Json -Depth 5),[Text.UTF8Encoding]::new($false));[IO.File]::Move($temporary,$requestPath)
 return @{success=$true;queued=$true;request=$requestPath;writes=1}
}

# Dot-sourcing exposes the actual validation functions to isolated tests.
if($MyInvocation.InvocationName -eq '.'){return}
$source=(Resolve-Path -LiteralPath $BackupDirectory).Path
$desktop=Test-Path -LiteralPath (Join-Path $source 'desktop-recovery.json')
if(-not $desktop){$manifest=Read-AgentopiaRecoveryManifest $source}
$raw=@(& wsl --list --quiet);if($LASTEXITCODE -ne 0){throw 'WSL registrations could not be verified; recovery was not prepared.'}
$distros=@(($raw -join "`n").Replace("`0",'') -split '[\r\n]+'|Where-Object {$_ -and $_.Trim()})
if($desktop){
 if(@(Get-Process Agentopia,AgentopiaSetup -ErrorAction SilentlyContinue).Count){throw 'Close Agentopia before queuing desktop recovery.'}
 New-AgentopiaDesktopRecoveryRequest $source ([Environment]::GetFolderPath('UserProfile')) $env:APPDATA $distros -ValidateOnly:$CheckOnly
 if(-not $CheckOnly){Write-Output 'Desktop recovery is queued. Install a verified Agentopia release that supports this backup, then launch it. It will prepare the recovery and reopen the restored profile. Reconnect AI providers after signing in.'}
 return
}
$destination=Get-AgentopiaRecoveryDestination ([Environment]::GetFolderPath('UserProfile')) $env:APPDATA $distros
if(@(Get-Process Agentopia,AgentopiaSetup -ErrorAction SilentlyContinue).Count){throw 'Close Agentopia before preparing a fresh recovery.'}
if($CheckOnly){[pscustomobject]@{success=$true;checkOnly=$true;destination=$destination;files=@($manifest.files).Count;writes=0};return}
New-Item -ItemType Directory -Path $destination | Out-Null
foreach($entry in $manifest.files){
 $target=Join-Path $destination $entry.name
 Copy-Item -LiteralPath (Join-Path $source $entry.name) -Destination $target -ErrorAction Stop
 if((Get-AgentopiaRecoveryHash $target) -cne $entry.sha256){throw 'The prepared recovery copy did not verify. Preserve it for inspection; do not launch Agentopia.'}
}
Copy-Item -LiteralPath (Join-Path $source 'manifest.json') -Destination (Join-Path $destination 'manifest.json') -ErrorAction Stop
Write-Output 'Recovery is prepared. Launch Agentopia to restore the database into a new private runtime.'
