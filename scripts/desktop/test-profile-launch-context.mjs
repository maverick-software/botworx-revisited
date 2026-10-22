// Development probe: generated marker files and child processes only. No app, DB or credentials opened.
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('isolated Windows profile launch-context diagnosis');
const id=Date.now().toString(),out=path.resolve('C:/Users/charl/AgentopiaQA/profile-launch',id),project=path.join(out,'probe');await mkdir(project,{recursive:true});
const root=path.resolve(import.meta.dirname,'../..'),sdk=path.join(root,'.supabase/desktop-computer-sdk/sdk/dotnet.exe');
const markerRoot='C:\\Users\\charl\\AppData\\Roaming\\AgentopiaProfileProbe-'+id,overlay='C:\\Users\\charl\\AppData\\Local\\Packages\\OpenAI.Codex_2p2nqsd0c76g0\\LocalCache\\Roaming\\AgentopiaProfileProbe-'+id;
const linux=p=>'/mnt/'+p[0].toLowerCase()+p.slice(2).replaceAll('\\','/');
const prep=spawnSync('wsl.exe',['-d','AgentopiaRuntime-a91a4800-e08f-4440-a4ec-588762d01bfd','-u','agentopia','--exec','python3','-c','from pathlib import Path;import sys;[(Path(p).mkdir(parents=True), (Path(p)/"marker.txt").write_text(v)) for p,v in [(sys.argv[1],"ordinary-marker"),(sys.argv[2],"overlay-marker")]]',linux(markerRoot),linux(overlay)],{encoding:'utf8',windowsHide:true});assert.equal(prep.status,0,prep.stderr);
await writeFile(path.join(project,'Probe.csproj'),'<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net10.0</TargetFramework><ImplicitUsings>enable</ImplicitUsings><Nullable>enable</Nullable><NuGetAudit>false</NuGetAudit></PropertyGroup></Project>');
await writeFile(path.join(project,'Program.cs'),String.raw`using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
class Probe {
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct STARTUPINFO { public uint cb;public string? reserved;public string? desktop;public string? title;public uint x,y,xs,ys,xc,yc,fill,flags;public ushort show,cbReserved;public IntPtr reserved2,input,output,error; }
 [StructLayout(LayoutKind.Sequential)] struct STARTUPINFOEX { public STARTUPINFO si;public IntPtr attributes; }
 [StructLayout(LayoutKind.Sequential)] struct PROCESS_INFORMATION {public IntPtr process,thread;public uint pid,tid;}
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool InitializeProcThreadAttributeList(IntPtr list,int count,int flags,ref nuint size);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool UpdateProcThreadAttribute(IntPtr list,uint flags,IntPtr attribute,IntPtr value,nuint size,IntPtr previous,IntPtr returned);
 [DllImport("kernel32.dll")] static extern void DeleteProcThreadAttributeList(IntPtr list);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool CreateProcessW(string app,StringBuilder command,IntPtr pa,IntPtr ta,bool inherit,uint flags,IntPtr env,string? cwd,ref STARTUPINFOEX startup,out PROCESS_INFORMATION process);
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetExitCodeProcess(IntPtr process,out uint code);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode)] static extern int GetCurrentPackageFullName(ref uint length,StringBuilder? name);
 static string Package(){uint size=0;GetCurrentPackageFullName(ref size,null);if(size==0)return "unpackaged";var name=new StringBuilder((int)size);return GetCurrentPackageFullName(ref size,name)==0?name.ToString():"unknown";}
 static string Q(string s)=>"\""+s.Replace("\"","\\\"")+"\"";
 static int Main(string[] args){try{
  var mode=args[0];var marker=args[1];var output=args[2];
  if(mode=="inspect"){File.WriteAllText(output,JsonSerializer.Serialize(new{pid=Environment.ProcessId,package=Package(),marker=File.ReadAllText(Path.Combine(marker,"marker.txt"))}));return 0;}
  string dll=typeof(Probe).Assembly.Location,exe=Environment.ProcessPath!;
  if(mode=="shell"){var p=Process.Start(new ProcessStartInfo(exe){ArgumentList={dll,"inspect",marker,output},UseShellExecute=true,WindowStyle=ProcessWindowStyle.Hidden})!;if(!p.WaitForExit(20000))throw new Exception("shell probe timed out");return p.ExitCode;}
  if(mode=="grandchild"){var p=Process.Start(new ProcessStartInfo(exe){ArgumentList={dll,"inspect",marker,output},UseShellExecute=false,CreateNoWindow=true})!;if(!p.WaitForExit(20000))throw new Exception("probe child timed out");return p.ExitCode;}
  nuint size=0;InitializeProcThreadAttributeList(IntPtr.Zero,1,0,ref size);var list=Marshal.AllocHGlobal((int)size);var policy=Marshal.AllocHGlobal(4);bool initialized=false;
  try{if(!InitializeProcThreadAttributeList(list,1,0,ref size))throw new System.ComponentModel.Win32Exception();initialized=true;Marshal.WriteInt32(policy,1);
   if(!UpdateProcThreadAttribute(list,0,new IntPtr(0x20012),policy,4,IntPtr.Zero,IntPtr.Zero))throw new System.ComponentModel.Win32Exception();
   var start=new STARTUPINFOEX{si=new STARTUPINFO{cb=(uint)Marshal.SizeOf<STARTUPINFOEX>()},attributes=list};
   var command=new StringBuilder(Q(exe)+" "+Q(dll)+" grandchild "+Q(marker)+" "+Q(output));
   if(!CreateProcessW(exe,command,IntPtr.Zero,IntPtr.Zero,false,0x00080000|0x08000000,IntPtr.Zero,null,ref start,out var pi))throw new System.ComponentModel.Win32Exception();
   CloseHandle(pi.thread);try{using var p=Process.GetProcessById((int)pi.pid);if(!p.WaitForExit(20000))throw new Exception("policy child timed out");if(!GetExitCodeProcess(pi.process,out var exit))throw new System.ComponentModel.Win32Exception();return (int)exit;}finally{CloseHandle(pi.process);}
  }finally{if(initialized)DeleteProcThreadAttributeList(list);Marshal.FreeHGlobal(list);Marshal.FreeHGlobal(policy);}
 }catch(Exception e){Console.Error.WriteLine(e);return 1;}}
}`);
const build=spawnSync(sdk,['build',path.join(project,'Probe.csproj'),'-c','Release','-o',path.join(out,'bin'),'--nologo'],{encoding:'utf8',windowsHide:true,env:{...process.env,DOTNET_CLI_TELEMETRY_OPTOUT:'1',DOTNET_NOLOGO:'1',DOTNET_CLI_HOME:path.join(out,'dotnet-home')}});await writeFile(path.join(out,'build.log'),build.stdout+build.stderr);assert.equal(build.status,0,'Probe build failed; inspect '+out);
const runs=[];for(const mode of ['inspect','policy','shell']){const file=path.join(out,mode+'.json'),result=spawnSync(sdk,[path.join(out,'bin/Probe.dll'),mode,markerRoot,file],{encoding:'utf8',windowsHide:true,timeout:45000});await writeFile(path.join(out,mode+'.log'),result.stdout+result.stderr);runs.push({mode,exitCode:result.status,error:result.error?.message,observation:result.status===0?JSON.parse(await readFile(file,'utf8')):undefined});}
const evidence={at:new Date().toISOString(),out,runs,productionFilesRead:false,productionFilesWritten:false,providerRequests:0,experimentCompleted:runs.every(r=>r.exitCode===0),ordinaryContextReached:runs.some(r=>r.observation?.marker==='ordinary-marker')};await writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
if(!evidence.experimentCompleted)process.exitCode=1;
