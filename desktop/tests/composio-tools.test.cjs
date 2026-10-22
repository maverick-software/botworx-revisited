const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{randomUUID}=require('node:crypto');
const build=process.env.AGENTOPIA_COMPOSIO_TEST_BUILD;
const {fixture,tool,response,key}=require('./fixtures/composio.cjs');
const {RemoteTools}=require(path.join(build,'remote-tools.js')),{ToolService}=require(path.join(build,'tool-service.js')),{defaultChatOptions}=require(path.join(build,'contracts.js')),{providerHistory}=require(path.join(build,'composer.js'));

function database(f,conversation){
 const tables={agents:[{id:f.agent,user_id:f.owner,active:true,metadata:{}}],conversation_sessions:[{conversation_id:conversation,user_id:f.owner,agent_id:f.agent}],desktop_tool_calls:[]};
 return {tables,from(name){let filters=[],insert,update,done=false;const records=()=>tables[name]??[];const value=(row,key)=>key.includes('->>')?row[key.split('->>')[0]]?.[key.split('->>')[1]]:row[key];const finish=()=>{if(insert&&!done){(tables[name]??=[]).push(structuredClone(insert));done=true;}const rows=records().filter(row=>filters.every(match=>match(row)));if(update&&!done){rows.forEach(row=>Object.assign(row,structuredClone(update)));done=true;}return rows;};const q={select(){return q;},eq(k,v){filters.push(row=>value(row,k)===v);return q;},is(k,v){filters.push(row=>v===null?value(row,k)==null:value(row,k)===v);return q;},order(){return q;},range(){return q;},in(k,v){filters.push(row=>v.includes(value(row,k)));return q;},limit(){return q;},insert(v){insert=v;return q;},update(v){update=v;return q;},single:async()=>({data:finish()[0]??null}),maybeSingle:async()=>({data:finish()[0]??null}),then(resolve,reject){return Promise.resolve({data:finish()}).then(resolve,reject);}};return q;}};
}
async function setup(permission='ask',mode='chat'){
 const f=fixture(),connection=await f.connect(),conversation=randomUUID(),db=database(f,conversation),events=[],user={id:f.owner,admin:true};
 const remote=new RemoteTools(db);remote.composio=f.service;remote.plugins={ensure:async()=>{},search:async()=>({name:'serper-search',adapter:'serper',enabled:false}),managedChrome:async()=>{throw Error('Not assigned');}};
 const terminal={definitions:()=>[],authorize:()=>{}},service=new ToolService(db,{},(owner,event)=>events.push(structuredClone(event)),async()=>user,remote,undefined,terminal),options={...defaultChatOptions,permission,mode,files:[]},plan=await remote.plan(f.owner,f.agent,options),request={id:randomUUID(),conversation_id:conversation,assistant_message_id:randomUUID(),agent_id:f.agent},args={connection_id:connection.id,tool_name:'GITHUB_LIST_REPOSITORIES',arguments_json:JSON.stringify({limit:5})};
 const call={id:randomUUID(),name:'mcp_call',namespace:'tools',arguments:JSON.stringify(args)};
 return {...f,connections:f.service,connection,db,events,remote,service,options,plan,request,call,args,user,execute:signal=>service.execute(user,request,call,options,signal??new AbortController().signal,plan,f.agent),actions:()=>f.calls.filter(row=>row.options.method==='POST'&&row.url.pathname.includes('/tools/execute/'))};
}
async function review(f){const until=Date.now()+5000;while(Date.now()<until){const found=f.events.find(event=>event.tool?.status==='awaiting_approval');if(found)return found.tool;await new Promise(resolve=>setImmediate(resolve));}throw Error('No actual ToolService approval was published');}

