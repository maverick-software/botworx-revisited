// Finish the narrow-window correction before this candidate is qualified.
import assert from 'node:assert/strict';
import {readFile,writeFile,readdir,lstat,copyFile,mkdir,unlink} from 'node:fs/promises';
import path from 'node:path';
import {build} from 'vite';
import {desktopOperation} from './operation-lock.mjs';
import {hash,json} from './phased-backup-control.mjs';
desktopOperation('finish unqualified56 narrow-window catalog layout');
const root=path.resolve(import.meta.dirname,'../..'),pointerFile=path.join(root,'.supabase/desktop-composio-release56/current.json'),pointer=await json(pointerFile),prior=await json(pointer.proof);
assert(prior.success&&prior.version==='0.44.56'&&!prior.eligibleForProductionInstallation);
assert.equal(path.dirname(prior.out),path.join(root,'.supabase/desktop-composio-release56'));
assert.equal(await hash(prior.image),prior.imageSha256);
try{await lstat(path.join(prior.out,'qualification.json'));throw Error('A qualified candidate cannot be edited');}catch(error){assert.equal(error.code,'ENOENT');}
const changed=[];for(const [name,digest]of Object.entries(prior.sourceHashes))if(await hash(path.join(root,'desktop',name))!==digest)changed.push(name);
assert.deepEqual(changed,['ui/plugin-catalog.css']);
await copyFile(path.join(root,'desktop/ui/plugin-catalog.css'),path.join(prior.source,'ui/plugin-catalog.css'));
await build({configFile:path.join(prior.source,'vite.config.mjs'),logLevel:'warn'});
const ui=path.join(prior.assets,'ui');assert.equal(ui,path.join(prior.program,'resources/resources/ui'));
for(const name of Object.keys(prior.uiFiles)){const file=path.resolve(ui,name);assert(file.startsWith(ui+path.sep));const info=await lstat(file);assert(info.isFile()&&!info.isSymbolicLink());await unlink(file);}
const uiFiles={};for(const name of await readdir(path.join(prior.source,'resources/ui'),{recursive:true})){const from=path.join(prior.source,'resources/ui',name),info=await lstat(from);assert(!info.isSymbolicLink());if(!info.isFile())continue;const to=path.join(ui,name);await mkdir(path.dirname(to),{recursive:true});await copyFile(from,to);uiFiles[name.replaceAll('\\','/')]=await hash(to);}
const resourceFiles=Object.fromEntries(Object.entries(prior.resourceFiles).filter(([name])=>!name.startsWith('ui/')));for(const [name,digest]of Object.entries(uiFiles))resourceFiles['ui/'+name]=digest;
const proof={...prior,at:new Date().toISOString(),sourceHashes:{...prior.sourceHashes,'ui/plugin-catalog.css':await hash(path.join(prior.source,'ui/plugin-catalog.css'))},uiFiles,resourceFiles,narrowLayoutCorrection:{priorProof:pointer.proof,changes:changed,beforeQualification:true}};
const file=path.join(prior.out,'package-proof-layout.json');await writeFile(file,JSON.stringify(proof,null,2),{flag:'wx'});await writeFile(pointerFile,JSON.stringify({...pointer,proof:file},null,2));console.log(JSON.stringify({success:true,version:proof.version,proof:file,uiFiles:Object.keys(uiFiles).length}));
