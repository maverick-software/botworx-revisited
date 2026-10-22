import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {writeFile,copyFile} from 'node:fs/promises';
import {expect} from '@playwright/test';

// Test instrumentation observes the delivered broker; its identity, permissions,
// provider adapters, native harness and renderer remain the packaged code.
export async function installLiveGuard(application){
 await application.evaluate(({app})=>{
  const {createRequire}=process.getBuiltinModule('module'),path=process.getBuiltinModule('path');
  const localRequire=createRequire(path.join(app.getAppPath(),'package.json'));
  const Broker=Object.values(localRequire.cache).find(module=>module.exports?.Broker)?.exports.Broker;
  if(!Broker)throw Error('The delivered broker module is unavailable');
  const initialize=Broker.prototype.initialize;
  Broker.prototype.initialize=async function(...args){globalThis.__liveBroker=this;return initialize.apply(this,args);};
  const real=globalThis.fetch;globalThis.__startupNetwork={local:0,blocked:[],catalog:0,inference:[]};
  globalThis.fetch=async(input,args)=>{
   const url=new URL(typeof input==='string'?input:input.url??String(input)),network=globalThis.__startupNetwork;
   if(url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname)){network.local++;return real(input,args);}
   if(url.href==='https://api.openai.com/v1/models'&&(args?.method??'GET')==='GET'){
    if(!globalThis.__liveAccessExpires||globalThis.__liveAccessExpires<Date.now()+90000)throw Error('Stop before copied access credentials need renewal');network.catalog++;return real(input,args);
   }
   if(url.href==='https://api.openai.com/v1/responses'&&args?.method==='POST'){
    if(!globalThis.__liveAccessExpires||globalThis.__liveAccessExpires<Date.now()+90000)throw Error('Stop before copied access credentials need renewal');
    const call={startedAt:new Date().toISOString(),status:null};network.inference.push(call);const response=await real(input,args);call.status=response.status;call.requestId=response.headers.get('x-request-id');return response;
   }
   network.blocked.push({origin:url.origin,path:url.pathname});throw Error('Live qualification blocked '+url.origin+url.pathname);
  };
 });
}

