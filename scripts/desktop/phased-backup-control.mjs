import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createReadStream} from 'node:fs';
import {readFile,writeFile,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
const exec=promisify(execFile);
export const json=async file=>JSON.parse(await readFile(file,'utf8'));
export const linux=value=>'/mnt/'+value[0].toLowerCase()+value.slice(2).replaceAll('\\','/');
export const hash=async file=>{const h=createHash('sha256');for await(const bytes of createReadStream(file))h.update(bytes);return h.digest('hex');};
export async function save(file,value){const temporary=file+'.'+process.pid+'.tmp';await writeFile(temporary,JSON.stringify(value,null,2));await rename(temporary,file);}
const decode=bytes=>(bytes.includes(0)?bytes.toString('utf16le'):bytes.toString('utf8')).replace(/^\uFEFF/,'').trim();
export const run=async(args,timeout=60000)=>{try{return decode((await exec('wsl.exe',args,{windowsHide:true,encoding:'buffer',timeout,maxBuffer:8*1024*1024})).stdout);}catch(error){throw Error('WSL operation failed: '+decode(Buffer.concat([error.stdout??Buffer.alloc(0),error.stderr??Buffer.alloc(0)])).slice(0,4000),{cause:error});}};
export const list=async running=>(await run(['--list',...(running?['--running']:[]),'--quiet'])).split(/\r?\n/).map(s=>s.trim()).filter(Boolean).sort();
export async function closed(){assert.equal((await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command','@(Get-Process Agentopia,AgentopiaSetup -ErrorAction SilentlyContinue | Where-Object { $_.HasExited -ne $true }).Count'],{encoding:'utf8',windowsHide:true})).stdout.trim(),'0','The existing application must remain normally closed.');}
const normalized=value=>path.win32.normalize(value.replace(/^\\\\\?\\/,'')).toLowerCase();
export function validateReader(found,config,out){
 assert(/^AgentopiaBackupReader-[a-f0-9-]{36}$/.test(config.reader.distribution));
 assert.equal(found.name,config.reader.distribution);assert.equal(found.version,2);
 assert.equal(normalized(config.reader.storage),normalized(path.join(out,'reader-runtime')));
 assert.equal(normalized(found.path),normalized(config.reader.storage));
 assert(normalized(found.path).startsWith(normalized(out)+path.sep));
}
export async function registration(name){
 assert(/^(AgentopiaRuntime|AgentopiaBackupReader)-[a-f0-9-]{36}$/.test(name));
 const query="$OutputEncoding=[Console]::OutputEncoding=[Text.UTF8Encoding]::new();Get-ChildItem 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Lxss'|ForEach-Object {$r=Get-ItemProperty -LiteralPath $_.PSPath;if($r.DistributionName -eq '"+name+"'){@{name=$r.DistributionName;path=$r.BasePath;version=$r.Version}|ConvertTo-Json -Compress}}";
 return JSON.parse((await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command',query],{encoding:'utf8',windowsHide:true})).stdout);
}
export async function readerRegistration(config,out){const found=await registration(config.reader.distribution);validateReader(found,config,out);return found;}
export async function removeReader(config,out){
 await readerRegistration(config,out);
 if((await list(true)).includes(config.reader.distribution)){await run(['--terminate',config.reader.distribution]);await new Promise(resolve=>setTimeout(resolve,2000));}
 await readerRegistration(config,out);await run(['--unregister',config.reader.distribution],120000);
 assert(!(await list(false)).includes(config.reader.distribution));
}
export function controlSelfTest(){
 const out='D:\\Users\\charl\\software\\Agentopia\\.supabase\\desktop-installed-0448\\physical-backup-1792300000000';
 const name='AgentopiaBackupReader-11111111-1111-4111-8111-111111111111';
 const config={reader:{distribution:name,storage:path.join(out,'reader-runtime')}};
 validateReader({name,path:config.reader.storage,version:2},config,out);
 assert.throws(()=>validateReader({name:'AgentopiaRuntime-11111111-1111-4111-8111-111111111111',path:config.reader.storage,version:2},config,out));
 assert.throws(()=>validateReader({name,path:path.join(out,'../other/runtime'),version:2},config,out));
 assert.throws(()=>validateReader({name,path:config.reader.storage,version:1},config,out));
 assert.throws(()=>validateReader({name,path:config.reader.storage,version:2},{reader:{...config.reader,distribution:'AgentopiaRuntime'}},out));
 return {success:true,checks:5,scope:'Owned reader cleanup accepts its exact WSL2 registration and refuses production names, other storage, WSL1 and the retained distribution.'};
}
