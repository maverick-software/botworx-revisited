// Real bundled Codex transport -> ToolService -> disposable PostgreSQL bridge.
// Direct tool invocation exercises no model endpoint and uses no provider key.
const {readFile,mkdir}=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const config=JSON.parse(await readFile(process.argv[2],'utf8'));
 // WSL localhost forwarding is asynchronous. Probe only the read-only health
 // route before any mutation, rather than retrying uncertain tool writes.
 let ready=false,lastError;for(let attempt=0;attempt<100&&!ready;attempt++){
  try{const reply=await fetch(config.endpoint,{headers:{Authorization:'Bearer '+config.token},signal:AbortSignal.timeout(1000)});ready=reply.ok&&(await reply.text())==='ready';}catch(error){lastError=error;}
  if(!ready)await new Promise(resolve=>setTimeout(resolve,100));
 }
 assert(ready,'Disposable database bridge did not become reachable: '+String(lastError?.cause??lastError));
 const {ToolService}=require(path.join(config.build,'tool-service.js')),{CodexMcp}=require(path.join(config.build,'codex-mcp.js')),{CodexClient}=require(path.join(config.build,'codex-client.js'));
 const call=async(body)=>{let reply;try{reply=await fetch(config.endpoint,{method:'POST',headers:{Authorization:'Bearer '+config.token,'Content-Type':'application/json'},body:JSON.stringify(body)});}catch(error){throw Error('Disposable database bridge failed during '+body.kind+'/'+(body.name??body.action??body.operation)+': '+String(error.cause??error));}assert.equal(reply.status,200);return reply.json();};
 const checked=result=>{if(result.error)throw Error(result.error.message);return result.data;};
 const db={rpc:(name,args)=>call({kind:'rpc',name,args}),from(table){let operation='select',columns='*',values,filters=[];
  const execute=async(single=false)=>call({kind:'table',table,operation,columns,values,filters,single});
  const query={select(value='*'){columns=value;return query;},eq(key,value){filters.push([key,value]);return query;},insert(value){operation='insert';values=value;return query;},update(value){operation='update';values=value;return query;},maybeSingle(){return execute(true);},single(){return execute(true);},then(resolve,reject){return execute().then(resolve,reject);}};return query;
 }};
 const options={permission:'ask',mode:'chat',thinking:'default',files:[]},events=[],service=new ToolService(db,{},(_,event)=>events.push(event),async()=>({id:config.user,admin:false}));
 const server=await new CodexMcp(service.chats.definitions(options),async(thread,name,args,id,signal)=>service.execute({id:config.user,admin:false},config.request,{id:thread+':'+id,name,arguments:JSON.stringify(args)},options,signal,undefined,config.request.agent_id,thread)).start();
 const home=path.join(config.out,'native-home');await mkdir(home);
 const settings={model_provider:'agentopia','model_providers.agentopia.name':'Owned inspection transport check','model_providers.agentopia.base_url':'http://127.0.0.1:1/v1','model_providers.agentopia.wire_api':'responses','model_providers.agentopia.requires_openai_auth':false,'mcp_servers.agentopia_host.url':server.url,'mcp_servers.agentopia_host.bearer_token_env_var':'AGENTOPIA_TOOLS_TOKEN','mcp_servers.agentopia_host.default_tools_approval_mode':'approve'};
 const client=new CodexClient(path.join(config.resources,'codex/x86_64-pc-windows-msvc/bin/codex.exe'),Object.entries(settings).flatMap(([k,v])=>['-c',k+'='+JSON.stringify(v)]),{SystemRoot:process.env.SystemRoot,PATH:process.env.PATH,USERPROFILE:config.out,APPDATA:path.join(config.out,'appdata'),LOCALAPPDATA:path.join(config.out,'local'),TEMP:config.out,TMP:config.out,CODEX_HOME:home,AGENTOPIA_TOOLS_TOKEN:server.bearer},config.out);
 const invoke=async(thread,name,args,id,expectError=false)=>{
  const result=await client.request('mcpServer/tool/call',{threadId:thread,server:'agentopia_host',tool:name,arguments:args,_meta:{threadId:thread,callId:id}});
  assert.equal(!!result.isError,expectError,JSON.stringify(result));return JSON.parse(result.content.find(c=>c.type==='text').text);
 };
 try{
  console.log('Initializing bundled Codex transport.');await client.initialize();const root=(await client.request('thread/start',{model:'gpt-6.1-sol',cwd:config.out,sandbox:'read-only',approvalPolicy:'untrusted'})).thread.id;
  checked(await call({kind:'control',action:'bind_root',thread:root}));
  const discovered=await client.request('mcpServerStatus/list',{threadId:root,serverName:'agentopia_host'});assert(discovered.data.some(s=>s.tools.list_chats&&s.tools.read_chat&&!s.toolsError));
  console.log('Discovered tools; listing and reading the disposable target.');const listed=await invoke(root,'list_chats',{query:config.title,limit:5,offset:0},'list-1');assert.equal(listed.chats.length,1);assert.equal(listed.chats[0].conversation_id,config.target);
  const read=await invoke(root,'read_chat',{conversation_id:config.target,offset:0,message_offset:0,limit:6,characters:6000},'read-1');assert(read.messages.some(m=>m.text.includes('NATIVE-INSPECTION-RESULT')));assert(read.messages.every(m=>m.citation.startsWith('agentopia-chat://'+config.target+'/message/')));
  assert(events.filter(e=>e.tool?.status==='completed').length>=2);await service.chats.validate(config.user,config.request,options,root);
  console.log('Checking source revocation and stored receipts.');checked(await call({kind:'control',action:'archive'}));await assert.rejects(service.chats.validate(config.user,config.request,options,root),/unavailable/);
  checked(await call({kind:'control',action:'unarchive'}));
  console.log('Checking independent child and stopped-child controls.');const child=(await client.request('thread/start',{model:'gpt-6.1-sol',cwd:config.out,sandbox:'read-only',approvalPolicy:'untrusted'})).thread.id;
  checked(await call({kind:'control',action:'bind_child',thread:child}));
  const background=await invoke(child,'read_chat',{conversation_id:config.target,offset:0,message_offset:0,limit:1,characters:100},'child-read');assert(background.messages.length);
  checked(await call({kind:'control',action:'stop_child',thread:child}));
  const stopped=await invoke(child,'read_chat',{conversation_id:config.target,offset:0,message_offset:0,limit:1,characters:100},'stopped-read',true);assert.match(stopped.error,/no longer active/);
  options.permission='chat';const denied=await invoke(child,'list_chats',{query:'',limit:5,offset:0},'chat-only',true);assert.match(denied.error,/not enabled/);
  console.log(JSON.stringify({success:true,actualCodex:true,actualToolService:true,actualPostgres:true,liveInferenceRequests:0,checks:['native discovery and direct list/read calls','source-linked saved text','completed receipts through ToolService','archival blocks subsequent validation','background child after parent completion','stopped child denied','Chat only denied']}));
 }finally{await client.close();server.close();}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
