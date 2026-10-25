const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {createServer}=require('node:http'),{createHash}=require('node:crypto');
const build=process.env.AGENTOPIA_OAUTH_TEST_BUILD||path.resolve(__dirname,'../build');
const {McpOAuth}=require(path.join(build,'mcp-oauth.js')),{oauthNetwork,publicOAuthAddress}=require(path.join(build,'mcp-oauth-network.js')),{withMcp}=require(path.join(build,'mcp-client.js'));
const scope={owner:'owner-a',agent:'agent-a',connection:'connection-a'};
async function fixture(t,options={}){
 const records=new Map(),requests=[],browser=[];let owner=scope.owner,stamp='reviewed-plugin-a',base,challenge,registrations=0,exchanges=0,refreshes=0;
 const server=createServer(async(req,res)=>{try{
  const url=new URL(req.url,base);let body='';for await(const value of req)body+=value;
  const form=new URLSearchParams(body);requests.push({path:url.pathname,method:req.method,authorization:req.headers.authorization,body});
  const json=(value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'}).end(JSON.stringify(value));};
  if(url.pathname==='/mcp'){
   if(!req.headers.authorization){res.writeHead(401,{'WWW-Authenticate':`Bearer resource_metadata="${base}/custom-resource", scope="notes:read"`}).end();return;}
   assert.match(req.headers.authorization,/^Bearer access-/);
   if(req.method!=='POST'){res.writeHead(405).end();return;}
   const value=JSON.parse(body);if(value.id===undefined){res.writeHead(202).end();return;}
   const result=value.method==='initialize'?{protocolVersion:'2025-06-18',capabilities:{tools:{}},serverInfo:{name:'OAuth fixture',version:'1'}}:value.method==='tools/list'?{tools:[{name:'read_note',inputSchema:{type:'object',properties:{}}}]}:{content:[{type:'text',text:'fixture result'}]};
   json({jsonrpc:'2.0',id:value.id,result});return;
  }
  if(url.pathname==='/custom-resource'){json({resource:base+'/mcp',authorization_servers:[base],scopes_supported:['notes:read']});return;}
  if(url.pathname==='/.well-known/oauth-authorization-server'){json({issuer:base,authorization_endpoint:base+'/authorize',token_endpoint:base+'/token',registration_endpoint:base+'/register',response_types_supported:['code'],grant_types_supported:['authorization_code','refresh_token'],code_challenge_methods_supported:options.noPkce?['plain']:['S256'],token_endpoint_auth_methods_supported:['none'],authorization_response_iss_parameter_supported:true,client_id_metadata_document_supported:true});return;}
  if(url.pathname==='/register'){registrations++;const value=JSON.parse(body);assert.equal(value.token_endpoint_auth_method,'none');json({...value,client_id:'registered-fixture'});return;}
  if(url.pathname==='/token'){
   assert.equal(form.get('resource'),base+'/mcp');
   if(form.get('grant_type')==='refresh_token'){refreshes++;assert.equal(form.get('refresh_token'),'refresh-fixture');if(options.refreshFailure){json({error:'invalid_grant'},400);return;}await new Promise(r=>setTimeout(r,20));}
   else{exchanges++;assert.equal(form.get('grant_type'),'authorization_code');assert.equal(form.get('code'),'fixture-code');assert.equal(createHash('sha256').update(form.get('code_verifier')).digest('base64url'),challenge.searchParams.get('code_challenge'));assert.equal(form.get('redirect_uri'),challenge.searchParams.get('redirect_uri'));assert.equal(form.get('client_id'),challenge.searchParams.get('client_id'));}
   if(options.exchangeFailure&&!refreshes){json({error:'invalid_grant'},400);return;}
   json({access_token:'access-'+(refreshes?'refreshed':'initial'),token_type:'Bearer',refresh_token:'refresh-fixture',expires_in:options.expired&&!refreshes?1:3600,scope:'notes:read'});return;
  }
  if(url.pathname==='/redirect'){res.writeHead(302,{Location:base+'/unexpected'}).end();return;}
  if(url.pathname==='/oversized'){res.end('x'.repeat(1024*1024+1));return;}
  res.writeHead(404).end();
 }catch(error){res.writeHead(500).end('fixture assertion');server.lastError=error;}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
 const store={get:key=>records.get(key),set:async(key,value)=>{if(value===undefined)records.delete(key);else records.set(key,value);}};
 const target=async()=>({address:base+'/mcp',stamp,auth:options.auth}),opened=new Promise(resolve=>options.onOpen=resolve);
 const open=async address=>{challenge=new URL(address);browser.push(address);assert.equal(challenge.origin,base);assert.equal(challenge.searchParams.get('resource'),base+'/mcp');assert.equal(challenge.searchParams.get('code_challenge_method'),'S256');assert.equal(challenge.searchParams.get('scope'),Object.hasOwn(options,'expectedScope')?options.expectedScope:'notes:read');options.onOpen(challenge);if(options.hold)return;await callback(options.issuer??base);};
 const make=()=>new McpOAuth(store,target,async()=>owner,open),oauth=make();
 async function callback(issuer=base,override={}){const url=new URL(challenge.searchParams.get('redirect_uri'));for(const [key,value]of Object.entries({state:challenge.searchParams.get('state'),code:'fixture-code',iss:issuer,...override}))if(value!==undefined)url.searchParams.set(key,value);return fetch(url);}
 t.after(async()=>{oauth.cancel();server.closeAllConnections();await new Promise(r=>server.close(r));if(server.lastError)throw server.lastError;});
 return {oauth,make,open,store,records,requests,browser,base,opened,callback,get counts(){return {registrations,exchanges,refreshes};},setOwner:value=>owner=value,setStamp:value=>stamp=value};
}
test('browser OAuth discovers the challenged metadata, verifies PKCE/resource/issuer, and calls actual MCP tools',async t=>{
 const f=await fixture(t,{hold:true}),pending=f.oauth.connect(scope);pending.catch(()=>{});await f.opened;
 assert.equal((await f.callback(f.base,{state:'é'.repeat(43)})).status,400);
 assert.equal((await f.callback(f.base,{state:'unrelated'})).status,400);
 await f.callback();assert.deepEqual(await pending,{connected:true});
 assert.equal(f.counts.registrations,1);assert.equal(f.counts.exchanges,1);assert.equal(f.records.size,1);
 const token=await f.oauth.token(scope,new AbortController().signal);assert.equal(token,'access-initial');
 await withMcp(f.base+'/mcp',token,new AbortController().signal,async client=>{assert.equal((await client.listTools()).tools[0].name,'read_note');assert.equal((await client.callTool({name:'read_note',arguments:{}})).content[0].text,'fixture result');});
 assert(f.requests.filter(r=>r.path==='/mcp'&&r.method==='POST').every(r=>r.authorization==='Bearer access-initial'));
 const persisted=[...f.records.values()][0];assert(!('verifier'in persisted));assert(!('state'in persisted));
});
test('a reopened engine restores credentials and coalesces simultaneous refreshes',async t=>{
 const f=await fixture(t,{expired:true});await f.oauth.connect(scope);const cold=f.make();
 assert.deepEqual(await Promise.all([cold.token(scope,new AbortController().signal),cold.token(scope,new AbortController().signal)]),['access-refreshed','access-refreshed']);
 assert.equal(f.counts.refreshes,1);assert.equal(f.browser.length,1);assert.equal(f.records.size,1);
});
test('a provided public client avoids dynamic registration',async t=>{
 const f=await fixture(t);await f.oauth.connect(scope,{clientId:'provided-public-client'});assert.equal(f.counts.registrations,0);assert.equal(new URL(f.browser[0]).searchParams.get('client_id'),'provided-public-client');
});
test('client metadata registration uses the declared public HTTPS document',async t=>{
 const f=await fixture(t);await f.oauth.connect(scope,{clientMetadataUrl:'https://agentopia.example/oauth-client.json'});assert.equal(f.counts.registrations,0);assert.equal(new URL(f.browser[0]).searchParams.get('client_id'),'https://agentopia.example/oauth-client.json');
});
for(const missing of [false,true])test('wrong or missing advertised callback issuer cannot exchange a code: '+missing,async t=>{
 const f=await fixture(t,{hold:true}),pending=f.oauth.connect(scope);pending.catch(()=>{});await f.opened;
 const url=new URL(new URL(f.browser[0]).searchParams.get('redirect_uri'));url.searchParams.set('state',new URL(f.browser[0]).searchParams.get('state'));url.searchParams.set('code','fixture-code');if(!missing)url.searchParams.set('iss',f.base+'/other-issuer');await fetch(url);
 await assert.rejects(pending,/could not finish/);assert.equal(f.counts.exchanges,0);assert.equal(f.records.size,0);
});
test('cancellation retires the callback listener and saves no browser credentials',async t=>{
 const f=await fixture(t,{hold:true}),pending=f.oauth.connect(scope);pending.catch(()=>{});await f.opened;f.oauth.cancel(scope);await assert.rejects(pending,/cancelled/);assert.equal(f.records.size,0);await assert.rejects(f.callback());
});
for(const mutation of ['owner','plugin'])test('authorization cannot commit after '+mutation+' changes',async t=>{
 const f=await fixture(t,{hold:true}),pending=f.oauth.connect(scope);pending.catch(()=>{});await f.opened;if(mutation==='owner')f.setOwner('owner-b');else f.setStamp('new-plugin');await f.callback();await assert.rejects(pending,/changed/);assert.equal(f.counts.exchanges,0);assert.equal(f.records.size,0);
});
test('an invalid refresh requires explicit reconnect and never opens a browser from a tool call',async t=>{
 const f=await fixture(t,{expired:true,refreshFailure:true});await f.oauth.connect(scope);await assert.rejects(f.oauth.token(scope,new AbortController().signal),/needs browser sign-in/);assert.equal(f.browser.length,1);assert.equal(f.counts.refreshes,1);
});
test('disconnect removes the local grant and prevents future credential reads',async t=>{
 const f=await fixture(t);await f.oauth.connect(scope);await f.oauth.disconnect(scope);assert.equal(f.records.size,0);assert.equal(await f.oauth.token(scope,new AbortController().signal),undefined);
});
test('servers without S256 metadata fail before browser authorization',async t=>{
 const f=await fixture(t,{noPkce:true});await assert.rejects(f.oauth.connect(scope),/PKCE S256/);assert.equal(f.browser.length,0);assert.equal(f.counts.exchanges,0);
});
test('reviewed public registration and scopes are applied from the plugin declaration',async t=>{
 const f=await fixture(t,{auth:{type:'oauth',client:{mode:'provided',clientId:'plugin-public-id',tokenEndpointAuthMethod:'none'},baseScopes:['notes:read'],defaultScopes:['notes:write']},expectedScope:'notes:read notes:write'});
 await f.oauth.connect(scope);assert.equal(f.counts.registrations,0);assert.equal(new URL(f.browser[0]).searchParams.get('client_id'),'plugin-public-id');
});
test('a plugin declaring no authentication cannot start an OAuth grant',async t=>{
 const f=await fixture(t,{auth:{type:'none'}});await assert.rejects(f.oauth.connect(scope),/unauthenticated/);assert.equal(f.browser.length,0);assert.equal(f.records.size,0);
});
test('an explicit empty default scope list requests no default scopes',async t=>{
 const f=await fixture(t,{auth:{type:'oauth',defaultScopes:[]},expectedScope:null});await f.oauth.connect(scope);assert.equal(new URL(f.browser[0]).searchParams.has('scope'),false);
});
test('a rejected authorization code is exchanged only once',async t=>{
 const f=await fixture(t,{exchangeFailure:true});await assert.rejects(f.oauth.connect(scope),/could not finish/);assert.equal(f.counts.exchanges,1);assert.equal(f.records.size,0);
});
test('a grant bound to an earlier plugin revision is unavailable until reconnected',async t=>{
 const f=await fixture(t);await f.oauth.connect(scope);f.setStamp('new-plugin');await assert.rejects(f.oauth.token(scope,new AbortController().signal),/needs browser sign-in/);assert.equal(f.browser.length,1);
});
test('plugin schemas preserve supported public OAuth declarations and reject secret or ignored settings',()=>{
 const {validatePluginPackage,examplePluginPackage,pluginDigest}=require(path.join(build,'plugin-validation.js'));
 const original=structuredClone(examplePluginPackage),name=Object.keys(original.mcp.mcpServers)[0];
 const supported=structuredClone(original);supported.mcp.mcpServers[name].extensions={'com.openai':{auth:{type:'oauth',client:{mode:'provided',clientId:'public-id',tokenEndpointAuthMethod:'none'},baseScopes:['notes:read']}}};
 assert.deepEqual(validatePluginPackage(supported).mcp.mcpServers[name].extensions,supported.mcp.mcpServers[name].extensions);assert.notEqual(pluginDigest(supported),pluginDigest(original));
 for(const auth of [{type:'oauth',clientSecret:'secret'},{type:'oauth',tokenUrl:'https://ignored.example/token'},{type:'oauth',client:{mode:'provided',clientId:'id',tokenEndpointAuthMethod:'client_secret_basic'}},{type:'oauth',client:{mode:'dcr',clientId:'ignored'}},{type:'oauth',baseScopes:['two scopes']},{type:'none',defaultScopes:['read']}]){const invalid=structuredClone(original);invalid.mcp.mcpServers[name].extensions={'com.openai':{auth}};assert.throws(()=>validatePluginPackage(invalid));}
});
test('the SQL-facing adapter enforces ownership and reviewed assignments before remote tool discovery',async t=>{
 const scope={owner:'11111111-1111-4111-8111-111111111111',agent:'22222222-2222-4222-8222-222222222222',connection:'33333333-3333-4333-8333-333333333333'};
 const f=await fixture(t),{McpOAuthConnections}=require(path.join(build,'mcp-oauth-connections.js')),{RemoteTools}=require(path.join(build,'remote-tools.js')),{validatePluginPackage,examplePluginPackage,pluginDigest}=require(path.join(build,'plugin-validation.js'));
 const pkg=structuredClone(examplePluginPackage),name=Object.keys(pkg.mcp.mcpServers)[0];pkg.mcp.mcpServers[name].url=f.base+'/mcp';pkg.mcp.mcpServers[name].extensions={'com.openai':{auth:{type:'oauth',client:{mode:'provided',clientId:'declared-public-id',tokenEndpointAuthMethod:'none'}}}};validatePluginPackage(pkg);
 const rows={agents:[{id:scope.agent,user_id:scope.owner,active:true}],agent_mcp_connections:[{id:scope.connection,agent_id:scope.agent,vault_server_url_id:'url-secret',is_active:true,auth_config:{},connection_name:'Reviewed OAuth'}],desktop_plugin_connections:[{user_id:scope.owner,agent_id:scope.agent,connection_id:scope.connection,plugin_name:pkg.manifest.name,server_name:name}],desktop_plugins:[{user_id:scope.owner,name:pkg.manifest.name,package:pkg,digest:pluginDigest(pkg),source:'imported',enabled:true}],desktop_agent_plugins:[{user_id:scope.owner,agent_id:scope.agent,plugin_name:pkg.manifest.name,enabled:true}]};
 // Only persistence is controlled here. The actual Plugins authorization code,
 // OAuth adapter, RemoteTools and pinned MCP client all execute unchanged.
 const db={from:table=>{let selected=rows[table]??[];const query={select:()=>query,eq:(key,value)=>{selected=selected.filter(row=>row[key]===value);return query;},single:async()=>({data:selected.length===1?selected[0]:null,error:selected.length===1?null:{message:'not owned'}}),maybeSingle:async()=>({data:selected[0]??null,error:null})};return query;},rpc:async(name,args)=>{assert.equal(name,'get_secret');assert.equal(args.secret_id,'url-secret');return {data:[{key:f.base+'/mcp'}],error:null};}};
 const adapter=new McpOAuthConnections(db,f.store,async()=>scope.owner,f.open);await adapter.connect(scope);assert.equal(f.counts.registrations,0);
 const tools=new RemoteTools(db,undefined,adapter),result=await tools.inspect(scope.owner,scope.agent,scope.connection,new AbortController().signal);assert.equal(result.count,1);assert.equal(result.tools[0].name,'read_note');assert(!JSON.stringify(result).includes('access-initial'));
 const opened=f.browser.length;rows.desktop_agent_plugins[0].enabled=false;await assert.rejects(adapter.token(scope,new AbortController().signal),/disabled|assigned/);assert.equal(await adapter.status(scope),false);rows.desktop_agent_plugins[0].enabled=true;
 rows.agents[0].user_id='different-owner';await assert.rejects(adapter.token(scope,new AbortController().signal),/unavailable/);rows.agents[0].user_id=scope.owner;
 rows.agent_mcp_connections[0].is_active=false;await assert.rejects(adapter.token(scope,new AbortController().signal),/disabled/);rows.agent_mcp_connections[0].is_active=true;
 rows.desktop_plugins[0].enabled=false;await assert.rejects(adapter.token(scope,new AbortController().signal),/disabled|assigned/);assert.equal(f.browser.length,opened);
});
test('OAuth network isolates public connections from private destinations and bounds responses',async t=>{
 const f=await fixture(t),network=oauthNetwork(f.base+'/mcp',new AbortController().signal);
 for(const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','192.168.1.1','::1','::ffff:127.0.0.1','fc00::1','fe80::1'])assert.equal(publicOAuthAddress(ip),false,ip);
 for(const ip of ['8.8.8.8','2606:4700:4700::1111'])assert.equal(publicOAuthAddress(ip),true,ip);
 await assert.rejects(oauthNetwork('https://public.example/mcp',new AbortController().signal)('http://127.0.0.1/token'),/HTTPS/);
 await assert.rejects(oauthNetwork('https://public.example/mcp',new AbortController().signal)('https://127.0.0.1/token'),/private network/);
 assert.equal((await network(f.base+'/redirect')).status,302);assert(!f.requests.some(r=>r.path==='/unexpected'));
 await assert.rejects(network(f.base+'/oversized'),/1 MB/);
});
test('OAuth discovery reaches a DNS hostname with address-list lookup enabled',async t=>{
 const server=createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({resource:'hostname fixture'}));});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,resolve);});
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const address='http://localhost:'+server.address().port+'/mcp',response=await oauthNetwork(address,AbortSignal.timeout(5000))(address);
 assert.equal(response.status,200);assert.deepEqual(await response.json(),{resource:'hostname fixture'});
});
