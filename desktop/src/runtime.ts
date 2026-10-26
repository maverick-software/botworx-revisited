import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,readFile,writeFile,access,readdir,copyFile,cp,unlink} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {randomUUID} from 'node:crypto';
import type {RuntimeStatus} from './contracts';
import {sendFiles,receiveBackup} from './transfer';
import {loadRuntimeBinding,type RuntimeBinding} from './runtime-binding';
import {recoveryStartup,completeRecoveryStartup} from './recovery-startup';
import {backupDirectory} from './backup-archives';
import {protectBackupFolder} from './backup-private-folder';
import {WorkspaceUpgradeReviewRequired} from './workspace-upgrade-pending';
const exec=promisify(execFile);
export const coreServices=['database','rest','auth','realtime','storage','functions'];
export function coreServicesReady(state:{runtime?:string;services?:{service:string;state:string;health:string|null}[]}){
 return state.runtime==='native'&&coreServices.every(name=>state.services?.some(service=>service.service===name&&service.state==='running'&&service.health==='healthy'));
}
export const linuxPath=(value:string)=>'/mnt/'+value[0].toLowerCase()+value.slice(2).replaceAll('\\','/');
// Homes are codex/<owner>/<provider>/<scope>. These exact inner directories
// are seeded again by the pinned executable; histories and custom skills stay.
export function nativeBackupEntry(base:string,source:string){const inner=path.relative(base,source).split(/[\\/]/).slice(3);return !['tmp','.tmp'].includes(inner[0])&&!(inner[0]==='skills'&&inner[1]==='.system');}
export function chromeBackupEntry(base:string,source:string){const parts=path.relative(base,source).split(/[\\/]/).filter(Boolean);return !parts.length||/^[a-f0-9-]{36}$/i.test(parts[0])&&(parts.length===1||parts[1]==='artifacts');}
export class Runtime {
 constructor(private resources:string,private data:string,private progress:(s:RuntimeStatus)=>void,private completeBackup?:(destination:string)=>Promise<unknown>){}
 state:RuntimeStatus={phase:'starting',message:'Checking Windows Subsystem for Linux…',ready:false};
 private maintenance=new Set<Promise<string>>();
 private backupTask?:Promise<string>;
 private binding?:Promise<RuntimeBinding>;private verified=false;
 private environment?:Record<string,string>;
 private selection(){return this.binding??=loadRuntimeBinding(this.data);}
 private notify(phase:string,message:string,ready=false){this.state={phase,message,ready,...(ready?{available:true}:{})};this.progress(this.state);}
 async wsl(args:string[],timeout=240000){
  try{const result=await exec('wsl.exe',args,{windowsHide:true,timeout,maxBuffer:16*1024*1024,encoding:'utf8'});
   return result.stdout.replaceAll('\0','').replace(/^\uFEFF/,'');
  }catch(error){const e=error as NodeJS.ErrnoException;throw new Error(`The Agentopia runtime command failed (${e.code??'timeout'}). Retry startup; if it repeats, export diagnostics. WSL setup may require a Windows restart.`);}
 }
 async command(args:string[],timeout=240000){const {distribution}=await this.selection();return this.wsl(['--distribution',distribution,'--user','agentopia','--cd','/home/agentopia/app','--exec',...args],timeout);}
 async send(files:{name:string;file:string}[],destination:string,root=false){return sendFiles(files,destination,root,(await this.selection()).distribution);}
 private async healthyEnvironment(){
  let state:any;try{state=JSON.parse(await this.command(['supabase','stack','status','--output-format','json']));}catch{throw new Error('Supabase returned an invalid runtime status. Retry startup.');}
  if(!coreServicesReady(state))throw new Error('The required local Supabase services did not become healthy. Export diagnostics and retry.');
  const health=await fetch(state.env.API_URL+'/auth/v1/health',{signal:AbortSignal.timeout(15000)});
  if(!health.ok)throw new Error('Local authentication is not ready. Choose Retry.');return state.env as Record<string,string>;
 }
 async connectionHealthy(){
  if(!this.verified||!this.environment?.API_URL)return false;
  const address=new URL(this.environment.API_URL);if(address.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(address.hostname))return false;
  try{const headers={apikey:this.environment.SERVICE_ROLE_KEY,Authorization:'Bearer '+this.environment.SERVICE_ROLE_KEY},rows=await Promise.all([fetch(new URL('/auth/v1/health',address),{signal:AbortSignal.timeout(2500)}),fetch(new URL('/rest/v1/agents?select=id&limit=0',address),{headers,signal:AbortSignal.timeout(2500)})]);return rows.every(row=>row.ok);}catch{return false;}
 }
 connectionState(available:boolean,message:string){this.state={...this.state,available,message};this.progress(this.state);}
 async reconnectExisting(){
  if(!this.verified||!this.state.ready||!this.environment)throw Error('Finish startup before reconnecting local services.');
  const {instanceId}=await this.selection();if(!instanceId)throw Error('Reopen Agentopia to verify this older runtime before reconnecting.');
  const previous=this.environment;
  const port=Number(new URL(previous.DB_URL).port);if(!Number.isSafeInteger(port)||port<1||port>65535)throw Error('The existing database port could not be verified.');
  const work=(async()=>{const result=JSON.parse(await this.command(['python3','/opt/agentopia/database_state.py','--resume-existing',instanceId,String(port)],360000));if(!result.success||result.coreServicesHealthy!==6)throw Error('The existing local services did not reconnect.');const current=await this.healthyEnvironment();for(const key of ['API_URL','DB_URL','SERVICE_ROLE_KEY','ANON_KEY'])if(current[key]!==previous[key])throw Error('The local connection identity changed. Reopen Agentopia before continuing.');})();
  const maintenance=work.then(()=>'');this.maintenance.add(maintenance);try{await maintenance;}finally{this.maintenance.delete(maintenance);}
 }
 async start():Promise<{env:Record<string,string>;accounts:number;recoveryOnly?:boolean}>{
  const recovery=await recoveryStartup(this.data);
  const binding=await this.selection(),distro=binding.distribution;this.verified=false;
  this.notify('prerequisite','Checking WSL 2…');
  let listing:string;
  try{listing=await this.wsl(['--list','--quiet']);}catch{throw new Error('WSL 2 is required. Enable virtualization and install Windows Subsystem for Linux, restart Windows if requested, then choose Retry.');}
  if(!listing.split(/\r?\n/).some(n=>n.trim()===distro)){
   if(binding.instanceId)throw new Error('The migrated Agentopia runtime is not registered. Restore the verified database copy before reopening this installation. The original runtime has been left untouched.');
   this.notify('installing','Creating your private Agentopia Linux runtime…');
   const archive=path.join(this.resources,'runtime.tar.gz');
   try{await access(archive);}catch{throw new Error('The bundled Linux runtime is missing. Reinstall Agentopia using the complete Windows installer.');}
   const expected=(await readFile(path.join(this.resources,'runtime.sha256'),'utf8')).trim();
   const hash=createHash('sha256');
   const {createReadStream}=await import('node:fs');
   for await(const chunk of createReadStream(archive))hash.update(chunk);
   if(hash.digest('hex')!==expected)throw new Error('The bundled runtime checksum failed. Download the installer again.');
   const target=path.join(this.data,'wsl');await mkdir(target,{recursive:true});
   await this.wsl(['--import',distro,target,archive,'--version','2'],600000);
  }
  let identity='';try{identity=(await this.command(['cat','/opt/agentopia/runtime-identity'])).trim();}catch{}
  if(identity!=='local.agentopia.desktop-runtime.v1')throw new Error('The selected WSL distribution could not be verified as an Agentopia installation. Its data has been left untouched.');
  if(binding.instanceId){let instance='';try{instance=(await this.command(['cat','/opt/agentopia/runtime-instance'])).trim();}catch{}if(instance!==binding.instanceId)throw new Error('This database copy does not match the installation’s runtime binding. Its data and the original runtime have been left untouched.');}
  this.verified=true;
  await this.send([
   {name:'config-template.toml',file:path.join(this.resources,'runtime/config.toml')},
   {name:'secure-runtime.py',file:path.join(this.resources,'runtime/secure-runtime.py')},
   {name:'database_state.py',file:path.join(this.resources,'runtime/database_state.py')},
  ],'/opt/agentopia',true);
  const keys=JSON.parse(await this.wsl(['--distribution',distro,'--user','root','--exec','python3','/opt/agentopia/secure-runtime.py']));
  if(keys.restartRequired)await this.command(['supabase','stop']);
  await this.command(['python3','/opt/agentopia/database_state.py']);
  this.notify('database','Starting PostgreSQL and Supabase services…');
  await this.command(['supabase','start','--runtime','native','--eager','--exclude','analytics,pooler,studio']);
  // Copy versioned maintenance resources on every upgrade; mutable database data stays in WSL.
  const migrations=(await readdir(path.join(this.resources,'database'))).filter(name=>/^\d{4}-[a-z0-9-]+\.sql$/.test(name)).sort();
  if(!migrations.includes('0001-baseline.sql'))throw new Error('The packaged database baseline is missing. Reinstall the complete application.');
  await this.send([
   ...migrations.map(name=>({name:'database/'+name,file:path.join(this.resources,'database',name)})),
   {name:'manage.py',file:path.join(this.resources,'runtime/manage.py')},
   {name:'voice.py',file:path.join(this.resources,'runtime/voice.py')},
  ],'/opt/agentopia',true);
  let importPending=false;
  try{await access(path.join(this.data,'migration-input','auth.dump'));await access(path.join(this.data,'migration-complete.json'));}catch{
   try{await access(path.join(this.data,'migration-input','auth.dump'));importPending=true;}catch{}
  }
  if(importPending){
   this.notify('migration','Restoring your existing accounts and database…');
   const input=path.join(this.data,'migration-input');
   const manifest=JSON.parse((await readFile(path.join(input,'manifest.json'),'utf8')).trim());
   const allowed=['auth.dump','application.dump','vault.dump','pgsodium_root.key','recovery.dump','database.dump'];
   const names=manifest.files.map((entry:{name:string})=>entry.name) as string[];
   if(!names.every(name=>allowed.includes(name))||new Set(names).size!==names.length)throw new Error('The migration manifest contains an invalid resource name.');
   await this.send([...names,'manifest.json'].map(name=>({name,file:path.join(input,name)})),'/home/agentopia/migration-input');
   await this.command(['python3','/opt/agentopia/manage.py','import','/home/agentopia/migration-input']);
   await writeFile(path.join(this.data,'migration-complete.json'),JSON.stringify({at:new Date().toISOString()}));
  }
  // A full recovery copy is made before applying a new application version.
  const version=(await readFile(path.join(this.resources,'version.json'),'utf8')).trim();
  let previous='';try{previous=await readFile(path.join(this.data,'schema-release.json'),'utf8');}catch{}
  if(previous && previous!==version)try{await this.backup('before-upgrade');}catch(error){
   if(!(error instanceof WorkspaceUpgradeReviewRequired))throw error;
   const env=await this.healthyEnvironment();
   this.state={phase:'workspace-review',message:'Review workspace recovery before finishing the upgrade. Agents and schedules remain paused.',ready:false,recoveryOnly:true};this.progress(this.state);
   return {env,accounts:0,recoveryOnly:true};
  }
  this.notify('schema','Checking database migrations and interrupted responses…');
  const info=JSON.parse(await this.command(['python3','/opt/agentopia/manage.py','provision']));
  await writeFile(path.join(this.data,'schema-release.json'),version);
  const env=await this.healthyEnvironment();
  this.environment=env;
  await completeRecoveryStartup(recovery);
  this.notify('ready','Your local database is ready.',true);
  return {env,accounts:info.accounts as number};
 }
 backup(label='manual'){
  if(this.backupTask)return Promise.reject(new Error('An installation backup is already running. Wait for it to finish.'));
  const work=this.createBackup(label);this.maintenance.add(work);
  this.backupTask=work;work.finally(()=>{this.maintenance.delete(work);if(this.backupTask===work)this.backupTask=undefined;}).catch(()=>{});return work;
 }
 databaseBackup(destination:string){
  const work=(async()=>{await mkdir(destination);const linux='/home/agentopia/backups/portable-'+randomUUID();await this.command(['python3','/opt/agentopia/manage.py','backup',linux]);await receiveBackup(linux,destination,(await this.selection()).distribution);return destination;})();this.maintenance.add(work);work.finally(()=>this.maintenance.delete(work)).catch(()=>{});return work;
 }
 private async createBackup(label:string){
  if(!/^[a-z0-9-]{1,40}$/i.test(label))throw Error('Use a valid installation backup label.');
  const name=new Date().toISOString().replaceAll(':','-')+'-'+label;
  const destination=path.join(this.data,'backups',name);
  await backupDirectory(this.data);const parent=path.dirname(destination);await mkdir(parent,{recursive:true});await backupDirectory(parent);await protectBackupFolder(parent);await mkdir(destination);await protectBackupFolder(destination);
  const incomplete=path.join(destination,'BACKUP-INCOMPLETE.txt');await writeFile(incomplete,'This installation backup is still being prepared. Keep the original profile.\r\n',{flag:'wx',mode:0o600});
  const linux='/home/agentopia/backups/'+name;
  await this.command(['python3','/opt/agentopia/manage.py','backup',linux]);
  await receiveBackup(linux,destination,(await this.selection()).distribution);
  await copyFile(path.join(this.resources,'runtime/Restore-Agentopia.ps1'),path.join(destination,'Restore-Agentopia.ps1'));
  for(const name of ['codex','workspaces','chrome-tools','draft-previews','editor-draft-journals']){try{const source=path.join(this.data,name);await access(source);await cp(source,path.join(destination,name),{recursive:true,filter:entry=>name==='codex'?nativeBackupEntry(source,entry):name==='draft-previews'&&path.relative(source,entry).split(path.sep)[0]==='codex'?nativeBackupEntry(path.join(source,'codex'),entry):name==='chrome-tools'?chromeBackupEntry(source,entry):true});}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}}
  await writeFile(path.join(destination,'NATIVE-RECOVERY.txt'),'The codex folder contains private native Codex session state, including its internal SQLite databases and rollouts. The workspaces folder contains Agentopia-managed scratch workspaces. With Agentopia closed, restore those folders into the original Windows profile Agentopia application-data directory alongside the restored PostgreSQL database. Provider connections must be reauthorized on a different Windows account. The chrome-tools folder includes saved Chrome artifacts; dedicated Chrome sign-ins and temporary upload copies are excluded and must be reconnected. External selected workspace folders need their own backups.\r\n');
  await writeFile(path.join(destination,'RECOVERY.txt'),
   'Agentopia database recovery\r\n\r\nKeep this entire folder private. It contains account password hashes and the database encryption root.\r\n\r\nOn a fresh Windows user profile or another Windows 11 computer, prepare WSL 2. Before installing or launching Agentopia, open PowerShell in this folder and run:\r\n\r\npowershell -NoProfile -ExecutionPolicy Bypass -File .\\Restore-Agentopia.ps1\r\n\r\nThen install and launch Agentopia. Accounts, passwords, roles, agents, and text conversations will be restored. Reconnect AI providers on the new Windows account. The recovery helper preserves existing runtimes by refusing to overwrite them.\r\n');
  if(this.completeBackup){this.notify('backup','Saving complete workspace recovery before the upgrade…');await this.completeBackup(destination);}
  await unlink(incomplete);return destination;
 }
 async stop(){await Promise.allSettled([...this.maintenance]);if(!this.verified)return;const {distribution}=await this.selection();await this.command(['supabase','stop'],45000);await this.wsl(['--terminate',distribution],15000);this.verified=false;}
}
