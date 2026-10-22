import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {expect} from '@playwright/test';

// Only external model responses are controlled. Keep each actual native
// request's input so isolation is checked at the model boundary as well as UI.
export async function observeParallelInputs(application){
 await application.evaluate(()=>{
  const guarded=globalThis.fetch,state=globalThis.__coordination;
  state.parallelInputs=[];
  globalThis.fetch=async(input,args)=>{
   const url=typeof input==='string'?input:input.url??String(input);
   const model=url==='https://api.openai.com/v1/responses'&&args?.method==='POST';
   const index=state.calls.length,body=model?JSON.stringify(JSON.parse(args.body).input):null;
   const response=await guarded(input,args);
   if(model){const routed=state.calls[index];if(!routed)throw Error('Missing native model routing receipt');state.parallelInputs.push({...routed,input:body});}
   return response;
  };
 });
}

export async function runParallelChats({application,page,runtime,out,evidence,save,check}){
 const state=JSON.parse(await runtime.command(['supabase','stack','status','--output-format','json']));
 const {createClient}=await import('@supabase/supabase-js'),db=createClient(state.env.API_URL,state.env.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const data=r=>{if(r.error)throw Error(r.error.message);return r.data;};
 const call=(action,args)=>page.evaluate(({action,args})=>window.agentopia.call(action,args),{action,args});
 const account={email:'parallel-'+randomUUID()+'@example.invalid',password:randomUUID()+randomUUID()};
 const user=data(await db.auth.admin.createUser({...account,email_confirm:true})).user;
 const role=data(await db.from('roles').select('id').eq('name','admin').single());
 data(await db.from('user_roles').insert({user_id:user.id,role_id:role.id}));evidence.fixtureUser=user.id;await save();
 await application.evaluate(async(_,owner)=>{
  const b=globalThis.__coordination.broker;
  await b.secrets.set('openai:'+owner,{client_id:'controlled-private-client',subject:'controlled-subject',email:'controlled@example.invalid',id_token:'CONTROLLED',access_token:'CONTROLLED-NOT-A-PROVIDER-CREDENTIAL',refresh_token:'',scope:'chatgpt.tokens.use.direct',expires_at:Date.now()+3600000});
  await b.secrets.set('models:openai-oauth:'+owner,[{id:'gpt-6.1-sol',name:'GPT-6.1 Sol',thinking:['default','low','high'],supportsTools:true}]);
  await b.secrets.set('prefer-chatgpt:'+owner,true);await b.secrets.set('chatgpt-welcome:'+owner,true);
 },user.id);
 await page.getByLabel('Email address',{exact:true}).fill(account.email);
 await page.getByLabel('Password',{exact:true}).fill(account.password);
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByRole('button',{name:'Account menu',exact:true})).toBeVisible({timeout:30000});
 const agent=await call('agents.save',{name:'Parallel acceptance agent',description:'Isolated simultaneous chat check',instructions:'Respond to the current conversation only. Do not use tools.',provider:'openai-oauth',model:'gpt-6.1-sol'});
 const profile=await call('agents.profile',{agentId:agent});
 await call('agents.profile.save',{agentId:agent,value:{...profile,policy:{...profile.policy,tools:[],delegation:false,memory:false,memoryWrite:false}}});
 const current=await call('agents.profile',{agentId:agent});
 const options={harness:'codex',provider:'openai-oauth',model:'gpt-6.1-sol',thinking:'default',permission:'ask',mode:'chat',files:[]};
 const nonce=randomUUID().slice(0,8),titleA='Parallel A '+nonce,titleB='Parallel B '+nonce;
 async function seed(title){
  const result=data(await db.rpc('desktop_begin_agent_chat',{p_user:user.id,p_request:randomUUID(),p_agent:agent,p_conversation:null,p_text:title,p_options:options,p_files:[],p_project:null,p_revision:null,p_plan:null,p_plan_revision:null,p_agent_revision:current.revision,p_parent:null}));
  data(await db.rpc('desktop_checkpoint_chat',{p_user:user.id,p_request:result.id,p_text:'Stored fixture context',p_status:'completed',p_error:null}));return result.conversation_id;
 }
 const a=await seed(titleA),b=await seed(titleB);
 const textA='START-A-'+randomUUID(),textB='START-B-'+randomUUID(),guideA='GUIDE-A-'+randomUUID(),queueB='FOLLOW-B-'+randomUUID(),draftA='DRAFT-A-'+randomUUID(),draftB='DRAFT-B-'+randomUUID();
 const markers={textA,textB,guideA,queueB,draftA,draftB};
 evidence.parallel={agent,a,b,titleA,titleB,markers};await save();
 await application.evaluate((_,{a,b,guideA,queueB})=>{
  const s=globalThis.__coordination;
  s.conversations[a]={steps:[{text:'A-FIRST-UNRELEASED',hold:'parallel-a-first'},{text:'A-STEERED-UNRELEASED',hold:'parallel-a-steered',requireInput:guideA}]};
  s.conversations[b]={steps:[{text:'B-FIRST-COMPLETE',hold:'parallel-b-first'},{text:'B-QUEUED-COMPLETE',requireInput:queueB}]};
 },{a,b,guideA,queueB});
 let firstOpen=true;
 async function open(id){
  if(firstOpen){await page.goto('agentopia://app/conversations/'+id);firstOpen=false;}
  else {
   const row=page.getByRole('region',{name:'Chat history',exact:true}).locator('.history-open').filter({hasText:id===a?titleA:titleB});
   await expect(row).toHaveCount(1);await row.click();
  }
  await expect(page).toHaveURL('agentopia://app/conversations/'+id);
  await expect(page.getByRole('textbox',{name:'Message',exact:true})).toBeEnabled({timeout:30000});
 }
 const composer=()=>page.getByRole('textbox',{name:'Message',exact:true});
 const held=name=>expect.poll(()=>application.evaluate((_,name)=>globalThis.__coordination.streams.has(name),name),{timeout:45000}).toBe(true);
 async function status(id){return data(await db.from('desktop_requests').select('status,error').eq('id',id).eq('user_id',user.id).single());}
 await open(a);await composer().fill(textA);await composer().press('Enter');await held('parallel-a-first');
 await open(b);await composer().fill(textB);await composer().press('Enter');await held('parallel-b-first');
 const running=await application.evaluate(()=>[...globalThis.__coordination.broker.native.running.values()].map(r=>({request:r.request.id,conversation:r.conversation,thread:r.state.threadId,turn:r.state.turnId})));
 assert.equal(running.length,2);assert.equal(new Set(running.map(r=>r.thread)).size,2);
 assert.deepEqual(new Set(running.map(r=>r.conversation)),new Set([a,b]));
 evidence.parallel.requests={a:running.find(r=>r.conversation===a).request,b:running.find(r=>r.conversation===b).request};
 await composer().fill(draftB);await page.screenshot({path:path.join(out,'parallel-two-native-turns.png')});await save();
 await check('Two separate conversation composers run simultaneous actual Codex turns with distinct native threads; switching chats preserves the working state.');

 await open(a);await expect(composer()).toHaveValue('');await composer().fill(guideA);await composer().press('Enter');
 await expect(page.getByLabel('Queued messages')).toContainText(guideA);
 const queued=await call('chat.queue.list',{conversationId:a});assert.equal(queued.length,1);assert.equal(queued[0].text,guideA);
 assert.equal(await application.evaluate(()=>globalThis.__coordination.calls.length),2);
 await open(b);await expect(composer()).toHaveValue(draftB);await expect(page.getByLabel('Queued messages')).toHaveCount(0);
 await open(a);await page.getByRole('button',{name:'Steer queued message',exact:true}).click();await held('parallel-a-steered');
 await expect(page.getByLabel('Queued messages')).toHaveCount(0);
 assert.equal(await application.evaluate(()=>globalThis.__coordination.streams.get('parallel-a-first').aborted),true);
 assert.equal(await application.evaluate(()=>globalThis.__coordination.streams.get('parallel-b-first').aborted),false);
 await page.screenshot({path:path.join(out,'parallel-steering-one-chat.png')});
 await check('Sending during chat A queues by default; its explicit Steer interrupts only A and delivers the guidance to A while B retains its own draft and running response.');

 await page.getByRole('button',{name:'Stop response',exact:true}).click();
 await expect.poll(async()=>(await status(evidence.parallel.requests.a)).status,{timeout:30000}).toBe('cancelled');
 assert.equal(await application.evaluate(()=>globalThis.__coordination.streams.get('parallel-a-steered').aborted),true);
 assert.equal(await application.evaluate(()=>globalThis.__coordination.streams.get('parallel-b-first').aborted),false);
 assert.equal((await status(evidence.parallel.requests.b)).status,'running');
 await composer().fill(draftA);
 await open(b);await expect(composer()).toHaveValue(draftB);await expect(page.getByRole('button',{name:'Stop response',exact:true})).toBeVisible();
 await check('Stopping A cancels its native turn and leaves B running, with independent unsent drafts available when switching between the chats.');

 await composer().fill(queueB);await composer().press('Enter');await expect(page.getByLabel('Queued messages')).toContainText(queueB);
 await application.evaluate(()=>globalThis.__coordination.streams.get('parallel-b-first').release());
 await expect(page.getByText('B-QUEUED-COMPLETE',{exact:true})).toBeVisible({timeout:45000});
 await expect(page.getByText('B-FIRST-COMPLETE',{exact:true})).toBeVisible();
 await expect(page.getByLabel('Queued messages')).toHaveCount(0);await expect(page.getByRole('button',{name:'Stop response',exact:true})).toHaveCount(0);
 const messagesA=await call('messages.list',{conversationId:a}),messagesB=await call('messages.list',{conversationId:b});
 assert(!JSON.stringify(messagesA).includes(textB)&&!JSON.stringify(messagesA).includes(queueB));
 assert(!JSON.stringify(messagesB).includes(textA)&&!JSON.stringify(messagesB).includes(guideA));
 const input=await application.evaluate(()=>globalThis.__coordination.parallelInputs);
 assert.equal(input.length,4);
 for(const r of input){const other=r.conversationId===a?[textB,queueB,draftB]:[textA,guideA,draftA];assert(other.every(text=>!r.input.includes(text)),'Another chat reached the model input');}
 assert(input.some(r=>r.conversationId===a&&r.input.includes(guideA)));
 assert(input.some(r=>r.conversationId===b&&r.input.includes(queueB)));
 evidence.parallel.modelInputs=input;await composer().fill(draftB);await save();
 await check('B completes its response and then its own queued follow-up once. Stored messages and actual model inputs contain no prompt, guidance or draft from the other chat.');

 await verifyParallelPinning({page,call,out,evidence,save,check});
 const network=await application.evaluate(()=>({calls:globalThis.__coordination.calls,blocked:globalThis.__coordination.blocked,errors:globalThis.__coordination.errors}));
 assert.deepEqual(network.blocked,[]);assert.deepEqual(network.errors,[]);evidence.parallel.network=network;await save();
}

