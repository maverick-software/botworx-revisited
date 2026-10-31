const {testDistribution}=require('./test-backend.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID,randomBytes}=require('node:crypto'),{execFileSync}=require('node:child_process'),{createServer}=require('node:http');
const {createClient}=require('@supabase/supabase-js');
const {Plugins}=require('../build/plugins.js'),{RemoteTools}=require('../build/remote-tools.js');
const {validatePluginPackage,validateToolDescriptor,pluginDigest,examplePluginPackage,searchPlugins}=require('../build/plugin-validation.js');
const copy=v=>JSON.parse(JSON.stringify(v)),check=r=>{if(r.error)throw new Error(r.error.message);return r.data;};

test('pinned portable plugin schemas, host support, secret exclusion, and deterministic integrity',()=>{
 const pkg=validatePluginPackage(examplePluginPackage);assert.equal(pkg.manifest.name,'microsoft-learn');
 assert.equal(pluginDigest(pkg),pluginDigest({mcp:pkg.mcp,manifest:pkg.manifest}));
 for(const change of [p=>delete p.manifest.$schema,p=>p.manifest.name='../outside',p=>p.manifest.version='latest',p=>p.manifest.hooks='./run.js',p=>p.manifest.extensions={'com.openai':{hooks:'./hooks.json'}},p=>p.manifest.extensions={'com.sylvana':{adapter:'serper'}},p=>p.mcp.mcpServers.docs={type:'stdio',command:'powershell'},p=>p.mcp.mcpServers.docs.headers={Authorization:'secret'},p=>p.mcp.mcpServers.docs.url='https://example.com/mcp?api_key=secret',p=>p.mcp.mcpServers.docs.url='https://user:secret@example.com/mcp',p=>p.mcp.mcpServers.docs.url='file:///C:/Windows',p=>p.mcp.mcpServers.docs.url='http://remote.example/mcp',p=>delete p.mcp,p=>p.extra=true]){const value=copy(pkg);change(value);assert.throws(()=>validatePluginPackage(value));}
 for(const p of searchPlugins)assert.equal(validatePluginPackage(p,true).manifest.name,p.manifest.name);
 assert.throws(()=>validatePluginPackage(JSON.parse('{"manifest":{"__proto__":{}}}')));
});

test('tool descriptors compile bounded local schemas and reject invalid descriptors before exposure',()=>{
 const tool={name:'search',description:'Search docs',inputSchema:{type:'object',properties:{query:{type:'string'}},required:['query'],additionalProperties:false},outputSchema:{type:'object',properties:{ok:{type:'boolean'}},required:['ok']},annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:true}};
 assert.equal(validateToolDescriptor(tool),tool);
 for(const change of [t=>t.name='bad tool',t=>t.inputSchema={type:'array'},t=>t.inputSchema.properties.query.type='invalid',t=>t.inputSchema.properties.query.$ref='https://untrusted.example/schema',t=>t.annotations.readOnlyHint='true',t=>t.outputSchema={type:'invalid'}]){const v=copy(tool);change(v);assert.throws(()=>validateToolDescriptor(v));}
});

