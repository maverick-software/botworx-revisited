param([ValidateSet('normal','host','host-visible')][string]$Mode)
$ErrorActionPreference='Stop'
$taskRepo='D:\Users\charl\software\Agentopia'
$taskPointer=Get-Content -LiteralPath "$taskRepo\.supabase\desktop-profile-location\production47-current.json" -Raw | ConvertFrom-Json
$taskIntent=Get-Content -LiteralPath $taskPointer.intent -Raw | ConvertFrom-Json
$taskExpected='C:\Users\charl\AppData\Local\AgentopiaDesktop\app-0.44.47\Agentopia.exe'
$taskProcesses=@(Get-CimInstance Win32_Process -Filter "Name='Agentopia.exe'")
if($taskProcesses.Count -lt 2){throw 'No complete Agentopia process group is running.'}
$taskProfiles=@()
foreach($taskProcess in $taskProcesses){
 if($taskProcess.ExecutablePath -ine $taskExpected){throw 'An unexpected Agentopia image is running.'}
 if($taskProcess.CommandLine -match '--user-data-dir=(?:"([^"]+)"|([^ ]+))'){
  $taskProfile=if($Matches[1]){$Matches[1]}else{$Matches[2]}
  if($taskProfile -ine $taskIntent.target){throw 'A child process is using another profile.'}
  $taskProfiles+=$taskProfile
 }
}
if($taskProfiles.Count -lt 1){throw 'No child process confirms the private profile path.'}
$taskReceipt=[ordered]@{success=$true;at=[DateTime]::UtcNow.ToString('o');launch=$Mode;version='0.44.47';profile=$taskIntent.target;processes=$taskProcesses.Count;childProfilePathsChecked=$taskProfiles.Count;providerRequests=0}
$taskFile=Join-Path $taskIntent.out "process-$Mode.json"
if(Test-Path -LiteralPath $taskFile){throw 'The process receipt already exists.'}
[IO.File]::WriteAllText($taskFile,($taskReceipt|ConvertTo-Json),[Text.UTF8Encoding]::new($false))
$taskReceipt|ConvertTo-Json -Compress