test('connected Composio accounts appear in agent sources, chat selection and discovered schemas',async()=>{
 const f=await setup();const source=f.plan.sources.find(row=>row.id==='mcp:'+f.connection.id);assert.equal(source.plugin,'composio');assert(source.ready&&source.enabled);assert(f.plan.definitions.every(def=>def.hostPlugins?.includes('composio')));const result=await f.remote.discover(f.owner,f.agent,{query:'repo',connection_id:f.connection.id,cursor:0},f.plan,new AbortController().signal);assert.equal(result.tools[0].name,'GITHUB_LIST_REPOSITORIES');assert.equal(result.tools[0].connectionId,f.connection.id);assert.equal(result.tools[0].inputSchema.properties.limit.maximum,100);assert.equal(f.actions().length,0);
 const none=await f.remote.plan(f.owner,f.agent,{...f.options,tools:[]});assert.equal(none.definitions.length,0);assert.equal(none.sources.length,0);
});
test('Default permissions wait for the real inline review before the Composio action is sent',async()=>{
 const f=await setup(),pending=f.execute(),row=await review(f);assert.equal(f.actions().length,0);assert.equal(row.approval.source,'GitHub · Composio');assert.deepEqual(row.approval.arguments,{limit:5});await f.service.decide(f.owner,row.id,true);const result=await pending;assert.equal(f.actions().length,1);assert.equal(result.structuredContent.items[0],'saved-result');assert.equal(f.db.tables.desktop_tool_calls[0].status,'completed');
});
test('Full access runs autonomously, saves its result, and refuses replay of a completed provider operation',async()=>{
 const f=await setup('full'),result=await f.execute();assert.match(f.plan.definitions.find(def=>def.name==='mcp_call').description,/Full access runs.*automatically/);assert.equal(result.structuredContent.items[0],'saved-result');assert.equal(f.actions().length,1);assert(!f.events.some(event=>event.tool?.status==='awaiting_approval'));const duplicate=await f.execute();assert(duplicate.duplicate);assert.equal(f.actions().length,1);assert.equal(f.db.tables.desktop_tool_calls.length,1);
});
test('Composio search retains task matches returned by its catalog without applying a second literal phrase filter',async()=>{
 const f=await setup(),query='Find the projects I have access to';const result=await f.remote.discover(f.owner,f.agent,{query,connection_id:f.connection.id,cursor:0},f.plan,new AbortController().signal);assert.equal(result.tools[0].name,'GITHUB_LIST_REPOSITORIES');assert(f.calls.some(call=>call.url.pathname==='/api/v3.1/tools'&&call.url.searchParams.get('query')===query));assert.equal(f.actions().length,0);
});
test('Chat only, selected-file access and Plan mode withhold Composio operations',async()=>{
 for(const [permission,mode]of [['chat','chat'],['files','chat'],['ask','plan'],['full','plan']]){const f=await setup(permission,mode);assert(!f.plan.definitions.some(def=>def.name==='mcp_call'));const result=await f.execute();assert.match(result.error,/not enabled/);assert.equal(f.actions().length,0);}
});
test('denial and cancellation leave the external action unexecuted and preserve their activity state',async()=>{
 const f=await setup(),pending=f.execute(),row=await review(f);await f.service.decide(f.owner,row.id,false);assert((await pending).denied);assert.equal(f.actions().length,0);const again={...f.call,id:randomUUID()};const result=await f.service.execute(f.user,f.request,again,f.options,new AbortController().signal,f.plan,f.agent);assert(result.denied);assert.equal(f.actions().length,0);
 const cancelled=await setup(),controller=new AbortController(),stopped=cancelled.execute(controller.signal);stopped.catch(()=>{});await review(cancelled);controller.abort(new DOMException('Stopped','AbortError'));await assert.rejects(stopped,/Stopped|cancel/i);assert.equal(cancelled.actions().length,0);assert.equal(cancelled.db.tables.desktop_tool_calls[0].status,'interrupted');
});
test('assignment revocation during an inline review blocks execution after approval',async()=>{
 const f=await setup(),pending=f.execute(),row=await review(f);await f.connections.assign(f.owner,f.connection.id,[]);await f.service.decide(f.owner,row.id,true);const result=await pending;assert(result.error);assert.equal(f.actions().length,0);assert.equal(f.db.tables.desktop_tool_calls[0].status,'failed');
});
test('schema changes and invalid arguments cannot cross the reviewed execution boundary',async()=>{
 const f=await setup(),pending=f.execute(),row=await review(f);f.setHook(async url=>url.pathname.endsWith('/tools/GITHUB_LIST_REPOSITORIES')?response({...tool(),input_parameters:{type:'object',properties:{repository:{type:'string'}},required:['repository'],additionalProperties:false}}):undefined);await f.service.decide(f.owner,row.id,true);assert((await pending).error);assert.equal(f.actions().length,0);
 const invalid=await setup('full');invalid.call.arguments=JSON.stringify({...invalid.args,arguments_json:JSON.stringify({limit:1000})});assert((await invalid.execute()).error);assert.equal(invalid.actions().length,0);
});
test('named-agent tool restrictions are applied before a Composio action can run',async()=>{
 const f=await setup('full');f.request.agent_instance_id=randomUUID();f.service.agents.context=async()=>({profile:{policy:{tools:[],memory:false,delegation:false}}});const result=await f.execute();assert.match(result.error,/agent policy/);assert.equal(f.actions().length,0);assert.equal(f.db.tables.desktop_tool_calls.length,0);
});
test('Composio results are credential-filtered and can be retained in both provider histories',async()=>{
 const f=await setup('full');f.setHook(async url=>url.pathname.includes('/tools/execute/')?response({successful:true,data:{items:['saved-result',key],api_key:key},log_id:'log_owned'}):undefined);const result=await f.execute();assert(!JSON.stringify(result).includes(key));assert.equal(result.structuredContent.api_key,'[Protected credential]');const rows=[{role:'assistant',content:{text:'Connected tool finished.'},metadata:{tools:f.db.tables.desktop_tool_calls}}];for(const provider of ['openai-oauth','openrouter']){const history=JSON.stringify(providerHistory(rows,provider,true));assert(history.includes('saved-result'));assert(!history.includes(key));}
});
test('the actual broker dispatcher binds Composio calls to its authenticated owner and blocks changes during backup',async()=>{
 const {Broker}=require(path.join(build,'broker.js')),f=fixture();await f.configure();const receiver=Object.assign(Object.create(Broker.prototype),{workspaceMonitor:{generation:0},identity:async()=>({id:f.owner,admin:true}),composio:f.service,nativeControls:0,native:{pluginsChanged:async()=>{}},backingUp:false});
 const status=await receiver.call('composio.status',{owner:randomUUID()});assert(status.configured);assert.equal(status.connections.length,0);receiver.backingUp=true;const before=f.calls.length;await assert.rejects(receiver.call('composio.configure',{key:'another-controlled-key'}),/backup/);assert.equal(f.calls.length,before);assert.equal(receiver.nativeControls,0);
});
test('an uncertain disconnect still invalidates active native plugin workers through the broker finally path',async()=>{
 const {Broker}=require(path.join(build,'broker.js')),f=fixture(),c=await f.connect(),invalidations=[];const receiver=Object.assign(Object.create(Broker.prototype),{workspaceMonitor:{generation:0},identity:async()=>({id:f.owner,admin:true}),composio:f.service,nativeControls:0,native:{pluginsChanged:async(...args)=>invalidations.push(args)},backingUp:false});
 f.setHook(async url=>{if(url.pathname.endsWith('/revoke'))throw Error('Controlled disconnect before confirmation');});await assert.rejects(receiver.call('composio.disconnect',{id:c.id}),/may already have completed/);assert.deepEqual(invalidations,[[f.owner,'composio']]);assert.equal(receiver.nativeControls,0);assert.equal((await f.service.status(f.owner)).connections[0].enabled,false);
});
