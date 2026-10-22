import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile,writeFile,mkdir,cp,symlink,readdir,lstat} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {build} from 'vite';
import {desktopOperation} from './operation-lock.mjs';
import {hash,json} from './phased-backup-control.mjs';
desktopOperation('prepare agent directory and home against verified installed66');
const root=path.resolve(import.meta.dirname,'../..'),baseFile=process.argv[2]??(await json(path.join(root,'.supabase/desktop-agent-automations66/current.json'))).proof,base=await json(baseFile),installed=await json(path.join(base.out,'installed.json'));
assert(installed.success);assert.equal(base.version,'0.44.66');assert.equal(await hash('C:/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.66/resources/app.asar'),base.baseImageSha256);
const records=path.join(root,'.supabase/desktop-agent-directory66'),out=path.join(records,String(Date.now())),source=path.join(out,'source/desktop'),ui=path.join(out,'ui'),changes=['ui/AgentDirectory.tsx','ui/agent-directory.css','ui/WorkspaceViews.tsx','ui/DesktopApp.tsx','ui/AgentSettings.tsx','ui/AgentMemoryPanel.tsx','ui/useChatDrafts.ts','src/startup-location.ts'];
await mkdir(source,{recursive:true});for(const name of ['ui','src','vite.config.mjs','presentation-renderer-patch.mjs'])await cp(path.join(base.source,name),path.join(source,name),{recursive:true});await symlink(path.join(root,'node_modules'),path.join(out,'source/node_modules'),'junction');
const sourceHashes={...base.sourceHashes};for(const [name,digest]of Object.entries(sourceHashes))assert.equal(await hash(path.join(source,name)),digest,name);
for(const name of changes){
 if(name==='ui/DesktopApp.tsx'){
  // Source67's recovery bootstrap is not part of this renderer update to backend66.
  let app=(await readFile(path.join(root,'desktop',name),'utf8')).replace(/\r\n/g,'\n');
  for(const text of ["import {WorkspaceImportRecovery} from './WorkspaceImportRecovery';\n","import {UpgradeRecoveryScreen} from './UpgradeRecoveryScreen';\n","import type {WorkspaceImportStatus} from '../src/workspace-import-contracts';\n"," const [workspaceRecovery,setWorkspaceRecovery]=useState<WorkspaceImportStatus|null>(null);\n","recovery?:WorkspaceImportStatus;","setWorkspaceRecovery(state.recovery??null);"]){assert(app.includes(text),text);app=app.replace(text,'');}
  const startup="{runtime.recoveryOnly?<UpgradeRecoveryScreen/>:<StartupScreen runtime={runtime}/>}";assert(app.includes(startup));app=app.replace(startup,'<StartupScreen runtime={runtime}/>');
  const recovery="!identity?workspaceRecovery?<WorkspaceImportRecovery status={workspaceRecovery} changed={authState} signOut={async()=>{await call('auth.signOut');setWorkspaceRecovery(null);await authState();}}/>:<Auth";assert(app.includes(recovery));app=app.replace(recovery,'!identity?<Auth');assert(!app.includes('WorkspaceImportRecovery')&&!app.includes('WorkspaceImportStatus'));await writeFile(path.join(source,name),app);
 }else await cp(path.join(root,'desktop',name),path.join(source,name));
 sourceHashes[name]=await hash(path.join(source,name));
}
await promisify(execFile)(process.execPath,['node_modules/typescript/bin/tsc','-p',path.join(source,'ui/tsconfig.json')],{cwd:root,windowsHide:true,timeout:120000,maxBuffer:1024*1024});await build({configFile:path.join(source,'vite.config.mjs'),build:{outDir:ui}});
const uiFiles={};for(const name of await readdir(ui,{recursive:true})){const file=path.join(ui,name),info=await lstat(file);assert(!info.isSymbolicLink());if(info.isFile())uiFiles[name.replaceAll('\\','/')]=await hash(file);}
const proof={success:true,at:new Date().toISOString(),out,source,sourceHashes,changes,ui,uiFiles,baseImageSha256:base.baseImageSha256,baseUiFiles:installed.uiFiles,baseProof:baseFile,version:base.version,providerRequests:0,databaseWrites:0,backendChanges:[],installed:false};
await writeFile(path.join(out,'proof.json'),JSON.stringify(proof,null,2),{flag:'wx'});await writeFile(path.join(records,'current.json'),JSON.stringify({out,proof:path.join(out,'proof.json')},null,2));console.log(JSON.stringify({success:true,out,changes,backendChanges:[]}));
