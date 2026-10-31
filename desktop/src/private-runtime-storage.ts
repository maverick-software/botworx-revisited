import path from 'node:path';
import {realpath} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {privateStorageDistribution} from './runtime-binding';

const exec=promisify(execFile);
const invalid=()=>new Error('Sylvana could not verify its registered private runtime storage. Existing data has been left untouched.');
export function localRuntimeStoragePath(value:unknown):string{
 if(typeof value!=='string'||!value||value.length>4000||/[\x00-\x1f\x7f]/.test(value))throw invalid();
 const raw=value.replaceAll('/','\\').replace(/^\\\\\?\\(?=[a-z]:\\)/i,'');
 if(!/^[a-z]:\\/i.test(raw)&&!/^\\\\\?\\Volume\{[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\}\\/i.test(raw))throw invalid();
 const normalized=path.win32.normalize(raw),root=path.win32.parse(normalized).root;
 if(normalized===root||normalized.slice(root.length).includes(':'))throw invalid();
 return normalized.replace(/\\+$/,'');
}
export function privateRuntimeStoragePaths(value:unknown):string[]{
 if(!Array.isArray(value)||value.length>512)throw invalid();
 const result=new Map<string,string>();
 for(const row of value){
  if(!row||typeof row!=='object'||!privateStorageDistribution(row.name))continue;
  if(row.version!==1&&row.version!==2)throw invalid();
  const directory=localRuntimeStoragePath(row.path);result.set(directory.toLowerCase(),directory);
 }
 return [...result.values()];
}
async function readRegisteredStorage():Promise<unknown>{
 const query="$ErrorActionPreference='Stop';$OutputEncoding=[Console]::OutputEncoding=[Text.UTF8Encoding]::new();$taskRuntimeRows=@(if(Test-Path -LiteralPath 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Lxss'){Get-ChildItem -LiteralPath 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Lxss'|ForEach-Object {$taskRuntime=Get-ItemProperty -LiteralPath $_.PSPath;[pscustomobject]@{name=$taskRuntime.DistributionName;path=$taskRuntime.BasePath;version=$taskRuntime.Version}}});ConvertTo-Json -InputObject $taskRuntimeRows -Compress";
 const powershell=path.win32.join(process.env.SystemRoot??'C:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
 try{const result=await exec(powershell,['-NoProfile','-NonInteractive','-Command',query],{windowsHide:true,encoding:'utf8',timeout:15000,maxBuffer:1024*1024});return JSON.parse(result.stdout.replace(/^\uFEFF/,''));}catch{throw invalid();}
}
export async function registeredPrivateRuntimeStorage(options:{platform?:NodeJS.Platform;read?:()=>Promise<unknown>;canonical?:(directory:string)=>Promise<string>}={}):Promise<string[]>{
 if((options.platform??process.platform)!=='win32')return [];
 const logical=privateRuntimeStoragePaths(await (options.read??readRegisteredStorage)()),result=new Map(logical.map(value=>[value.toLowerCase(),value]));
 for(const directory of logical){
  try{const canonical=localRuntimeStoragePath(await (options.canonical??realpath)(directory));result.set(canonical.toLowerCase(),canonical);}
  catch(error){if(!['ENOENT','ENOTDIR'].includes((error as NodeJS.ErrnoException).code??''))throw invalid();}
 }
 return [...result.values()];
}
