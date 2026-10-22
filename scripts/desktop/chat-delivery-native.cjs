// Actual bundled Codex MCP -> ToolService -> disposable PostgreSQL.
// The receiving queue is a controlled callback; this does not start inference.
const {readFile,writeFile,mkdir}=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const config=JSON.parse(await readFile(process.argv[2],'utf8'));let ready=false;
 for(let attempt=0;attempt<100&&!ready;attempt++){
  try{const response=await fetch(config.endpoint,{headers:{Authorization:'Bearer '+config.token},signal:AbortSignal.timeout(1000)});ready=response.ok&&(await response.text())==='ready';}catch{}
  if(!ready)await new Promise(resolve=>setTimeout(resolve,100));
 }
 assert(ready,'The disposable bridge is unavailable; no mutation was retried.');
 const {ToolService}=require(path.join(config.build,'tool-service.js')),{chatDeliveryReceipt}=require(path.join(config.build,'chat-delivery.js')),{CodexMcp}=require(path.join(config.build,'codex-mcp.js')),{CodexClient}=require(path.join(config.build,'codex-client.js'));
 const call=async body=>{const response=await fetch(config.endpoint,{method:'POST',headers:{Authorization:'Bearer '+config.token,'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(response.status,200);return response.json();};
 const checked=result=>{if(result.error)throw Error(result.error.message);return result.data;};
 const db={rpc:(name,args)=>call({kind:'rpc',name,args}),from(table){let operation='select',columns='*',values,filters=[];
  const execute=single=>call({kind:'table',table,operation,columns,values,filters,single});
  const q={select(value='*'){columns=value;return q},eq(key,value){filters.push([key,value]);return q},is(key,value){filters.push([key,value]);return q},insert(value){operation='insert';values=value;return q},update(value){operation='update';values=value;return q},maybeSingle(){return execute(true)},single(){return execute(true)},then(resolve,reject){return execute(false).then(resolve,reject)}};return q;
 }};
 const options={provider:'openai-oauth',model:'fixture-model',permission:'ask',mode:'chat',thinking:'default',files:[]},events=[],decisions=[],handoffs=[],decisionErrors=[];let decision='once';
 const service=new ToolService(db,{},(owner,event)=>{
  events.push(event);
  if(event.tool?.status==='awaiting_approval'&&decision){decisions.push(decision);service.decide(owner,event.tool.id,true,decision==='pair').catch(error=>decisionErrors.push(error));}
 },async()=>({id:config.user,admin:false}));
 service.deliverChat=async(owner,row,signal)=>{signal.throwIfAborted();handoffs.push({owner,id:row.id,text:row.text});return chatDeliveryReceipt(row);};
 const cancelled=new AbortController();
 const server=await new CodexMcp(service.deliveryDefinitions(options),async(thread,name,args,id,signal)=>{
  try{return await service.execute({id:config.user,admin:false},config.request,{id:thread+':'+id,name,arguments:JSON.stringify(args)},options,args.text==='Cancellation fixture'?AbortSignal.any([signal,cancelled.signal]):signal,undefined,config.request.agent_id,thread);}
  catch(error){await writeFile(path.join(config.out,'private-tool-error.log'),error.stack??String(error));throw error;}
 }).start();
 const home=path.join(config.out,'native-home');await mkdir(home);
 const settings={model_provider:'agentopia','model_providers.agentopia.name':'Chat delivery transport qualification','model_providers.agentopia.base_url':'http://127.0.0.1:1/v1','model_providers.agentopia.wire_api':'responses','model_providers.agentopia.requires_openai_auth':false,'mcp_servers.agentopia_host.url':server.url,'mcp_servers.agentopia_host.bearer_token_env_var':'AGENTOPIA_TOOLS_TOKEN','mcp_servers.agentopia_host.default_tools_approval_mode':'approve'};
 const client=new CodexClient(path.join(config.resources,'codex/x86_64-pc-windows-msvc/bin/codex.exe'),Object.entries(settings).flatMap(([key,value])=>['-c',key+'='+JSON.stringify(value)]),{SystemRoot:process.env.SystemRoot,PATH:process.env.PATH,USERPROFILE:config.out,APPDATA:path.join(config.out,'appdata'),LOCALAPPDATA:path.join(config.out,'local'),TEMP:config.out,TMP:config.out,CODEX_HOME:home,AGENTOPIA_TOOLS_TOKEN:server.bearer},config.out);
 const invoke=async(thread,text,id,expectError=false)=>{
  const result=await client.request('mcpServer/tool/call',{threadId:thread,server:'agentopia_host',tool:'send_message_to_chat',arguments:{conversation_id:config.target,text},_meta:{threadId:thread,callId:id}});
  assert.equal(!!result.isError,expectError,JSON.stringify(result));return JSON.parse(result.content.find(part=>part.type==='text').text);
 };
 try{
  await client.initialize();const root=(await client.request('thread/start',{model:'gpt-6.1-sol',cwd:config.out,sandbox:'read-only',approvalPolicy:'untrusted'})).thread.id;
  checked(await call({kind:'control',action:'bind_root',thread:root}));
  const discovered=await client.request('mcpServerStatus/list',{threadId:root,serverName:'agentopia_host'});assert(discovered.data.some(server=>server.tools.send_message_to_chat&&!server.toolsError));
  console.log('Native schema discovered; checking one-time authorization.');const first=await invoke(root,'Review the native transport draft.','once-1');assert.equal(first.status,'queued');assert.equal(handoffs.length,1);assert.deepEqual(decisions,['once']);
  const duplicate=await invoke(root,'Review the native transport draft.','once-1');assert(duplicate.duplicate);assert.equal(handoffs.length,1);
  const changed=await invoke(root,'Changed text must not reuse the stable ID.','once-1',true);assert.match(changed.error,/different arguments/);
  console.log('Saved receipt and changed-call checks passed; checking pair authorization.');decision='pair';await invoke(root,'Allow subsequent coordination.','pair-1');assert.equal(handoffs.length,2);assert.deepEqual(decisions,['once','pair']);
  await invoke(root,'Use the already approved chat pair.','pair-2');assert.equal(handoffs.length,3);assert.deepEqual(decisions,['once','pair']);
  options.permission='files';const limited=await invoke(root,'Selected files cannot send work.','files-denied',true);assert.match(limited.error,/not enabled/);options.permission='ask';
  const other=(await client.request('thread/start',{model:'gpt-6.1-sol',cwd:config.out,sandbox:'read-only',approvalPolicy:'untrusted'})).thread.id;
  const unknown=await invoke(other,'Unknown native thread cannot send.','unknown-thread',true);assert.match(unknown.error,/no longer active/);assert.equal(handoffs.length,3);
  // Use a separate target with no pair grant for the pending cancellation case.
  console.log('Pair reuse and scope checks passed; checking pending cancellation.');checked(await call({kind:'control',action:'revoke_pair'}));decision=null;
  const work=invoke(root,'Cancellation fixture','cancel-1',true);work.catch(()=>{});
  const deadline=Date.now()+5000;while(!events.some(event=>event.tool?.status==='awaiting_approval'&&event.tool.approval?.arguments.message==='Cancellation fixture')&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,20));
  assert(events.some(event=>event.tool?.status==='awaiting_approval'&&event.tool.approval?.arguments.message==='Cancellation fixture'));cancelled.abort();await assert.rejects(work,/authorize or execute this native tool call/);assert.equal(handoffs.length,3);assert.equal(decisionErrors.length,0);
  console.log(JSON.stringify({success:true,actualCodex:true,actualToolService:true,actualPostgres:true,controlledReceivingQueue:true,liveInferenceRequests:0,handoffs:handoffs.length,decisions,checks:['native schema discovery','one-time authorization saved before handoff','exact replay returns receipt','changed replay rejected','pair authorization persisted','saved pair avoids new review','Selected files denied','unknown native thread denied','cancelled pending review cannot dispatch']}));
 }finally{await client.close();server.close();}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
