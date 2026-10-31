const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{randomUUID}=require('node:crypto');
const build=process.env.SYLVANA_COMPOSIO_TEST_BUILD;if(!build)throw Error('Run the isolated Composio qualification script.');
const {ComposioClient,ComposioUnavailableError}=require(path.join(build,'composio-client.js'));
const {ComposioConnections}=require(path.join(build,'composio-connections.js'));
const {composioInvalidatedAgents}=require(path.join(build,'composio-connections.js'));
const {composioToolkit,composioAccount,composioTool}=require(path.join(build,'composio-contracts.js'));
const {fixture,toolkit,tool,response,key}=require('./fixtures/composio.cjs');

test('catalog returns the complete paginated project view, including uppercase custom connectors',async()=>{
 const f=fixture();f.setHook(async url=>url.pathname.endsWith('/toolkits')?response({items:[toolkit(url.searchParams.has('cursor')?'CUSTOM_INTERNAL':'github')],next_cursor:url.searchParams.has('cursor')?null:'page_2',total_items:2}):undefined);
 const first=await f.client.catalog({search:'  repo  ',category:'developer-tools',user:'bound_user'}),second=await f.client.catalog({cursor:first.nextCursor});
 assert.equal(first.total,2);assert.equal(second.items[0].slug,'CUSTOM_INTERNAL');assert.equal(second.nextCursor,null);assert.equal(f.calls[0].url.searchParams.get('search'),'repo');assert.equal(f.calls[0].url.searchParams.get('type'),'all');assert.equal(f.calls[0].url.searchParams.get('user_id'),'bound_user');
});
test('authentication metadata keeps methods and required fields while excluding secret defaults and raw service fields',()=>{
 const data=toolkit();data.hidden_credential=key;const result=composioToolkit(data);assert.deepEqual(result.authSchemes,['OAUTH2','API_KEY']);assert.equal(result.authMethods[1].connection[0].secret,true);assert(!JSON.stringify(result).includes('must-not-leak'));assert(!JSON.stringify(result).includes(key));
 const noAuth=composioToolkit({slug:'public_weather',no_auth:true,meta:{}});assert.deepEqual(noAuth.authSchemes,['NO_AUTH']);assert.equal(noAuth.noAuth,true);
});
test('catalog rejects duplicate connectors and a repeated pagination cursor',async()=>{
 const f=fixture();f.setHook(async()=>response({items:[toolkit(),toolkit()]}));await assert.rejects(f.client.catalog(),/duplicate/);
 f.setHook(async()=>response({items:[],next_cursor:'repeat'}));await assert.rejects(f.client.catalog({cursor:'repeat'}),/invalid catalog page/);
});
test('category pagination collects all categories and detects a looping server',async()=>{
 const f=fixture();f.setHook(async url=>response({items:[{id:url.searchParams.get('cursor')?'two':'one',name:'Category'}],next_cursor:url.searchParams.get('cursor')?null:'page2'}));assert.equal((await f.client.categories()).length,2);
 f.setHook(async()=>response({items:[],next_cursor:'loop'}));await assert.rejects(f.client.categories(),/invalid category page/);
});
test('connection responses never expose service tokens, state or parameter bags',()=>{
 const value={id:'ca_owned',toolkit:{slug:'github'},auth_config:{id:'ac_owned',auth_scheme:'OAUTH2'},user_id:'bound_user',status:'ACTIVE',state:{val:{access_token:key}},data:{api_key:key},params:{password:key}};
 const parsed=composioAccount(value);assert.equal(parsed.status,'ACTIVE');assert(!JSON.stringify(parsed).includes(key));assert(!Object.hasOwn(parsed,'state'));
});
test('HTTP failures discard echoed credentials and distinguish quota and permission failures',async()=>{
 for(const [status,pattern]of [[401,/project key/],[403,/permissions/],[429,/usage limit/],[402,/balance/],[404,/unavailable/]]){const f=fixture();f.setStatus(status);await assert.rejects(f.client.catalog(),error=>pattern.test(error.message)&&!error.message.includes(key));assert.equal(f.calls.length,1);}
});
test('invalid credentials, path identifiers and oversized search terms are rejected before network access',async()=>{
 const f=fixture();assert.throws(()=>new ComposioClient('key\r\nInjected: value'),/valid/);await assert.rejects(f.client.toolkit('../other'),/Invalid/);await assert.rejects(f.client.catalog({search:'x'.repeat(301)}),/valid/);await assert.rejects(f.client.tool('GITHUB_READ','latest?credential=other'),/Invalid/);assert.equal(f.calls.length,0);
});
test('connection links must use the Composio HTTPS origin and contain a valid expiry',async()=>{
 const f=fixture();for(const url of ['https://evil.example/link','http://connect.composio.dev/link','https://user:password@connect.composio.dev/link']){f.setHook(async()=>response({connected_account_id:'ca_owned',redirect_url:url,expires_at:new Date().toISOString()}));await assert.rejects(f.client.connect('bound_user','ac_owned','Account'),/invalid connection link/);}
});
test('a dropped POST has an uncertain outcome and is never automatically retried',async()=>{
 const f=fixture();f.setNetwork(true);await assert.rejects(f.client.execute('ca_owned','bound_user','GITHUB_LIST_REPOSITORIES','20261020_00',{}),error=>error instanceof ComposioUnavailableError&&/may already have completed/.test(error.message)&&!error.message.includes(key));assert.equal(f.calls.length,1);
});
test('bounded streaming stops an oversized catalog and invalid JSON has an actionable error',async()=>{
 const f=fixture();let cancelled=false;f.setHook(async()=>new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array(8*1024*1024+1));},cancel(){cancelled=true;}})));await assert.rejects(f.client.catalog(),/too large/);assert(cancelled);
 f.setHook(async()=>new Response('{invalid'));await assert.rejects(f.client.catalog(),/invalid response/);
});
test('tool discovery uses the current query format, known versions and matching toolkit identity',async()=>{
 const f=fixture(),page=await f.client.tools('github',undefined,'repos');assert.equal(f.calls[0].url.searchParams.get('query'),'repos');assert.equal(f.calls[0].url.searchParams.get('toolkit_versions'),'latest');assert.equal(page.items[0].version,'20261020_00');
 f.setHook(async()=>response({items:[tool('GMAIL_LIST_MESSAGES','gmail')]}));await assert.rejects(f.client.tools('github'),/outside this connector/);
});
test('direct execution pins account, owner, tool version and structured arguments without instant-account fallback',async()=>{
 const f=fixture(),result=await f.client.execute('ca_owned','bound_user','GITHUB_LIST_REPOSITORIES','20261020_00',{limit:5});assert.equal(result.log_id,'log_controlled');assert.deepEqual(f.calls[0].body,{connected_account_id:'ca_owned',user_id:'bound_user',version:'20261020_00',arguments:{limit:5}});assert.equal(f.calls[0].options.headers['x-api-key'],key);
});
test('tools support both documented parameter maps and JSON Schema, including actions without arguments',()=>{
 const mapped=composioTool({...tool(),input_parameters:{repo:{type:'string',required:true},count:{type:'integer',required:false}}});assert.deepEqual(mapped.inputSchema.required,['repo']);assert.equal(mapped.inputSchema.properties.repo.type,'string');assert(!Object.hasOwn(mapped.inputSchema.properties.repo,'required'));assert.equal(mapped.inputSchema.additionalProperties,false);
 assert.deepEqual(composioTool({...tool(),input_parameters:{}}).inputSchema,{type:'object',properties:{},additionalProperties:false});assert.throws(()=>composioTool({...tool(),input_parameters:{arbitrary:'untyped value'}}),/unsupported tool schema/);
});
test('instant usage is never substituted for a connected user account',async()=>{
 const f=fixture();await assert.rejects(f.client.execute('instant_account','bound_user','GITHUB_LIST_REPOSITORIES','20261020_00',{}),/intended user account/);assert.equal(f.calls.length,0);
});
test('project setup verifies the key and returns status without the project credential',async()=>{
 const f=fixture(),status=await f.configure();assert(status.configured);assert(!JSON.stringify(status).includes(key));assert.equal(f.values.get('composio-key:'+f.owner),key);assert.equal(f.values.get('composio-state:'+f.owner).connections.length,0);
});
test('account changes during setup stop the write of a project key',async()=>{
 const f=fixture();f.setHook(async()=>{f.setOwner(randomUUID());return response({items:[]});});await assert.rejects(f.configure(),/account changed/);assert.equal(f.values.size,0);
});
test('a connection is pending before browser launch and becomes available only after verified ACTIVE status',async()=>{
 const f=fixture();await f.configure();const connection=await f.service.connect(f.owner,{toolkit:'github',scheme:'OAUTH2',name:'Work GitHub'});assert.equal(connection.enabled,false);assert.equal((await f.service.status(f.owner)).connections[0].status,'INITIATED');assert.equal(f.opened.length,1);assert.equal(f.calls.find(row=>row.url.pathname.endsWith('/link')).body.user_id,f.accounts.get(connection.accountId).user_id);
 const pending=await f.service.refresh(f.owner,connection.id);assert(!pending.enabled);f.accounts.get(connection.accountId).status='ACTIVE';assert((await f.service.refresh(f.owner,connection.id)).enabled);
});
test('API-key connectors create the correct scheme and use hosted credential collection',async()=>{
 const f=fixture();await f.configure();const connection=await f.service.connect(f.owner,{toolkit:'github',scheme:'API_KEY'});assert.equal(connection.scheme,'API_KEY');const create=f.calls.find(row=>row.url.pathname.endsWith('/auth_configs')&&row.body);assert.deepEqual(create.body.auth_config,{type:'use_custom_auth',authScheme:'API_KEY',credentials:{}});assert(!JSON.stringify(await f.service.status(f.owner)).includes(key));
});
test('custom OAuth requires configured authentication rather than choosing a different method',async()=>{
 const f=fixture();await f.configure();f.setHook(async url=>url.pathname.endsWith('/toolkits/custom_oauth')?response({...toolkit('custom_oauth'),composio_managed_auth_schemes:[]}):undefined);await assert.rejects(f.service.connect(f.owner,{toolkit:'custom_oauth',scheme:'OAUTH2'}),/custom authentication configuration/);assert.equal(f.opened.length,0);
});
test('wrong authentication configuration cannot start a connection for another toolkit',async()=>{
 const f=fixture();await f.configure();f.configs.set('ac_wrong',{toolkit:{slug:'gmail'},auth_config:{id:'ac_wrong',auth_scheme:'OAUTH2'}});await assert.rejects(f.service.connect(f.owner,{toolkit:'github',scheme:'OAUTH2',authConfigId:'ac_wrong'}),/for this connector/);assert.equal(f.accounts.size,0);
});
test('a provider account from another user, toolkit or auth configuration cannot activate a local binding',async()=>{
 for(const field of ['user_id','toolkit','auth_config']){const f=fixture();await f.configure();const connection=await f.service.connect(f.owner,{toolkit:'github',scheme:'OAUTH2'}),account=f.accounts.get(connection.accountId);account.status='ACTIVE';account[field]=field==='user_id'?'another_user':field==='toolkit'?{slug:'gmail'}:{id:'another_config',auth_scheme:'OAUTH2'};await assert.rejects(f.service.refresh(f.owner,connection.id),/does not match/);assert.equal((await f.service.status(f.owner)).connections[0].enabled,false);}
});
test('cancelled sign-ins cannot reappear as active after the external browser completes',async()=>{
 const f=fixture();await f.configure();const c=await f.service.connect(f.owner,{toolkit:'github',scheme:'OAUTH2'});await f.service.cancel(f.owner,c.id);f.accounts.get(c.accountId).status='ACTIVE';const before=f.calls.length;await assert.rejects(f.service.refresh(f.owner,c.id),/Start a new connection/);assert.equal(f.calls.length,before);assert(!(await f.service.status(f.owner)).connections[0].enabled);
});
test('parallel connection requests preserve both bindings and reuse one authentication configuration',async()=>{
 const f=fixture();await f.configure();await Promise.all([f.service.connect(f.owner,{toolkit:'github',scheme:'OAUTH2',name:'Work'}),f.service.connect(f.owner,{toolkit:'github',scheme:'OAUTH2',name:'Personal'})]);assert.equal((await f.service.status(f.owner)).connections.length,2);assert.equal(f.configs.size,1);
});
test('connection assignment applies to owned active agents and changing it invalidates prepared authority',async()=>{
 const f=fixture(),c=await f.connect(),authorized=await f.service.authorized(f.owner,f.agent,c.id);await assert.rejects(f.service.assign(f.owner,c.id,[f.otherAgent]),/foreign or retired/);await f.service.assign(f.owner,c.id,[]);await assert.rejects(authorized.guard(),/assignment changed/);await assert.rejects(f.service.authorized(f.owner,f.agent,c.id),/unassigned/);
});
test('account isolation is checked before connection metadata or tool access is returned',async()=>{
 const f=fixture(),c=await f.connect();f.setOwner(randomUUID());const before=f.calls.length;await assert.rejects(f.service.status(f.owner),/account changed/);await assert.rejects(f.service.authorized(f.owner,f.agent,c.id),/account changed/);assert.equal(f.calls.length,before);
});
test('remote revocation and key replacement invalidate an existing agent operation',async()=>{
 const f=fixture(),c=await f.connect(),authority=await f.service.authorized(f.owner,f.agent,c.id);f.accounts.get(c.accountId).status='EXPIRED';await assert.rejects(f.service.authorized(f.owner,f.agent,c.id),/Reconnect/);f.accounts.get(c.accountId).status='ACTIVE';await f.service.configure(f.owner,'another-controlled-key');await assert.rejects(authority.guard(),/project changed/);assert(!(await f.service.status(f.owner)).connections[0].enabled);
});
test('disconnect disables local use before contacting Composio and keeps it disabled on an uncertain revoke',async()=>{
 const f=fixture(),c=await f.connect();f.setHook(async url=>{if(url.pathname.endsWith('/revoke')){assert(!(await f.service.status(f.owner)).connections[0].enabled);throw Error('lost connection');}});await assert.rejects(f.service.disconnect(f.owner,c.id),/may already have completed/);assert.equal((await f.service.status(f.owner)).connections[0].status,'DISCONNECTING');await assert.rejects(f.service.authorized(f.owner,f.agent,c.id),/disabled/);assert.equal(f.calls.filter(row=>row.url.pathname.endsWith('/revoke')).length,1);
});
test('catalog cache is labelled during network failure and never hides rejected credentials',async()=>{
 const f=fixture();await f.configure();const original=await f.service.catalog(f.owner,{search:'repo'});original.items[0].name='mutated by caller';f.setNetwork(true);const cached=await f.service.catalog(f.owner,{search:'repo'});assert.equal(cached.cached,true);assert.equal(cached.items[0].name,'GitHub');assert.equal(cached.fetchedAt,original.fetchedAt);await assert.rejects(f.service.catalog(f.owner,{search:'different'}),/could not be reached/);f.setNetwork(false);f.setStatus(401);await assert.rejects(f.service.catalog(f.owner,{search:'repo'}),/project key/);
});
test('project removal clears the credential and immediately blocks agent use without deleting remote accounts',async()=>{
 const f=fixture(),c=await f.connect();await f.service.removeProject(f.owner);assert.equal((await f.service.status(f.owner)).configured,false);assert.equal(f.accounts.get(c.accountId).status,'ACTIVE');assert.equal((await f.service.status(f.owner)).connections[0].enabled,false);await assert.rejects(f.service.authorized(f.owner,f.agent,c.id),/Connect a Composio project/);
});
test('no-auth connectors are verified and enabled without opening a sign-in browser',async()=>{
 const f=fixture();await f.configure();f.setHook(async url=>url.pathname.endsWith('/toolkits/public_weather')?response({slug:'public_weather',name:'Public weather',no_auth:true,auth_schemes:['NO_AUTH'],meta:{}}):undefined);const connection=await f.service.connect(f.owner,{toolkit:'public_weather',scheme:'NO_AUTH'});assert(connection.enabled);assert.equal(connection.status,'ACTIVE');assert.equal(f.opened.length,0);assert.equal(f.calls.find(call=>call.url.pathname==='/api/v3.1/connected_accounts'&&call.body).body.connection.state.authScheme,'NO_AUTH');
});
test('reconnection retains the connection identity and restricted agent grants',async()=>{
 const f=fixture(),old=await f.connect();await f.service.assign(f.owner,old.id,[f.agent]);f.accounts.get(old.accountId).status='EXPIRED';await f.service.refresh(f.owner,old.id);const connection=await f.service.connect(f.owner,{toolkit:'github',scheme:'OAUTH2',name:'Work restored',reconnectId:old.id});assert.equal(connection.id,old.id);assert.notEqual(connection.accountId,old.accountId);assert.deepEqual(connection.agents,[f.agent]);assert.equal((await f.service.status(f.owner)).connections.length,1);assert(!connection.enabled);
});
test('agent-scoped OAuth connections persist one agent before opening sign-in and keep that scope on activation',async()=>{
 const f=fixture();await f.configure();const connection=await f.service.connect(f.owner,{toolkit:'github',scheme:'OAUTH2',agentId:f.agent});assert.deepEqual(connection.agents,[f.agent]);assert.deepEqual((await f.service.status(f.owner)).connections[0].agents,[f.agent]);assert.equal(f.opened.length,1);f.setAgentAvailable(f.otherAgent,true);f.accounts.get(connection.accountId).status='ACTIVE';await f.service.refresh(f.owner,connection.id);assert((await f.service.sources(f.owner,f.agent)).find(row=>row.id==='mcp:'+connection.id).enabled);assert(!(await f.service.sources(f.owner,f.otherAgent)).find(row=>row.id==='mcp:'+connection.id).enabled);await assert.rejects(f.service.authorized(f.owner,f.otherAgent,connection.id),/unassigned/);
});
test('agent-scoped no-auth connectors never become available to another owned agent',async()=>{
 const f=fixture();await f.configure();f.setAgentAvailable(f.otherAgent,true);f.setHook(async url=>url.pathname.endsWith('/toolkits/public_weather')?response({slug:'public_weather',name:'Public weather',no_auth:true,auth_schemes:['NO_AUTH'],meta:{}}):undefined);const connection=await f.service.connect(f.owner,{toolkit:'public_weather',scheme:'NO_AUTH',agentId:f.agent});assert(connection.enabled);assert.deepEqual(connection.agents,[f.agent]);await assert.rejects(f.service.authorized(f.owner,f.otherAgent,connection.id),/unassigned/);
});
test('agent-scoped API-key connectors keep hosted credential collection and one-agent grants',async()=>{
 const f=fixture();await f.configure();const connection=await f.service.connect(f.owner,{toolkit:'github',scheme:'API_KEY',agentId:f.agent});assert.deepEqual(connection.agents,[f.agent]);assert.equal(connection.scheme,'API_KEY');assert.equal(connection.enabled,false);assert.equal(f.opened.length,1);assert(f.opened[0].startsWith('https://connect.composio.dev/'));assert(!JSON.stringify(await f.service.status(f.owner)).includes(key));assert.equal(f.calls.filter(call=>call.url.pathname.endsWith('/link')).length,1);
});
test('foreign or retired agent selection is rejected before a Composio request',async()=>{
 const f=fixture();await f.configure();const before=f.calls.length;await assert.rejects(f.service.connect(f.owner,{toolkit:'github',scheme:'OAUTH2',agentId:f.otherAgent}),/foreign or retired/);assert.equal(f.calls.length,before);assert.equal(f.opened.length,0);assert.equal(f.accounts.size,0);
});
test('retiring an agent during configuration refuses the external account creation',async()=>{
 const f=fixture();await f.configure();f.setHook(async url=>{if(url.pathname.startsWith('/api/v3.1/auth_configs/'))f.setAgentAvailable(f.agent,false);});await assert.rejects(f.service.connect(f.owner,{toolkit:'github',scheme:'OAUTH2',agentId:f.agent}),/foreign or retired/);assert.equal(f.accounts.size,0);assert.equal(f.opened.length,0);
});
test('parallel per-agent grants preserve other agents and revocation invalidates prepared authority',async()=>{
 const f=fixture(),connection=await f.connect();f.setAgentAvailable(f.otherAgent,true);await f.service.assign(f.owner,connection.id,[]);await Promise.all([f.service.assignAgent(f.owner,connection.id,f.agent,true),f.service.assignAgent(f.owner,connection.id,f.otherAgent,true)]);assert.deepEqual(new Set((await f.service.status(f.owner)).connections[0].agents),new Set([f.agent,f.otherAgent]));const authority=await f.service.authorized(f.owner,f.agent,connection.id);await f.service.assignAgent(f.owner,connection.id,f.agent,false);await assert.rejects(authority.guard(),/assignment changed/);assert.deepEqual((await f.service.status(f.owner)).connections[0].agents,[f.otherAgent]);await f.service.authorized(f.owner,f.otherAgent,connection.id);await assert.rejects(f.service.assignAgent(f.owner,connection.id,f.agent,'true'),/Choose whether/);
});
test('agent view cannot silently narrow a connection shared with all current and future agents',async()=>{
 const f=fixture(),connection=await f.connect();await f.service.assignAgent(f.owner,connection.id,f.agent,true);await assert.rejects(f.service.assignAgent(f.owner,connection.id,f.agent,false),/shared access in Plugins/);assert.equal((await f.service.status(f.owner)).connections[0].agents,null);
});
test('revoking one agent preserves an unaffected peer prepared Composio authority',async()=>{
 const f=fixture(),connection=await f.connect();f.setAgentAvailable(f.otherAgent,true);await f.service.assign(f.owner,connection.id,[f.agent,f.otherAgent]);const revoked=await f.service.authorized(f.owner,f.agent,connection.id),peer=await f.service.authorized(f.owner,f.otherAgent,connection.id);await f.service.assignAgent(f.owner,connection.id,f.agent,false);await assert.rejects(revoked.guard(),/assignment changed/);await peer.guard();assert.equal((await f.service.authorized(f.owner,f.otherAgent,connection.id)).signature,peer.signature);
});
test('connection changes invalidate their assigned workers while project changes invalidate the account',()=>{
 const a=randomUUID(),b=randomUUID(),id=randomUUID(),connection={id,name:'Scoped',toolkit:'github',scheme:'OAUTH2',authConfigId:'ac_test',accountId:'ca_test',status:'INITIATED',enabled:false,agents:[a]},before={configured:true,connections:[connection]},after={configured:true,connections:[{...connection,status:'ACTIVE',enabled:true}]};assert.deepEqual(composioInvalidatedAgents('composio.refresh',before,after),[a]);assert.deepEqual(composioInvalidatedAgents('composio.connect',{configured:true,connections:[]},after),[a]);assert.deepEqual(composioInvalidatedAgents('composio.agent.assign',before,after,b),[b]);assert.equal(composioInvalidatedAgents('composio.configure',before,after),null);assert.equal(composioInvalidatedAgents('composio.refresh',{...before,connections:[{...connection,agents:null}]},after),null);assert.deepEqual(composioInvalidatedAgents('composio.status',before,before),[]);
});
test('agent-scoped reconnect retains existing peer grants and refuses an unassigned agent',async()=>{
 const f=fixture(),connection=await f.connect();f.setAgentAvailable(f.otherAgent,true);await f.service.assign(f.owner,connection.id,[f.agent,f.otherAgent]);f.accounts.get(connection.accountId).status='EXPIRED';await f.service.refresh(f.owner,connection.id);const next=await f.service.connect(f.owner,{toolkit:'github',scheme:'OAUTH2',agentId:f.agent,reconnectId:connection.id});assert.deepEqual(next.agents,[f.agent,f.otherAgent]);await f.service.assign(f.owner,next.id,[f.otherAgent]);const before=f.accounts.size;await assert.rejects(f.service.connect(f.owner,{toolkit:'github',scheme:'OAUTH2',agentId:f.agent,reconnectId:next.id}),/already assigned/);assert.equal(f.accounts.size,before);
});
