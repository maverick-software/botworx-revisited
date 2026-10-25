import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {desktopOperation} from './operation-lock.mjs';
import {hash,json,save} from './phased-backup-control.mjs';

desktopOperation('bind unchanged recovery124 source and the separately qualified launcher guard');
const root=path.resolve(import.meta.dirname,'../..');
const baseFile=path.join(root,'.supabase/desktop-draft-preview76/source124-1792848382173/evidence.json');
const productFile=path.join(root,'.supabase/desktop-draft-preview76/recovery124-1792848860709/evidence.json');
const focusedFile='F:/Agentopia-Acceptance/credential-launcher124/1792849271669/evidence.json';
const compatibilityFile='F:/Agentopia-Acceptance/desktop-recovery-launcher/1792849366247/evidence.json';
const out=path.join(root,'.supabase/desktop-draft-preview76','source124-bound-'+Date.now());
await mkdir(out,{recursive:true});
const e={success:false,out,sourceOnly:true,productionAccess:false,providerRequests:0,checks:[]};
const ref=async file=>({file,sha256:await hash(file)});
const powershellReceipt=async file=>JSON.parse((await readFile(file,'utf8')).replace(/^\uFEFF/,''));
try{
 const base=await json(baseFile),product=await json(productFile),focused=await powershellReceipt(focusedFile),compatibility=await powershellReceipt(compatibilityFile);
 assert(base.success&&base.commands.every(command=>command.code===0));
 assert.equal(await hash(path.join(root,'scripts/desktop/test-creation-recovery124-source.mjs')),base.controllerSha256);
 const changes=[];e.sourceHashes={};
 for(const[file,digest]of Object.entries(base.sourceHashes)){
  const current=await hash(path.join(root,file));e.sourceHashes[file]=current;
  if(current!==digest)changes.push(file);
 }
 assert.deepEqual(changes.sort(),['desktop/resources/runtime/Restore-Agentopia.ps1','scripts/desktop/import-backup.ps1']);
 const helper=await readFile(path.join(root,'scripts/desktop/import-backup.ps1'),'utf8');
 const guard=" if($descriptor.requiresDesktopRecoveryFormat -lt 18 -and $descriptor.PSObject.Properties.Name -contains 'windowsProfileManifest'){throw 'Encrypted Windows credentials require a newer recovery capability.'}\r\n";
 assert.equal(helper.split(guard).length,2,'Exactly the tested lower-capability guard was added.');
 const original=helper.replace(guard,'');
 assert.equal(createHash('sha256').update(original).digest('hex'),base.sourceHashes['scripts/desktop/import-backup.ps1']);
 assert.equal(await readFile(path.join(product.bundle,'Restore-Agentopia.ps1'),'utf8'),original);
 assert.equal(e.sourceHashes['desktop/resources/runtime/Restore-Agentopia.ps1'],e.sourceHashes['scripts/desktop/import-backup.ps1']);
 e.checks.push('Every source/test byte from the broad qualification is unchanged except the source and bundled launcher, whose only addition is the tested pre18 refusal.');
 assert(focused.success&&compatibility.success);
 assert.equal(focused.checks.length,2);assert.equal(compatibility.groups,12);
 for(const receipt of[focused,compatibility])assert.equal(receipt.helperSha256,e.sourceHashes['scripts/desktop/import-backup.ps1']);
 e.checks.push('The current exact launcher passes the Windows-resource downgrade refusal and all twelve compatibility groups through capability18.');
 assert(product.success&&product.actualWindowsEncryption&&product.actualPortableProducer&&product.actualPreparation&&product.actualPostgresImport&&product.sameWindowsUser);
 assert.equal(path.resolve(product.sourceQualification),path.resolve(baseFile));
 assert.equal(await hash(path.join(root,'scripts/desktop/test-creation-recovery124-product.mjs')),product.controllerSha256);
 assert.equal(await hash(path.join(root,'scripts/desktop/creation-recovery124-worker.cjs')),product.workerSha256);
 for(const phase of product.phases){assert.equal(await hash(phase.file),phase.sha256);assert((await json(phase.file)).success);}
 assert.equal(product.protocol.postRestoreExchanges,0);assert.equal(product.protocol.authorizedActions,1);assert.equal(product.protocol.postRestoreRefreshes,1);
 assert(product.sourceServicesStopped&&product.restoredServicesStopped&&product.generatedRuntimeRemoved);
 e.checks.push('The complete same-user Windows encrypted-profile and PostgreSQL restore proof remains bound to the unchanged compiled source; its positive capability18 path is unchanged by the additional refusal.');
 const pythonLogs={};
 for(const[name,expected]of[['windows-credential-recovery',6],['complete-recovery-preparation',12],['database-snapshot',4]]){
  const file=path.join(base.out,name+'.log'),log=await readFile(file,'utf8');
  assert.equal(Number(log.match(/Ran (\d+) tests?/)?.[1]),expected);assert(/\bOK\b/.test(log));
  pythonLogs[name]={...await ref(file),cases:expected};
 }
 assert.equal(base.windowsRecoveryCases,0);
 e.checks.push('The original broad receipt miscounts the Python Windows cases as zero; its immutable successful log establishes six cases. The other preparation and snapshot logs establish twelve and four.');
 Object.assign(e,{build:base.build,brokerSourceIntegrated:base.brokerSourceIntegrated,actualBrokerRuntime:false,actualPostgres:false,actualNativeExecution:false,focusedCases:base.focusedCases,regressionCases:base.regressionCases,recoveryCases:base.recoveryCases,windowsRecoveryCases:6,preparationCases:12,snapshotCases:4,commands:base.commands,commandsReusedFromBase:true,baseSource:await ref(baseFile),fullProducerProof:await ref(productFile),focusedLauncher:await ref(focusedFile),compatibilityLauncher:await ref(compatibilityFile),pythonLogs,rawWindowsRecoveryCases:base.windowsRecoveryCases,controllerSha256:base.controllerSha256,bindingControllerSha256:await hash(import.meta.filename)});
 e.success=true;
}catch(error){e.error=error.stack;process.exitCode=1;}
const file=path.join(out,'evidence.json');await writeFile(file,JSON.stringify(e,null,2));
if(e.success)await save(path.join(root,'.supabase/desktop-draft-preview76/source-current.json'),{out,evidence:file});
console.log(JSON.stringify({success:e.success,out,checks:e.checks.length,error:e.error}));
