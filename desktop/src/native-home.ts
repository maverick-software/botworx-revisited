import {createHash,randomUUID} from 'node:crypto';
import {createReadStream,constants} from 'node:fs';
import {mkdir,lstat,readFile,readdir,writeFile,copyFile,realpath,rename} from 'node:fs/promises';
import path from 'node:path';
import {rebaseNativeHome} from './native-home-rebase';

const pending=new Map<string,Promise<string>>(),maximumHome=210;
type Binding={format:1;owner:string;provider:string;scope:string};
const missing=(error:unknown)=>(error as NodeJS.ErrnoException).code==='ENOENT';
async function hash(file:string){const value=createHash('sha256');for await(const chunk of createReadStream(file))value.update(chunk);return value.digest('hex');}
async function exists(file:string){try{return await lstat(file);}catch(error){if(missing(error))return;throw error;}}
function selected(relative:string){const parts=relative.split(path.sep);return !['tmp','.tmp'].includes(parts[0])&&!(parts[0]==='skills'&&parts[1]==='.system');}
async function inventory(root:string){
 const records:Record<string,{directory:boolean;sha256?:string}>={};if(!await exists(root))return records;
 async function visit(directory:string){for(const name of (await readdir(directory)).sort()){const file=path.join(directory,name),relative=path.relative(root,file);if(!selected(relative))continue;const info=await lstat(file);if(info.isSymbolicLink()||!info.isDirectory()&&!info.isFile())throw new Error('Native history contains a linked or unsupported file. Its original data has been retained.');records[relative]={directory:info.isDirectory(),...(info.isFile()?{sha256:await hash(file)}:{})};if(info.isDirectory())await visit(file);}}
 await visit(root);return records;
}
function same(left:unknown,right:unknown){return JSON.stringify(left)===JSON.stringify(right);}
async function checkedDirectory(directory:string,physicalRoot:string){
 const before=await exists(directory);if(before?.isSymbolicLink()||before&&!before.isDirectory())throw new Error('The native state directory is linked or unavailable.');await mkdir(directory,{recursive:true});const actual=await realpath(directory),relative=path.relative(physicalRoot,actual);
 if((await lstat(directory)).isSymbolicLink()||relative.startsWith('..')||path.isAbsolute(relative))throw new Error('The native state directory resolves outside this Sylvana profile.');
 return actual;
}

/** Keep existing ordinary homes. Compact only paths the bundled Windows state
 * database cannot open. The existing three-level backup layout stays intact. */
export async function nativeHome(directory:string,owner:string,provider:string,scope:string,resources?:string,platform=process.platform):Promise<string>{
 if(!/^[a-f0-9-]{36}$/i.test(owner)||!['openai-oauth','openrouter','openai-api','sylvana'].includes(provider)||!scope||scope.length>200||!/^[a-z0-9-]+$/i.test(scope))throw new Error('Invalid native state scope.');
 const legacy=path.join(directory,'codex',owner,provider,scope);
 await mkdir(directory,{recursive:true});const physicalRoot=await realpath(directory),physicalLegacy=path.join(physicalRoot,'codex',owner,provider,scope);
 const binding:Binding={format:1,owner,provider,scope},key=createHash('sha256').update(JSON.stringify(binding)).digest('hex').slice(0,32);
 const compact=path.join(directory,'codex','_',provider,key),physicalCompact=path.join(physicalRoot,'codex','_',provider,key);
 const adopted=await exists(compact);if(!adopted&&(platform!=='win32'||physicalLegacy.length<=maximumHome)){
  let parent=directory;for(const segment of ['codex',owner,provider,scope]){parent=path.join(parent,segment);await checkedDirectory(parent,physicalRoot);}return legacy;
 }
 if(platform==='win32'&&physicalCompact.length>maximumHome)throw new Error('The Windows Sylvana profile path is too long for the bundled Codex state database. Use a shorter profile location. Existing native history has been retained.');
 const existing=pending.get(physicalCompact);if(existing)return existing;
 const task=(async()=>{
  let parent=directory;for(const segment of ['codex','_',provider]){parent=path.join(parent,segment);await checkedDirectory(parent,physicalRoot);}
  const verify=async()=>{await checkedDirectory(compact,physicalRoot);const metadata=path.join(compact,'.sylvana-scope.json');if((await lstat(metadata)).isSymbolicLink()||!same(JSON.parse(await readFile(metadata,'utf8')),binding))throw new Error('The compact native state belongs to a different account or conversation. Its data has been retained.');return compact;};
  if(await exists(compact))return verify();
  const source=await exists(legacy);if(source?.isSymbolicLink()||source&&!source.isDirectory())throw new Error('The original native history is linked or unavailable. Its data has been retained.');
  if(source){const actual=await realpath(legacy);if(actual!==physicalLegacy)throw new Error('The original native history resolves elsewhere. Its data has been retained.');}
  const recovery=path.join(directory,'native-recovery');await checkedDirectory(recovery,physicalRoot);
  const before=await inventory(legacy);
  if(!before['state_5.sqlite']&&Object.entries(before).some(([name,record])=>!record.directory&&(['sessions','archived_sessions'].includes(name.split(path.sep)[0])||/^(state_|thread_history_|session_index\.)/.test(path.basename(name)))))throw new Error('The original native history has saved records without its index. Its files have been retained for recovery.');
  const stage=path.join(recovery,randomUUID().slice(0,8));await mkdir(stage);
  for(const [name,record] of Object.entries(before)){
   const target=path.join(stage,name);if(record.directory)await mkdir(target,{recursive:true});else{await mkdir(path.dirname(target),{recursive:true});await copyFile(path.join(legacy,name),target,constants.COPYFILE_EXCL);if(await hash(target)!==record.sha256)throw new Error('Native history copy verification failed. Original and partial copies have been retained.');}
  }
  if(!same(await inventory(legacy),before)||!same(await inventory(stage),before))throw new Error('Native history changed during relocation. Original and partial copies have been retained.');
  await rebaseNativeHome(stage,compact,legacy,physicalLegacy,resources);
  if(!same(await inventory(legacy),before))throw new Error('Original native history changed during index repair. Both copies have been retained.');
  await writeFile(path.join(stage,'.sylvana-scope.json'),JSON.stringify(binding),{flag:'wx',mode:0o600});
  try{await rename(stage,compact);}catch(error){if(!['EEXIST','ENOTEMPTY','EPERM'].includes((error as NodeJS.ErrnoException).code??'')||!await exists(compact))throw error;}
  return verify();
 })();pending.set(physicalCompact,task);void task.finally(()=>pending.delete(physicalCompact)).catch(()=>{});return task;
}
