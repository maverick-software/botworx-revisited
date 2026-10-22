const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {CodexHarness}=require('../build/codex-harness.js'),{ChatDrafts}=require('../build/chat-drafts.js'),{childChatPath,parseChildChatPath}=require('../build/native-navigation.js');
test('dedicated child routes and drafts remain separate from the main chat and other accounts',async()=>{
 const owner=randomUUID(),other=randomUUID(),requestId=randomUUID(),threadId=randomUUID(),conversationId=randomUUID(),child={requestId,threadId};
 const route=childChatPath(conversationId,child);assert.deepEqual(parseChildChatPath(route),{conversationId,child});assert.equal(parseChildChatPath(route+'/extra'),null);assert.equal(parseChildChatPath('/conversations/'+conversationId),null);
 const values=new Map(),secrets={get:key=>values.get(key),set:async(key,value)=>values.set(key,structuredClone(value))},drafts=new ChatDrafts(secrets),scope='child:'+requestId+':'+threadId,main='conversation:'+conversationId;
 await drafts.save(owner,main,{text:'Unsent parent message',options:{files:[]}});await drafts.save(owner,scope,{text:'Independent child guidance',options:{files:[]}});
 assert.equal(drafts.get(other,scope),null);assert.equal(drafts.get(owner,main).text,'Unsent parent message');assert.equal(new ChatDrafts(secrets).get(owner,scope).text,'Independent child guidance');await drafts.remove(owner,scope);assert.equal(drafts.get(owner,scope),null);assert.equal(drafts.get(owner,main).text,'Unsent parent message');
});
test('child history reads enforce ownership and return fresh isolated state without resuming execution',async()=>{
 const owner=randomUUID(),requestId=randomUUID(),threadId=randomUUID(),conversationId=randomUUID(),child={threadId,status:'completed',result:'saved result'},row={request_id:requestId,user_id:owner,state:{children:[child]},context:{provider:'openrouter',model:'model'},desktop_requests:{conversation_id:conversationId}};
 const db={from:()=>{const filters=[];const q={select:()=>q,eq:(key,value)=>{filters.push([key,value]);return q;},maybeSingle:async()=>({data:filters.every(([key,value])=>row[key]===value)?row:null,error:null})};return q;}};
 const harness=new CodexHarness(db,{},'','',()=>{},async()=>{});const saved=await harness.readChild(owner,requestId,threadId);assert.equal(saved.child.result,'saved result');saved.child.result='renderer change';assert.equal(row.state.children[0].result,'saved result');assert(!harness.busy);
 harness.contexts.set(requestId,{owner,state:{children:[{...child,status:'running',result:'live result'}]},provider:'openai-oauth',model:'live-model'});const live=await harness.readChild(owner,requestId,threadId);assert.equal(live.child.status,'running');assert.equal(live.provider,'openai-oauth');assert.equal(live.conversationId,conversationId);
 await assert.rejects(harness.readChild(randomUUID(),requestId,threadId),/unavailable/);await assert.rejects(harness.readChild(owner,requestId,randomUUID()),/unavailable/);
});
test('sidebar hydration preserves newer child events and keeps native branches and provider labels distinct',()=>{
 const {mergeChildViews}=require('../build/native-navigation.js'),entry=(requestId,updatedAt,result)=>({requestId,conversationId:'parent',provider:'openrouter',model:'selected-model',child:{threadId:'child',updatedAt,result}});
 const current=entry('request','2026-10-16T20:02:00Z','live result'),stale=entry('request','2026-10-16T20:01:00Z','old result');let rows=mergeChildViews([current],[stale]);assert.equal(rows[0].child.result,'live result');rows=mergeChildViews(rows,[entry('another-native-branch','2026-10-16T20:03:00Z','other result')]);assert.equal(rows.length,2);const event={...entry('request','2026-10-16T20:04:00Z','new result'),provider:'',model:''};rows=mergeChildViews(rows,[event]);assert.equal(rows[0].provider,'openrouter');assert.equal(rows[0].model,'selected-model');assert.equal(rows[0].child.result,'new result');
});
