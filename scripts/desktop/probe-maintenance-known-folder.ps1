param([Parameter(Mandatory=$true)][string]$MarkerName,[Parameter(Mandatory=$true)][string]$MarkerValue)
$ErrorActionPreference='Stop'
if($MarkerName -notmatch '^\.agentopia-context-[a-f0-9]{32}\.tmp$' -or $MarkerValue -notmatch '^[a-f0-9]{64}$'){throw 'Invalid context marker.'}
$taskLocal=[Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData)
$taskRoot=[IO.Path]::GetFullPath((Join-Path $taskLocal 'AgentopiaDesktop'))
if(-not [IO.Directory]::Exists($taskRoot)){throw 'The installer account folder does not exist in this Windows context.'}
$taskMarker=Join-Path $taskRoot $MarkerName
if([IO.File]::Exists($taskMarker)){throw 'Context marker already exists.'}
try{
 [IO.File]::WriteAllText($taskMarker,$MarkerValue,[Text.UTF8Encoding]::new($false))
 @{localApplicationData=$taskLocal;marker=$taskMarker}|ConvertTo-Json -Compress
 [Console]::Out.Flush()
 $taskWait=[Console]::In.ReadLineAsync()
 $null=$taskWait.Wait(45000)
}finally{if([IO.File]::Exists($taskMarker)){[IO.File]::Delete($taskMarker)}}