export async function runPackagedLive({application,page,runtime,physical,out,release,check,evidence,save,recorderPath}){
 const initial=JSON.parse(await runtime.command(['supabase','stack','status','--output-format','json']));
 const {createClient}=await import('@supabase/supabase-js');
 const db=createClient(initial.env.API_URL,initial.env.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const data=result=>{if(result.error)throw Error(result.error.message);return result.data;};
 const call=(action,args)=>page.evaluate(({action,args})=>window.agentopia.call(action,args),{action,args});
 const existing=(await call('auth.state')).identity,account={email:'packaged-live-'+randomUUID()+'@example.invalid',password:randomUUID()+randomUUID()};
 const user=existing??data(await db.auth.admin.createUser({...account,email_confirm:true,user_metadata:{first_name:'Packaged verification'}})).user;assert(user);
 if(existing){assert.equal(user.id,evidence.fixtureUser,'Resume must retain the same isolated user');assert(user.admin);}
 else{const role=data(await db.from('roles').select('id').eq('name','admin').single());data(await db.from('user_roles').insert({user_id:user.id,role_id:role.id}));}
 evidence.fixtureUser=user.id;await save();
 for(const previous of evidence.priorFailedRequests??[]){const rows=data(await db.from('desktop_codex_turns').select('thread_id,state').eq('request_id',previous.requestId));assert(rows.every(row=>!row.thread_id&&!row.state?.items?.length),'An earlier request has native execution evidence; inspect before another submission');}
 if(evidence.interruptionAudit){const rows=data(await db.from('desktop_requests').select('id,status').eq('user_id',user.id));assert.equal(rows.length,evidence.interruptionAudit.requestCount);assert(rows.every(row=>evidence.interruptionAudit.requestIds.includes(row.id)&&row.status==='failed'),'The retained database changed after its interruption audit. Stop before inference.');}
 const seeded=await application.evaluate(async({app},{snapshot,owner})=>{
  const {createRequire}=process.getBuiltinModule('module'),path=process.getBuiltinModule('path'),localRequire=createRequire(path.join(app.getAppPath(),'package.json'));
  const {Secrets}=localRequire('./build/secrets.js'),source=new Secrets(snapshot);await source.load();const session=source.get('session');if(!session?.access_token)throw Error('Physical source has no local owner');
  const sourceOwner=JSON.parse(Buffer.from(session.access_token.split('.')[1],'base64url').toString()).sub,connection=source.get('openai:'+sourceOwner),models=source.get('models:openai-oauth:'+sourceOwner);
  if(!connection?.scope?.split(' ').includes('chatgpt.tokens.use.direct')||connection.expires_at<Date.now()+600000||!models?.some(model=>model.id==='gpt-6.1-sol'))throw Error('Physical ChatGPT connection is not ready');
  const broker=globalThis.__liveBroker;if(!broker)throw Error('Delivered broker initialization was not observed');
  // A valid access token suffices for inference; this fixture never receives the
  // usable refresh token, preventing accidental detached-store rotation.
  await broker.secrets.set('openai:'+owner,{...connection,refresh_token:''});
  await broker.secrets.set('models:openai-oauth:'+owner,models);
  await broker.secrets.set('prefer-chatgpt:'+owner,true);await broker.secrets.set('chatgpt-welcome:'+owner,true);
  const router=source.get('openrouter'),routerModels=source.get('models:openrouter:shared');
  if(router&&routerModels){await broker.secrets.set('openrouter',router);await broker.secrets.set('openrouter-default',source.get('openrouter-default'));await broker.secrets.set('models:openrouter:shared',routerModels);}
  globalThis.__liveAccessExpires=connection.expires_at;
  return {bothConfigured:!!router&&!!routerModels,validForSeconds:Math.floor((connection.expires_at-Date.now())/1000),models:models.length,refreshCredentialCopied:false};
 },{snapshot:physical.snapshot,owner:user.id});
 evidence.authorization={inspection:physical.inspection,...seeded};await save();
 if(!existing){await page.getByLabel('Email address',{exact:true}).fill(account.email);await page.getByLabel('Password',{exact:true}).fill(account.password);await page.getByRole('button',{name:'Sign in',exact:true}).click();}
 await expect(page.getByRole('button',{name:/^New chat\b/}).first()).toBeVisible({timeout:30000});
 const identity=(await call('auth.state')).identity;assert.equal(identity.id,user.id);assert(identity.admin);
 const {defaultAgentPolicy,agentToolNames}=await application.evaluate(({app})=>{const {createRequire}=process.getBuiltinModule('module'),path=process.getBuiltinModule('path'),req=createRequire(path.join(app.getAppPath(),'package.json'));const {defaultAgentPolicy,agentToolNames}=req('./build/agent-contracts.js');return {defaultAgentPolicy,agentToolNames};});
 const marker=evidence.markers?.marker??'LIVE-'+randomUUID().slice(0,12),sop=evidence.markers?.sop??'SOP-'+randomUUID().slice(0,8),skill=evidence.markers?.skill??'SKILL-'+randomUUID().slice(0,8),specialistCode=evidence.markers?.specialistCode??'SPECIALIST-'+randomUUID().slice(0,8);
 async function agent(name,changes={}){const id=await call('agents.save',{name,description:'Packaged live acceptance fixture',instructions:'Perform only the requested verification. Use the saved evidence and do not invent tool results.',provider:'openai-oauth',model:'gpt-6.1-sol'}),profile=await call('agents.profile',{agentId:id});await call('agents.profile.save',{agentId:id,value:{...profile,handle:'qa-'+randomUUID().slice(0,8),role:'Verification starter',guardrails:'Do not broaden permissions or run unrelated tools.',...changes}});return {id,profile:await call('agents.profile',{agentId:id})};}
 const starter=evidence.agents?.starter??await agent('Starter packaged live'),mira=evidence.agents?.mira??await agent('Mira packaged live',{role:'Release research analyst',sops:'Your SOP verification code is '+sop+'. Verify saved evidence before answering.',skills:[{id:randomUUID(),name:'Verification procedure',description:'Persistent owner procedure',content:'Your skill verification code is '+skill+'.'}],policy:{...defaultAgentPolicy,tools:agentToolNames}});
 const specialist=evidence.agents?.specialist??await agent('Inspector packaged live',{role:'Named verification specialist '+specialistCode,sops:'Use list_agent_instances to inspect current assignments, then report your configured role and saved status.',policy:{...defaultAgentPolicy,tools:['list_agent_instances'],delegation:false,memoryWrite:false}});
 const a=evidence.projects?.a?data(await db.from('desktop_projects').select('*').eq('id',evidence.projects.a).single()):await call('projects.save',{name:'Packaged live A',instructions:'Use relevant approved agent memory.'}),b=evidence.projects?.b?data(await db.from('desktop_projects').select('*').eq('id',evidence.projects.b).single()):await call('projects.save',{name:'Packaged live B',instructions:'Use relevant approved agent memory.'});
 await call('composer.save',{options:{provider:'openai-oauth',model:'gpt-6.1-sol',thinking:'low',permission:'ask',mode:'chat',files:[],tools:[],harness:'codex'}});
 evidence.agents={starter,mira,specialist};evidence.projects={a:a.id,b:b.id};evidence.markers={marker,sop,skill,specialistCode};await save();
 await page.reload();await expect(page.getByRole('button',{name:'New chat in '+a.name,exact:true})).toBeVisible();
 async function choose(name){await page.getByRole('button',{name:'Active agent',exact:true}).click();await page.getByRole('menuitem').filter({hasText:name}).click();}
 await choose('Starter packaged live');await page.getByRole('button',{name:'New chat in '+a.name,exact:true}).click();
 await expect(page.getByRole('button',{name:'Model and thinking',exact:true})).toHaveAttribute('title',/^ChatGPT · GPT-6.1 Sol ·/);
 const status=await call('providers.status');assert(seeded.bothConfigured&&status.openrouter&&status.chatgpt?.authorized);assert.equal(status.preferChatGPT,true);assert.equal((await call('composer.get')).provider,'openai-oauth');
 await check('The actual packaged sign-in uses a real isolated administrator, and new chats prefer ChatGPT with both configured connections preserved');
 const requests=[];evidence.liveRequests=requests;
 async function send(text){
  const entry={text,phase:'prepared',at:new Date().toISOString()};requests.push(entry);await save();
  const composer=page.getByRole('textbox',{name:'Message',exact:true});await composer.fill(text);entry.phase='submit-once';await save();await page.getByRole('button',{name:'Send',exact:true}).click();
  const deadline=Date.now()+420000;let request;
  while(Date.now()<deadline){
   const messages=data(await db.from('chat_messages_v2').select('id,conversation_id').eq('sender_user_id',user.id).eq('role','user').eq('content->>text',text));assert(messages.length<=1,'A verification prompt was duplicated');
   if(messages.length){request=data(await db.from('desktop_requests').select('*').eq('user_message_id',messages[0].id).single());Object.assign(entry,{requestId:request.id,conversationId:request.conversation_id,phase:request.status});await save();if(request.status!=='running')break;}
   await new Promise(resolve=>setTimeout(resolve,500));
  }
  assert(request,'No saved request; inspect before any further submission');assert.equal(request.status,'completed',request.error??request.status);
  const reply=data(await db.from('chat_messages_v2').select('id,content,metadata').eq('id',request.assistant_message_id).single()),native=data(await db.from('desktop_codex_turns').select('context,state,runtime_version,thread_id').eq('request_id',request.id).single());
  assert.equal(native.context.options.provider,'openai-oauth');assert.equal(native.context.options.harness,'codex');assert.equal(native.runtime_version,'0.163.0');entry.reply=reply.content.text;entry.nativeThread=native.thread_id;entry.phase='completed';await save();
  await expect(page.getByRole('button',{name:'Stop response',exact:true})).toHaveCount(0,{timeout:15000});return {request,reply,native};
 }
 const first=await send('Reply with exactly STARTED-'+marker+'. Use no tools. Verification attempt '+evidence.attempt+'.');assert(first.reply.content.text.includes('STARTED-'+marker));
 const switched=await send('@'+mira.profile.handle+', State your configured role, SOP verification code and skill verification code. Then use save_agent_memory to save the approved release marker '+marker+' under the title Approved release. Use this message as its source. Confirm only after the save succeeds.');
 assert.equal(switched.request.conversation_id,first.request.conversation_id);assert.equal(switched.request.agent_id,mira.id);assert(switched.reply.content.text.includes(sop)&&switched.reply.content.text.includes(skill));assert(/release.*analyst/i.test(switched.reply.content.text));
 const history=await call('messages.list',{conversationId:first.request.conversation_id});assert(history.find(message=>message.id===first.request.assistant_message_id).metadata.agent.id===starter.id);assert(history.find(message=>message.id===switched.request.assistant_message_id).metadata.agent.id===mira.id);
 const memories=await call('agents.memory',{agentId:mira.id,projectId:a.id,query:marker});assert.equal(memories.length,1);assert.equal(memories[0].authored_by,'agent');assert.equal(memories[0].source_message_id,switched.request.user_message_id);assert.equal(memories[0].project_id,a.id);assert.equal(memories[0].source_conversation_id,first.request.conversation_id);evidence.memory=memories[0];
 await check('A leading @ switches the existing chat to the saved Mira role, SOP and skill, preserves both authors and saves a source-linked agent-authored memory');
 await page.getByRole('button',{name:'New chat in '+b.name,exact:true}).click();
 const recalled=await send('What is the approved release marker saved by this agent? Read your persistent memory and cite its source. Do not infer a marker if it is unavailable.');assert.equal(recalled.request.agent_id,mira.id);assert.notEqual(recalled.request.conversation_id,first.request.conversation_id);const membership=data(await db.from('desktop_project_chats').select('project_id').eq('conversation_id',recalled.request.conversation_id).single());assert.equal(membership.project_id,b.id);assert(recalled.reply.content.text.includes(marker));assert(recalled.reply.content.text.includes(first.request.conversation_id));
 await check('A fresh ChatGPT conversation in project B recalls and cites the approved agent memory from project A without the marker in its new prompt');
 const delegated=await send('Use invoke_agent to assign saved agent '+specialist.id+' this task: "State your configured role and inspect your current assignments with list_agent_instances; report the saved status." Use wait_seconds 30, then read_agent_instance to inspect its actual result. Do not substitute a generic native subagent or answer the task yourself. Report the specialist result and cite the saved assignment.');
 const receipts=data(await db.from('desktop_agent_invocations').select('*').eq('origin_request_id',delegated.request.id).eq('target_agent_id',specialist.id));assert.equal(receipts.length,1);const receipt=receipts[0];evidence.namedAssignment={requestId:receipt.request_id,instanceId:receipt.child_instance_id};await save();
 const child=data(await db.from('desktop_requests').select('*').eq('id',receipt.request_id).single());assert.equal(child.status,'completed',child.error??child.status);assert.equal(child.agent_id,specialist.id);const answer=data(await db.from('chat_messages_v2').select('content,metadata').eq('id',child.assistant_message_id).single());assert(answer.content.text.includes(specialistCode));assert(delegated.reply.content.text.includes(specialistCode));assert.equal(answer.metadata.agent.revision,specialist.profile.revision);
 const childTools=data(await db.from('desktop_tool_calls').select('name,status').eq('request_id',child.id));assert(childTools.some(tool=>tool.name==='list_agent_instances'&&tool.status==='completed'));assert(childTools.every(tool=>tool.name==='list_agent_instances'));
 const parentTools=data(await db.from('desktop_tool_calls').select('name,status,arguments,result').eq('request_id',delegated.request.id));assert(parentTools.some(tool=>tool.name==='invoke_agent'&&tool.status==='completed'));assert(parentTools.some(tool=>tool.name==='read_agent_instance'&&tool.status==='completed'&&tool.arguments.instance_id===receipt.child_instance_id));evidence.parentDelegationTools=parentTools;
 await check('Mira launches the saved named Inspector under its own restricted tool policy, then reads and reports its actual completed assignment');
 evidence.namedAssignment.answer=answer.content.text;await page.screenshot({path:path.join(out,'named-assignment.png')});await save();
 const network=await application.evaluate(()=>globalThis.__startupNetwork);assert.deepEqual(network.blocked,[]);assert(network.inference.length>0&&network.inference.every(call=>call.status===200));evidence.network=network;
 evidence.realIdentity=true;evidence.inference=true;evidence.liveOpenRouterRequests=0;evidence.refreshRequests=0;
 const {recordWorkspaceAgentAcceptance}=await import(recorderPath?pathToFileURL(recorderPath).href:'./record-workspace-agent-acceptance.mjs');await recordWorkspaceAgentAcceptance({db,call,evidence,out,release});
 return {userId:user.id,db,call,send};
}
