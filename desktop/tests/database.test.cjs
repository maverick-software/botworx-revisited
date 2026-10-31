const {testDistribution}=require('./test-backend.cjs');
const test=require('node:test');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {readFileSync}=require('node:fs');
const {randomUUID,randomBytes}=require('node:crypto');
const {createClient}=require('@supabase/supabase-js');
const {Broker}=require('./legacy-harness.cjs');
const {Providers}=require('../build/providers.js');
const {coreServicesReady}=require('../build/runtime.js');
class MemorySecrets{constructor(){this.data=new Map();}get(key){return this.data.get(key);}async set(key,value){if(value===undefined)this.data.delete(key);else this.data.set(key,value);}}
function state(){
 if(process.env.SYLVANA_NATIVE_TEST_STATUS)return JSON.parse(readFileSync(process.env.SYLVANA_NATIVE_TEST_STATUS,'utf8'));
 return JSON.parse(execFileSync('wsl.exe',['--distribution',testDistribution(),'--user','sylvana','--cd','/home/sylvana/app','--exec','supabase','stack','status','--output-format','json'],{encoding:'utf8',windowsHide:true}));
}
function check(result){if(result.error)throw result.error;return result.data;}
test('native database: account permissions, agent defaults, chat idempotency, streaming persistence and last-admin protection',async()=>{
 const runtime=state();assert.equal(runtime.runtime,'native');assert(coreServicesReady(runtime));
 const env=runtime.env;
 const service=createClient(env.API_URL,env.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const secrets=new MemorySecrets();const providers=new Providers(secrets,'urn:uuid:'+randomUUID());
 const events=[];let broker=new Broker(env,secrets,providers,event=>events.push(event));
 const password=randomBytes(24).toString('base64url')+'Aa1!';let user,other;let agent;
 const originalFetch=global.fetch;
 try{
  user=check(await service.auth.admin.createUser({email:`desktop-test-${randomUUID()}@example.com`,password,email_confirm:true})).user;
  other=check(await service.auth.admin.createUser({email:`desktop-other-${randomUUID()}@example.com`,password,email_confirm:true})).user;
  const identity=await broker.call('auth.signIn',{email:user.email,password});assert.equal(identity.admin,false);
  const appearance={theme:'dark',textSize:'large',sendWith:'ctrl-enter',sidebarCollapsed:true};
  await broker.call('preferences.save',{userId:user.id,preferences:appearance});assert.deepEqual(await broker.call('preferences.get'),{...appearance,sidebarWidth:244});
  await assert.rejects(broker.call('preferences.save',{userId:other.id,preferences:appearance}),/another account/);
  await assert.rejects(broker.call('preferences.save',{userId:user.id,preferences:{...appearance,theme:'invalid'}}),/Invalid/);
  for(const action of ['admin.users','admin.role','admin.suspend','providers.saveOpenRouter','providers.removeOpenRouter'])await assert.rejects(broker.call(action,{}),/Administrator/);
  await secrets.set('models:openrouter:shared',[{id:'test/model',name:'Test model'}]);
  await secrets.set('openrouter',{key:'disposable-test-key'});
  const status=await broker.call('providers.status');assert(!JSON.stringify(status).includes('disposable-test-key'));
  agent=await broker.call('agents.save',{name:'Desktop test agent',description:'Disposable test',instructions:'Reply clearly',provider:'openrouter',model:'test/model'});
  const preference=check(await service.from('agent_llm_preferences').select('*').eq('agent_id',agent));assert.equal(preference.length,1);assert.equal(preference[0].provider,'openrouter');
  const otherAgent=check(await service.rpc('desktop_save_agent',{p_user:other.id,p_id:null,p_name:'Other test agent',p_description:'',p_instructions:'',p_provider:'openrouter',p_model:'test/model'}));
  const ownClient=createClient(env.API_URL,env.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});check(await ownClient.auth.signInWithPassword({email:user.email,password}));
  assert.equal(check(await ownClient.from('agents').select('id').eq('id',otherAgent)).length,0);
  const otherRequest=check(await service.rpc('desktop_begin_chat',{p_user:other.id,p_request:randomUUID(),p_agent:otherAgent,p_conversation:null,p_text:'Private other-user message'}));
  assert.equal(check(await ownClient.from('conversation_sessions').select('id').eq('conversation_id',otherRequest.conversation_id)).length,0);
  assert.equal(check(await ownClient.from('chat_messages_v2').select('id').eq('conversation_id',otherRequest.conversation_id)).length,0);
  assert(!(await broker.call('conversations.list')).some(c=>c.conversation_id===otherRequest.conversation_id),'Global history exposed another account');
  for(const action of ['rename','pin','archive','delete'])await assert.rejects(broker.call('conversations.manage',{conversationId:otherRequest.conversation_id,action,title:'Hijacked'}),/not found/);
  assert((await ownClient.rpc('desktop_manage_conversation',{p_user:other.id,p_conversation:otherRequest.conversation_id,p_action:'delete'})).error,'A user could bypass the conversation broker');
  assert((await ownClient.rpc('desktop_begin_chat',{p_user:other.id,p_request:randomUUID(),p_agent:otherAgent,p_conversation:null,p_text:'Forged'})).error);
  assert((await ownClient.rpc('get_users_auth_data')).error,'A standard user could call the legacy account-listing function');
  await assert.rejects(broker.call('messages.list',{conversationId:otherRequest.conversation_id}));
  await assert.rejects(broker.call('agents.save',{id:otherAgent,name:'Hijack',description:'',instructions:'',provider:'openrouter',model:'test/model'}));
  console.log('Verified standard-user restrictions and ownership through both the broker and database API.');
  global.fetch=async(url,options)=>{
   if(String(url)==='https://openrouter.ai/api/v1/chat/completions')return new Response('data: {"choices":[{"delta":{"content":"Saved answer"}}]}\n\ndata: {"choices":[{"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n');
   return originalFetch(url,options);
  };
  const requestId=randomUUID();const result=await broker.call('chat.start',{requestId,agentId:agent,text:'Hello'});
  for(let attempt=0;attempt<100&&!events.some(e=>e.requestId===requestId&&e.status);attempt++)await new Promise(resolve=>setTimeout(resolve,50));
  await broker.shutdown();
  await assert.rejects(broker.call('chat.start',{requestId:randomUUID(),agentId:agent,text:'Do not start after shutdown'}),/account changed/);
  broker=new Broker(env,secrets,providers,event=>events.push(event));await broker.initialize();
  const repeated=await broker.call('chat.start',{requestId,agentId:agent,conversationId:result.conversation_id,text:'Hello'});assert.equal(repeated.existing,true);
  const messages=await broker.call('messages.list',{conversationId:result.conversation_id});assert.equal(messages.length,2);
  assert.equal(messages[1].metadata.status,'completed');assert.equal(messages[1].content.text,'Saved answer');
  const persisted=check(await service.from('desktop_requests').select('status').eq('id',requestId).single());assert.notEqual(persisted.status,'running');
  await assert.rejects(broker.call('chat.start',{requestId,agentId:agent,conversationId:result.conversation_id,text:'Different text'}),/already used/);
  const session=check(await service.from('conversation_sessions').select('id').eq('conversation_id',result.conversation_id).single());
  check(await service.from('chat_messages_v2').insert(Array.from({length:1005},(_,index)=>({conversation_id:result.conversation_id,session_id:session.id,sender_user_id:user.id,role:'user',content:{type:'text',text:`History ${index}`}}))));
  const completeHistory=await broker.call('messages.list',{conversationId:result.conversation_id});
  assert.equal(completeHistory.length,1007);assert.equal(completeHistory[0].role,'user');assert.equal(completeHistory[1].content.text,'Saved answer');assert.equal(completeHistory.at(-1).content.text,'History 1004');
  console.log('Verified atomic messages, unique request identifiers, and saved response lifecycle.');
  await broker.call('conversations.manage',{conversationId:result.conversation_id,action:'rename',title:'Renamed saved chat'});
  await broker.call('conversations.manage',{conversationId:result.conversation_id,action:'pin'});
  await broker.call('conversations.manage',{conversationId:result.conversation_id,action:'archive'});
  let library=(await broker.call('conversations.list')).find(c=>c.conversation_id===result.conversation_id);
  assert.equal(library.title,'Renamed saved chat');assert.equal(library.pinned,true);assert.equal(library.archived,true);
  await broker.call('conversations.manage',{conversationId:result.conversation_id,action:'unarchive'});
  await broker.call('conversations.manage',{conversationId:result.conversation_id,action:'unpin'});
  library=(await broker.call('conversations.list')).find(c=>c.conversation_id===result.conversation_id);
  assert.equal(library.archived,false);assert.equal(library.pinned,false);
  await assert.rejects(broker.call('conversations.manage',{conversationId:result.conversation_id,action:'rename',title:' '}),/title/);
  const deleted=check(await service.rpc('desktop_begin_chat',{p_user:user.id,p_request:randomUUID(),p_agent:agent,p_conversation:null,p_text:'Delete proof'}));
  await assert.rejects(broker.call('conversations.manage',{conversationId:deleted.conversation_id,action:'delete'}),/Finish or stop/);
  check(await service.rpc('desktop_checkpoint_chat',{p_user:user.id,p_request:deleted.id,p_text:'Finished',p_status:'completed',p_error:null}));
  await broker.call('conversations.manage',{conversationId:deleted.conversation_id,action:'delete'});
  assert.equal(check(await service.from('chat_messages_v2').select('id').eq('conversation_id',deleted.conversation_id)).length,0);
  console.log('Verified global private history and persistent rename, pin, archive, restore, and cascade deletion.');
  const olderChats=Array.from({length:1005},(_,index)=>({conversation_id:randomUUID(),user_id:user.id,agent_id:agent,title:`Older saved chat ${index}`}));
  for(let offset=0;offset<olderChats.length;offset+=250)check(await service.from('conversation_sessions').insert(olderChats.slice(offset,offset+250)));
  const fullLibrary=await broker.call('conversations.list');assert.equal(fullLibrary.length,1006);assert.equal(new Set(fullLibrary.map(c=>c.conversation_id)).size,1006);
  assert(fullLibrary.some(c=>c.title==='Older saved chat 1004'),'History was truncated at the API row limit');
  const adminRoles=check(await service.from('user_roles').select('user_id,role_id,roles(name)')).filter(r=>r.roles?.name==='admin');
  if(adminRoles.length===1){
   const original=adminRoles[0];
   const attempt=await service.rpc('desktop_set_admin',{p_actor:original.user_id,p_target:original.user_id,p_admin:false});
   if(!attempt.error)check(await service.from('user_roles').insert({user_id:original.user_id,role_id:original.role_id}));
   assert(attempt.error,'The last administrator was removable');assert.match(attempt.error.message,/last active administrator/);
   const suspension=await service.auth.admin.updateUserById(original.user_id,{ban_duration:'1h'});
   if(!suspension.error)check(await service.auth.admin.updateUserById(original.user_id,{ban_duration:'none'}));
   assert(suspension.error,'The last administrator was suspendable');
  }else throw new Error('Run this fixture with exactly one existing administrator to exercise last-admin protection.');
 }finally{
  global.fetch=originalFetch;await broker.shutdown();
  for(const account of [user,other])if(account){
   const agents=check(await service.from('agents').select('id').eq('user_id',account.id));
   for(const a of agents)check(await service.from('agents').delete().eq('id',a.id));
   check(await service.auth.admin.deleteUser(account.id));
  }
 }
});
