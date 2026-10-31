$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
try {
 $taskPayload = [Console]::ReadLine() | ConvertFrom-Json
 Add-Type -ReferencedAssemblies System.dll,System.Core.dll -TypeDefinition @'
using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
public static class SylvanaCommandJob {
 [StructLayout(LayoutKind.Sequential)] struct IO { public ulong a,b,c,d,e,f; }
 [StructLayout(LayoutKind.Sequential)] struct Basic { public long a,b; public uint flags; public UIntPtr min,max; public uint count; public UIntPtr affinity; public uint priority,scheduling; }
 [StructLayout(LayoutKind.Sequential)] struct Extended { public Basic basic; public IO io; public UIntPtr processMemory,jobMemory,peakProcess,peakJob; }
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr attributes,string name);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job,int kind,ref Extended data,uint size);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool TerminateJobObject(IntPtr job,uint exit);
 static readonly object gate=new object();
 static void Emit(string kind,string value) { lock(gate) { Console.WriteLine(kind+":"+Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(value)));Console.Out.Flush(); } }
 static void Pump(Stream stream,string kind) { try { byte[] bytes=new byte[4096];int size;while((size=stream.Read(bytes,0,bytes.Length))>0) { lock(gate) { Console.WriteLine(kind+":"+Convert.ToBase64String(bytes,0,size));Console.Out.Flush(); } } } catch {} }
 public static void Run(string executable,string encoded,string directory,int timeout) {
  IntPtr job=CreateJobObject(IntPtr.Zero,null);
  if(job==IntPtr.Zero) throw new System.ComponentModel.Win32Exception();
  Extended limits=new Extended();limits.basic.flags=0x2000;
  if(!SetInformationJobObject(job,9,ref limits,(uint)Marshal.SizeOf(typeof(Extended)))||!AssignProcessToJobObject(job,Process.GetCurrentProcess().Handle)) throw new System.ComponentModel.Win32Exception();
  // Assign the supervisor before launching user code: normal descendants inherit the job.
  // EOF on the parent-owned pipe also ends the job after an Electron crash.
  Thread lease=new Thread(delegate(){try{while(Console.ReadLine()!=null){} }catch{}TerminateJobObject(job,130);});lease.IsBackground=true;lease.Start();
  try {
   ProcessStartInfo start=new ProcessStartInfo(executable,"-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand "+encoded);
   start.WorkingDirectory=directory;start.UseShellExecute=false;start.CreateNoWindow=true;start.WindowStyle=ProcessWindowStyle.Hidden;start.RedirectStandardOutput=true;start.RedirectStandardError=true;start.RedirectStandardInput=true;
   Process process=Process.Start(start);process.StandardInput.Close();Emit("S",process.Id.ToString());
   Thread output=new Thread(delegate(){Pump(process.StandardOutput.BaseStream,"O");});Thread errors=new Thread(delegate(){Pump(process.StandardError.BaseStream,"E");});output.IsBackground=true;errors.IsBackground=true;output.Start();errors.Start();
   if(!process.WaitForExit(timeout)){Emit("T","Command reached its time limit.");TerminateJobObject(job,124);return;}
   output.Join(1000);errors.Join(1000);Emit("R",process.ExitCode.ToString());
  } catch(Exception error) { Emit("F",error.Message); }
  finally { TerminateJobObject(job,0); }
 }
}
'@
 $taskScript = "[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new(`$false);`$OutputEncoding=[Console]::OutputEncoding;`$ProgressPreference='SilentlyContinue';`$ErrorActionPreference='Stop';try { & {`n" + $taskPayload.command + "`n};if(-not `$?){exit 1};if(`$LASTEXITCODE){exit `$LASTEXITCODE};exit 0 } catch { [Console]::Error.WriteLine(`$_.ToString());exit 1 }"
 $taskEncoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($taskScript))
 $taskExecutable=[string]$taskPayload.executable
 if([string]::IsNullOrWhiteSpace($taskExecutable)){$taskExecutable=Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe'}
 if(-not [IO.Path]::IsPathRooted($taskExecutable) -or -not [IO.File]::Exists($taskExecutable)){throw 'The configured PowerShell executable is unavailable.'}
 [SylvanaCommandJob]::Run($taskExecutable,$taskEncoded,[string]$taskPayload.cwd,[int]$taskPayload.timeoutMs)
} catch {
 [Console]::WriteLine('F:'+[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($_.ToString())))
 exit 1
}
