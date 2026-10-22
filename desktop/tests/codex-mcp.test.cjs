const test=require('node:test'),assert=require('node:assert/strict');
const {mkdtemp,mkdir}=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {CodexMcp}=require('../build/codex-mcp.js'),{CodexClient}=require('../build/codex-client.js');
const definition={name:'read_file',description:'Owned protocol verification tool.',parameters:{type:'object',properties:{path:{type:'string'}},required:['path'],additionalProperties:false}};

test('private native MCP authenticates, declares only scoped tools, carries thread identity and cancels its own call',async()=>{
 let invoked=0,cancelled=false;const server=await new CodexMcp([definition],async(thread,name,args,id,signal)=>{invoked++;assert.equal(thread,'owned-thread');if(args.path==='wait')return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>{cancelled=true;reject(new Error('cancelled'));},{once:true}));return{thread,name,args,id};}).start();
 try{const send=(rpc,session,token=server.bearer)=>fetch(server.url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...(session?{'Mcp-Session-Id':session}:{})},body:JSON.stringify({jsonrpc:'2.0',...rpc})});
  assert.equal((await send({id:1,method:'initialize'},null,'wrong')).status,401);
  const init=await send({id:1,method:'initialize',params:{protocolVersion:'2025-06-18'}}),session=init.headers.get('mcp-session-id');assert(session);assert.equal((await init.json()).result.serverInfo.name,'agentopia-host');
  const listed=await(await send({id:2,method:'tools/list'},session)).json();assert.deepEqual(listed.result.tools.map(t=>t.name),['read_file']);
  const noIdentity=await(await send({id:3,method:'tools/call',params:{name:'read_file',arguments:{path:'x'}}},session)).json();assert(noIdentity.error);assert.equal(invoked,0);
  const result=await(await send({id:4,method:'tools/call',params:{name:'read_file',arguments:{path:'x'},_meta:{threadId:'owned-thread',callId:'call-1'}}},session)).json();assert(JSON.parse(result.result.content[0].text).thread==='owned-thread');
  const waiting=send({id:5,method:'tools/call',params:{name:'read_file',arguments:{path:'wait'},_meta:{threadId:'owned-thread',callId:'call-2'}}},session);for(let n=0;n<50&&invoked<2;n++)await new Promise(r=>setTimeout(r,10));await send({method:'notifications/cancelled',params:{requestId:5}},session);assert((await(await waiting).json()).error);assert(cancelled);
 }finally{server.close();}
});

test('the unmodified bundled Codex discovers and calls the private MCP transport without model inference',async()=>{
 const base=await mkdtemp(path.join(os.tmpdir(),'agentopia-native-mcp-')),home=path.join(base,'home');await mkdir(home);let observed;
 const server=await new CodexMcp([definition],async(thread,name,args,id)=>{observed={thread,name,args,id};return{value:'NATIVE-MCP-READY'};}).start();
 const config={model_provider:'agentopia','model_providers.agentopia.name':'Protocol check','model_providers.agentopia.base_url':'http://127.0.0.1:1/v1','model_providers.agentopia.wire_api':'responses','model_providers.agentopia.requires_openai_auth':false,'mcp_servers.agentopia_host.url':server.url,'mcp_servers.agentopia_host.bearer_token_env_var':'AGENTOPIA_TOOLS_TOKEN','mcp_servers.agentopia_host.default_tools_approval_mode':'approve'};
 const client=new CodexClient(path.resolve('desktop/resources/codex/x86_64-pc-windows-msvc/bin/codex.exe'),Object.entries(config).flatMap(([k,v])=>['-c',k+'='+JSON.stringify(v)]),{SystemRoot:process.env.SystemRoot,PATH:process.env.PATH,USERPROFILE:base,APPDATA:path.join(base,'appdata'),LOCALAPPDATA:path.join(base,'local'),TEMP:os.tmpdir(),TMP:os.tmpdir(),CODEX_HOME:home,AGENTOPIA_TOOLS_TOKEN:server.bearer},base);
 try{await client.initialize();const started=await client.request('thread/start',{model:'gpt-6.1-sol',cwd:base,sandbox:'read-only',approvalPolicy:'untrusted'});const status=await client.request('mcpServerStatus/list',{threadId:started.thread.id,serverName:'agentopia_host'});assert(status.data.some(s=>s.tools.read_file&&!s.toolsError),JSON.stringify(status.data));
  const result=await client.request('mcpServer/tool/call',{threadId:started.thread.id,server:'agentopia_host',tool:'read_file',arguments:{path:'x'},_meta:{threadId:started.thread.id,callId:'protocol-call'}});assert(!result.isError);assert(result.content.some(c=>c.text?.includes('NATIVE-MCP-READY')));assert.equal(observed.thread,started.thread.id);
 }finally{await client.close();server.close();}
});