export async function verifyParallelPinning({page,call,out,evidence,save,check}){
 const {a,b,titleA,titleB}=evidence.parallel;
 const history=page.getByRole('region',{name:'Chat history',exact:true});
 const group=history.locator(':scope>div').filter({has:page.locator('.section-label').filter({hasText:/^Pinned$/})});
 async function pin(title,unpin=false){
  await history.locator('.history-row').filter({hasText:title}).hover();
  await history.getByRole('button',{name:'Options for '+title,exact:true}).click();
  await page.getByRole('menuitem',{name:unpin?'Unpin':'Pin chat',exact:true}).click();
  // Pinning moves the row into a different group. Wait for that movement
  // before positioning the pointer for the next row's hover-only menu.
  await expect(group.locator('.history-open').filter({hasText:title})).toHaveCount(unpin?0:1);
 }
 const before=await call('conversations.list');
 evidence.parallel.pinStateAtContinuation={a:before.find(c=>c.conversation_id===a).pinned,b:before.find(c=>c.conversation_id===b).pinned};await save();
 if(!evidence.parallel.pinStateAtContinuation.a)await pin(titleA);
 if(!evidence.parallel.pinStateAtContinuation.b)await pin(titleB);
 await expect(group.locator('.history-open')).toHaveCount(2);
 evidence.parallel.pinnedOrder=await group.locator('.history-open').allTextContents();
 await pin(titleA,true);await expect(group.locator('.history-open')).toHaveCount(1);await expect(group).toContainText(titleB);
 const chats=await call('conversations.list');assert.equal(chats.find(c=>c.conversation_id===a).pinned,false);assert.equal(chats.find(c=>c.conversation_id===b).pinned,true);
 await page.screenshot({path:path.join(out,'parallel-pinned-history.png')});await save();
 await check('Both chats can be pinned through their sidebar menus; unpinning A removes only A from Pinned while retaining B and both conversations.');
}

