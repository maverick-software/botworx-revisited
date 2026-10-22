import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash,list} from './phased-backup-control.mjs';
import {launchDurableProfileProbe} from './launch-durable-profile-probe.mjs';
import {verifyNativePdf63} from './pdf-pages-packaged63-workflow.mjs';
desktopOperation('exact63 native PDF page tool transport and saved cold receipt acceptance');
const root=path.resolve(import.meta.dirname,'../..'),proof=await json((await json(path.join(root,'.supabase/desktop-pdf-pages-release63/current.json'))).proof),packaged=await json(path.join(proof.out,'packaged-accepted.json')),prior=await json(packaged.evidence),intent=await json(path.join(prior.out,'intent.json')),out=path.join(proof.out,'native-pdf-'+Date.now()),cfg={...intent.cfg,out,temp:path.join(out,'temp')},e={success:false,out,imageSha256:proof.imageSha256,checks:[],pdfPages:prior.pdfPages,realProviderRequests:0},save=()=>writeFile(path.join(out,'evidence.json'),JSON.stringify(e,null,2));
assert(packaged.success&&packaged.scannedPdfPersistence);assert.equal(await hash(path.join(cfg.program,'resources/app.asar')),proof.imageSha256);assert(!(await list(true)).includes(cfg.distribution));await mkdir(out);await save();
try{for(const cold of [false,true]){const result=await launchDurableProfileProbe(cfg,{testProfile:false,initialProfile:cfg.target,expectedProfile:cfg.target,expectedRuntime:'ready',resumeDebugWorkers:true,isolateOsHome:true,label:cold?'cold-native-pdf63':'native-pdf63',runReady:args=>verifyNativePdf63({...args,cfg,out,cold,evidence:e,save})});assert(result.success&&result.normalExit===0);assert(!(await list(true)).includes(cfg.distribution));}e.success=true;await save();await writeFile(path.join(proof.out,'native-pdf-accepted.json'),JSON.stringify({success:true,imageSha256:proof.imageSha256,evidence:path.join(out,'evidence.json'),controlledResponses:2,coldNoReplay:true,realProviderRequests:0},null,2),{flag:'wx'});}catch(error){e.error=error.message;e.cause=error.cause?.message;await save();process.exitCode=1;}
console.log(JSON.stringify({success:e.success,out,checks:e.checks,error:e.error,cause:e.cause,realProviderRequests:0}));
