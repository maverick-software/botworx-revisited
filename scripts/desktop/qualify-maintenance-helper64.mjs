// Qualify the optional ready-runtime test hook while retaining the default
// missing-runtime recovery helper's exact earlier behavior.
import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {desktopOperation} from './operation-lock.mjs';
import {hash,json,list} from './phased-backup-control.mjs';
import {launchDurableProfileProbe} from './launch-durable-profile-probe.mjs';
desktopOperation('qualify64 default recovery helper with no optional ready hook');
const root=path.resolve(import.meta.dirname,'../..'),pointer=await json(path.join(root,'.supabase/desktop-google-editor-release64/current.json')),proof=await json(pointer.proof),prior=await json(path.join(root,'.supabase/desktop-normal-maintenance/launcher-qualified63.json')),helper='scripts/desktop/launch-durable-profile-probe.mjs',current=await readFile(path.join(root,helper),'utf8');
assert(proof.success&&proof.version==='0.44.64');
const added="  if(prepareReady){assert.equal(expectedRuntime,'ready');await prepareReady(application);evidence.beforeMainPreparation=true;}\n";
assert(current.includes('hiddenWindow=false,prepareReady,runReady')&&current.includes(added));
const old=current.replace('hiddenWindow=false,prepareReady,runReady','hiddenWindow=false,runReady').replace(added,'');assert.equal(createHash('sha256').update(old).digest('hex'),prior.sourceHashes[helper],'Only the documented optional ready hook may differ from the qualified63 helper.');
const capture=await readFile(path.join(root,'scripts/desktop/capture-maintenance-portable.mjs'),'utf8');assert(!capture.includes('prepareReady'));assert.equal(await hash(path.join(root,'scripts/desktop/capture-maintenance-portable.mjs')),prior.sourceHashes['scripts/desktop/capture-maintenance-portable.mjs']);
const oldReader=await readFile(path.join(root,'scripts/desktop/verify-maintenance-portable52.py'),'utf8'),newReader=await readFile(path.join(root,'scripts/desktop/verify-maintenance-portable64.py'),'utf8');assert.equal(newReader,oldReader.replace("descriptor['requiresDesktopRecoveryFormat']==10","descriptor['requiresDesktopRecoveryFormat']==11"));
const out=path.join(proof.out,'maintenance-helper-'+Date.now()),home=path.join(out,'home'),roaming=path.join(home,'AppData/Roaming'),profile=path.join(roaming,'Agentopia'),id=randomUUID(),distribution='AgentopiaRuntime-'+id;await mkdir(profile,{recursive:true});assert(!(await list()).includes(distribution));await writeFile(path.join(profile,'runtime-binding.json'),JSON.stringify({format:1,distribution,instanceId:id}));
const cfg={out,home,roaming,legacy:profile,profile,temp:path.join(out,'temp'),program:proof.program,exe:proof.exe,assets:proof.assets,imageSha256:proof.imageSha256},result=await launchDurableProfileProbe(cfg,{label:'default-missing-runtime',testProfile:false,initialProfile:profile,expectedProfile:profile,isolateOsHome:true,hiddenWindow:true});
assert(result.success&&result.absentPrivateRuntimeRefused&&result.normalExit===0&&result.externalRequestsAttempted===0&&!result.beforeMainPreparation);assert(!(await list()).includes(distribution));
const receipt={success:true,at:new Date().toISOString(),version:proof.version,imageSha256:proof.imageSha256,helper,helperSha256:await hash(path.join(root,helper)),previousSha256:prior.sourceHashes[helper],onlyOptionalReadyHookChanged:true,defaultHelperHasNoReadyHook:true,absentRuntimeRefused:true,defaultProbe:result.out,normalExit:0,externalRequests:0,productionWrites:0,recoveryReader:'scripts/desktop/verify-maintenance-portable64.py',recoveryReaderSha256:await hash(path.join(root,'scripts/desktop/verify-maintenance-portable64.py')),onlyReaderCapabilityChanged:true};await writeFile(path.join(proof.out,'maintenance-helper-qualified.json'),JSON.stringify(receipt,null,2),{flag:'wx'});console.log(JSON.stringify({success:true,out,defaultRecoveryHelper:true,normalExit:0,productionWrites:0}));