export async function verifyParallelReopen({application,page,out,evidence,save,check,unpinned=false}){
 const {a,b,titleB,markers,requests}=evidence.parallel;
 const call=(action,args)=>page.evaluate(({action,args})=>window.agentopia.call(action,args),{action,args});
 assert.equal((await call('auth.state')).identity.id,evidence.fixtureUser);
 assert.deepEqual(await application.evaluate(()=>globalThis.__coordination.calls),[]);
 const chats=await call('conversations.list');assert.equal(chats.find(c=>c.conversation_id===a).pinned,false);assert.equal(chats.find(c=>c.conversation_id===b).pinned,!unpinned);
 await page.goto('agentopia://app/conversations/'+a);const composer=page.getByRole('textbox',{name:'Message',exact:true});
 await expect(composer).toHaveValue(markers.draftA,{timeout:30000});await expect(page.getByRole('button',{name:'Stop response',exact:true})).toHaveCount(0);
 const messagesA=await call('messages.list',{conversationId:a});assert(messagesA.some(m=>m.metadata?.timing?.requestId===requests.a&&m.metadata.status==='cancelled'));
 await page.goto('agentopia://app/conversations/'+b);await expect(composer).toHaveValue(markers.draftB,{timeout:30000});
 await expect(page.getByText('B-FIRST-COMPLETE',{exact:true})).toBeVisible();await expect(page.getByText('B-QUEUED-COMPLETE',{exact:true})).toBeVisible();await expect(page.getByLabel('Queued messages')).toHaveCount(0);
 const history=page.getByRole('region',{name:'Chat history',exact:true}),group=history.locator(':scope>div').filter({has:page.locator('.section-label').filter({hasText:/^Pinned$/})});
 if(unpinned){await expect(group).toHaveCount(0);await check('A second cold reopening preserves both unpinned chats, saved drafts and completed/cancelled results without replaying model work.');}
 else{
  await expect(group.locator('.history-open')).toHaveCount(1);await expect(group).toContainText(titleB);
  await page.screenshot({path:path.join(out,'parallel-cold-recovered.png')});
  await check('Cold reopening retains A’s cancellation, B’s two saved responses, separate drafts and the selected pin state without starting any model request.');
  await history.locator('.history-row').filter({hasText:titleB}).hover();await history.getByRole('button',{name:'Options for '+titleB,exact:true}).click();await page.getByRole('menuitem',{name:'Unpin',exact:true}).click();await expect(group).toHaveCount(0);
  evidence.parallel.unpinnedAfterReopen=true;await save();
 }
 assert.deepEqual(await application.evaluate(()=>globalThis.__coordination.calls),[]);
}