test('plugins preserve owned MCP connections, bind imported tools, revoke access, validate results, and run reviewed Tavily searches',async()=>{
 const state=JSON.parse(execFileSync('wsl.exe',['-d',testDistribution(),'-u','sylvana','--cd','/home/sylvana/app','--exec','supabase','stack','status','--output-format','json'],{encoding:'utf8',windowsHide:true}));
 const db=createClient(state.env.API_URL,state.env.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}}),registry=new Plugins(db),remote=new RemoteTools(db),password=randomBytes(24).toString('base64url')+'Aa1!',accounts=[],agents=[],realFetch=global.fetch;
 let requests=0,executions=0,searches=0,schemaEpoch=1,badOutput=false,tavilyCreated=false;
 const server=createServer(async(req,res)=>{if(req.method!=='POST'){res.writeHead(405);return res.end();}let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw);requests++;res.setHeader('Content-Type','application/json');if(body.id===undefined){res.writeHead(202);return res.end();}let result;
  if(body.method==='initialize')result={protocolVersion:'2025-06-18',capabilities:{tools:{}},serverInfo:{name:'Plugin fixture',version:'1'}};
  else if(body.method==='tools/list')result={tools:[{name:body.params?.cursor?'second':'lookup',description:'Lookup '+schemaEpoch,inputSchema:{type:'object',properties:{query:{type:'string'}},required:['query'],additionalProperties:false},outputSchema:{type:'object',properties:{ok:{type:'boolean'}},required:['ok']},annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:true}}],...(body.params?.cursor?{}:{nextCursor:'second-page'})};
  else if(body.method==='tools/call'){executions++;result={content:[{type:'text',text:'Fixture verified'}],structuredContent:{ok:badOutput?'bad':true}};}
  else{res.end(JSON.stringify({jsonrpc:'2.0',id:body.id,error:{code:-32601,message:'Unknown method'}}));return;}res.end(JSON.stringify({jsonrpc:'2.0',id:body.id,result}));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  for(let i=0;i<2;i++){const user=check(await db.auth.admin.createUser({email:'plugins-'+randomUUID()+'@example.com',password,email_confirm:true})).user;accounts.push(user);agents.push(check(await db.rpc('desktop_save_agent',{p_user:user.id,p_id:null,p_name:'Plugin fixture '+i,p_description:'',p_instructions:'',p_provider:'openrouter',p_model:'fixture/model'})));}
  const user={id:accounts[0].id,email:accounts[0].email,admin:true},other={id:accounts[1].id,email:accounts[1].email,admin:false},role=check(await db.from('roles').select('id').eq('name','admin').single());check(await db.from('user_roles').insert({user_id:user.id,role_id:role.id}));
  const legacy=randomUUID();check(await db.rpc('desktop_save_mcp_connection',{p_user:user.id,p_id:legacy,p_agent:agents[0],p_name:'Existing plugin fixture',p_url:'http://127.0.0.1:'+server.address().port+'/mcp',p_token:'plugin-fixture-secret'}));
  let list=await registry.list(user);assert(list.some(p=>p.name==='mcp-'+legacy));const original=check(await db.from('agent_mcp_connections').select('vault_server_url_id,auth_config').eq('id',legacy).single());await registry.list(user);assert.deepEqual(check(await db.from('agent_mcp_connections').select('vault_server_url_id,auth_config').eq('id',legacy).single()),original);
  const pkg=copy(examplePluginPackage);pkg.manifest.name='plugin-fixture-'+randomUUID().slice(0,8);pkg.mcp.mcpServers.docs.url='http://127.0.0.1:'+server.address().port+'/mcp';
  const reviewed=await registry.call('plugins.validate',{package:pkg},user);assert.equal(requests,0);await assert.rejects(registry.call('plugins.install',{package:pkg,digest:'wrong'},user));await registry.call('plugins.install',{package:pkg,digest:reviewed.digest},user);assert.equal(requests,0);
  await assert.rejects(registry.call('plugins.assign',{name:pkg.manifest.name,agentId:agents[1],enabled:true},user));await registry.call('plugins.assign',{name:pkg.manifest.name,agentId:agents[0],enabled:true},user);
  list=await registry.list(user);const plugin=list.find(p=>p.name===pkg.manifest.name),id=plugin.assignments[0].connection_ids[0];assert(id);assert.equal((await registry.list(other)).some(p=>p.name===pkg.manifest.name),false);
  const api=createClient(state.env.API_URL,state.env.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});check(await api.auth.signInWithPassword({email:other.email,password}));assert((await api.from('desktop_plugins').select('*')).error);assert((await api.rpc('desktop_assign_plugin',{p_user:user.id,p_name:pkg.manifest.name,p_agent:agents[0],p_enabled:true})).error);
  await assert.rejects(remote.inspect(other.id,agents[0],id,AbortSignal.timeout(10000)));const catalog=await remote.inspect(user.id,agents[0],id,AbortSignal.timeout(10000));assert.equal(catalog.count,2);assert.equal(catalog.tools[0].validation,'Schema validated');
  const options={permission:'ask',mode:'chat'},args={connection_id:id,tool_name:'lookup',arguments_json:JSON.stringify({query:'Verified'})};let plan=await remote.plan(user.id,agents[0],options),prepared=await remote.prepare(user.id,agents[0],'mcp_call',args,plan,AbortSignal.timeout(10000));assert.equal(executions,0);assert.equal((await prepared.run(AbortSignal.timeout(10000))).structuredContent.ok,true);assert.equal(executions,1);
  prepared=await remote.prepare(user.id,agents[0],'mcp_call',args,plan,AbortSignal.timeout(10000));schemaEpoch++;await assert.rejects(prepared.run(AbortSignal.timeout(10000)),/changed/);assert.equal(executions,1);
  prepared=await remote.prepare(user.id,agents[0],'mcp_call',args,plan,AbortSignal.timeout(10000));await registry.call('plugins.enable',{name:pkg.manifest.name,enabled:false},user);await assert.rejects(prepared.run(AbortSignal.timeout(10000)));assert.equal(executions,1);await registry.call('plugins.enable',{name:pkg.manifest.name,enabled:true},user);
  prepared=await remote.prepare(user.id,agents[0],'mcp_call',args,plan,AbortSignal.timeout(10000));badOutput=true;await assert.rejects(prepared.run(AbortSignal.timeout(10000)),/usable result/);assert.equal(executions,2);badOutput=false;
  await registry.call('plugins.assign',{name:pkg.manifest.name,agentId:agents[0],enabled:false},user);await assert.rejects(remote.inspect(user.id,agents[0],id,AbortSignal.timeout(10000)));await registry.call('plugins.remove',{name:pkg.manifest.name},user);assert.equal(check(await db.from('agent_mcp_connections').select('id').eq('id',id)).length,0);assert.equal(check(await db.from('agent_mcp_connections').select('id').eq('id',legacy)).length,1);
  await assert.rejects(registry.call('plugins.key.save',{name:'tavily-search',key:'never-saved'},other),/Administrator/);
  await registry.call('plugins.assign',{name:'tavily-search',agentId:agents[0],enabled:true},user);assert.equal((await registry.search(user.id,agents[0])).adapter,'tavily');
  const old=check(await db.from('system_api_keys').select('provider_name').eq('provider_name','tavily_api').maybeSingle());
  if(!old){
   await registry.call('plugins.key.save',{name:'tavily-search',key:'fixture-tavily-private'},user);tavilyCreated=true;
   global.fetch=async(url,init)=>{if(String(url)!=='https://api.tavily.com/search')return realFetch(url,init);searches++;assert.equal(init.headers.Authorization,'Bearer fixture-tavily-private');const body=JSON.parse(init.body);assert.equal(body.search_depth,'basic');assert.equal(body.query,'Plugin search proof');return new Response(JSON.stringify({results:[{title:'Verified search',url:'https://example.com/source',content:'Current search excerpt'}]}));};
   plan=await remote.plan(user.id,agents[0],options);prepared=await remote.prepare(user.id,agents[0],'web_search',{query:'Plugin search proof'},plan,AbortSignal.timeout(10000));assert.equal(searches,0);const result=await prepared.run(AbortSignal.timeout(10000));assert.equal(searches,1);assert.equal(result.results[0].snippet,'Current search excerpt');assert(!JSON.stringify(await registry.list(other)).includes('fixture-tavily-private'));
   prepared=await remote.prepare(user.id,agents[0],'web_search',{query:'Plugin search proof'},plan,AbortSignal.timeout(10000));await registry.call('plugins.assign',{name:'serper-search',agentId:agents[0],enabled:true},user);await assert.rejects(prepared.run(AbortSignal.timeout(10000)));assert.equal(searches,1);
  }
  console.log('PASS: Validated import, preserved protected legacy connection, paginated schema discovery, owned assignments, approval revalidation, output validation, disable/removal, and protected Tavily routing. Search responses were controlled fixtures.');
 }finally{
  global.fetch=realFetch;if(tavilyCreated){await registry.call('plugins.key.remove',{name:'tavily-search'}, {id:accounts[0].id,admin:true});await db.from('system_api_keys').delete().eq('provider_name','tavily_api');}
  for(let i=0;i<accounts.length;i++){await db.from('agents').delete().eq('user_id',accounts[i].id);await db.auth.admin.deleteUser(accounts[i].id);}server.closeAllConnections();await new Promise(r=>server.close(r));
 }
});
