import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,writeFile,copyFile,unlink} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {expect} from '@playwright/test';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash,list} from './phased-backup-control.mjs';
import {launchDurableProfileProbe} from './launch-durable-profile-probe.mjs';

desktopOperation('actual packaged71 library management and in-flight native scope revocation');
const root=path.resolve(import.meta.dirname,'../..'),pointer=await json(path.join(root,'.supabase/desktop-agent-library71-real/current.json'));
const cfg=await json(pointer.sourceIntent),proof=await json(pointer.candidateFile),checkpoint=path.join(cfg.out,'document-fixture.json'),f=await json(checkpoint);
assert(cfg.role==='source'&&proof.version==='0.44.71'&&f.inputsRemoved);
assert((await json(path.join(cfg.out,'documents-seed-accepted.json'))).success);
assert.equal(await hash(path.join(cfg.program,'resources/app.asar')),proof.imageSha256);assert(!(await list(true)).includes(cfg.distribution));
const resumeIndex=process.argv.indexOf('--resume-evidence'),resumeFile=resumeIndex<0?null:path.resolve(process.argv[resumeIndex+1]),finishIndex=process.argv.indexOf('--finish-evidence'),finishFile=finishIndex<0?null:path.resolve(process.argv[finishIndex+1]);assert(!(resumeFile&&finishFile));
let prior;
if(finishFile){
 assert(finishFile.startsWith(cfg.out+path.sep));prior=await json(finishFile);const probe=await json(path.join(prior.out,'app/evidence.json'));assert.equal(probe.failureCleanupNormalExit,0);assert.equal(prior.imageSha256,proof.imageSha256);assert.equal(f.library.phase,'replacement-page-read');assert.equal(prior.checks.length,4);assert(prior.error.includes('column desktop_media_revisions.original does not exist'));assert.equal(probe.controlledNetwork.calls.length,3);assert.equal(prior.archive.requestStatus,'failed');assert.equal(prior.replace.requestStatus,'failed');assert.equal(prior.pdf.pageSha256,f.pageSha256);
}else if(resumeFile){
 assert(resumeFile.startsWith(cfg.out+path.sep));prior=await json(resumeFile);const probe=await json(path.join(prior.out,'app/evidence.json'));
 assert.equal(prior.imageSha256,proof.imageSha256);assert.equal(probe.failureCleanupNormalExit,0);
 assert(f.libraryStarted&&f.library.phase==='metadata-saved'&&prior.checks.length===1&&prior.error.includes('403 Forbidden'));
 assert.equal(probe.controlledNetwork.calls.length,1);assert.equal(probe.controlledNetwork.calls[0].requestId,f.library.archiveRequest);
}else{
 assert(!f.libraryStarted,'Inspect the saved lifecycle phase and request state before any continuation. Never replay this workflow blindly.');
 f.libraryStarted=true;f.library={archiveRequest:randomUUID(),replaceRequest:randomUUID(),pdfRequest:randomUUID(),phase:'prepared'};
 await writeFile(checkpoint,JSON.stringify(f,null,2));
}
const out=path.join(cfg.out,'library-'+Date.now());await mkdir(out);
const e={success:false,at:new Date().toISOString(),out,imageSha256:proof.imageSha256,controllerSha256:await hash(import.meta.filename),actualPackagedApp:true,actualPostgres:true,actualCodexHarness:true,productionAccess:false,realProviderRequests:0,installed:false,checks:[]};
if(prior){e.priorPassedEvidence=finishFile??resumeFile;e.checks=[...prior.checks];if(finishFile){e.archive=prior.archive;e.replace=prior.replace;e.pdf=prior.pdf;e.finalizationOnly=true;}}
const save=()=>writeFile(path.join(out,'evidence.json'),JSON.stringify(e,null,2));
const phase=async value=>{f.library.phase=value;await writeFile(checkpoint,JSON.stringify(f,null,2));};
const check=async text=>{e.checks.push(text);await save();console.log('PASS '+text);};await save();
const toolCode=(name,args)=>'const tool=ALL_TOOLS.find(t=>t.name.endsWith('+JSON.stringify(name)+'));if(!tool)throw Error("Missing document tool");const result=await tools[tool.name]('+JSON.stringify(args)+');for(const content of result.content??[]){if(content.type==="image")image(content);else if(content.type==="text")text(content.text);}';
try{
 const result=await launchDurableProfileProbe(cfg,{label:path.relative(cfg.out,path.join(out,'app')),testProfile:false,initialProfile:cfg.profile,expectedProfile:cfg.profile,expectedRuntime:'ready',resumeDebugWorkers:true,isolateOsHome:true,evaluationTimeoutMs:15*60000,normalCloseTimeoutMs:120000,
  prepareReady:application=>application.evaluate(({dialog})=>{
   globalThis.__library71Picker=[];
   dialog.showOpenDialog=async options=>{if(options.title!=='Replace the library document file')throw Error('Unexpected lifecycle picker');const files=globalThis.__library71Picker;globalThis.__library71Picker=[];return {canceled:!files.length,filePaths:files};};
   const real=globalThis.fetch;globalThis.fetch=async(input,args)=>{
    const url=new URL(typeof input==='string'?input:input.url??String(input));
    if(url.href==='https://openrouter.ai/api/v1/models')return Response.json({data:[{id:'openai/gpt-6.1-sol',name:'Controlled compatible model',supported_parameters:['tools','reasoning'],architecture:{input_modalities:['text','image'],output_modalities:['text']}}]});
    if(url.href==='https://openrouter.ai/api/v1/responses')return real('https://api.openai.com/v1/responses',args);
    return real(input,args);
   };
  }),
  runReady:async({application,page})=>{
   const call=(action,args)=>page.evaluate(({action,args})=>window.agentopia.call(action,args),{action,args});assert.equal((await call('auth.state')).identity?.id,f.owner);
   await application.evaluate(async(_,f)=>{const b=globalThis.__coordination.broker,c=b.secrets.get('openai:'+f.owner);if(c?.access_token!=='CONTROLLED-NOT-A-PROVIDER-CREDENTIAL')throw Error('Generated connection changed');await b.secrets.set('openai:'+f.owner,{...c,expires_at:Date.now()+3600000,refresh_token:''});},f);
   const settings=()=>call('agentSettings.get',{agentId:f.agent});
   const row=async()=>{const value=(await settings()).documents.find(row=>row.id===f.documents[0]);assert(value);return value;};
   const expected=value=>({version:value.version,updatedAt:value.updated_at});
   const update=async(operation,value={})=>call('agentSettings.documents.update',{agentId:f.agent,id:f.documents[0],expected:expected(await row()),operation,value});
   const status=id=>application.evaluate(async(_,id)=>{const r=await globalThis.__coordination.broker.admin.from('desktop_requests').select('status,error,conversation_id').eq('id',id).maybeSingle();if(r.error)throw Error(r.error.message);return r.data;},id);
   const plan=(id,rule)=>application.evaluate((_,{id,rule})=>{globalThis.__coordination.requests[id]=rule;},{id,rule});
   const start=async(id,provider)=>{assert.equal(await status(id),null,'Existing native requests must be inspected, never replayed.');return call('chat.start',{requestId:id,agentId:f.agent,text:'Verify the current assigned library scope through its document tool.',options:{provider,model:provider==='openrouter'?'openai/gpt-6.1-sol':'gpt-6.1-sol',thinking:provider==='openrouter'?'default':'low',permission:'files',mode:'chat',files:[]}});};
   const finish=async id=>{await expect.poll(async()=>{const r=await status(id);if(['failed','cancelled','interrupted'].includes(r?.status))throw Error(r.error??r.status);return r?.status;},{timeout:120000,intervals:[200,500,1000]}).toBe('completed');};
   const finishStale=async id=>{await expect.poll(async()=>{const r=await status(id);if(['cancelled','interrupted'].includes(r?.status))throw Error(r.error??r.status);return ['completed','failed'].includes(r?.status);},{timeout:120000,intervals:[200,500,1000]}).toBe(true);};
   const hold=async(id,provider,key)=>{
    await plan(id,{steps:[{kind:'exec',code:toolCode('read_agent_document',{document_id:f.documents[0],offset:0,characters:16000}),hold:key},{text:'The old document scope was rejected.',requireInput:'assigned documents changed',inspectInput:['assigned documents changed','74 apples']}]});
    await start(id,provider);await expect.poll(()=>application.evaluate((_,key)=>globalThis.__coordination.streams.has(key),key),{timeout:120000}).toBe(true);
   };
   const release=key=>application.evaluate((_,key)=>globalThis.__coordination.streams.get(key).release(),key);
   const inspectDenial=async id=>{
    const observation=await application.evaluate(async(_,{id,document})=>{const b=globalThis.__coordination.broker,r=await b.admin.from('desktop_tool_calls').select('name,status,result,error').eq('request_id',id),turn=await b.admin.from('desktop_codex_turns').select('context,state').eq('request_id',id).single();if(r.error||turn.error)throw Error(r.error?.message??turn.error?.message);const state=JSON.stringify(turn.data.state);return {tools:r.data,calls:globalThis.__coordination.calls.filter(row=>row.requestId===id),oldSnapshotAssigned:turn.data.context.agentDocuments.documents.some(row=>row.id===document),savedStateDenial:/assigned documents changed|could not verify this native turn/.test(state),oldTextInSavedState:state.includes('74 apples')};},{id,document:f.documents[0]});
    assert(observation.oldSnapshotAssigned);assert.equal(observation.oldTextInSavedState,false);
    const request=await status(id),second=observation.calls.find(call=>call.index===1);
    if(request.status==='failed')assert.match(request.error,/403 Forbidden.*could not verify this native turn/);
    else{assert.equal(request.status,'completed');assert(second?.inputObservation?.matches['assigned documents changed']);assert.equal(second.inputObservation.matches['74 apples'],false);}
    assert(!observation.tools.some(tool=>tool.status==='completed'&&tool.result?.text?.includes('74 apples')));
    return {requestId:id,requestStatus:request.status,controlledResponses:observation.calls.length,oldSnapshotAssigned:true,requestDenialRecorded:true,savedStateDenial:observation.savedStateDenial,furtherInferenceRefused:request.status==='failed',oldContentReturned:false,toolStatuses:observation.tools.map(tool=>({name:tool.name,status:tool.status}))};
   };

   let current;if(!finishFile){await page.goto('agentopia://app/agents/'+f.agent);await page.getByRole('button',{name:'Edit agent',exact:true}).click();await page.getByRole('button',{name:'Documents',exact:true}).click();
   if(!resumeFile){const original=await row();
   await page.getByRole('button',{name:'Manage '+original.file_name,exact:true}).click();let modal=page.getByRole('dialog');
   await modal.getByLabel('Document name',{exact:true}).fill('Orchard handbook71');await modal.getByLabel('Collection',{exact:true}).fill('Operations');await modal.getByLabel('Tags, separated by commas',{exact:true}).fill('orchard, receipts');await modal.getByLabel('Description',{exact:true}).fill('Generated packaged lifecycle reference.');
   await modal.getByRole('button',{name:'Save details',exact:true}).click();await expect(modal).toHaveCount(0);current=await row();assert.equal(current.display_name,'Orchard handbook71');assert.equal(current.category,'Operations');assert.deepEqual(current.tags.sort(),['orchard','receipts']);
   await assert.rejects(call('agentSettings.documents.update',{agentId:f.agent,id:f.documents[0],expected:expected(original),operation:'archive'}),/changed/);
   await phase('metadata-saved');await check('The actual packaged editor saves library organization to PostgreSQL and rejects a stale metadata token.');

   await call('agentSettings.save',{agentId:f.peer,section:'documents',value:{ids:[f.documents[2],f.documents[0]]}});
   await hold(f.library.archiveRequest,'openai-oauth','library71-archive');await page.getByRole('button',{name:'Manage Orchard handbook71',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Archive document',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
   await release('library71-archive');await finishStale(f.library.archiveRequest);
   }else{const request=await status(f.library.archiveRequest);assert.equal(request.status,'failed');assert.match(request.error,/403 Forbidden.*could not verify this native turn/);assert.equal((await row()).is_archived,true);}
   assert(!(await settings()).documentIds.includes(f.documents[0]));assert(!(await call('agentSettings.get',{agentId:f.peer})).documentIds.includes(f.documents[0]));
   e.archive=await inspectDenial(f.library.archiveRequest);if(resumeFile)e.archive.priorEvidence=resumeFile;
   await assert.rejects(call('agentSettings.save',{agentId:f.agent,section:'documents',value:{ids:f.documents.slice(0,2)}}),/archived|active document/);
   await page.getByLabel('View',{exact:true}).selectOption('archived');await page.getByRole('button',{name:'Manage Orchard handbook71',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Restore document',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
   assert(!(await settings()).documentIds.includes(f.documents[0]));assert(!(await call('agentSettings.get',{agentId:f.peer})).documentIds.includes(f.documents[0]));
   await call('agentSettings.save',{agentId:f.agent,section:'documents',value:{ids:f.documents.slice(0,2)}});await page.getByLabel('View',{exact:true}).selectOption('active');await page.getByRole('button',{name:'Refresh library',exact:true}).click();
   await phase('archive-denied-and-restored');await check('Archiving revokes both agents while a real OAuth-native response is waiting; its old tool scope returns an error without document text, and restoration grants no assignment.');

   const input=path.join(cfg.home,'replacement71.pdf');await copyFile(path.join(proof.source,'tests/fixtures/pdf-pages/scanned-3-pages.pdf'),input);f.library.replacementHash=await hash(input);f.library.replacementPath=input;await phase('replacement-prepared');
   await hold(f.library.replaceRequest,'openrouter','library71-replace');await application.evaluate((_,file)=>{globalThis.__library71Picker=[file];},input);await page.getByRole('button',{name:'Manage Orchard handbook71',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Replace file',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0,{timeout:60000});await unlink(input);
   current=await row();assert.equal(current.version,2);assert.equal(current.file_extension,'.pdf');assert.equal(current.display_name,'Orchard handbook71');assert.equal(current.category,'Operations');assert((await settings()).documentIds.includes(f.documents[0]));
   await release('library71-replace');await finishStale(f.library.replaceRequest);e.replace=await inspectDenial(f.library.replaceRequest);
   await phase('replacement-denied');await check('The packaged replacement picker retains the PDF and the previous Markdown bytes, preserves organization and assignment, and invalidates an already-running OpenRouter-native tool scope.');

   await plan(f.library.pdfRequest,{steps:[{kind:'exec',code:toolCode('read_agent_document_pages',{document_id:f.documents[0],pages:[3]})},{text:'Current replacement page three received.',requireInput:'input_image',inspectInput:['input_image']}]});await start(f.library.pdfRequest,'openrouter');await finish(f.library.pdfRequest);
   const pdf=await application.evaluate(async(_,f)=>{const b=globalThis.__coordination.broker,crypto=globalThis.__durableProbeRequire('node:crypto'),r=await b.admin.from('desktop_tool_calls').select('name,status,result').eq('request_id',f.library.pdfRequest);if(r.error)throw Error(r.error.message);const tool=r.data.find(row=>row.name==='read_agent_document_pages'&&row.status==='completed');if(!tool||tool.result?.pageImages?.[0]?.page!==3)throw Error('Replacement page three was not read');return {page:3,pageSha256:crypto.createHash('sha256').update(Buffer.from(tool.result.pageImages[0].image.split(',')[1],'base64')).digest('hex')};},f);
   assert.equal(pdf.pageSha256,f.pageSha256);e.pdf=pdf;await phase('replacement-page-read');await check('A fresh OpenRouter-native response reads page three of the replacement PDF from retained database bytes after its input path is removed; the page image reaches native input.');

   await page.getByRole('button',{name:'Manage Orchard handbook71',exact:true}).click();const modal=page.getByRole('dialog');await modal.getByText('File versions',{exact:true}).click();await modal.getByRole('button',{name:'Use version 1',exact:true}).click();await expect(modal).toHaveCount(0);
   }
   if(finishFile){for(const id of [f.library.archiveRequest,f.library.replaceRequest]){const r=await status(id);assert.equal(r.status,'failed');assert.match(r.error,/403 Forbidden.*could not verify this native turn/);}assert.equal((await status(f.library.pdfRequest)).status,'completed');}
   current=await row();assert.equal(current.version,3);assert.equal(current.file_extension,'.md');assert.equal(current.display_name,'Orchard handbook71');
   const retained=await application.evaluate(async(_,f)=>{const b=globalThis.__coordination.broker,crypto=globalThis.__durableProbeRequire('node:crypto'),must=r=>{if(r.error)throw Error(r.error.message);return r.data;};const revisions=must(await b.admin.from('desktop_media_revisions').select('version,sha256,bytes').eq('media_id',f.documents[0]).eq('user_id',f.owner));const history=revisions.map(row=>{const bytes=Buffer.from(row.bytes.slice(2),'hex'),actual=crypto.createHash('sha256').update(bytes).digest('hex');if(actual!==row.sha256)throw Error('Revision original hash differs');return {version:row.version,sha256:actual};}).sort((a,b)=>a.version-b.version);const snapshot=await b.agentDocuments.snapshot(f.owner,f.agent),text=await b.agentDocuments.execute(f.owner,snapshot,'read_agent_document',{document_id:f.documents[0],offset:0,characters:16000},async()=>{},new AbortController().signal);const original=must(await b.admin.rpc('desktop_read_agent_document',{p_user:f.owner,p_agent:f.agent,p_id:f.documents[0],p_original:true}));return {history,currentSha256:crypto.createHash('sha256').update(Buffer.from(original.base64,'base64')).digest('hex'),textReadable:text.text.includes('74 apples'),assignments:snapshot.documents.map(row=>row.id),imagesEnabled:b.imageConnections.status(f.owner).connection.enabled};},f);
   assert.deepEqual(retained.history,[{version:1,sha256:f.originals[0]},{version:2,sha256:f.library.replacementHash}]);assert.equal(retained.currentSha256,f.originals[0]);assert(retained.textReadable);assert.equal(retained.imagesEnabled,false);assert.deepEqual(retained.assignments.sort(),f.documents.slice(0,2).sort());
   f.library.history=retained.history;e.retained=retained;await phase('complete');await check('Using the previous file version restores readable Markdown as version three, preserves both byte-verified prior originals and document assignments, and keeps image generation disabled.');
   await expect.poll(()=>application.evaluate(()=>{const b=globalThis.__coordination.broker;return b.active.size===0&&!b.native.busy;}),{timeout:60000}).toBe(true);
   return {success:true,requests:[f.library.archiveRequest,f.library.replaceRequest,f.library.pdfRequest],revisions:retained.history.length};
  }});
 assert.equal(result.normalExit,0);assert(!(await list(true)).includes(cfg.distribution));Object.assign(e,{success:true,normalExit:0,runtimeStopped:true,controlledResponses:result.controlledNetwork.calls.length,workflow:result.workflow});await save();
 await writeFile(path.join(cfg.out,'library-lifecycle-accepted.json'),JSON.stringify({success:true,evidence:path.join(out,'evidence.json')},null,2));console.log(JSON.stringify({success:true,evidence:path.join(out,'evidence.json'),checks:e.checks.length,controlledResponses:e.controlledResponses,realProviderRequests:0}));
}catch(error){e.error=error.cause?.stack??error.stack;await save();console.error('Packaged library lifecycle stopped; inspect '+out+' and its saved request IDs before continuation.');process.exitCode=1;}
