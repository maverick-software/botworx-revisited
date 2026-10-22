const {testDistribution}=require('./test-backend.cjs');
const test=require('node:test');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {randomUUID,randomBytes}=require('node:crypto');
const {createClient}=require('@supabase/supabase-js');
const {Broker}=require('./legacy-harness.cjs');
const {Providers}=require('../build/providers.js');
class Secrets{data=new Map();get(k){return this.data.get(k);}async set(k,v){if(v===undefined)this.data.delete(k);else this.data.set(k,v);}}
function check(r){if(r.error)throw new Error(r.error.message);return r.data;}
test('restored settings: owned agent configuration, catalog management, Vault isolation, and Stripe requests',async()=>{
 const runtime=JSON.parse(execFileSync('wsl.exe',['-d',testDistribution(),'-u','agentopia','--cd','/home/agentopia/app','--exec','supabase','stack','status','--output-format','json'],{encoding:'utf8',windowsHide:true}));
 const db=createClient(runtime.env.API_URL,runtime.env.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const events=[];const secrets=new Secrets(),providers=new Providers(secrets,'urn:uuid:'+randomUUID()),broker=new Broker(runtime.env,secrets,providers,event=>events.push(event));
 const otherSecrets=new Secrets(),otherBroker=new Broker(runtime.env,otherSecrets,new Providers(otherSecrets,'urn:uuid:'+randomUUID()),()=>{});
 const password=randomBytes(24).toString('base64url')+'Aa1!',tag=randomUUID();const accounts=[];const resources=[];let providerId,agentId,promptId;let originalSystemKey,originalStripe;let touchedKey=false,touchedStripe=false;
 const originalFetch=global.fetch;
 const record=async(table,value)=>{const row=check(await db.from(table).insert(value).select('id').single());resources.push([table,row.id]);return row.id;};
 try{
  const admin=check(await db.auth.admin.createUser({email:`settings-${tag}@example.com`,password,email_confirm:true})).user;accounts.push(admin);
  const other=check(await db.auth.admin.createUser({email:`settings-other-${tag}@example.com`,password,email_confirm:true})).user;accounts.push(other);
  const role=check(await db.from('roles').select('id').eq('name','admin').single());check(await db.from('user_roles').insert({user_id:admin.id,role_id:role.id}));
  await broker.call('auth.signIn',{email:admin.email,password});await otherBroker.call('auth.signIn',{email:other.email,password});
  for(const action of ['keys','key.save','integrations','integration.save','prompts','prompt.save','stripe','stripe.key.save','stripe.test','stripe.sync'])await assert.rejects(otherBroker.call('settings.admin.'+action,{}),/Administrator/);
  await broker.call('settings.profile.save',{value:{first_name:'Settings',last_name:'Proof',username:'test_'+tag.slice(0,8),company_name:'Local',title:'Owner',mobile_number:'+15551234567'}});
  assert.equal((await broker.call('settings.profile.get')).first_name,'Settings');assert.notEqual((await otherBroker.call('settings.profile.get')).first_name,'Settings');
  await assert.rejects(broker.call('settings.profile.save',{value:{username:'!invalid'}}),/username/);
  await secrets.set('models:openrouter:shared',[{id:'test/model',name:'Test model'}]);await secrets.set('openrouter',{key:'disposable-settings-provider'});
  agentId=await broker.call('agents.save',{name:'Settings test',description:'Disposable',instructions:'Be accurate.',provider:'openrouter',model:'test/model'});
  const otherAgent=check(await db.rpc('desktop_save_agent',{p_user:other.id,p_id:null,p_name:'Private settings',p_description:'',p_instructions:'',p_provider:'openrouter',p_model:'test/model'}));
  await assert.rejects(broker.call('agentSettings.get',{agentId:otherAgent}));
  await assert.rejects(otherBroker.call('agentSettings.save',{agentId,section:'identity',value:{name:'Hijack',personality:'',mbtiType:'',purpose:''}}));
  const api=createClient(runtime.env.API_URL,runtime.env.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});check(await api.auth.signInWithPassword({email:other.email,password}));
  for(const fn of ['desktop_save_agent_settings','desktop_store_setting_secret']){
   const args=fn==='desktop_save_agent_settings'?{p_user:admin.id,p_agent:agentId,p_section:'identity',p_value:{name:'Hijack'}}:{p_user:admin.id,p_scope:'api-key',p_id:'serper_api',p_secret:'fake',p_value:{name:'Fake'}};
   assert((await api.rpc(fn,args)).error,'Public settings RPC bypassed the broker');
  }
  await broker.call('agentSettings.save',{agentId,section:'identity',value:{name:'Configured agent',personality:'Use a concise, friendly tone.',mbtiType:'INTJ',purpose:'Research'}});
  const caps={};for(const key of ['voice','web_search','document_creation','ocr_processing','temporary_chat_links']){caps[key+'_enabled']=true;caps[key+'_credential']='';}
  await broker.call('agentSettings.save',{agentId,section:'capabilities',value:caps});
  const datastore=await record('datastores',{user_id:admin.id,name:'Knowledge proof',description:'',type:'pinecone'});
  const foreignDatastore=await record('datastores',{user_id:other.id,name:'Private knowledge',description:'',type:'pinecone'});
  await broker.call('agentSettings.save',{agentId,section:'memory',value:{context_history_size:10,use_account_graph:true,datastores:[datastore]}});
  await assert.rejects(broker.call('agentSettings.save',{agentId,section:'memory',value:{context_history_size:20,use_account_graph:false,datastores:[foreignDatastore]}}),/not found/);
  assert.equal((await broker.call('agentSettings.get',{agentId})).agent.settings.context_history_size,10,'Failed assignment partially changed metadata');
  const media=await record('media_library',{user_id:admin.id,file_name:'proof.txt',file_type:'text/plain',file_size:5,file_extension:'txt',storage_path:'settings-test/'+tag,processing_status:'completed'});
  await broker.call('agentSettings.save',{agentId,section:'documents',value:{ids:[media]}});
  await broker.call('agentSettings.save',{agentId,section:'documents',value:{ids:[]}});
  await broker.call('agentSettings.save',{agentId,section:'documents',value:{ids:[media]}});
  const team=await record('teams',{name:'Owned team',owner_user_id:admin.id});
  // The legacy team insert trigger derives its owner from a browser JWT. This
  // service-role fixture has no browser identity, so establish its owner here.
  check(await db.from('teams').update({owner_user_id:admin.id}).eq('id',team));
  await broker.call('agentSettings.save',{agentId,section:'team',value:{ids:[team]}});
  const contact=await record('contacts',{user_id:admin.id,first_name:'Settings',last_name:'Contact'});
  await broker.call('agentSettings.save',{agentId,section:'contacts',value:{mode:'specific_contacts',ids:[contact]}});
  check(await db.from('agent_contact_permissions').update({can_edit:true,can_delete:true,can_export:true}).eq('agent_id',agentId));
  await broker.call('agentSettings.save',{agentId,section:'contacts',value:{mode:'no_access',ids:[]}});
  const denied=check(await db.from('agent_contact_permissions').select('can_view,can_contact,can_edit,can_delete,can_export').eq('agent_id',agentId).single());assert(Object.values(denied).every(v=>v===false));
  await broker.call('agentSettings.save',{agentId,section:'contacts',value:{mode:'specific_contacts',ids:[contact]}});
  await broker.call('agentSettings.save',{agentId,section:'channels',value:Object.fromEntries(['email','sms','slack','discord','telegram','whatsapp'].map(k=>[k+'_enabled',true]))});
  const value={name:'desktop_test_'+tag.replaceAll('-',''),display_name:'Settings test provider',authorization_endpoint:'https://example.invalid/authorize',token_endpoint:'https://example.invalid/token',revoke_endpoint:'',discovery_endpoint:'',scopes_supported:['read'],pkce_required:true,client_credentials_location:'header',is_enabled:true,configuration_metadata:{client_id:'public-client'}};
  await broker.call('settings.admin.integration.save',{value});providerId=(await broker.call('settings.admin.integrations')).find(v=>v.name===value.name).id;
  await assert.rejects(broker.call('settings.admin.integration.save',{id:providerId,value:{...value,configuration_metadata:{client_secret:'must-stay-private'}}}),/protected credential/);
  await assert.rejects(broker.call('settings.admin.integration.save',{id:providerId,value:{...value,token_endpoint:'http://example.invalid/token'}}),/HTTPS/);
  await broker.call('settings.connection.save',{providerId,name:'My test tool',key:'settings-tool-secret-'+tag});
  const connection=(await broker.call('settings.connections')).find(v=>v.connection_name==='My test tool');assert(!JSON.stringify(connection).includes('settings-tool-secret'));
  await broker.call('agentSettings.save',{agentId,section:'sources',value:{ids:[connection.id]}});
  await assert.rejects(otherBroker.call('settings.connection.remove',{id:connection.id}),/not found/);
  await assert.rejects(broker.call('settings.admin.integration.remove',{id:providerId}),/saved user connections/);
  await broker.call('agentSettings.mcp.save',{agentId,name:'Protected MCP',url:'https://mcp.example.invalid/private-path-'+tag+'?token=protected-query'});
  const snapshot=await broker.call('agentSettings.get',{agentId});
  assert.equal(snapshot.agent.personality,'Use a concise, friendly tone.');assert.equal(snapshot.agent.settings.web_search_enabled,true);assert.equal(snapshot.agent.settings.ocr_processing_enabled,true);
  assert.deepEqual(snapshot.datastoreIds,[datastore]);assert.deepEqual(snapshot.documentIds,[media]);assert.deepEqual(snapshot.teamIds,[team]);assert.deepEqual(snapshot.contactIds,[contact]);assert.deepEqual(snapshot.connectionIds,[connection.id]);assert.equal(snapshot.contactMode,'specific_contacts');assert.equal(snapshot.agent.email_enabled,true);
  assert(!JSON.stringify(snapshot).includes('private-path-'));assert(!JSON.stringify(snapshot).includes('settings-tool-secret'));assert(!snapshot.datastores.some(v=>v.id===foreignDatastore));
  const first=check(await db.rpc('desktop_begin_chat',{p_user:admin.id,p_request:randomUUID(),p_agent:agentId,p_conversation:null,p_text:'Initial context'}));
  check(await db.rpc('desktop_checkpoint_chat',{p_user:admin.id,p_request:first.id,p_text:'Initial answer',p_status:'completed',p_error:null}));
  const session=check(await db.from('conversation_sessions').select('id').eq('conversation_id',first.conversation_id).single());
  check(await db.from('chat_messages_v2').insert(Array.from({length:12},(_,n)=>({conversation_id:first.conversation_id,session_id:session.id,sender_user_id:admin.id,role:n%2?'assistant':'user',content:{type:'text',text:'Context '+n}}))));
  let sent;global.fetch=async(url,options)=>{if(String(url)==='https://openrouter.ai/api/v1/chat/completions'){sent=JSON.parse(options.body);return new Response('data: {"choices":[{"delta":{"content":"Settings applied"}}]}\n\ndata: {"choices":[{"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n');}return originalFetch(url,options);};
  const chatId=randomUUID();await broker.call('chat.start',{requestId:chatId,agentId,conversationId:first.conversation_id,text:'Use my settings'});
  for(let attempt=0;attempt<100&&!events.some(e=>e.requestId===chatId&&e.status);attempt++)await new Promise(resolve=>setTimeout(resolve,50));
  assert.equal(events.find(e=>e.requestId===chatId&&e.status)?.status,'completed');assert.equal(sent.messages.length,11);assert.match(sent.messages[0].content,/Use a concise, friendly tone/);assert.equal(sent.messages.at(-1).content,'Use my settings');
  assert.equal((await broker.call('messages.list',{conversationId:first.conversation_id})).length,16,'Context limit truncated saved history');global.fetch=originalFetch;
  await broker.call('agentSettings.mcp.remove',{agentId,id:snapshot.mcp[0].id});
  await broker.call('agentSettings.task.save',{agentId,value:{name:'Paused task',instructions:'Review the project',cron:'0 9 * * 1-5',timezone:'America/Los_Angeles'}});
  await assert.rejects(broker.call('agentSettings.task.save',{agentId,value:{name:'Invalid',instructions:'Review',cron:'99 99 * * *',timezone:'UTC'}}),/valid five-field/);
  const task=(await broker.call('agentSettings.get',{agentId})).tasks[0];assert.equal(task.status,'paused');
  await broker.call('agentSettings.task.remove',{agentId,id:task.id});
  await broker.call('settings.connection.remove',{id:connection.id});assert.equal((await broker.call('agentSettings.get',{agentId})).connectionIds.length,0);
  await broker.call('settings.admin.prompt.save',{value:{key:'desktop_test_'+tag,name:'Test prompt',description:'Fixture',category:'tools',content:'Use approved tools.',is_active:true}});
  promptId=(await broker.call('settings.admin.prompts')).find(v=>v.key==='desktop_test_'+tag).id;
  await broker.call('settings.admin.prompt.save',{id:promptId,value:{key:'desktop_test_'+tag,name:'Test prompt',description:'Edited',category:'meta',content:'Updated content.',is_active:false}});
  assert.equal((await broker.call('settings.admin.prompts')).find(v=>v.id===promptId).content,'Updated content.');
  await broker.call('settings.admin.prompt.remove',{id:promptId});promptId=undefined;
  originalSystemKey=check(await db.from('system_api_keys').select('*').eq('provider_name','serper_api').maybeSingle());
  if(!originalSystemKey?.vault_secret_id){
   touchedKey=true;await broker.call('settings.admin.key.save',{provider:'serper_api',key:'settings-key-one-'+tag});
   const first=check(await db.from('system_api_keys').select('vault_secret_id').eq('provider_name','serper_api').single()).vault_secret_id;
   await broker.call('settings.admin.key.save',{provider:'serper_api',key:'settings-key-two-'+tag});
   const old=check(await db.rpc('get_secret',{secret_id:first}));assert.equal(old.length,0,'Rotated secret was left accessible');
   assert(!JSON.stringify(await broker.call('settings.admin.keys')).includes('settings-key-'));
   await broker.call('settings.admin.key.remove',{provider:'serper_api'});
  }else console.log('Existing Serper credential retained; its rotation test was skipped.');
  const stripe=check(await db.from('admin_integration_credentials').select('id').eq('integration_type','stripe'));
  originalStripe=check(await db.from('admin_settings').select('*').eq('setting_key','stripe_config').maybeSingle());
  if(!stripe.length){
   touchedStripe=true;await broker.call('settings.admin.stripe.key.save',{name:'secret_key',key:'sk_test_settings_'+tag});
   assert(!JSON.stringify(await broker.call('settings.admin.stripe')).includes('sk_test_settings_'));
   let productCalls=0;
   global.fetch=async(url,options)=>{
    if(String(url).startsWith('https://api.stripe.com/')){
     assert.equal(options.headers.Authorization,'Bearer sk_test_settings_'+tag);assert.equal(options.redirect,'error');
     if(String(url).includes('/v1/account'))return Response.json({id:'acct_settings_test',country:'US',charges_enabled:false});
     productCalls++;return Response.json({has_more:productCalls===1,data:[{id:'prod_settings_'+tag+productCalls,name:'Test plan',active:true,description:'Fixture',default_price:{id:'price_settings_'+tag+productCalls,unit_amount:1500,currency:'usd',recurring:{interval:'month'}}}]});
    }return originalFetch(url,options);
   };
   assert.equal((await broker.call('settings.admin.stripe.test')).account_id,'acct_settings_test');assert.equal((await broker.call('settings.admin.stripe.sync')).count,2);assert.equal(productCalls,2);
   check(await db.from('billing_plans').delete().like('stripe_price_id','price_settings_'+tag+'%'));
   await broker.call('settings.admin.stripe.key.remove',{name:'secret_key'});
   await assert.rejects(broker.call('settings.admin.stripe.test'),/Save a Stripe/);
  }else console.log('Existing Stripe credentials retained; simulated replacement/sync test was skipped.');
  console.log('PASS: Original agent settings persist, owned assignments are atomic, credentials stay private and rotate safely, admin catalog/prompt controls work, and mocked Stripe account/product requests use protected keys.');
 }finally{
  global.fetch=originalFetch;await broker.shutdown();await otherBroker.shutdown();
  if(touchedKey){await broker.call('settings.admin.key.remove',{provider:'serper_api'});if(originalSystemKey)check(await db.from('system_api_keys').upsert(originalSystemKey));else check(await db.from('system_api_keys').delete().eq('provider_name','serper_api'));}
  if(touchedStripe){await broker.call('settings.admin.stripe.key.remove',{name:'secret_key'});check(await db.from('billing_plans').delete().like('stripe_price_id','price_settings_'+tag+'%'));if(originalStripe)check(await db.from('admin_settings').upsert(originalStripe));else check(await db.from('admin_settings').delete().eq('setting_key','stripe_config'));}
  if(promptId)check(await db.from('system_prompts').delete().eq('id',promptId));
  for(const account of accounts){check(await db.from('agents').delete().eq('user_id',account.id));check(await db.from('user_integration_credentials').delete().eq('user_id',account.id));}
  for(const [table,id] of resources.reverse())check(await db.from(table).delete().eq('id',id));
  if(providerId)check(await db.from('service_providers').delete().eq('id',providerId));
  for(const account of accounts)check(await db.auth.admin.deleteUser(account.id));
 }
});
