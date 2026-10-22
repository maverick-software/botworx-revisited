$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
try {
 $taskPayload = [Console]::ReadLine() | ConvertFrom-Json
 Add-Type -ReferencedAssemblies System.dll,System.Core.dll -TypeDefinition @'
using System;
using System.IO;
using System.Text;
using System.Threading;
using System.Collections.Concurrent;
using System.Runtime.InteropServices;
using System.Diagnostics;
public static class AgentopiaInteractive {
 [StructLayout(LayoutKind.Sequential)] struct Coord { public short X,Y; public Coord(int x,int y){X=(short)x;Y=(short)y;} }
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct Startup { public int cb;public string reserved,desktop,title;public int x,y,w,h,xchars,ychars,fill,flags;public short show,reservedSize;public IntPtr reservedBytes,input,output,error; }
 [StructLayout(LayoutKind.Sequential)] struct StartupEx { public Startup startup;public IntPtr attributes; }
 [StructLayout(LayoutKind.Sequential)] struct ProcessInfo { public IntPtr process,thread;public uint pid,tid; }
 [StructLayout(LayoutKind.Sequential)] struct IO { public ulong a,b,c,d,e,f; }
 [StructLayout(LayoutKind.Sequential)] struct Basic { public long a,b;public uint flags;public UIntPtr min,max;public uint count;public UIntPtr affinity;public uint priority,scheduling; }
 [StructLayout(LayoutKind.Sequential)] struct Extended { public Basic basic;public IO io;public UIntPtr pm,jm,pp,pj; }
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool CreatePipe(out IntPtr read,out IntPtr write,IntPtr attributes,uint size);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool ReadFile(IntPtr file,byte[] data,uint length,out uint count,IntPtr overlapped);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool WriteFile(IntPtr file,byte[] data,uint length,out uint count,IntPtr overlapped);
 [DllImport("kernel32.dll")] static extern int CreatePseudoConsole(Coord size,IntPtr input,IntPtr output,uint flags,out IntPtr console);
 [DllImport("kernel32.dll")] static extern int ResizePseudoConsole(IntPtr console,Coord size);
 [DllImport("kernel32.dll")] static extern void ClosePseudoConsole(IntPtr console);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool InitializeProcThreadAttributeList(IntPtr list,int count,int flags,ref IntPtr size);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool UpdateProcThreadAttribute(IntPtr list,uint flags,IntPtr attribute,IntPtr value,IntPtr size,IntPtr old,IntPtr returned);
 [DllImport("kernel32.dll")] static extern void DeleteProcThreadAttributeList(IntPtr list);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool CreateProcessW(string application,StringBuilder command,IntPtr pa,IntPtr ta,bool inherit,uint flags,IntPtr environment,string directory,ref StartupEx startup,out ProcessInfo process);
 [DllImport("kernel32.dll")] static extern uint WaitForSingleObject(IntPtr handle,uint milliseconds);
 [DllImport("kernel32.dll")] static extern bool GetExitCodeProcess(IntPtr process,out uint code);
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr attributes,string name);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job,int kind,ref Extended data,uint size);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
 [DllImport("kernel32.dll")] static extern bool TerminateJobObject(IntPtr job,uint code);
 static readonly object gate=new object();
 static void Emit(string kind,byte[] value,int count){lock(gate){Console.WriteLine(kind+":"+Convert.ToBase64String(value,0,count));Console.Out.Flush();}}
 static void Emit(string kind,string value){byte[] bytes=Encoding.UTF8.GetBytes(value);Emit(kind,bytes,bytes.Length);}
 static void Check(bool result){if(!result)throw new System.ComponentModel.Win32Exception();}
 public static void Run(string executable,string directory,int columns,int rows,string ready){
  IntPtr job=CreateJobObject(IntPtr.Zero,null);Check(job!=IntPtr.Zero);Extended limits=new Extended();limits.basic.flags=0x2000;
  Check(SetInformationJobObject(job,9,ref limits,(uint)Marshal.SizeOf(typeof(Extended))));Check(AssignProcessToJobObject(job,Process.GetCurrentProcess().Handle));
  // Input reception and pipe writes use separate threads: EOF must end the job even if the client stops reading.
  BlockingCollection<string> queue=new BlockingCollection<string>(512);
  Thread lease=new Thread(delegate(){try{string line;while((line=Console.ReadLine())!=null){if(line.Length>100000||!queue.TryAdd(line)){Emit("F","Terminal input queue exceeded its limit.");break;}}}catch{}TerminateJobObject(job,130);});lease.IsBackground=true;lease.Start();
  IntPtr inputRead=IntPtr.Zero,inputWrite=IntPtr.Zero,outputRead=IntPtr.Zero,outputWrite=IntPtr.Zero,console=IntPtr.Zero,attributes=IntPtr.Zero;
  try{
   Check(CreatePipe(out inputRead,out inputWrite,IntPtr.Zero,0));Check(CreatePipe(out outputRead,out outputWrite,IntPtr.Zero,0));
   int result=CreatePseudoConsole(new Coord(columns,rows),inputRead,outputWrite,0,out console);if(result!=0)Marshal.ThrowExceptionForHR(result);
   Thread pump=new Thread(delegate(){try{byte[] bytes=new byte[4096];uint count;while(ReadFile(outputRead,bytes,(uint)bytes.Length,out count,IntPtr.Zero)&&count>0)Emit("O",bytes,(int)count);}catch{}});pump.IsBackground=true;pump.Start();
   IntPtr required=IntPtr.Zero;InitializeProcThreadAttributeList(IntPtr.Zero,1,0,ref required);attributes=Marshal.AllocHGlobal(required);Check(InitializeProcThreadAttributeList(attributes,1,0,ref required));
   Check(UpdateProcThreadAttribute(attributes,0,new IntPtr(0x20016),console,new IntPtr(IntPtr.Size),IntPtr.Zero,IntPtr.Zero));
   StartupEx startup=new StartupEx();startup.startup.cb=Marshal.SizeOf(typeof(StartupEx));startup.attributes=attributes;
   // A redirected parent otherwise lends its control pipes to the client even with inherit=false.
   // Explicit null standard handles make Windows initialize the client's pseudoconsole handles.
   startup.startup.flags=0x100;
   // Keep console editing/history in this session. Do not read or append the Windows user's shared history.
   string initialization="$ErrorActionPreference='Stop';try{[Console]::InputEncoding=[Text.UTF8Encoding]::new($false);[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false);$OutputEncoding=[Console]::OutputEncoding;Import-Module PSReadLine;Set-PSReadLineOption -HistorySaveStyle SaveNothing -HistorySavePath (Join-Path $env:TEMP ('AgentopiaSession-'+[guid]::NewGuid().ToString()+'.history'));[Microsoft.PowerShell.PSConsoleReadLine]::ClearHistory($null,$null)}catch{[Console]::Error.WriteLine($_.ToString());exit 1};$ErrorActionPreference='Continue'";
   // ConsoleHost records the encoded startup command after it executes. Clear
   // both engine and editor history in the first prompt, before PSReadLine
   // initializes from Get-History, and only then accept input.
   initialization+=";$script:AgentopiaInitialPrompt=${function:prompt};function global:prompt { $ErrorActionPreference='Stop';try { $taskInitialPrompt=$script:AgentopiaInitialPrompt;Set-Item function:global:prompt -Value $taskInitialPrompt;Remove-Variable AgentopiaInitialPrompt -Scope Script -ErrorAction SilentlyContinue;Microsoft.PowerShell.Core\\Clear-History;[Microsoft.PowerShell.PSConsoleReadLine]::ClearHistory($null,$null);[Console]::WriteLine([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('"+Convert.ToBase64String(Encoding.UTF8.GetBytes(ready))+"'))); & $taskInitialPrompt } catch { [Console]::Error.WriteLine($_.ToString());exit 1 } };Clear-Host";
   string encoded=Convert.ToBase64String(Encoding.Unicode.GetBytes(initialization));
   ProcessInfo process;Check(CreateProcessW(executable,new StringBuilder("\""+executable+"\" -NoLogo -NoProfile -NoExit -EncodedCommand "+encoded),IntPtr.Zero,IntPtr.Zero,false,0x80000,IntPtr.Zero,directory,ref startup,out process));
   CloseHandle(inputRead);inputRead=IntPtr.Zero;CloseHandle(outputWrite);outputWrite=IntPtr.Zero;CloseHandle(process.thread);Emit("S",process.pid.ToString());
   Thread writer=new Thread(delegate(){try{foreach(string line in queue.GetConsumingEnumerable()){
    if(line.StartsWith("I:")){byte[] bytes=Convert.FromBase64String(line.Substring(2));uint count;int offset=0;while(offset<bytes.Length){byte[] rest=new byte[bytes.Length-offset];Array.Copy(bytes,offset,rest,0,rest.Length);if(!WriteFile(inputWrite,rest,(uint)rest.Length,out count,IntPtr.Zero)||count==0)break;offset+=(int)count;}}
    else if(line.StartsWith("R:")){string[] size=line.Substring(2).Split(',');int x=int.Parse(size[0]),y=int.Parse(size[1]);if(x<20||x>300||y<5||y>120)throw new Exception("Invalid terminal dimensions.");ResizePseudoConsole(console,new Coord(x,y));}
    else if(line=="C"){TerminateJobObject(job,130);return;}
   }}catch(Exception error){Emit("F",error.Message);TerminateJobObject(job,1);}});writer.IsBackground=true;writer.Start();
   WaitForSingleObject(process.process,0xffffffff);uint exit;GetExitCodeProcess(process.process,out exit);CloseHandle(process.process);
   ClosePseudoConsole(console);console=IntPtr.Zero;pump.Join(1500);Emit("R",exit.ToString());
  }catch(Exception error){Emit("F",error.Message);}
  finally{TerminateJobObject(job,0);}
 }
}
'@
 $taskExecutable=[string]$taskPayload.executable
 if([string]::IsNullOrWhiteSpace($taskExecutable)){$taskExecutable=Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe'}
 if(-not [IO.Path]::IsPathRooted($taskExecutable) -or -not [IO.File]::Exists($taskExecutable)){throw 'The configured PowerShell executable is unavailable.'}
 [AgentopiaInteractive]::Run($taskExecutable,[string]$taskPayload.cwd,[int]$taskPayload.columns,[int]$taskPayload.rows,[string]$taskPayload.ready)
} catch {
 [Console]::WriteLine('F:'+[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($_.ToString())))
 exit 1
}
