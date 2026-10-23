import assert from 'node:assert/strict';
import path from 'node:path';
import {writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {expect} from '@playwright/test';

export async function inspectLibraryRecovery71(_,f){
 const req=globalThis.__durableProbeRequire,assert=req('node:assert/strict'),crypto=req('node:crypto'),fs=req('node:fs/promises');
 const b=globalThis.__coordination.broker,owner=(await b.identity()).id;assert.equal(owner,f.owner);
 const main=await b.agentDocuments.snapshot(owner,f.agent),peer=await b.agentDocuments.snapshot(owner,f.peer);
 assert.deepEqual(main.documents.map(row=>row.id).sort(),f.documents.slice(0,2).sort());
 assert.deepEqual(peer.documents.map(row=>row.id),[f.documents[2]]);
 for(let index=0;index<3;index++){
  await assert.rejects(fs.lstat(f.inputPaths[index]),error=>error.code==='ENOENT');
  const result=await b.admin.rpc('desktop_read_agent_document',{p_user:owner,p_agent:index<2?f.agent:f.peer,p_id:f.documents[index],p_original:true});
  if(result.error)throw Error(result.error.message);
  assert.equal(crypto.createHash('sha256').update(Buffer.from(result.data.base64,'base64')).digest('hex'),f.originals[index]);
 }
 const guard=async()=>assert.equal((await b.identity()).id,owner),signal=new AbortController().signal;
 const text=await b.agentDocuments.execute(owner,main,'read_agent_document',{document_id:f.documents[0],offset:0,characters:16000},guard,signal);
 const peerText=await b.agentDocuments.execute(owner,peer,'read_agent_document',{document_id:f.documents[2],offset:0,characters:16000},guard,signal);
 assert(text.text.includes(f.marker)&&text.text.includes('74 apples'));assert(peerText.text.includes(f.peerMarker)&&peerText.text.includes('47 pears'));
 const pages=await b.agentDocuments.execute(owner,main,'read_agent_document_pages',{document_id:f.documents[1],pages:[3]},guard,signal);
 assert.equal(pages.pageImages[0].page,3);const image=pages.pageImages[0].image;
 const pageSha256=crypto.createHash('sha256').update(Buffer.from(image.split(',')[1],'base64')).digest('hex');assert.equal(pageSha256,f.pageSha256);
 assert.equal(b.imageConnections.status(owner).connection.enabled,false);
 const revisions=await b.admin.from('desktop_media_revisions').select('version,sha256,bytes').eq('media_id',f.documents[0]).eq('user_id',owner);if(revisions.error)throw Error(revisions.error.message);const history=revisions.data.map(row=>{const digest=crypto.createHash('sha256').update(Buffer.from(row.bytes.slice(2),'hex')).digest('hex');assert.equal(digest,row.sha256);return {version:row.version,sha256:digest};}).sort((a,b)=>a.version-b.version);assert.deepEqual(history,f.library.history);
 return {originalHashes:f.originals,pageSha256,pageImage:image,documents:3,retainedRevisions:history,imagesDisabled:true};
}

export async function finishNativeLibraryRecovery71({application,page,f,saved,progress,checkpoint,e,out,check,inheritedOriginalResponses=0}){
 const call=(action,args)=>page.evaluate(({action,args})=>window.agentopia.call(action,args),{action,args});
 await application.evaluate(async(_,f)=>{const b=globalThis.__coordination.broker;await b.secrets.setMany([
  ['openai:'+f.owner,{client_id:'controlled-document-client',subject:'controlled-document-subject',email:'controlled@qa.invalid',id_token:'CONTROLLED',access_token:'CONTROLLED-NOT-A-PROVIDER-CREDENTIAL',refresh_token:'',scope:'chatgpt.tokens.use.direct',expires_at:Date.now()+3600000}],
  ['models:openai-oauth:'+f.owner,[{id:'gpt-6.1-sol',name:'GPT-6.1 Sol',thinking:['default','low'],supportsTools:true}]],['chatgpt-welcome:'+f.owner,true]
 ]);},f);
 const request=async id=>application.evaluate(async(_,id)=>{const b=globalThis.__coordination.broker,r=await b.admin.from('desktop_requests').select('status,error,conversation_id').eq('id',id).maybeSingle();if(r.error)throw Error(r.error.message);return r.data;},id);
 const turn=async id=>application.evaluate(async(_,id)=>{const r=await globalThis.__coordination.broker.admin.from('desktop_codex_turns').select('thread_id,context').eq('request_id',id).single();if(r.error)throw Error(r.error.message);return r.data;},id);
 async function read(id,conversation,text){
  const old=await request(id);if(old){assert.equal(old.status,'completed','Inspect an uncertain request instead of replaying it.');assert.equal(old.conversation_id,conversation);return false;}
  await application.evaluate((_,{id,f,text})=>{const code='const t=ALL_TOOLS.find(t=>t.name.endsWith("read_agent_document"));if(!t)throw Error("Missing restored document reader");const r=await tools[t.name]('+JSON.stringify({document_id:f.documents[0],offset:0,characters:16000})+');for(const c of r.content??[])if(c.type==="text")text(c.text);';globalThis.__coordination.requests[id]={steps:[{kind:'exec',code},{text,requireInputs:[f.marker,'74 apples']}]};},{id,f,text});
  await call('chat.start',{requestId:id,conversationId:conversation,agentId:f.agent,text:'Read the assigned orchard reference after recovery.',options:{provider:'openai-oauth',model:'gpt-6.1-sol',thinking:'low',permission:'files',mode:'chat',files:[]}});
  await expect.poll(async()=>{const r=await request(id);if(['failed','cancelled','interrupted'].includes(r?.status))throw Error(r.error??r.status);return r?.status;},{timeout:120000,intervals:[200,500,1000]}).toBe('completed');return true;
 }
 const originalSubmitted=await read(progress.requestId,f.conversation,f.marker+' restored document read complete.');
 const changed=await turn(progress.requestId),original=saved.tables.desktop_codex_turns.find(row=>row.request_id===f.directRequest);
 const current=await application.evaluate(async(_,f)=>(await globalThis.__coordination.broker.agentDocuments.snapshot(f.owner,f.agent)).key,f);
 assert.notEqual(original.context.agentDocuments.key,current);assert.equal(changed.context.agentDocuments.key,current);assert.notEqual(changed.thread_id,original.thread_id);
 e.scopeChangedContinuation={requestId:progress.requestId,originalNativeThread:original.thread_id,nativeThread:changed.thread_id,savedReferenceScopeChanged:true,freshNativeThreadRequired:true,controlledResponses:originalSubmitted?2:inheritedOriginalResponses};
 assert.equal(e.scopeChangedContinuation.controlledResponses,2);
 if(!progress.stableRequestId){progress.stableRequestId=randomUUID();await writeFile(checkpoint,JSON.stringify(progress,null,2));}
 const stableSource=saved.tables.desktop_codex_turns.find(row=>row.request_id===f.parentRequest);assert(stableSource);assert.equal(stableSource.context.agentDocuments.key,current);
 const stableSubmitted=await read(progress.stableRequestId,f.parentConversation,f.marker+' restored current-scope reference read complete.');
 const stable=await turn(progress.stableRequestId);assert.equal(stable.context.scope,stableSource.context.scope);assert.equal(stable.thread_id,stableSource.thread_id);
 const calls=await application.evaluate(()=>globalThis.__coordination.calls);assert.equal(calls.length,(originalSubmitted?2:0)+(stableSubmitted?2:0));
 e.restored.stableNativeThread=stableSource.thread_id;e.continuation={requestId:progress.stableRequestId,nativeThread:stable.thread_id,controlledResponses:2,unchangedSavedScope:true};
 progress.continuationCompleted=true;await writeFile(checkpoint,JSON.stringify(progress,null,2));
 await page.goto('agentopia://app/conversations/'+f.parentConversation);await expect(page.getByText(f.marker+' restored current-scope reference read complete.',{exact:true})).toBeVisible();await page.screenshot({path:path.join(out,'restored-conversation.png')});
 await check('Changed saved references require a fresh native thread; a separate restored conversation with unchanged references resumes its original native thread and reads retained text through the real bridge.');
 return {restored:true,controlledResponses:calls.length,savedScopeChangedStartsNewThread:true,unchangedSavedScopeResumesSameThread:true};
}

export async function coldLibraryRecovery71({application,page,f,progress,out}){
 const auth=await page.evaluate(()=>window.agentopia.call('auth.state'));assert.equal(auth.identity?.id,f.owner);
 const docs=await application.evaluate(inspectLibraryRecovery71,f);assert.equal(docs.pageSha256,f.pageSha256);
 const state=await application.evaluate(async(_,{f,progress})=>{const b=globalThis.__coordination.broker,ids=[f.directRequest,f.routerRequest,f.parentRequest,f.namedRequest,f.scheduledRequest,f.library.archiveRequest,f.library.replaceRequest,f.library.pdfRequest,progress.requestId,progress.stableRequestId],r=await b.admin.from('desktop_requests').select('id,status').in('id',ids);if(r.error)throw Error(r.error.message);return {requests:r.data,calls:globalThis.__coordination.calls,blocked:globalThis.__coordination.blocked,errors:globalThis.__coordination.errors};},{f,progress});
 assert.equal(state.requests.length,10);const denied=new Set([f.library.archiveRequest,f.library.replaceRequest]);assert(state.requests.every(row=>row.status===(denied.has(row.id)?'failed':'completed')));assert.deepEqual(state.calls,[]);assert.deepEqual(state.blocked,[]);assert.deepEqual(state.errors,[]);
 await page.goto('agentopia://app/conversations/'+f.parentConversation);await expect(page.getByText(f.marker+' restored current-scope reference read complete.',{exact:true})).toBeVisible();await page.screenshot({path:path.join(out,'cold-restored-conversation.png')});
 return {documents:3,retainedPreviousOriginals:2,completedRequests:8,expectedRevokedRequests:2,inferenceRequests:0};
}
