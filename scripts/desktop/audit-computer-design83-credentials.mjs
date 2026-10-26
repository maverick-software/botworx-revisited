// Reuse the byte-frozen strict comparator. Only module/root/job paths are rebound.
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {json,hash} from './phased-backup-control.mjs';
import {computerDesign83Base,computerDesign83Image,verifyComputerDesign83Proof} from './prepare-computer-design83.mjs';

export function deriveComputerDesign83Comparator(source,{root,out,postInspection=false}){
 assert.equal(path.resolve(root),path.resolve('F:/Agentopia'));
 assert.equal(path.resolve(path.dirname(out)),path.resolve(root,'.supabase/desktop-computer-design83'));assert(/^\d{13}$/.test(path.basename(out)));
 let derived=source;const transforms=[];
 function replaceExact(before,after,count){assert.equal(derived.split(before).length-1,count,before);derived=derived.replaceAll(before,after);transforms.push({before,after,count});}
 for(const name of ['operation-lock.mjs','phased-backup-control.mjs','launch-durable-profile-probe.mjs'])replaceExact("'./"+name+"'",JSON.stringify(pathToFileURL(path.join(root,'scripts/desktop',name)).href),1);
 replaceExact("root=path.resolve(import.meta.dirname,'../..')","root="+JSON.stringify(root),1);
 // The accepted base program executes the encryption helper. Only the validated
 // fresh baseline job belongs to the renderer maintenance directory.
 replaceExact('path.resolve(path.dirname(maintenance.job))===path.resolve(proof.out)','path.resolve(path.dirname(maintenance.job))===path.resolve('+JSON.stringify(out)+')',1);
 assert.equal(typeof postInspection,'boolean');if(postInspection)replaceExact('installed-credentials-accepted.json','installed-credentials-post-inspection.json',2);
 return {derived,transforms};
}
async function audit(){
 const root='F:/Agentopia',arg=name=>{const i=process.argv.indexOf(name);assert(i>=0,name+' required');return path.resolve(process.argv[i+1]??'');},proofFile=arg('--proof'),job=arg('--job'),p=await json(proofFile),base=await json(computerDesign83Base),installed=await json(path.join(job,'evidence.json'));
 verifyComputerDesign83Proof(p,base);assert.equal(path.resolve(proofFile),path.resolve(p.out,'package-proof.json'));assert.equal(path.resolve(path.dirname(job)),path.resolve(p.out));assert(/^installation-\d{13}$/.test(path.basename(job)));assert(installed.installed&&installed.database?.success&&installed.version==='0.44.82');
 assert.equal(await hash(p.image),computerDesign83Image);assert.equal(await hash('C:/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.82/resources/app.asar'),computerDesign83Image);
 for(const name of ['audit-installed-credentials75.mjs','protected_settings_policy80.cjs','protected_settings_policy81.cjs']){assert.equal(await hash(path.join(root,'scripts/desktop',name)),base.controllerHashes[name],name);assert.equal(p.controllerHashes[name],base.controllerHashes[name],name);}
 const jwks=path.join(base.out,'composio-public-jwks82.json');assert.equal(await hash(jwks),base.publicJwksSha256);assert.equal(p.publicJwksSha256,base.publicJwksSha256);
 const postInspection=process.argv.includes('--post-inspection'),originalReceipt=path.join(job,'installed-credentials-accepted.json'),originalReceiptSha256=postInspection?await hash(originalReceipt):null,receipt=path.join(job,postInspection?'installed-credentials-post-inspection.json':'installed-credentials-accepted.json');if(postInspection){const old=await json(originalReceipt);assert(old.success&&(await json(old.evidence)).success);}
 const originalFile=path.join(root,'scripts/desktop/audit-installed-credentials75.mjs'),originalSource=await readFile(originalFile,'utf8'),{derived,transforms}=deriveComputerDesign83Comparator(originalSource,{root,out:p.out,postInspection}),out=path.join(job,'frozen-comparator-'+Date.now());await mkdir(out);const worker=path.join(out,'frozen-credential-comparator.mjs');await writeFile(worker,derived,{flag:'wx'});
 const e={success:false,at:new Date().toISOString(),proof:proofFile,proofSha256:await hash(proofFile),acceptedBaseProof:computerDesign83Base,acceptedBaseProofSha256:await hash(computerDesign83Base),job,originalComparator:originalFile,originalComparatorSha256:await hash(originalFile),derivedComparator:worker,derivedComparatorSha256:await hash(worker),exactTransforms:transforms,programByteIdentical:true,nonUiResourcesByteIdentical:true,productionProfileReadOnly:true,providerRequests:0,secretValuesExported:false},save=()=>writeFile(path.join(out,'evidence.json'),JSON.stringify(e,null,2));await save();
 try{
  const executed=await promisify(execFile)(process.execPath,[worker,'--patch82',job,'--compat82-proof',computerDesign83Base,'--composio-jwks',jwks],{cwd:root,windowsHide:true,encoding:'utf8',timeout:240000,maxBuffer:1024*1024});await writeFile(path.join(out,'comparator.log'),executed.stdout+executed.stderr);
  const accepted=await json(receipt),compared=await json(accepted.evidence);assert(accepted.success&&compared.success&&compared.productionProfileReadOnly&&compared.providerRequests===0);assert.equal(await hash(originalFile),e.originalComparatorSha256);assert.equal(await hash('F:/Agentopia-Data/profiles/a91a4800-e08f-4440-a4ec-588762d01bfd/profile/credentials.bin'),compared.encryptedAfterSha256);if(postInspection){assert.equal(await hash(originalReceipt),originalReceiptSha256);e.originalReceipt=originalReceipt;e.originalReceiptSha256=originalReceiptSha256;e.originalReceiptUnchanged=true;}
  assert(compared.comparison.beforeSettings===112&&compared.comparison.afterSettings===112&&compared.comparison.allOtherProtectedSettingsIdentical&&compared.comparison.allProviderConnectionValuesIdentical&&compared.comparison.imageGenerationDisabled);
  e.comparisonEvidence=accepted.evidence;e.comparison=compared.comparison;e.encryptedAfterSha256=compared.encryptedAfterSha256;e.frozenComparatorUnchanged=true;e.success=true;await save();console.log(JSON.stringify({success:true,evidence:path.join(out,'evidence.json'),comparisonEvidence:e.comparisonEvidence,comparison:e.comparison,providerRequests:0,productionProfileReadOnly:true}));
 }catch(error){e.error=error.message;if(error.stdout||error.stderr)await writeFile(path.join(out,'private-comparator-failure.log'),String(error.stdout??'')+String(error.stderr??''));await save();throw error;}
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(import.meta.filename))await audit();
