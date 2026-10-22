import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {lstat,readFile,realpath} from 'node:fs/promises';
import path from 'node:path';
import codeTools from './code-tool-manifest.json';
import scripts from './script-runtime-manifest.json';

const lookbackMs=30*60*1000;
type ProtectionEvent={eventId:number;at:string;process:string;target:string};
type Evidence={at:string;program:string};
export type WorkspaceAccessDiagnostic={status:'blocked'|'no_matching_event'|'unavailable'|'unsupported';message:string;checkedAt:string;readOnly:true;provesWritable:false;evidence:Evidence[]};
const messages={blocked:'Windows Controlled Folder Access blocked bundled command tools in this selected folder. Stop repeated writes. Choose a writable workspace or review Windows protection manually; this diagnostic changes no protection settings.',no_matching_event:'No recent matching Windows protection event was found. This does not establish that the folder is writable. Inspect the original error before retrying.',unavailable:'Windows protection events could not be checked. Inspect the original error; no permission or protection setting was changed.',unsupported:'Windows protection diagnostics are available only on Windows.'};
const normalized=(value:string)=>path.win32.normalize(value.replace(/^\\\\\?\\(?=[a-z]:\\)/i,'')).replace(/\\+$/,'').toLowerCase();
function localAbsolute(value:unknown):value is string{return typeof value==='string'&&value.length>3&&value.length<=4096&&!/[\x00-\x1f]/.test(value)&&/^[a-z]:[\\/]/i.test(value.replace(/^\\\\\?\\/,''));}
export function protectionEvidence(root:string,input:unknown,processes:string[],now=Date.now(),allowedRelative:(value:string)=>boolean=()=>true):Evidence[]{
 if(!localAbsolute(root)||normalized(root).length<=2||!Array.isArray(input)||input.length>256)return [];
 const folder=normalized(root),allowed=new Set(processes.filter(localAbsolute).map(normalized)),found=new Map<string,Evidence>();
 for(const value of input){
  const row=value as Partial<ProtectionEvent>;if(!row||row.eventId!==1123||!localAbsolute(row.process)||!localAbsolute(row.target)||!allowed.has(normalized(row.process)))continue;
  const at=typeof row.at==='string'?Date.parse(row.at):NaN;if(!Number.isFinite(at)||at<now-lookbackMs||at>now+10000)continue;
  const target=normalized(row.target);if(target!==folder&&!target.startsWith(folder+'\\'))continue;
  const relative=path.win32.relative(folder,target);if(!allowedRelative(relative))continue;
  const evidence={at:new Date(at).toISOString(),program:path.win32.basename(row.process)};found.set(evidence.at+'|'+evidence.program,evidence);if(found.size===8)break;
 }
 return [...found.values()];
}

// Only a fixed, read-only event query runs. The selected path is JSON on stdin,
// never PowerShell source. OS known folders resolve Defender's Documents alias.
export const protectionQuery=String.raw`
$ErrorActionPreference='Stop'
try {
 $policy=[Console]::In.ReadToEnd() | ConvertFrom-Json
 function Resolve-LoggedPath([string]$value) {
  if(!$value){return $null}
  $match=[regex]::Match($value,'(?i)^%userprofile%\\(Documents|Desktop|Pictures|Music|Videos)(\\|$)')
  if($match.Success) {
   $known=@{Documents='MyDocuments';Desktop='DesktopDirectory';Pictures='MyPictures';Music='MyMusic';Videos='MyVideos'}
   $base=[Environment]::GetFolderPath($known[$match.Groups[1].Value])
   if(!$base){return $null}
   $value=$base+$value.Substring($match.Groups[0].Length-$(if($match.Groups[2].Value){1}else{0}))
  }
  return [IO.Path]::GetFullPath([Environment]::ExpandEnvironmentVariables($value)).TrimEnd('\')
 }
 $root=Resolve-LoggedPath ([string]$policy.root)
 $programs=@($policy.processes | ForEach-Object {Resolve-LoggedPath ([string]$_)})
 try {$events=@(Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-Windows Defender/Operational';Id=1123;StartTime=((Get-Date).AddMinutes(-30))} -MaxEvents 256 -ErrorAction Stop)}
 catch {if($_.FullyQualifiedErrorId -like 'NoMatchingEventsFound*'){$events=@()}else{throw}}
 $scopedEvents=@()
 foreach($event in $events) {
  $xml=[xml]$event.ToXml();$values=@{}
  foreach($field in $xml.Event.EventData.Data){$values[[string]$field.Name]=[string]$field.'#text'}
  $target=Resolve-LoggedPath $values['Path'];$process=Resolve-LoggedPath $values['Process Name']
  if(!$target -or !$process -or $programs -notcontains $process){continue}
  if(!$target.Equals($root,[StringComparison]::OrdinalIgnoreCase) -and !$target.StartsWith($root+'\',[StringComparison]::OrdinalIgnoreCase)){continue}
  $scopedEvents+=@{eventId=1123;at=$event.TimeCreated.ToUniversalTime().ToString('o');process=$process;target=$target}
  if($scopedEvents.Count -ge 32){break}
 }
 @{available=$true;events=@($scopedEvents)} | ConvertTo-Json -Depth 4 -Compress
} catch { '{"available":false,"events":[]}' }
`;

