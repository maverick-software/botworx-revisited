import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..'),file=path.join(root,'scripts/desktop/accept-chrome-context-packaged60.mjs'),prior=await readFile(file,'utf8'),start=prior.indexOf('function helpers('),end=prior.indexOf("try{\n const first=");assert(start>=0&&end>start);
let functions=prior.slice(start,end).replaceAll('Exact60','Exact61');
const script=`import assert from 'node:assert/strict';
import {mkdir,readdir,lstat,copyFile,link,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {expect} from '@playwright/test';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash,list} from './phased-backup-control.mjs';
import {launchDurableProfileProbe} from './launch-durable-profile-probe.mjs';
import {verifyImageAttachments61} from './image-attachment-packaged61-workflow.mjs';
desktopOperation('exact61 packaged image, database, agent and cold reopening acceptance');
const root=path.resolve(import.meta.dirname,'../..'),pointer=await json(path.join(root,'.supabase/desktop-image-attachment-release61/current.json')),proof=await json(pointer.proof),base=await json(proof.acceptedBase),liveBase=await json(path.join(root,'.supabase/desktop-agent-report-release57/1792613505169/package-proof.json')),live=await json(path.join(liveBase.out,'live-report-1792616428861/evidence.json'));assert(proof.version==='0.44.61'&&live.success&&live.liveProviderRequests===6);assert.equal(await hash(proof.image),proof.imageSha256);
let ancestor=base,accepted;for(let depth=0;depth<12;depth++){try{accepted=await json(path.join(ancestor.out,'integrated-migration-accepted.json'));break;}catch(error){if(error.code!=='ENOENT')throw error;ancestor=await json(ancestor.acceptedBase);}}assert(accepted?.success);const prior=await json(accepted.intent),previous=await json(prior.sourceEvidence),resumeFile=process.argv[2],resume=resumeFile?await json(resumeFile):null,out=path.join(proof.out,'packaged-'+Date.now()),program=resume?path.join(resume.out,'private-program'):path.join(out,'private-program');assert(!(await list(true)).includes(prior.distribution));await mkdir(out,{recursive:true});
if(resume){assert(!resume.success&&resume.checks.length===0&&resume.modelRequests===0&&resume.imageSha256===proof.imageSha256&&resume.imageAttachments?.ids?.length===2);const stopped=await json(path.join(resume.out,'first61/evidence.json'));assert(stopped.error.includes("reading 'profile'"));assert.equal(await hash(path.join(program,'resources/app.asar')),proof.imageSha256);}else{
await mkdir(program,{recursive:true});for(const name of await readdir(proof.program,{recursive:true})){const from=path.join(proof.program,name),to=path.join(program,name),info=await lstat(from);assert(!info.isSymbolicLink());if(info.isDirectory())await mkdir(to,{recursive:true});else{await mkdir(path.dirname(to),{recursive:true});if(['Agentopia.exe','resources/app.asar','resources/resources/runtime/config.toml'].includes(name.replaceAll('\\\\','/')))await copyFile(from,to);else await link(from,to);}}
await copyFile(path.join(prior.assets,'runtime/config.toml'),path.join(program,'resources/resources/runtime/config.toml'));}
const cfg={...prior,out,program,exe:path.join(program,'Agentopia.exe'),assets:path.join(program,'resources/resources'),imageSha256:proof.imageSha256,temp:path.join(out,'temp')},e={success:false,at:new Date().toISOString(),out,version:proof.version,imageSha256:proof.imageSha256,actualPostgreSQL:true,modelRequests:0,checks:[],...(resume?{imageAttachments:resume.imageAttachments,resumedFrom:resumeFile,completedAttachmentsNotRepeated:true}:{})},save=()=>writeFile(path.join(out,'evidence.json'),JSON.stringify(e,null,2)),check=async name=>{e.checks.push(name);await save();console.log('PASS '+name);};let draft;await save();
${functions}
try{
 for(const cold of [false,true]){const result=await launchDurableProfileProbe(cfg,{testProfile:false,initialProfile:prior.target,expectedProfile:prior.target,expectedRuntime:'ready',resumeDebugWorkers:true,isolateOsHome:true,label:cold?'cold61':'first61',runReady:async args=>{await verifyImageAttachments61({...args,cfg,out,cold,evidence:e,save,check});return verifySaved(args,cold);}});assert(result.success&&result.normalExit===0);await save();}
 e.success=true;await save();await writeFile(path.join(proof.out,'packaged-accepted.json'),JSON.stringify({success:true,version:proof.version,imageSha256:proof.imageSha256,evidence:path.join(out,'evidence.json'),coldReopening:true,agentContinuity:true,formattedDocuments:true,chromeSnapshotColdPersistence:true,imageAttachments:true,realPostgreSQLImagePersistence:true,nativeToolImageContent:true,originalImagePreserved:true,newProviderRequests:0,liveVisionUnderstandingTested:false},null,2),{flag:'wx'});
}catch(error){e.error=error.stack;e.cause=error.cause?.message;await save();process.exitCode=1;}
console.log(JSON.stringify({success:e.success,out,checks:e.checks.length,newProviderRequests:0,error:e.error}));
`;
await writeFile(path.join(root,'scripts/desktop/test-image-packaged61.mjs'),script);
