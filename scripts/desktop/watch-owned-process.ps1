param([int]$ObservedPid,[string]$ExpectedPath,[string]$Folder)
$ErrorActionPreference='Stop'
$observed=[Diagnostics.Process]::GetProcessById($ObservedPid)
if ($observed.MainModule.FileName -ine $ExpectedPath) { throw 'Unexpected executable for owned process observer.' }
$null=$observed.Handle
@{pid=$ObservedPid;path=$observed.MainModule.FileName;at=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $Folder 'watch-ready.json')
$done=$observed.WaitForExit(150000)
@{pid=$ObservedPid;at=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds();signaled=$done;hasExited=$observed.HasExited;exitCode=$(if($done){$observed.ExitCode}else{$null})} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $Folder 'windows-exit.json')
$observed.Dispose()
