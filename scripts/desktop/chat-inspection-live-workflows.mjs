import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import {expect} from '@playwright/test';
import {installLiveGuard as originalGuard} from './packaged-live-workflows.mjs';

export async function installInspectionLiveGuard(application){
 await originalGuard(application);
 await application.evaluate(()=>{const real=globalThis.fetch;globalThis.fetch=(input,args)=>{const url=String(typeof input==='string'?input:input.url??input);if(url==='https://api.openai.com/v1/responses'&&globalThis.__startupNetwork.inference.length>=8)throw Error('The single inspection acceptance request reached its eight-round ceiling. Inspect saved work before another request.');return real(input,args);};});
}
export async function runChatInspectionLive({application,page,runtime,physical,out,check,evidence,save}){
 const state=JSON.parse(await runtime.command(['supabase','stack','status','--output-format','json'])),{createClient}=await import('@supabase/supabase-js');
 const db=createClient(state.env.API_URL,state.env.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}}),data=result=>{if(result.error)throw Error(result.error.message);return result.data;};
 const call=(action,args)=>page.evaluate(({action,args})=>window.agentopia.call(action,args),{action,args});
 assert(!(await call('auth.state')).identity,'A new controlled fixture is required; inspect any earlier live work before another submission.');
 const account={email:'chat-inspection-'+randomUUID()+'@example.invalid',password:randomUUID()+randomUUID()},user=data(await db.auth.admin.createUser({...account,email_confirm:true})).user;
 const role=data(await db.from('roles').select('id').eq('name','admin').single());data(await db.from('user_roles').insert({user_id:user.id,role_id:role.id}));evidence.fixtureUser=user.id;await save();
 evidence.authorization=await application.evaluate(async({app},{snapshot,owner,inspection})=>{
  const {createRequire}=process.getBuiltinModule('module'),p=process.getBuiltinModule('path'),require=createRequire(p.join(app.getAppPath(),'package.json')),{Secrets}=require('./build/secrets.js'),source=new Secrets(snapshot);await source.load();
  const session=source.get('session');if(!session?.access_token)throw Error('Physical source has no local owner');
  const sourceOwner=JSON.parse(Buffer.from(session.access_token.split('.')[1],'base64url').toString()).sub,connection=source.get('openai:'+sourceOwner),models=source.get('models:openai-oauth:'+sourceOwner);
  if(!connection?.scope?.split(' ').includes('chatgpt.tokens.use.direct')||connection.expires_at<Date.now()+600000||!models?.some(m=>m.id==='gpt-6.1-sol'))throw Error('Fresh ordinary ChatGPT authorization is required');
  const broker=globalThis.__liveBroker;if(!broker)throw Error('The delivered broker was not observed');
  await broker.secrets.set('openai:'+owner,{...connection,refresh_token:''});await broker.secrets.set('models:openai-oauth:'+owner,models);await broker.secrets.set('prefer-chatgpt:'+owner,true);await broker.secrets.set('chatgpt-welcome:'+owner,true);
  globalThis.__liveAccessExpires=connection.expires_at;
  return {inspection,validForSeconds:Math.floor((connection.expires_at-Date.now())/1000),refreshCredentialCopied:false};
 },{snapshot:physical.snapshot,owner:user.id,inspection:physical.inspection});await save();
 await page.getByLabel('Email address',{exact:true}).fill(account.email);await page.getByLabel('Password',{exact:true}).fill(account.password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('button',{name:/^New chat\b/}).first()).toBeVisible({timeout:30000});
 const agent=await call('agents.save',{name:'Chat inspection verification',description:'One controlled cross-chat read',instructions:'Use only the requested saved-chat inspection tools. Cite confirmed saved message sources and never invent a marker.',provider:'openai-oauth',model:'gpt-6.1-sol'}),profile=await call('agents.profile',{agentId:agent});
 await call('agents.profile.save',{agentId:agent,value:{...profile,handle:'inspection-'+randomUUID().slice(0,8),policy:{...profile.policy,tools:['list_chats','read_chat'],delegation:false,memory:true,memoryWrite:false,maxDepth:0}}});
 const title='Saved inspection '+randomUUID().slice(0,8),marker='CHAT-READ-'+randomUUID(),seedId=randomUUID(),requestId=randomUUID(),options={provider:'openai-oauth',model:'gpt-6.1-sol',thinking:'low',permission:'ask',mode:'chat',files:[]};
 const seed=data(await db.rpc('desktop_begin_chat_with_options',{p_user:user.id,p_request:seedId,p_agent:agent,p_conversation:null,p_text:'Saved verification release marker',p_options:options,p_files:[]}));
 data(await db.rpc('desktop_checkpoint_chat',{p_user:user.id,p_request:seedId,p_text:marker,p_status:'completed',p_error:null}));data(await db.from('conversation_sessions').update({title}).eq('conversation_id',seed.conversation_id).eq('user_id',user.id));
 const question='Inspect saved conversation '+title+'. Find it with tools.list_chats, then use tools.read_chat to read its saved assistant message. Report its exact release marker and cite that saved message using the returned citation. Use only those two tools.';
 assert(!question.includes(marker));
 const record={requestId,phase:'prepared',provider:'openai-oauth',target:seed.conversation_id,expectedMarker:marker};evidence.liveRequests=[record];await save();
 const pointer=path.resolve(out,'../../desktop-chat-inspection/latest-live.json');
 const latest=JSON.parse(await readFile(pointer,'utf8'));latest.requestId=requestId;latest.phase='submitting';await writeFile(pointer,JSON.stringify(latest,null,2));
 record.phase='submitting';await save();
 const started=await call('chat.start',{requestId,agentId:agent,conversationId:null,text:question,options});record.conversationId=started.conversation_id;record.phase='running';await save();
 await page.reload();await expect(page.getByRole('button',{name:/^Inspect saved conversation/}).first()).toBeVisible({timeout:30000});await page.getByRole('button',{name:/^Inspect saved conversation/}).first().click();
 await expect.poll(async()=>{const row=data(await db.from('desktop_requests').select('status,error').eq('id',requestId).eq('user_id',user.id).single());if(['failed','cancelled','interrupted'].includes(row.status))throw Error(row.error??row.status);return row.status;},{timeout:180000,intervals:[1000,2000,3000]}).toBe('completed');
 const messages=await call('messages.list',{conversationId:record.conversationId}),answer=messages.find(m=>m.id===started.assistant_message_id);assert(answer?.content.text.includes(marker),'The model did not return the saved marker');
 const receipts=data(await db.from('desktop_tool_calls').select('id,name,status,result,native_thread_id').eq('request_id',requestId).eq('user_id',user.id));assert(receipts.some(r=>r.name==='list_chats'&&r.status==='completed'));assert(receipts.some(r=>r.name==='read_chat'&&r.status==='completed'&&r.result.messages.some(m=>m.text===marker)));
 const expectedCitation='agentopia-chat://'+seed.conversation_id+'/message/'+seed.assistant_message_id;assert(answer.content.text.includes(expectedCitation),'The final answer did not cite the saved source');
 record.reply=answer.content.text;record.phase='completed';record.receipts=receipts.map(({id,name,status,native_thread_id})=>({id,name,status,native_thread_id}));await save();
 const last=page.locator('article.message').last();await expect(last).toContainText(marker);await last.getByRole('link').first().click();await expect(page.getByRole('region',{name:'Conversation source',exact:true})).toContainText(marker);
 await page.screenshot({path:path.join(out,'cross-chat-source.png')});
 const network=await application.evaluate(()=>globalThis.__startupNetwork);assert.deepEqual(network.blocked,[]);assert(network.inference.length>0&&network.inference.length<=8&&network.inference.every(r=>r.status===200));evidence.network=network;evidence.liveOpenRouterRequests=0;evidence.refreshRequests=0;
 latest.phase='live-read-completed';latest.inferenceCalls=network.inference.length;await writeFile(pointer,JSON.stringify(latest,null,2));
 await check('A real ChatGPT native turn lists and reads a separate owned chat, returns its unprompted marker, saves tool receipts and opens the cited source in the packaged chat interface.');
 return {userId:user.id};
}
