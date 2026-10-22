import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {desktopOperation} from './operation-lock.mjs';
import {captureMaintenancePortable} from './capture-maintenance-portable.mjs';
import {hash,list} from './phased-backup-control.mjs';

desktopOperation('qualify capability-10 application-update recovery with retained external paths');
const root=path.resolve(import.meta.dirname,'../..'),json=async file=>JSON.parse(await readFile(file,'utf8'));
const proof=await json((await json(path.join(root,'.supabase/desktop-connection-release53/current.json'))).proof),base=await json(proof.acceptedBase),accepted=await json(path.join(base.out,'composio-application-accepted.json')),actual=await json(accepted.evidence),retained=await json(path.join(base.out,'retained-qa.json')),prior=await json(retained.intent);
assert(proof.success&&accepted.success&&actual.success);assert.equal(await hash(path.join(prior.program,'resources/app.asar')),base.imageSha256);assert(!(await list(true)).includes(prior.distribution));
const stamp=String(Date.now()),out=path.join(root,'.supabase/desktop-maintenance-backup',stamp),sourceHome=path.join('F:/Agentopia-Acceptance','maintenance-scope53-'+stamp,'home');await mkdir(out,{recursive:true});await mkdir(sourceHome,{recursive:true});
const sourceProfile=path.join(sourceHome,'AppData/Roaming/Agentopia');await cp(prior.profile,sourceProfile,{recursive:true});await cp(path.join(prior.home,'Agentopia Files'),path.join(sourceHome,'Agentopia Files'),{recursive:true});
const snapshot=path.join(actual.capability10Backup,'current-database-backup'),cfg={out,sourceProfile,sourceHome,sourcePublicRoot:path.join(sourceHome,'Agentopia Files'),logicalSnapshot:snapshot,program:proof.program,exe:proof.exe,assets:proof.assets,imageSha256:proof.imageSha256,production:false,scope:'application-update'};
await writeFile(path.join(out,'intent.json'),JSON.stringify(cfg,null,2),{flag:'wx'});
const evidence={success:false,at:new Date().toISOString(),out,scope:cfg.scope,sourceApplicationEvidence:accepted.evidence,sourceDatabaseSnapshot:snapshot,productionChanged:false,providerRequests:0};
try{
 const captured=await captureMaintenancePortable(cfg);assert(captured.success&&captured.scope==='application-update'&&captured.externalReferencesPreservedInPlace>0&&captured.fullWorkspaceExport===false);
 const declaration=await json(path.join(captured.destination,'application-update-scope.json'));assert.equal(declaration.externalReferences.length,captured.externalReferencesPreservedInPlace);
 const external=await json(path.join(captured.destination,'external-files.json'));assert(external.accounts.every(row=>row.references.length===0));assert.equal(Object.keys(external.manifest.files).length,0);assert.equal(captured.accounts,(await json(path.join(snapshot,'manifest.json'))).accounts);assert(captured.privateFiles>0&&captured.clipboardImages>0);
 const settings=await json(path.join(captured.destination,'portable-settings.json')),states=[];const walk=value=>{if(!value||typeof value!=='object')return;for(const [name,item] of Object.entries(value)){if(name==='composio-state')states.push(item);else walk(item);}};walk(settings);assert.equal(states.length,1);assert.equal(states[0].connections.length,2);assert(states[0].connections.every(row=>!row.enabled&&row.status==='NEEDS_VERIFICATION'));assert(!JSON.stringify(settings).includes('controlled-composio-key-not-a-credential'));
 const independent=JSON.parse((await promisify(execFile)(path.join(proof.assets,'script-runtimes/python-3.14.8/python.exe'),['-I','-B',path.join(root,'scripts/desktop/verify-maintenance-portable52.py'),path.join(out,'intent.json')],{windowsHide:true,encoding:'utf8',timeout:120000,maxBuffer:1024*1024})).stdout);
 assert(independent.success&&independent.scope===cfg.scope&&independent.portableCapability===10&&independent.externalReferencesRetainedInPlace===captured.externalReferencesPreservedInPlace);
 Object.assign(evidence,{success:true,capture:captured,independent,fullRawProfilePreserved:true,externalTreeBytesCopied:0,composioBindingsDisabled:true,composioProjectKeyExcludedFromPortable:true});console.log(JSON.stringify({success:true,out,rawProfileFiles:independent.rawProfileFiles,externalReferencesRetainedInPlace:captured.externalReferencesPreservedInPlace,externalTreeBytesCopied:0,composioBindings:2,providerRequests:0}));
}catch(error){evidence.error=error.stack;process.exitCode=1;console.error(error.stack);}
finally{await writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));await writeFile(path.join(root,'.supabase/desktop-maintenance-backup/application-scope53-current.json'),JSON.stringify({success:evidence.success,out,evidence:path.join(out,'evidence.json')},null,2));}
