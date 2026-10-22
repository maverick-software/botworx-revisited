import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,readdir,lstat,copyFile,link,writeFile,readFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash,list} from './phased-backup-control.mjs';
import {launchDurableProfileProbe} from './launch-durable-profile-probe.mjs';
import {comparePrimarySettings63} from './compare-primary-settings63.mjs';
import {prepareGoogle64Network,snapshotGoogle64Agents,retireGoogle64Fixtures,setupGoogle64,restoreGoogle64,runGoogle64Interface} from './google-document-packaged64-workflow.mjs';
desktopOperation('verify exact64 owned QA document opening, encrypted journal and cold continuity');
const root=path.resolve(import.meta.dirname,'../..'),pointer=await json(path.join(root,'.supabase/desktop-google-editor-release64/current.json')),proof=await json(pointer.proof),prior=(await json(path.join(root,'.supabase/desktop-live-streaming63/1792636247014/intent.json'))).cfg,memory=await json(path.join(root,'.supabase/desktop-live-memory63/1792638894638/evidence.json')),mixed=await json(path.join(root,'.supabase/desktop-live-mixed63/1792638126317/evidence.json')),schedule=await json(path.join(root,'.supabase/desktop-live-schedule63/1792639437415/evidence.json'));
assert(proof.success&&proof.version==='0.44.64'&&memory.success&&mixed.success&&schedule.success);assert.equal(await hash(proof.image),proof.imageSha256);assert(!(await list(true)).includes(prior.distribution));assert.equal(prior.instance,'c0e548ce-f913-4746-9e2e-9a466362c900');
const cleanupIndex=process.argv.indexOf('--cleanup-only'),cleanupOnly=cleanupIndex>=0,out=cleanupOnly?path.resolve(process.argv[cleanupIndex+1]):path.join(proof.out,'packaged-'+Date.now()),program=path.join(out,'private-program'),source='F:/Agentopia-Data/profiles/a91a4800-e08f-4440-a4ec-588762d01bfd/profile',baseline=path.join(out,'primary-baseline');let cfg,fixture,e;
if(cleanupOnly){const saved=await json(path.join(out,'intent.json'));assert(out.startsWith(proof.out+path.sep));cfg=saved.cfg;fixture=saved.fixture;e=await json(path.join(out,'evidence.json'));assert.equal(cfg.imageSha256,proof.imageSha256);}
else{
 await mkdir(program,{recursive:true});for(const name of await readdir(proof.program,{recursive:true})){const from=path.join(proof.program,name),to=path.join(program,name),info=await lstat(from);assert(!info.isSymbolicLink());if(info.isDirectory())await mkdir(to,{recursive:true});else{await mkdir(path.dirname(to),{recursive:true});if(['Agentopia.exe','resources/app.asar','resources/resources/runtime/config.toml'].includes(name.replaceAll('\\','/')))await copyFile(from,to);else await link(from,to);}}
 await copyFile(path.join(prior.program,'resources/resources/runtime/config.toml'),path.join(program,'resources/resources/runtime/config.toml'));
 cfg={...prior,out,program,exe:path.join(program,'Agentopia.exe'),assets:path.join(program,'resources/resources'),imageSha256:proof.imageSha256,temp:path.join(out,'temp')};await mkdir(baseline,{recursive:true});for(const name of ['Local State','credentials.bin'])await copyFile(path.join(source,name),path.join(baseline,name));
 const marker=randomUUID().slice(0,8),workspace=path.join('F:/Agentopia-Acceptance','google64-'+Date.now(),'workspace');await mkdir(workspace,{recursive:true});const types=[['docx','Word64','Docs','document','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.google-apps.document'],['xlsx','Workbook64','Sheets','spreadsheets','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.google-apps.spreadsheet'],['pptx','Slides64','Slides','presentation','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/vnd.google-apps.presentation']],files=[];
 for(const [extension,label,editor,editorPath,mimetype,target]of types){const file=path.join(workspace,'Google64-'+marker+'.'+extension);await copyFile(path.join(root,'desktop/tests/fixtures/documents/sample.'+extension),file);const bytes=await readFile(file);files.push({path:file,name:path.basename(file),extension,label,editor,editorPath,mimetype,target,sha256:createHash('sha256').update(bytes).digest('hex'),md5:createHash('md5').update(bytes).digest('hex')});}
 const retire=[];for(const previous of ['1792641958038/packaged-1792642845659','1792643177855/packaged-1792643410393']){const failure=await json(path.join(root,'.supabase/desktop-google-editor-release64',previous,'evidence.json'));assert(failure.cleanup?.restored&&failure.modelRequests===0);retire.push(failure.googleChat.conversation);}
 fixture={owner:cfg.owner,namespace:randomUUID(),connectionId:randomUUID(),marker,files,retire};e={success:false,at:new Date().toISOString(),version:proof.version,out,imageSha256:proof.imageSha256,actualPostgreSQL:true,actualIPC:true,encryptedJournal:true,simulatedComposio:true,realComposioRequests:0,modelRequests:0,productionWrites:0,checks:[],phase:'prepared'};await writeFile(path.join(out,'intent.json'),JSON.stringify({cfg,fixture,sourceProof:pointer.proof},null,2));
}
const save=()=>writeFile(path.join(out,'evidence.json'),JSON.stringify(e,null,2));await save();
const expected={own:memory.profiles.own,foreign:memory.profiles.foreign,requests:[memory.ownRequest,memory.foreignRequest,mixed.rootRequest,mixed.childRequest,schedule.requestId]};
try{
 for(const cold of cleanupOnly?[true]:[false,true]){
  const sessionFixture={...fixture,cloud:cold?e.warmGoogle?.cloud??[]:[]};
  const result=await launchDurableProfileProbe(cfg,{testProfile:false,initialProfile:cfg.target,expectedProfile:cfg.target,expectedRuntime:'ready',resumeDebugWorkers:true,isolateOsHome:true,label:cleanupOnly?'cleanup-google64-'+Date.now():cold?'cold-google64':'warm-google64',prepareReady:application=>prepareGoogle64Network(application,sessionFixture),runReady:async({application,page})=>{
   if(cleanupOnly){e.cleanup=await restoreGoogle64(application,fixture);e.phase='recovered-fixture-settings';await save();return e.cleanup;}
   let retain=false;
   try{
    if(!cold)e.retiredFixtureChats=await retireGoogle64Fixtures(application,cfg,fixture);
    const before=await snapshotGoogle64Agents(application,cfg,expected);if(cold)assert.deepEqual(before,e.agentsBefore);else{e.agentsBefore=before;e.googleChat=await setupGoogle64(application,cfg,fixture);e.phase='fixture-created';await save();}
    await runGoogle64Interface({application,page,cfg,fixture,e,cold,save});const after=await snapshotGoogle64Agents(application,cfg,expected);assert.deepEqual(after,e.agentsBefore);assert.equal(await application.evaluate(()=>globalThis.__coordination.calls.length),0);
    e.checks.push((cold?'Cold reopening':'Packaged64')+' retains the saved compact/coordinator/specialist definitions, SOPs, tool/memory restrictions, memory content hashes and five completed real requests without replay.');
    if(cold){e.cleanup=await restoreGoogle64(application,fixture);await page.evaluate(({conversation})=>window.agentopia.call('conversations.manage',{conversationId:conversation,action:'archive'}),{conversation:e.googleChat.conversation});await page.goto('agentopia://app/conversations/'+cfg.compact.conversation);e.phase='cold-verified-and-restored';}else{retain=true;e.phase='warm-verified-awaiting-cold';}
    await save();return {documentOpening:true,savedAgents:true,noInference:true,simulatedCloud:true,cold,protectedFixtureRestored:cold};
   }catch(error){e.workflowError=error.message;throw error;}finally{if(!retain&&!e.cleanup?.restored){e.cleanup=await restoreGoogle64(application,fixture);await save();}}
  }});
  assert(result.success&&result.normalExit===0);assert(!(await list(true)).includes(cfg.distribution));e[cold?'coldProbe':'warmProbe']=result.out;await save();
 }
 for(const file of fixture.files)assert.equal(await hash(file.path),file.sha256);e.primaryComparison=await comparePrimarySettings63({out,source,baseline,proof});assert(e.primaryComparison.protectedNonSessionValuesEqual);assert(e.cleanup?.restored);e.success=true;e.phase=cleanupOnly?'cleanup-complete':'accepted';await save();
 if(!cleanupOnly)await writeFile(path.join(proof.out,'packaged-accepted.json'),JSON.stringify({success:true,at:new Date().toISOString(),version:proof.version,imageSha256:proof.imageSha256,evidence:path.join(out,'evidence.json'),coldReopening:true,agentContinuity:true,officeTypes:['docx','xlsx','pptx'],actualPostgreSQL:true,actualFileIPC:true,encryptedOperationPersistence:true,creationReplaySuppressed:true,protectedFixtureRestored:true,realComposioRequests:0,realProviderRequests:0,ordinaryProfileUpdated:false},null,2),{flag:'wx'});
}catch(error){e.error=error.message;e.cause=error.cause?.message;await save();process.exitCode=1;}
console.log(JSON.stringify({success:e.success,out,checks:e.checks.length,phase:e.phase,error:e.error,cause:e.cause,realProviderRequests:0,realComposioRequests:0}));
