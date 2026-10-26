// Renderer-only same-version maintenance, bound to the accepted Computer host repair.
import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,readFile,writeFile,copyFile,link,symlink} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash} from './phased-backup-control.mjs';
import {viewportInventory} from './prepare-skills-viewport81.mjs';

export const computerDesign83Base='F:/Agentopia/.supabase/desktop-host-plugin-compat82/1792995366465/package-proof.json';
export const computerDesign83Image='31e6d351eb269a1a19e014d71ed49b3ea4c7cb6e8a5cf422b06966f59e34c007';
export const computerDesign83Kind='installed82-computer-design-renderer-repair';
export const computerDesign83Records='F:/Agentopia/.supabase/desktop-computer-design83';
export const computerDesign83Controllers=['prepare-computer-design83.mjs','install-computer-design83.mjs','qualify-computer-design83.mjs','audit-computer-design83-credentials.mjs','audit-agent-health75.mjs','audit-agent-health75.py','audit_logical_snapshot71.py','composio_service_row_checks80.py','audit-installed-credentials75.mjs','protected_settings_policy80.cjs','protected_settings_policy81.cjs','normal-clean-chat75-process.mjs','launch-durable-profile-probe.mjs'];
export function verifyComputerDesign83Approval(a){
 assert(a.success&&a.rootAccepted===true&&/^[0-9a-f]{40}$/.test(a.sourceCommit));
 const names=Object.keys(a.uiSourceHashes).sort();assert(names.includes('ui/ComputerSettings.tsx'));
 assert(names.every(name=>['ui/ComputerSettings.tsx','ui/SettingsPanel.tsx','ui/computer-settings.css','ui/settings-page.css'].includes(name)));
 for(const digest of Object.values(a.uiSourceHashes))assert(/^[0-9a-f]{64}$/.test(digest));
 assert(path.isAbsolute(a.fixtureEvidence)&&/^F:/i.test(a.fixtureEvidence)&&/^[0-9a-f]{64}$/.test(a.fixtureEvidenceSha256));
}
export function verifyComputerDesign83Proof(p,base){
 assert(p.success&&p.kind===computerDesign83Kind&&p.version==='0.44.82'&&p.schema===88&&p.desktopRecovery===18);
 assert.equal(path.resolve(p.baseProof),path.resolve(computerDesign83Base));assert.equal(p.imageSha256,computerDesign83Image);
 assert.equal(path.resolve(path.dirname(p.out)),path.resolve(computerDesign83Records));assert(/^\d{13}$/.test(path.basename(p.out)));
 assert.deepEqual(p.programFiles,base.programFiles);assert.deepEqual(p.compiled,base.compiled);assert.deepEqual(p.productionDependencies,base.productionDependencies);
 const nonUi=value=>Object.fromEntries(Object.entries(value).filter(([name])=>!name.startsWith('ui/')));
 assert.deepEqual(nonUi(p.resourceFiles),nonUi(base.resourceFiles));assert.notDeepEqual(p.uiFiles,base.uiFiles);
 assert.deepEqual(Object.keys(p.sourceHashes).sort(),Object.keys(base.sourceHashes).sort());
 assert.deepEqual(Object.keys(p.sourceHashes).filter(name=>p.sourceHashes[name]!==base.sourceHashes[name]).sort(),p.sourceChanges.slice().sort());
 assert(p.sourceChanges.includes('ui/ComputerSettings.tsx')&&p.sourceChanges.every(name=>['ui/ComputerSettings.tsx','ui/SettingsPanel.tsx','ui/computer-settings.css','ui/settings-page.css'].includes(name)));
}
async function prepare(){
 desktopOperation('prepare reviewed Computer settings renderer design83');
 const root=path.resolve(import.meta.dirname,'../..'),exec=promisify(execFile),approvalAt=process.argv.indexOf('--source-approval');assert(approvalAt>=0,'Root source acceptance is required before building');
 const approvalFile=path.resolve(process.argv[approvalAt+1]??''),approval=await json(approvalFile);assert(/^F:/i.test(root)&&/^F:/i.test(approvalFile));verifyComputerDesign83Approval(approval);
 const base=await json(computerDesign83Base),installed=await json('F:/Agentopia/.supabase/desktop-release82/installed-current.json'),accepted=await json(installed.evidence),completion=await json('F:/Agentopia/.supabase/desktop-host-plugin-compat82/1792995366465/installation-1792995500686/completion.json'),qualification=path.join(base.out,'qualification.json');
 assert(base.success&&base.kind==='installed82-host-plugin-compatibility-repair'&&base.imageSha256===computerDesign83Image&&installed.success&&accepted.success&&completion.success&&(await json(qualification)).success);assert.equal(path.resolve(installed.proof),path.resolve(computerDesign83Base));
 for(const name of ['audit-installed-credentials75.mjs','protected_settings_policy80.cjs','protected_settings_policy81.cjs'])assert.equal(await hash(path.join(root,'scripts/desktop',name)),base.controllerHashes[name],name);
 const git=async args=>(await exec('git',args,{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:4000000})).stdout.trim();assert.equal(await git(['rev-parse','HEAD']),approval.sourceCommit);
 assert.equal(await hash(approval.fixtureEvidence),approval.fixtureEvidenceSha256);const tested=await json(approval.fixtureEvidence);assert(tested.success&&tested.actualElectron&&tested.controlledIPC&&tested.ordinaryProfileWrites===0&&tested.liveProviderRequests===0);
 for(const name of ['package.json','package-lock.json'])assert.equal(await hash(path.join(root,name)),await hash(path.join(base.sourceRoot,name)));
 for(const[name,digest]of Object.entries(base.programFiles))assert.equal(await hash(path.join(base.program,name)),digest,name);for(const[name,digest]of Object.entries(base.resourceFiles))assert.equal(await hash(path.join(base.assets,name)),digest,name);
 const out=path.join(computerDesign83Records,String(Date.now())),sourceRoot=path.join(out,'source'),source=path.join(sourceRoot,'desktop'),program=path.join(out,'program'),assets=path.join(program,'resources/resources'),ui=path.join(assets,'ui'),temp=path.join(out,'temp');await mkdir(source,{recursive:true});await mkdir(temp);
 const sourceHashes={...base.sourceHashes};for(const[name,digest]of Object.entries(base.sourceHashes)){const to=path.join(source,name);await mkdir(path.dirname(to),{recursive:true});await copyFile(path.join(base.source,name),to);assert.equal(await hash(to),digest,name);}
 for(const[name,digest]of Object.entries(approval.uiSourceHashes)){assert.equal(await hash(path.join(root,'desktop',name)),digest,name);await copyFile(path.join(root,'desktop',name),path.join(source,name));assert.equal(await hash(path.join(source,name)),digest,name);sourceHashes[name]=digest;}
 for(const name of ['package.json','package-lock.json'])await copyFile(path.join(base.sourceRoot,name),path.join(sourceRoot,name));await symlink(path.join(root,'node_modules'),path.join(sourceRoot,'node_modules'),'junction');
 for(const[name,args,timeout]of [['typecheck',[path.join(root,'node_modules/typescript/bin/tsc'),'-p',path.join(source,'ui/tsconfig.json'),'--noEmit'],180000],['renderer',[path.join(root,'node_modules/vite/bin/vite.js'),'build','--config',path.join(source,'vite.config.mjs')],240000]]){const result=await exec(process.execPath,args,{cwd:sourceRoot,encoding:'utf8',windowsHide:true,timeout,maxBuffer:4000000,env:{...process.env,TEMP:temp,TMP:temp}});await writeFile(path.join(out,name+'.log'),result.stdout+result.stderr);}
 for(const name of [...Object.keys(base.programFiles),...Object.keys(base.resourceFiles).map(name=>'resources/resources/'+name)].filter(name=>!name.startsWith('resources/resources/ui/'))){const to=path.join(program,name);await mkdir(path.dirname(to),{recursive:true});await link(path.join(base.program,name),to);}
 for(const name of Object.keys(await viewportInventory(path.join(source,'resources/ui')))){const to=path.join(ui,name);await mkdir(path.dirname(to),{recursive:true});await link(path.join(source,'resources/ui',name),to);}
 const all=await viewportInventory(program),programFiles=Object.fromEntries(Object.entries(all).filter(([name])=>!name.startsWith('resources/resources/'))),resourceFiles=await viewportInventory(assets),uiFiles=await viewportInventory(ui);await copyFile(path.join(base.out,'composio-public-jwks82.json'),path.join(out,'composio-public-jwks82.json'));assert.equal(await hash(path.join(out,'composio-public-jwks82.json')),base.publicJwksSha256);
 const controllerHashes={};for(const name of computerDesign83Controllers)controllerHashes[name]=await hash(path.join(root,'scripts/desktop',name));
 const p={...base,success:true,kind:computerDesign83Kind,out,sourceRoot,source,sourceCommit:approval.sourceCommit,sourceHashes,sourceChanges:Object.keys(approval.uiSourceHashes),sourceApproval:approvalFile,sourceApprovalSha256:await hash(approvalFile),fixtureEvidence:approval.fixtureEvidence,fixtureEvidenceSha256:approval.fixtureEvidenceSha256,program,exe:path.join(program,'Agentopia.exe'),assets,image:path.join(program,'resources/app.asar'),imageSha256:computerDesign83Image,baseImageSha256:computerDesign83Image,baseProof:computerDesign83Base,programFiles,resourceFiles,ui,uiFiles,baseUiFiles:base.uiFiles,controllerHashes,changedCompiled:[],typescriptPassed:true,reusedBackendQualification:qualification,reusedBackendQualificationSha256:await hash(qualification),installerConstructed:false,installed:false,providerRequests:0};verifyComputerDesign83Proof(p,base);assert.equal(await hash(p.image),computerDesign83Image);
 const proofFile=path.join(out,'package-proof.json');await writeFile(proofFile,JSON.stringify(p,null,2),{flag:'wx'});await writeFile(path.join(out,'qualification.json'),JSON.stringify({success:true,kind:p.kind,proof:proofFile,proofSha256:await hash(proofFile),typescriptPassed:true,fixtureEvidence:p.fixtureEvidence,fixtureEvidenceSha256:p.fixtureEvidenceSha256,reusedBackendQualification:qualification,reusedBackendQualificationSha256:p.reusedBackendQualificationSha256,programByteIdentical:true,nonUiResourcesByteIdentical:true,actualPackagedRendererPending:true},null,2),{flag:'wx'});await writeFile(path.join(computerDesign83Records,'current.json'),JSON.stringify({out,proof:proofFile},null,2));console.log(JSON.stringify({success:true,out,proof:proofFile,installed:false,kind:p.kind}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(import.meta.filename))await prepare();
