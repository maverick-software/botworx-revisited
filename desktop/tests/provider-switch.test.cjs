const {testDistribution}=require('./test-backend.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),{randomUUID,randomBytes}=require('node:crypto');
const {mkdtemp,writeFile,rm}=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {createClient}=require('@supabase/supabase-js'),{Broker}=require('./legacy-harness.cjs'),{Providers}=require('../build/providers.js');
class Secrets{data=new Map();get(key){return this.data.get(key);}async set(key,value){if(value===undefined)this.data.delete(key);else this.data.set(key,value);}}
const check=result=>{if(result.error)throw new Error(result.error.message);return result.data;};
test('one conversation switches ChatGPT → OpenRouter → ChatGPT with history, images, reasoning, and credential isolation',async()=>{
 const state=JSON.parse(execFileSync('wsl.exe',['-d',testDistribution(),'-u','sylvana','--cd','/home/sylvana/app','--exec','supabase','stack','status','--output-format','json'],{encoding:'utf8',windowsHide:true}));
 const db=createClient(state.env.API_URL,state.env.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}}),secrets=new Secrets(),events=[],providers=new Providers(secrets,'urn:uuid:'+randomUUID());
 const broker=new Broker(state.env,secrets,providers,event=>events.push(event)),accounts=[],originalFetch=global.fetch,root=await mkdtemp(path.join(os.tmpdir(),'sylvana-provider-switch-'));
 const password=randomBytes(24).toString('base64url')+'Aa1!';let agent,openaiBody,routerBody,routerMode='success',oauthCalls=0,routerCalls=0;
 const wait=async id=>{for(let n=0;n<160;n++){const result=events.find(e=>e.requestId===id&&e.status);if(result)return result;await new Promise(r=>setTimeout(r,50));}throw new Error('Provider fixture timed out.');};
 try{
  for(let n=0;n<2;n++)accounts.push(check(await db.auth.admin.createUser({email:`provider-switch-${randomUUID()}@example.com`,password,email_confirm:true})).user);
  await broker.call('auth.signIn',{email:accounts[0].email,password});
  await secrets.set('openai:'+accounts[0].id,{email:'connected@example.com',subject:'fixture',client_id:'fixture-client',scope:'chatgpt.tokens.use.direct',access_token:'oauth-private',refresh_token:'refresh-private',expires_at:Date.now()+3600000});
  await secrets.set('openrouter',{key:'router-private'});
  await secrets.set('models:openai-oauth:'+accounts[0].id,[{id:'test-gpt',name:'GPT',thinking:['low','high']}]);
  await secrets.set('models:openrouter:shared',[{id:'openai/test-gpt',name:'Router GPT',supportsTools:true,thinking:['high'],inputModalities:['text','image']},{id:'vendor/text',name:'Text only',thinking:[],inputModalities:['text']}]);
  agent=await broker.call('agents.save',{name:'Provider switch fixture',description:'',instructions:'Be precise.',provider:'openai-oauth',model:'test-gpt'});
  await writeFile(path.join(root,'note.md'),'Provider context marker SWAP-923');await writeFile(path.join(root,'pixel.png'),Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64'));
  const files=await broker.files.add(accounts[0].id,[path.join(root,'note.md'),path.join(root,'pixel.png')]);
  global.fetch=async(url,args)=>{
   if(String(url)==='https://api.openai.com/v1/responses'){
    oauthCalls++;assert.equal(args.headers.Authorization,'Bearer oauth-private');openaiBody=JSON.parse(args.body);
    return new Response('data: {"type":"response.output_text.delta","delta":"ChatGPT remembered SWAP-923"}\n\ndata: {"type":"response.completed"}\n\n');
   }
   if(String(url)==='https://openrouter.ai/api/v1/chat/completions'){
    routerCalls++;assert.equal(args.headers.Authorization,'Bearer router-private');routerBody=JSON.parse(args.body);
    if(routerMode==='limit')return new Response('',{status:402});
    if(routerMode==='partial')return new Response('data: {"choices":[{"delta":{"content":"Partial provider response"}}]}\n\n');
    return new Response('data: {"choices":[{"delta":{"content":"OpenRouter remembered SWAP-923"}}]}\n\ndata: {"choices":[{"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n');
   }return originalFetch(url,args);
  };
  const base={permission:'files',thinking:'high',mode:'plan',files:files.map(f=>f.id)},id=randomUUID();
  const first=await broker.call('chat.start',{requestId:id,agentId:agent,text:'Read these notes and plan.',options:base});assert.equal((await wait(id)).status,'completed');assert.equal(openaiBody.input[0].content[1].type,'input_image');
  await assert.rejects(broker.call('chat.start',{requestId:randomUUID(),agentId:agent,conversationId:first.conversation_id,text:'Switch',options:{...base,provider:'openrouter',files:[]}}),/Choose a model/);
  const routerOptions={...base,provider:'openrouter',model:'openai/test-gpt',files:[]};await broker.call('composer.save',{options:routerOptions});
  const next=randomUUID();await broker.call('chat.start',{requestId:next,agentId:agent,conversationId:first.conversation_id,text:'Continue with the same notes.',options:routerOptions});assert.equal((await wait(next)).status,'completed');
  assert.equal(routerBody.model,'openai/test-gpt');assert.equal(routerBody.reasoning.effort,'high');assert.equal(routerBody.messages[1].content[1].type,'image_url');assert(routerBody.messages.some(m=>m.role==='assistant'&&m.content==='ChatGPT remembered SWAP-923'));assert(routerBody.messages[0].content.includes('PLAN MODE'));
  const back=randomUUID(),oauthOptions={...base,provider:'openai-oauth',model:'test-gpt',files:[]};await broker.call('composer.save',{options:oauthOptions});
  await broker.call('chat.start',{requestId:back,agentId:agent,conversationId:first.conversation_id,text:'Continue after switching back.',options:oauthOptions});assert.equal((await wait(back)).status,'completed');assert(openaiBody.input.some(m=>m.role==='assistant'&&m.content==='OpenRouter remembered SWAP-923'));assert.equal(openaiBody.reasoning.effort,'high');assert.equal(openaiBody.store,false);
  let rows=await broker.call('messages.list',{conversationId:first.conversation_id});assert.equal(rows.length,6);assert.deepEqual(rows.filter(m=>m.role==='user').map(m=>m.metadata.options.provider),['openai-oauth','openrouter','openai-oauth']);
  assert.equal(check(await db.from('agent_llm_preferences').select('provider').eq('agent_id',agent).single()).provider,'openai-oauth');
  await assert.rejects(broker.call('chat.start',{requestId:randomUUID(),agentId:agent,conversationId:first.conversation_id,text:'Image incompatible',options:{...routerOptions,model:'vendor/text',thinking:'default'}}),/cannot read images/);
  assert.equal((await broker.call('messages.list',{conversationId:first.conversation_id})).length,6);
  const textOnly=randomUUID();await broker.call('chat.start',{requestId:textOnly,agentId:agent,conversationId:first.conversation_id,text:'No attachments now.',options:{...routerOptions,model:'vendor/text',thinking:'default',permission:'chat'}});assert.equal((await wait(textOnly)).status,'completed');assert(!JSON.stringify(routerBody.messages).includes('image_url'));assert(!JSON.stringify(routerBody.messages).includes('Attached file context:'));
  routerMode='limit';const limited=randomUUID(),before=oauthCalls;await broker.call('chat.start',{requestId:limited,agentId:agent,conversationId:first.conversation_id,text:'Limit test',options:{...routerOptions,permission:'chat'}});const failure=await wait(limited);assert.equal(failure.status,'failed');assert.match(failure.error,/credits/);assert.equal(oauthCalls,before,'A provider failure must not silently invoke ChatGPT');
  routerMode='partial';const interrupted=randomUUID();await broker.call('chat.start',{requestId:interrupted,agentId:agent,conversationId:first.conversation_id,text:'Partial test',options:{...routerOptions,permission:'chat'}});assert.equal((await wait(interrupted)).status,'failed');rows=await broker.call('messages.list',{conversationId:first.conversation_id});assert.equal(rows.at(-1).content.text,'Partial provider response');assert.equal(rows.at(-1).metadata.status,'failed');
  const status=await broker.call('providers.status');assert.equal(status.selections.openrouter.model,'openai/test-gpt');assert.equal(status.selections['openai-oauth'].thinking,'high');assert(!JSON.stringify(status).includes('private'));assert.equal(providers.status(accounts[1].id).chatgpt,null);assert.deepEqual(providers.status(accounts[1].id).selections,{});
  for(const action of ['providers.defaultOpenRouter','providers.saveOpenRouter','providers.removeOpenRouter'])await assert.rejects(broker.call(action,{model:'vendor/text',key:'forged'}),/Administrator/);
  console.log('PASS: Same real local conversation crossed both provider adapters with images/history and high thinking; text-only permission, visible limits, partial persistence, no fallback, and secret isolation held. Requests were simulated.');
 }finally{
  await broker.shutdown();global.fetch=originalFetch;
  for(const account of accounts){check(await db.from('agents').delete().eq('user_id',account.id));check(await db.auth.admin.deleteUser(account.id));}
  assert(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep));await rm(root,{recursive:true,force:true});
 }
});
