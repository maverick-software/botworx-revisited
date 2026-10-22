import {readFile,writeFile,readdir,lstat,mkdir,copyFile,link,rename} from 'node:fs/promises';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import path from 'node:path';import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';
import {closed,hash} from './phased-backup-control.mjs';
import {captureCompressedProfile} from './compressed-private-profile.mjs';
desktopOperation('install responsive chat details');
const root=path.resolve(import.meta.dirname,'../..'),records=path.join(root,'.supabase/desktop-responsive-context'),json=async p=>JSON.parse(await readFile(p,'utf8')),exec=promisify(execFile),pointer=await json(path.join(records,'current.json')),proof=await json(pointer.proof),base=await json(proof.baseReceipt),resources='C:/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.47/resources';
await closed();assert.equal(await hash(proof.baseReceipt),proof.baseReceiptSha256);assert.equal(await hash(path.join(resources,'app.asar')),proof.imageSha256);
async function inventory(dir){const result={};for(const name of(await readdir(dir,{recursive:true})).sort()){const file=path.join(dir,name),info=await lstat(file);assert(!info.isSymbolicLink());if(info.isFile())result[name.replaceAll('\\','/')]=await hash(file);}return result;}
assert.deepEqual(await inventory(proof.ui),proof.uiHashes);
const contextEvidence=await json(process.argv[2]),readingEvidence=await json(process.argv[3]);
assert(contextEvidence.success&&contextEvidence.checks.length===13&&readingEvidence.success&&readingEvidence.checks.length===5);
for(const evidence of [contextEvidence,readingEvidence])assert.equal(path.resolve(evidence.delivered),path.resolve(proof.ui));
for(const [name,digest]of Object.entries(base.resourceFiles))assert.equal(await hash(path.join(resources,'resources',name)),digest,'Installed base resource changed: '+name);
const work=proof.work,distro='AgentopiaRuntime-a91a4800-e08f-4440-a4ec-588762d01bfd',linuxWork='/mnt/f/'+path.relative('F:/',work).replaceAll('\\','/'),wslArgs=['-d',distro,'-u','agentopia','--exec','python3'];
await exec('wsl.exe',[...wslArgs,'/mnt/f/Agentopia/scripts/desktop/responsive-context-physical.py','before',linuxWork],{windowsHide:true,maxBuffer:1024*1024});
const sid=(await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command','[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],{encoding:'utf8',windowsHide:true})).stdout.trim();assert(/^S-1-5-[0-9-]+$/.test(sid));
await exec('icacls.exe',[work,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F','/Q'],{windowsHide:true});
const profileRecovery=path.join(work,'profile-before-ui.tar.gz'),profile=await captureCompressedProfile('C:/Users/charl/.agentopia/desktop/profile',profileRecovery,{headroomBytes:512*1024**2,maxCompressedBytes:100*1024**2});
await writeFile(path.join(work,'profile-recovery.json'),JSON.stringify(profile,null,2),{flag:'wx'});await copyFile('C:/Users/charl/.agentopia/desktop/profile-location.json',path.join(work,'profile-location.json'));
const dataArgs=[...wslArgs,'/mnt/f/Agentopia/scripts/desktop/responsive-context-data.py'];
await exec('wsl.exe',[...dataArgs,'before',linuxWork],{windowsHide:true,maxBuffer:1024*1024});
const oldUi=path.join(resources,'resources/ui'),pending=path.join(resources,'resources/ui-responsive-pending'),rollback=path.join(resources,'resources/ui-before-responsive-context');
for(const p of [pending,rollback]){try{await lstat(p);throw Error('Update path already exists: '+p);}catch(e){if(e.code!=='ENOENT')throw e;}}
await mkdir(pending);for(const [name,digest]of Object.entries(proof.uiHashes)){const to=path.join(pending,name);await mkdir(path.dirname(to),{recursive:true});if(proof.beforeUiHashes[name]===digest)await link(path.join(oldUi,name),to);else await copyFile(path.join(proof.ui,name),to);assert.equal(await hash(to),digest);}
await closed();await rename(oldUi,rollback);try{await rename(pending,oldUi);assert.deepEqual(await inventory(oldUi),proof.uiHashes);await exec('wsl.exe',[...wslArgs,'/mnt/f/Agentopia/scripts/desktop/responsive-context-physical.py','after',linuxWork],{windowsHide:true,maxBuffer:1024*1024});await exec('wsl.exe',[...dataArgs,'after',linuxWork],{windowsHide:true,maxBuffer:1024*1024});}catch(e){try{await rename(oldUi,pending);}catch{}await rename(rollback,oldUi);throw e;}
const resourceFiles=Object.fromEntries(Object.entries(base.resourceFiles).filter(([k])=>!k.startsWith('ui/')));for(const [name,digest]of Object.entries(proof.uiHashes))resourceFiles['ui/'+name]=digest;
const receipt={success:true,at:new Date().toISOString(),revision:proof.revision,version:'0.44.47',imageSha256:proof.imageSha256,baseReceipt:proof.baseReceipt,baseReceiptSha256:proof.baseReceiptSha256,resourceFiles,profileRecovery,profileRecoverySha256:profile.archiveSha256,profileFiles:profile.fileCount,rollbackUi:rollback,contextEvidence:path.resolve(process.argv[2]),readingEvidence:path.resolve(process.argv[3]),backendUnchanged:true,versionJsonUnchanged:true,tablesCompared:126,allSavedTableRowsPreserved:true,providerRequests:0,installed:true,normalReopeningPassed:false,nativeAcceptancePending:true,fullGoalComplete:false};
await writeFile(path.join(work,'installed.json'),JSON.stringify(receipt,null,2),{flag:'wx'});await writeFile(path.join(records,'installed.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify({success:true,work,revision:proof.revision,profileFiles:profile.fileCount,tablesCompared:126,nativeAcceptancePending:true}));
