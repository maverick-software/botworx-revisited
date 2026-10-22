const {testDistribution}=require('./test-backend.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),{randomUUID,randomBytes}=require('node:crypto'),{mkdtemp,writeFile,readFile,rm}=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {createClient}=require('@supabase/supabase-js'),{Broker}=require('./legacy-harness.cjs'),{Providers}=require('../build/providers.js');
class Secrets{data=new Map();get(k){return this.data.get(k);}async set(k,v){this.data.set(k,v);}}
const check=r=>{if(r.error)throw new Error(r.error.message);return r.data;};
test('both provider tool loops perform owned, reviewed edits; denial, cancellation, history, and RLS remain enforced',async()=>{
 const state=JSON.parse(execFileSync('wsl.exe',['-d',testDistribution(),'-u','agentopia','--cd','/home/agentopia/app','--exec','supabase','stack','status','--output-format','json'],{encoding:'utf8',windowsHide:true})),db=createClient(state.env.API_URL,state.env.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const secrets=new Secrets(),secondSecrets=new Secrets(),events=[],broker=new Broker(state.env,secrets,new Providers(secrets,'urn:uuid:'+randomUUID()),e=>events.push(e)),other=new Broker(state.env,secondSecrets,new Providers(secondSecrets,'urn:uuid:'+randomUUID()),()=>{}),originalFetch=global.fetch,accounts=[],root=await mkdtemp(path.join(os.tmpdir(),'agentopia-tools-db-')),file=path.join(root,'notes.md');
 const password=randomBytes(24).toString('base64url')+'Aa1!';let agent,reference,counter=0,bodies=[];
 const wait=async predicate=>{for(let n=0;n<200;n++){const value=await predicate();if(value)return value;await new Promise(r=>setTimeout(r,40));}throw new Error('Tool workflow timed out.');};
 try{
  for(let n=0;n<2;n++)accounts.push(check(await db.auth.admin.createUser({email:`tools-${randomUUID()}@example.com`,password,email_confirm:true})).user);
  await broker.call('auth.signIn',{email:accounts[0].email,password});await other.call('auth.signIn',{email:accounts[1].email,password});
  await secrets.set('openrouter',{key:'fixture-router'});await secrets.set('models:openrouter:shared',[{id:'fixture/model',name:'Fixture',supportsTools:true,thinking:['high']}]);await secrets.set('openai:'+accounts[0].id,{access_token:'fixture-oauth',expires_at:Date.now()+3600000,scope:'chatgpt.tokens.use.direct'});await secrets.set('models:openai-oauth:'+accounts[0].id,[{id:'fixture-model',name:'Fixture',supportsTools:true,thinking:['high']}]);
  agent=await broker.call('agents.save',{name:'Workspace tools fixture',description:'',instructions:'Use tools carefully.',provider:'openrouter',model:'fixture/model'});await writeFile(file,'Before\n');reference=(await broker.files.add(accounts[0].id,[root]))[0];broker.files.dialogs={showMessageBox:async()=>({response:1})};
  global.fetch=async(url,args)=>{
   const oauth=String(url)==='https://api.openai.com/v1/responses';if(!oauth&&String(url)!=='https://openrouter.ai/api/v1/chat/completions')return originalFetch(url,args);
   const body=JSON.parse(args.body);bodies.push(body);const history=oauth?body.input:body.messages,last=history.at(-1),isResult=oauth?last.type==='function_call_output':last.role==='tool';
   const complete=text=>new Response(oauth?'data: '+JSON.stringify({type:'response.output_text.delta',delta:text})+'\n\ndata: {"type":"response.completed"}\n\n':'data: '+JSON.stringify({choices:[{delta:{content:text}}]})+'\n\ndata: {"choices":[{"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n');
   const tool=(name,parameters)=>{const id='tool_'+(++counter);return new Response(oauth?'data: '+JSON.stringify({type:'response.completed',response:{output:[{type:'reasoning',id:'rs_'+counter,summary:[],encrypted_content:'opaque_'+counter},{type:'function_call',call_id:id,name,namespace:'workspace',arguments:JSON.stringify(parameters)}]}})+'\n\n':'data: '+JSON.stringify({choices:[{delta:{reasoning_details:[{type:'reasoning.encrypted',data:'opaque_'+counter,index:0}],tool_calls:[{index:0,id,function:{name,arguments:JSON.stringify(parameters)}}]},finish_reason:'tool_calls'}]})+'\n\ndata: [DONE]\n\n');};
   if(!isResult)return tool('read_file',{reference_id:reference.id,path:'notes.md'});
   const result=JSON.parse(oauth?last.output:last.content);
   if(result.content!==undefined)return tool('write_file',{reference_id:reference.id,path:'notes.md',expected_hash:result.sha256,content:'After\n',reason:'Improve the note.'});
   return complete(result.denied?'Declined.':result.error?'File conflict.':'Saved. <!-- GOAL_COMPLETE -->');
  };
  let conversation;
  for(const provider of ['openai-oauth','openrouter']){
   await writeFile(file,'Before\n');const requestId=randomUUID(),options={provider,model:provider==='openrouter'?'fixture/model':'fixture-model',thinking:'high',permission:'ask',mode:'chat',files:[reference.id]};
   const request=await broker.call('chat.start',{requestId,agentId:agent,conversationId:conversation,text:'Read and edit the note.',options});conversation=request.conversation_id;
   const review=await wait(()=>events.find(e=>e.requestId===requestId&&e.tool?.status==='awaiting_approval')?.tool);assert.equal(await readFile(file,'utf8'),'Before\n');await assert.rejects(other.call('tools.decide',{id:review.id,approved:true}));
   const client=createClient(state.env.API_URL,state.env.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});check(await client.auth.signInWithPassword({email:accounts[1].email,password}));assert.equal(check(await client.from('desktop_tool_calls').select('id').eq('id',review.id)).length,0);
   await broker.call('tools.decide',{id:review.id,approved:true});assert.equal((await wait(()=>events.find(e=>e.requestId===requestId&&e.status))).status,'completed');assert.equal(await readFile(file,'utf8'),'After\n');
   const rows=await broker.call('messages.list',{conversationId:conversation}),last=rows.at(-1);assert.equal(last.metadata.tools.length,2);assert.equal(last.metadata.tools[1].status,'completed');await assert.rejects(other.call('tools.revert',{id:review.id}));await broker.call('tools.revert',{id:review.id});assert.equal(await readFile(file,'utf8'),'Before\n');
   const continuation=bodies.filter(body=>body.model===options.model).at(-1);assert(JSON.stringify(continuation).includes('opaque_'),'Provider-specific reasoning was dropped between tool calls');
  }
  const options={provider:'openrouter',model:'fixture/model',thinking:'high',permission:'ask',mode:'chat',files:[reference.id]};
  const deniedId=randomUUID();await broker.call('chat.start',{requestId:deniedId,agentId:agent,text:'Decline this proposal',options});const denied=await wait(()=>events.find(e=>e.requestId===deniedId&&e.tool?.status==='awaiting_approval')?.tool);await broker.call('tools.decide',{id:denied.id,approved:false});await wait(()=>events.find(e=>e.requestId===deniedId&&e.status));assert.equal(await readFile(file,'utf8'),'Before\n');assert(!bodies.at(-1).tools.some(tool=>tool.function.name==='write_file'));
  const cancelledId=randomUUID();await broker.call('chat.start',{requestId:cancelledId,agentId:agent,text:'Cancel this proposal',options});const cancelled=await wait(()=>events.find(e=>e.requestId===cancelledId&&e.tool?.status==='awaiting_approval')?.tool);await broker.call('chat.cancel',{requestId:cancelledId});assert.equal((await wait(()=>events.find(e=>e.requestId===cancelledId&&e.status))).status,'cancelled');assert.equal(await readFile(file,'utf8'),'Before\n');await assert.rejects(broker.call('tools.decide',{id:cancelled.id,approved:true}),/no longer active/);
  await secrets.set('models:openrouter:shared',[{id:'fixture/model',name:'Chat-only model',supportsTools:false,thinking:['high']}]);const chatOnlyId=randomUUID(),chatOnly=await broker.call('chat.start',{requestId:chatOnlyId,agentId:agent,text:'Analyze without tool support',options});await wait(()=>events.find(e=>e.requestId===chatOnlyId&&e.status));assert(!bodies.at(-1).tools);assert.equal((await broker.call('messages.list',{conversationId:chatOnly.conversation_id})).at(-1).metadata.tools,undefined);assert.equal(await readFile(file,'utf8'),'Before\n');
  await secrets.set('models:openrouter:shared',[{id:'fixture/model',name:'Fixture',supportsTools:true,thinking:['high']}]);const logoutId=randomUUID();await broker.call('chat.start',{requestId:logoutId,agentId:agent,text:'Pending during sign-out',options});await wait(()=>events.find(e=>e.requestId===logoutId&&e.tool?.status==='awaiting_approval'));const beforeLogout=events.length;await broker.call('auth.signOut');await broker.call('auth.signIn',{email:accounts[1].email,password});assert.equal(events.length,beforeLogout,'Private tool or response events escaped after sign-out');assert.equal(await readFile(file,'utf8'),'Before\n');
  console.log('PASS: Real Supabase tool records and file writes crossed both provider formats with opaque reasoning preserved; review, owner-only approval/undo, RLS, declined writes, cancellation, and saved activity held. Inference was simulated.');
 }finally{
  await broker.shutdown();await other.shutdown();global.fetch=originalFetch;
  for(const account of accounts){check(await db.from('agents').delete().eq('user_id',account.id));check(await db.auth.admin.deleteUser(account.id));}
  assert(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep));await rm(root,{recursive:true,force:true});
 }
});