type Query={root:string;processes:string[]};
type Options={platform?:string;now?:()=>number;reader?:(query:Query,signal?:AbortSignal)=>Promise<unknown>};
export class WorkspaceAccessDiagnostics{
 private platform:string;private now:()=>number;private reader:(query:Query,signal?:AbortSignal)=>Promise<unknown>;private powershell:string;private processes:string[];
 constructor(resources:string,options:Options={}){
  this.platform=options.platform??process.platform;this.now=options.now??Date.now;
  this.powershell=path.resolve(resources,codeTools.powershell.directory,codeTools.powershell.entry);
  this.processes=[this.powershell,...[scripts.node,scripts.python].map(runtime=>path.resolve(resources,'script-runtimes',runtime.directory,runtime.entry))];
  this.reader=options.reader??((query,signal)=>this.query(query,signal));
 }
 private async query(query:Query,signal?:AbortSignal):Promise<unknown>{
  const relative=codeTools.powershell.directory+'/'+codeTools.powershell.entry,stat=await lstat(this.powershell),actual=await realpath(this.powershell);
  if(!stat.isFile()||stat.isSymbolicLink()||normalized(actual)!==normalized(this.powershell)||createHash('sha256').update(await readFile(actual)).digest('hex')!==codeTools.files[relative as keyof typeof codeTools.files])throw Error('The bundled diagnostic runtime changed.');
  signal?.throwIfAborted();return new Promise((resolve,reject)=>{
   const child=spawn(this.powershell,['-NoLogo','-NoProfile','-NonInteractive','-Command',protectionQuery],{windowsHide:true,stdio:['pipe','pipe','ignore'],signal});let output='',oversized=false;
   const timer=setTimeout(()=>child.kill(),4000);timer.unref();
   child.stdin.on('error',()=>{});child.stdout.on('data',chunk=>{output+=chunk.toString('utf8');if(Buffer.byteLength(output)>96*1024){oversized=true;child.kill();}});
   child.once('error',error=>{clearTimeout(timer);reject(error);});child.once('close',code=>{clearTimeout(timer);if(code!==0||oversized)return reject(Error('Windows protection query unavailable.'));try{resolve(JSON.parse(output.replace(/^\uFEFF/,'')));}catch{reject(Error('Windows protection query unavailable.'));}});
   child.stdin.end(JSON.stringify(query));
  });
 }
 async inspect(root:string,signal?:AbortSignal,allowedRelative:(value:string)=>boolean=()=>true):Promise<WorkspaceAccessDiagnostic>{
  signal?.throwIfAborted();const now=this.now(),checkedAt=new Date(now).toISOString();
  const result=(status:WorkspaceAccessDiagnostic['status'],evidence:Evidence[]=[]):WorkspaceAccessDiagnostic=>({status,message:messages[status],checkedAt,readOnly:true,provesWritable:false,evidence});
  if(this.platform!=='win32')return result('unsupported');if(!localAbsolute(root)||normalized(root).length<=2)return result('unavailable');
  try{const payload=await this.reader({root,processes:this.processes},signal) as {available?:unknown;events?:unknown};signal?.throwIfAborted();if(payload?.available!==true||!Array.isArray(payload.events)||payload.events.length>256)return result('unavailable');const evidence=protectionEvidence(root,payload.events,this.processes,now,allowedRelative);return result(evidence.length?'blocked':'no_matching_event',evidence);}
  catch(error){if(signal?.aborted)throw signal.reason??error;return result('unavailable');}
 }
}
