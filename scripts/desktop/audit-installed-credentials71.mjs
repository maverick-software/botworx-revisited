// Compare encrypted snapshots in an isolated Windows-encryption helper. Plaintext
// exists only in helper memory; no credential value is printed, exported or sent.
import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,copyFile,readFile,writeFile,stat} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash} from './phased-backup-control.mjs';
import {launchDurableProfileProbe} from './launch-durable-profile-probe.mjs';

desktopOperation('read-only isolated comparison of installed71 protected credentials');
const root=path.resolve(import.meta.dirname,'../..'),release=await json(path.join(root,'.supabase/desktop-recovery71-release/current.json'));
const proof=await json(release.proof),maintenance=await json(path.join(root,'.supabase/desktop-normal-maintenance/current-update71.json'));
const installed=await json(path.join(maintenance.job,'installed-data-accepted.json'));assert(installed.success&&installed.version==='0.44.71');
await assert.rejects(stat(path.join(maintenance.job,'installed-credentials-accepted.json')),error=>error.code==='ENOENT');
const recovery=path.join(maintenance.job,'recovery'),raw=await json(path.join(recovery,'private-profile-recovery.json'));
const baseline=path.join(recovery,'helper-home/AppData/Roaming/Agentopia/credentials.bin');
assert.equal(await hash(baseline),raw.manifest.files['credentials.bin'].sha256);
const current=path.join('F:/Agentopia-Data/profiles/a91a4800-e08f-4440-a4ec-588762d01bfd/profile','credentials.bin');
const out=path.join(maintenance.job,'credential-audit-'+Date.now());await mkdir(out);
const exec=promisify(execFile),sid=(await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command','[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],{windowsHide:true,encoding:'utf8'})).stdout.trim();
assert(/^S-1-5-[0-9-]+$/.test(sid));await exec('icacls.exe',[out,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F','/Q'],{windowsHide:true});
const home=path.join(out,'helper-home'),roaming=path.join(home,'AppData/Roaming'),profile=path.join(roaming,'Agentopia');await mkdir(profile,{recursive:true});
await copyFile(path.join(recovery,'helper-home/AppData/Roaming/Agentopia/Local State'),path.join(profile,'Local State'));
await copyFile(baseline,path.join(out,'before.bin'));
const before=await stat(current);await copyFile(current,path.join(out,'after.bin'));const after=await stat(current);
assert.equal(before.size,after.size);assert.equal(before.mtimeMs,after.mtimeMs);assert.equal(await hash(current),await hash(path.join(out,'after.bin')));
const missing=randomUUID();await writeFile(path.join(profile,'runtime-binding.json'),JSON.stringify({format:1,distribution:'AgentopiaRuntime-'+missing,instanceId:missing}));
const cfg={out,home,roaming,legacy:profile,profile,temp:path.join(out,'temp'),program:proof.program,exe:proof.exe,imageSha256:proof.imageSha256};
const e={success:false,at:new Date().toISOString(),out,version:proof.version,imageSha256:proof.imageSha256,
 encryptedBeforeSha256:await hash(path.join(out,'before.bin')),encryptedAfterSha256:await hash(path.join(out,'after.bin')),
 secretValuesExported:false,providerRequests:0,productionProfileReadOnly:true};
try{
 const result=await launchDurableProfileProbe(cfg,{label:'helper',testProfile:false,initialProfile:profile,expectedProfile:profile,
  isolateOsHome:true,hiddenWindow:true,runMissing:async({application})=>application.evaluate(async({safeStorage},files)=>{
   const req=globalThis.__durableProbeRequire,fs=req('node:fs/promises'),assert=req('node:assert/strict');
   assert(safeStorage.isEncryptionAvailable());
   const left=JSON.parse(safeStorage.decryptString(await fs.readFile(files.before)));
   const right=JSON.parse(safeStorage.decryptString(await fs.readFile(files.after)));
   const stable=value=>JSON.stringify(value===undefined?null:value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
   const changes=[],families={};let identical=0;
   for(const key of new Set([...Object.keys(left),...Object.keys(right)])){
    if(stable(left[key])===stable(right[key])){identical++;continue;}
    const name=key.split(':')[0],family=/^[a-z][a-z0-9-]*$/.test(name)?name:'other';
    const status=!(key in left)?'added':!(key in right)?'removed':'updated';families[family]=(families[family]??0)+1;changes.push({family,status});
   }
   const providerKeys=Object.keys(left).filter(key=>key==='openrouter'||key==='openai'||key.startsWith('openai:'));
   const preservedProviderKeys=providerKeys.filter(key=>stable(left[key])===stable(right[key])).length;
   const imageKeys=[...new Set([...Object.keys(left),...Object.keys(right)])].filter(key=>key.startsWith('image-generation:'));
   const imageGenerationDisabled=imageKeys.every(key=>left[key]?.enabled!==true&&right[key]?.enabled!==true);
   return {beforeSettings:Object.keys(left).length,afterSettings:Object.keys(right).length,identicalSettings:identical,
    changedSettings:changes.length,changes,families,providerConnectionRecords:providerKeys.length,preservedProviderConnectionRecords:preservedProviderKeys,
    imageGenerationDisabled,allProviderConnectionValuesIdentical:preservedProviderKeys===providerKeys.length};
  },{before:path.join(out,'before.bin'),after:path.join(out,'after.bin')})});
 assert(result.success&&result.normalExit===0&&result.absentPrivateRuntimeRefused);e.comparison=result.workflow;
 assert(e.comparison.allProviderConnectionValuesIdentical&&e.comparison.providerConnectionRecords>0&&e.comparison.imageGenerationDisabled);
 assert.equal(e.comparison.beforeSettings,e.comparison.afterSettings);assert.equal(e.comparison.changedSettings,0);
 assert.equal(e.comparison.identicalSettings,e.comparison.beforeSettings);
 assert.equal(await hash(path.join(out,'after.bin')),e.encryptedAfterSha256);
 e.success=true;e.normalHelperExit=true;e.helperDatabaseNeverStarted=true;
 const evidence=path.join(out,'evidence.json');await writeFile(evidence,JSON.stringify(e,null,2));
 await writeFile(path.join(maintenance.job,'installed-credentials-accepted.json'),JSON.stringify({success:true,evidence},null,2),{flag:'wx'});
 console.log(JSON.stringify({success:true,evidence,comparison:e.comparison,providerRequests:0}));
}catch(error){e.error=error.cause?.stack??error.stack;await writeFile(path.join(out,'evidence.json'),JSON.stringify(e,null,2));console.error('Inspect protected credential comparison at '+out);process.exitCode=1;}
