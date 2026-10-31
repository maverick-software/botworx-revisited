const {testDistribution}=require('./test-backend.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');const {randomUUID,randomBytes}=require('node:crypto');
const {mkdtemp,writeFile,rm}=require('node:fs/promises');const path=require('node:path'),os=require('node:os');
const {createClient}=require('@supabase/supabase-js');const {Broker}=require('./legacy-harness.cjs');const {Providers}=require('../build/providers.js');
class Secrets{data=new Map();get(k){return this.data.get(k);}async set(k,v){if(v===undefined)this.data.delete(k);else this.data.set(k,v);}}
const check=r=>{if(r.error)throw new Error(r.error.message);return r.data;};
test('composer persists per-turn settings and file context; goals enforce ownership, budgets, plan mode, and pause',async()=>{
 const state=JSON.parse(execFileSync('wsl.exe',['-d',testDistribution(),'-u','sylvana','--cd','/home/sylvana/app','--exec','supabase','stack','status','--output-format','json'],{encoding:'utf8',windowsHide:true}));
 const db=createClient(state.env.API_URL,state.env.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}}),secrets=new Secrets(),events=[];
 const broker=new Broker(state.env,secrets,new Providers(secrets,'urn:uuid:'+randomUUID()),event=>events.push(event));const second=new Broker(state.env,new Secrets(),new Providers(new Secrets(),'urn:uuid:'+randomUUID()),()=>{});
 const accounts=[],password=randomBytes(24).toString('base64url')+'Aa1!';const original=global.fetch;let agent;const root=await mkdtemp(path.join(os.tmpdir(),'sylvana-composer-db-'));
 let payload,goalTurn=0,replyKind='normal';
 const wait=async predicate=>{for(let n=0;n<200;n++){const value=await predicate();if(value)return value;await new Promise(r=>setTimeout(r,50));}throw new Error('Timed out waiting for the local workflow.');};
 try{
  for(let n=0;n<2;n++)accounts.push(check(await db.auth.admin.createUser({email:`composer-${randomUUID()}@example.com`,password,email_confirm:true})).user);
  await broker.call('auth.signIn',{email:accounts[0].email,password});await second.call('auth.signIn',{email:accounts[1].email,password});
  await secrets.set('openrouter',{key:'controlled-composer-key'});await secrets.set('models:openrouter:shared',[{id:'test/default',name:'Default',supportsTools:true,thinking:['low','medium','high']},{id:'test/other',name:'Other',supportsTools:true,thinking:['low','high']}]);
  agent=await broker.call('agents.save',{name:'Composer fixture',description:'',instructions:'Be accurate.',provider:'openrouter',model:'test/default'});
  await writeFile(path.join(root,'notes.md'),'Context marker DOC-381');const refs=await broker.files.add(accounts[0].id,[path.join(root,'notes.md')]);
  await assert.rejects(second.call('composer.save',{userId:accounts[0].id,options:{}}),/another account/);
  const options={provider:'openrouter',model:'test/other',thinking:'high',permission:'files',mode:'plan',files:[refs[0].id]};await broker.call('composer.save',{userId:accounts[0].id,options});assert.equal((await broker.call('composer.get')).model,'test/other');
  global.fetch=async(url,args)=>{
   if(String(url)==='https://openrouter.ai/api/v1/chat/completions'){
    args.signal.throwIfAborted();
    payload=JSON.parse(args.body);
    if(replyKind==='slow')return new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Working"}}]}\n\n'));args.signal.addEventListener('abort',()=>controller.error(new DOMException('Cancelled','AbortError')),{once:true});}}));
    const text=replyKind==='goal'?(++goalTurn===2?'Completed. <!-- GOAL_COMPLETE -->':'First pass.'):replyKind==='never'?'More work remains.':'A concrete plan.';
    return new Response('data: '+JSON.stringify({choices:[{delta:{content:text}}]})+'\n\ndata: {"choices":[{"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n');
   }return original(url,args);
  };
  const id=randomUUID(),request=await broker.call('chat.start',{requestId:id,agentId:agent,text:'Review my notes',options});await wait(()=>events.find(e=>e.requestId===id&&e.status));
  assert.equal(payload.model,'test/other');assert.equal(payload.reasoning.effort,'high');assert(payload.messages[0].content.includes('PLAN MODE'));assert(JSON.stringify(payload.messages).includes('DOC-381'));
  const rows=await broker.call('messages.list',{conversationId:request.conversation_id});assert.equal(rows[0].metadata.options.thinking,'high');assert.equal(rows[0].content.files[0].name,'notes.md');
  assert.equal(check(await db.from('agent_llm_preferences').select('model').eq('agent_id',agent).single()).model,'test/default');
  const next=randomUUID();await broker.call('chat.start',{requestId:next,agentId:agent,conversationId:request.conversation_id,text:'Now chat without file context',options:{...options,mode:'chat',permission:'chat',files:[]}});await wait(()=>events.find(e=>e.requestId===next&&e.status));assert(!JSON.stringify(payload.messages).includes('DOC-381'));
  await assert.rejects(broker.call('chat.start',{requestId:id,agentId:agent,conversationId:request.conversation_id,text:'Review my notes',options:{...options,thinking:'low'}}),/already used/);
  assert.equal((await broker.call('messages.list',{conversationId:request.conversation_id})).length,4);
  await assert.rejects(second.call('chat.start',{requestId:randomUUID(),agentId:agent,text:'Hijack',options}));
  replyKind='goal';const goal=await broker.call('goals.create',{agentId:agent,objective:'Complete the two-pass fixture',maxTurns:3});
  await assert.rejects(second.call('goals.start',{id:goal.id,options:{}}));await broker.call('goals.start',{id:goal.id,options:{permission:'chat',mode:'chat',thinking:'default',files:[]}});
  const complete=await wait(async()=>{const g=(await broker.call('goals.list')).find(g=>g.id===goal.id);return g.status==='completed'&&g;});assert.equal(complete.turns_used,2);assert(events.some(e=>e.kind==='started'&&e.goalId===goal.id));
  replyKind='never';const limited=await broker.call('goals.create',{agentId:agent,objective:'Budget stop',maxTurns:1});await broker.call('goals.start',{id:limited.id,options:{}});const paused=await wait(async()=>{const g=(await broker.call('goals.list')).find(g=>g.id===limited.id);return g.status==='paused'&&g;});assert.equal(paused.turns_used,1);await assert.rejects(broker.call('goals.start',{id:limited.id,options:{}}),/turn limit/);
  const planned=await broker.call('goals.create',{agentId:agent,objective:'Plan first',maxTurns:3});await broker.call('goals.start',{id:planned.id,options:{mode:'plan'}});const plan=await wait(async()=>{const g=(await broker.call('goals.list')).find(g=>g.id===planned.id);return g.status==='paused'&&g;});assert.equal(plan.turns_used,1);assert.match(plan.note,/Plan created/);
  replyKind='slow';const cancellable=await broker.call('goals.create',{agentId:agent,objective:'Pause during work',maxTurns:3});await broker.call('goals.start',{id:cancellable.id,options:{}});await wait(()=>events.find(e=>e.goalId===cancellable.id&&e.kind==='started'));await broker.call('goals.pause',{id:cancellable.id});await wait(async()=>{const g=(await broker.call('goals.list')).find(g=>g.id===cancellable.id);return g.status==='paused';});
  await assert.rejects(second.call('goals.pause',{id:cancellable.id}));assert.equal((await second.call('goals.list')).length,0);
  console.log('PASS: Model/thinking/plan options are immutable per request, file sharing obeys permissions, and real database goals enforce completion, budgets, ownership, and pause.');
 }finally{
  await broker.shutdown();await second.shutdown();global.fetch=original;
  for(const account of accounts){check(await db.from('agents').delete().eq('user_id',account.id));check(await db.auth.admin.deleteUser(account.id));}
  const target=path.resolve(root);assert(target.startsWith(path.resolve(os.tmpdir())+path.sep));await rm(target,{recursive:true,force:true});
 }
});
