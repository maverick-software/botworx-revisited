import {safeStorage} from 'electron';
import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import path from 'node:path';
const persisted=(value:unknown):string|undefined=>JSON.stringify(value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
export class Secrets {
 private values:Record<string,unknown>={};
 private writing:Promise<void>=Promise.resolve();
 constructor(private directory:string){}
 async load(){
  if(!safeStorage.isEncryptionAvailable())throw new Error('Windows credential encryption is unavailable. Sign in to Windows and retry.');
  try{this.values=JSON.parse(safeStorage.decryptString(await readFile(path.join(this.directory,'credentials.bin'))));}
  catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw new Error('Saved credentials could not be decrypted for this Windows account. Restore the original Windows account or remove the credential file to reconnect.');}
 }
 get<T>(key:string):T|undefined{return this.values[key] as T|undefined;}
 creationCredentialJournalIds(owner:string){
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(owner))throw Error('Choose a canonical connection owner.');const prefix='mcp-creation-handoff:'+owner+':';return Object.keys(this.values).filter(key=>key.startsWith(prefix)).map(key=>{const id=key.slice(prefix.length);if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id))throw Error('A retained connection handoff identity is invalid.');return id;});
 }
 creationOAuthConnectionIds(owner:string,principal:string){
  for(const id of [owner,principal])if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id))throw Error('Choose a canonical creation connection identity.');const prefix='mcp-oauth-creation:'+owner+':'+principal+':';return Object.keys(this.values).filter(key=>key.startsWith(prefix)).map(key=>{const id=key.slice(prefix.length);if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id))throw Error('A retained creation connection identity is invalid.');return id;});
 }
 scheduledWorkspaceIds(owner:string){
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(owner))throw Error('Choose a valid workspace account.');
  const prefix='scheduled-workspace:'+owner+':';
  return Object.keys(this.values).filter(key=>key.startsWith(prefix)).map(key=>{const run=key.slice(prefix.length);if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(run))throw Error('A saved scheduled workspace identity is invalid.');return run;});
 }
 scheduledWorkspaceRecoveryIds(owner:string){
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(owner))throw Error('Choose a valid recovery account.');
  const prefix='scheduled-workspace-recovery:'+owner+':';return Object.keys(this.values).filter(key=>key.startsWith(prefix)).map(key=>{const id=key.slice(prefix.length);if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id))throw Error('A saved recovery identity is invalid.');return id;});
 }
 workspaceImportIds(owner:string){
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(owner))throw Error('Choose a valid workspace recovery account.');const prefix='scheduled-workspace-import:'+owner+':';return Object.keys(this.values).filter(key=>key.startsWith(prefix)).map(key=>{const id=key.slice(prefix.length);if(!/^[a-f0-9]{64}$/.test(id))throw Error('A saved workspace import identity is invalid.');return id;});
 }
 workspaceLayouts(owner:string):Record<string,unknown>{
  if(!/^[a-f0-9-]{36}$/i.test(owner))throw Error('Choose a valid layout account.');const prefix='panes:'+owner+':',result:Record<string,unknown>={};
  for(const [key,value]of Object.entries(this.values))if(key.startsWith(prefix)){const scope=key.slice(prefix.length);if(scope!=='home'&&!/^[a-f0-9-]{36}$/i.test(scope))throw Error('Invalid saved workspace scope.');result[scope]=structuredClone(value);}return result;
 }
 set(key:string,value:unknown){
  return this.setMany([[key,value]]);
 }
 setMany(entries:readonly (readonly [string,unknown])[]){
  const keys=new Set<string>();for(const [key]of entries){if(typeof key!=='string'||!key||keys.has(key))throw new Error('Invalid saved-setting transaction.');keys.add(key);}
  const changes=entries.map(([key,value])=>[key,value] as const);
  const operation=this.writing.then(()=>this.write(changes));
  this.writing=operation.catch(()=>{});return operation;
 }
 compareAndSetMany(entries:readonly (readonly [string,unknown]|readonly [string,unknown,unknown])[]){
  const keys=new Set<string>();for(const [key]of entries){if(typeof key!=='string'||!key||keys.has(key))throw new Error('Invalid saved-setting comparison transaction.');keys.add(key);}
  const changes=entries.map(entry=>({key:entry[0],expected:persisted(entry[1]),write:entry.length===3,value:entry.length===3?structuredClone(entry[2]):undefined}));
  const operation=this.writing.then(async()=>{if(changes.some(change=>persisted(this.values[change.key])!==change.expected))return false;const writes=changes.filter(change=>change.write);if(writes.length)await this.write(writes.map(change=>[change.key,change.value] as const));return true;});
  this.writing=operation.then(()=>{},()=>{});return operation;
 }
 private async write(entries:readonly (readonly [string,unknown])[]){
  const next={...this.values};for(const [key,value]of entries){if(value===undefined)delete next[key];else next[key]=value;}
  await mkdir(this.directory,{recursive:true});
  const target=path.join(this.directory,'credentials.bin');
  await writeFile(target+'.tmp',safeStorage.encryptString(JSON.stringify(next)),{mode:0o600});
  await rename(target+'.tmp',target);this.values=next;
 }
}
