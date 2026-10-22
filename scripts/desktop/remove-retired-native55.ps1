param([Parameter(Mandatory=$true)][string]$Job,[switch]$Fixture,[switch]$Store)
$ErrorActionPreference='Stop'
if($PSVersionTable.PSVersion.Major -lt 7){throw 'The qualified PowerShell 7 runtime is required'}
$taskJob=[IO.Path]::GetFullPath($Job)
if($Fixture){
 if($taskJob -notmatch '^F:\\Agentopia\\\.supabase\\desktop-native-delete55-tests\\[0-9]{13}$'){throw 'Unexpected fixture directory'}
 $taskRoots=@((Join-Path $taskJob 'candidate'))
}elseif($Store){
 if($taskJob -notmatch '^F:\\Agentopia\\\.supabase\\desktop-store-cleanup55\\[0-9]{13}$'){throw 'Unexpected Store retention job'}
 $taskEligible=Get-Content -LiteralPath (Join-Path $taskJob 'eligible.json') -Raw|ConvertFrom-Json
 if(-not $taskEligible.success -or -not $taskEligible.sourceUnchanged -or -not $taskEligible.programRollbackVerified){throw 'Verified complete Store retention is required'}
 if((Get-FileHash -LiteralPath 'C:\Users\charl\.agentopia\desktop\profile-location.json' -Algorithm SHA256).Hash.ToLower() -ne $taskEligible.selectorSha256){throw 'The active F profile changed'}
 $taskRoots=@('C:\Users\charl\AppData\Local\Packages\OpenAI.Codex_2p2nqsd0c76g0\LocalCache\Roaming\Agentopia')
}else{
 if($taskJob -cne 'F:\Agentopia\.supabase\desktop-cleanup55\1792599907730'){throw 'Unexpected preservation job'}
 $taskEligible=Get-Content -LiteralPath (Join-Path $taskJob 'eligible.json') -Raw|ConvertFrom-Json
 if(-not $taskEligible.success -or -not $taskEligible.everyDestinationByteVerifiedDuringCopy -or -not $taskEligible.legacySourceRehashedIndependently -or -not $taskEligible.destinationPathsSizesTimesLinksComparedIndependently -or -not $taskEligible.programRollbackVerified){throw 'Preservation checks are required'}
 if((Get-FileHash -LiteralPath 'C:\Users\charl\.agentopia\desktop\profile-location.json' -Algorithm SHA256).Hash.ToLower() -ne $taskEligible.selectorSha256){throw 'The selected F profile changed'}
 if(@(Get-Process Agentopia,AgentopiaSetup -ErrorAction SilentlyContinue).Count -ne 0){throw 'Close the ordinary app before old-build removal'}
 $taskRoots=@('C:\Users\charl\.agentopia\desktop\profile','C:\Users\charl\AppData\Roaming\Agentopia','C:\Users\charl\AppData\Local\AgentopiaDesktop\app-0.44.52','C:\Users\charl\AppData\Local\AgentopiaDesktop\app-0.44.53','C:\Users\charl\AppData\Local\AgentopiaDesktop\app-0.44.54')
}
Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Collections.Generic;
using System.Text.Json;
public sealed class RetiredTreeStats55 {
 public long Files {get;set;} public long Bytes {get;set;} public long Directories {get;set;}
 public List<string> Redirects {get;}=new List<string>();
}
public static class RetiredTreeDelete55 {
 static string Bound(string path,string root) {
  string full=Path.GetFullPath(path);
  if(!String.Equals(path,full,StringComparison.Ordinal)||(!String.Equals(full,root,StringComparison.OrdinalIgnoreCase)&&!full.StartsWith(root+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase)))throw new IOException("A target escaped its exact obsolete root");
  return full;
 }
 static bool Redirect(FileAttributes a)=>(a&FileAttributes.ReparsePoint)!=0;
 static void PhysicalParents(string path) {
  for(DirectoryInfo d=new DirectoryInfo(path);d!=null;d=d.Parent)if(Redirect(d.Attributes))throw new IOException("A deletion root or parent is redirected");
 }
 static void Walk(string path,string root,string progress,RetiredTreeStats55 stats) {
  Bound(path,root);FileAttributes own=File.GetAttributes(path);
  if(Redirect(own)){stats.Redirects.Add(path);return;}
  foreach(FileSystemInfo item in new DirectoryInfo(path).EnumerateFileSystemInfos()) {
   string full=Bound(item.FullName,root);FileAttributes a=item.Attributes;
   if(Redirect(a)){stats.Redirects.Add(full);continue;}
   if((a&FileAttributes.Directory)!=0)Walk(full,root,progress,stats);
   else {
    long bytes=((FileInfo)item).Length;
    if((a&FileAttributes.ReadOnly)!=0)File.SetAttributes(full,a&~FileAttributes.ReadOnly);
    File.Delete(full);stats.Files++;stats.Bytes+=bytes;
    if(stats.Files%5000==0)File.WriteAllText(progress,JsonSerializer.Serialize(new {root,files=stats.Files,bytes=stats.Bytes,directories=stats.Directories,redirects=stats.Redirects.Count,at=DateTime.UtcNow}));
   }
  }
  // The enumerator is disposed before removing its own directory.
  using(var children=Directory.EnumerateFileSystemEntries(path).GetEnumerator())if(children.MoveNext())return;
  if((own&FileAttributes.ReadOnly)!=0)File.SetAttributes(path,own&~FileAttributes.ReadOnly);
  Directory.Delete(path,false);stats.Directories++;
 }
 public static RetiredTreeStats55 Remove(string path,string progress,bool fixture) {
  string root=Path.GetFullPath(path);if(!String.Equals(path,root,StringComparison.Ordinal))throw new IOException("The root is not canonical");
  string[] allowed={@"C:\Users\charl\.agentopia\desktop\profile",@"C:\Users\charl\AppData\Roaming\Agentopia",@"C:\Users\charl\AppData\Local\AgentopiaDesktop\app-0.44.52",@"C:\Users\charl\AppData\Local\AgentopiaDesktop\app-0.44.53",@"C:\Users\charl\AppData\Local\AgentopiaDesktop\app-0.44.54",@"C:\Users\charl\AppData\Local\Packages\OpenAI.Codex_2p2nqsd0c76g0\LocalCache\Roaming\Agentopia"};
  bool ok=fixture?System.Text.RegularExpressions.Regex.IsMatch(root,@"^F:\\Agentopia\\\.supabase\\desktop-native-delete55-tests\\[0-9]{13}\\candidate$"):Array.Exists(allowed,p=>String.Equals(root,p,StringComparison.Ordinal));
  if(!ok)throw new IOException("Root is outside the explicit deletion list");
  var stats=new RetiredTreeStats55();if(!Directory.Exists(root))return stats;PhysicalParents(root);Walk(root,root,progress,stats);return stats;
 }
}
'@
$taskResult=@{success=$false;at=[DateTime]::UtcNow.ToString('o');deletedFiles=0;deletedBytes=0;deletedDirectories=0;roots=@();retainedRedirects=@();providerRequests=0;priorPartialDeletionNotIncludedInCounts=(-not $Fixture)}
function Task-Save {$taskResult|ConvertTo-Json -Depth 7|Set-Content -LiteralPath (Join-Path $taskJob 'bulk-cleanup.json') -Encoding utf8NoBOM}
try{
 Task-Save
 foreach($taskRoot in $taskRoots){
  if(-not $Fixture){$taskNeedle=$taskRoot.ToLowerInvariant();if(@(Get-CimInstance Win32_Process|Where-Object {($_.ExecutablePath -and $_.ExecutablePath.ToLowerInvariant().Contains($taskNeedle))-or($_.CommandLine -and $_.CommandLine.ToLowerInvariant().Contains($taskNeedle))}).Count -gt 0){throw ('A process references '+$taskRoot)}}
  Write-Output ('Removing checked obsolete root '+$taskRoot)
  $taskStats=[RetiredTreeDelete55]::Remove($taskRoot,(Join-Path $taskJob 'native-removal-progress.json'),[bool]$Fixture)
  $taskResult.deletedFiles+=$taskStats.Files;$taskResult.deletedBytes+=$taskStats.Bytes;$taskResult.deletedDirectories+=$taskStats.Directories
  foreach($taskRedirect in $taskStats.Redirects){$taskResult.retainedRedirects+=@{path=$taskRedirect}}
  $taskResult.roots+=@{path=$taskRoot;removed=(-not[IO.Directory]::Exists($taskRoot))};Task-Save
 }
 $taskResult.success=$true;$taskResult.finishedAt=[DateTime]::UtcNow.ToString('o');Task-Save
 $taskResult|ConvertTo-Json -Depth 7
}catch{$taskResult.error=$_.Exception.Message;Task-Save;throw}
