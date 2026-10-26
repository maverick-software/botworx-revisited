const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{randomUUID}=require('node:crypto');
const Module=require('node:module'),original=Module._load;Module._load=function(name,...args){if(name==='electron')return {dialog:{},shell:{},nativeImage:{},safeStorage:{}};return original.call(this,name,...args);};let Broker,CodexHarness,ToolService;try{({Broker}=require(path.join(process.env.AGENTOPIA_PREVIEW_BUILD,'broker.js')));({CodexHarness}=require(path.join(process.env.AGENTOPIA_PREVIEW_BUILD,'codex-harness.js')));({ToolService}=require(path.join(process.env.AGENTOPIA_PREVIEW_BUILD,'tool-service.js')));}finally{Module._load=original;}
const {LocalRuntimeConnection}=require(path.join(process.env.AGENTOPIA_PREVIEW_BUILD,'local-runtime-connection.js'));
const {McpOAuth}=require(path.join(process.env.AGENTOPIA_PREVIEW_BUILD,'mcp-oauth.js')),{mcpOAuthScopeKey}=require(path.join(process.env.AGENTOPIA_PREVIEW_BUILD,'mcp-oauth-scope.js'));
function brokerFixture(){const owner=randomUUID(),broker=Object.create(Broker.prototype);Object.assign(broker,{currentOwner:owner,signedOut:false,closing:false,backingUp:false,active:new Map(),startingChats:new Map(),goals:new Map(),runningGoals:new Map(),pausedGoals:new Set(),agentMutations:new Map(),nativeControls:0,native:{busy:false},terminal:{busy:false},previews:{busy:false},previewRunner:{native:{busy:false}},assignments:{queue:{size:0}},scheduledControls:0,scheduled:{scheduler:{busy:false}},scheduledQueue:{busy:false},chatQueue:{list:()=>[]},emitOwned:()=>{},identity:()=>assert.fail('Offline stop must not read database identity')});Object.defineProperty(broker,'goalQueue',{value:{cancel:()=>{}}});return {owner,broker};}

test('active offline work blocks service recovery until its cached owner stops it',async()=>{
 const {owner,broker}=brokerFixture(),requestId=randomUUID(),controller=new AbortController();let complete,healthy=false,reconnections=0;
 const done=new Promise(resolve=>complete=resolve);broker.active.set(requestId,{userId:owner,controller,done});controller.signal.addEventListener('abort',()=>{broker.active.delete(requestId);complete();});
 const connection=new LocalRuntimeConnection({health:async()=>healthy,recover:()=>broker.recoverLocalRuntime(async()=>{reconnections++;healthy=true;}),publish:()=>{}});
 assert.equal(await connection.check(true),false);assert.equal(reconnections,0);
 assert.deepEqual(await broker.offlineControl('chat.cancel',{requestId}),{handled:true});assert(controller.signal.aborted);
 assert.equal(await connection.check(true,true),true);assert.equal(reconnections,1);assert.equal(broker.backingUp,false);
});
test('offline stop rejects switched accounts, signed-out sessions and forged request identities',async()=>{
 const {owner,broker}=brokerFixture(),requestId=randomUUID(),controller=new AbortController();broker.active.set(requestId,{userId:owner,controller,done:Promise.resolve()});
 await assert.rejects(broker.offlineControl('chat.cancel',{requestId:randomUUID()}),/no longer running/);
 broker.currentOwner=randomUUID();await assert.rejects(broker.offlineControl('chat.cancel',{requestId}),/no longer running/);
 broker.currentOwner=owner;broker.signedOut=true;await assert.rejects(broker.offlineControl('chat.cancel',{requestId}),/Sign in/);assert(!controller.signal.aborted);
 assert.deepEqual(await broker.offlineControl('chat.send',{}),{handled:false});
});
test('offline goal pause stops only its cached owned work and labels unconfirmed saved status',async()=>{
 const {owner,broker}=brokerFixture(),id=randomUUID(),owned=new AbortController(),other=new AbortController();broker.runningGoals.set(id,{owner,goal:{id,status:'running',objective:'Retained goal'}});broker.active.set(randomUUID(),{userId:owner,goalId:id,controller:owned});broker.active.set(randomUUID(),{userId:owner,goalId:randomUUID(),controller:other});
 const result=await broker.offlineControl('goals.pause',{id});assert.equal(result.value.status,'paused');assert.match(result.value.note,/Reconnect and inspect its saved status/);assert(broker.pausedGoals.has(id));assert(owned.signal.aborted);assert(!other.signal.aborted);
});
test('passive queued work remains retained while recovery fences new admissions',async()=>{
 const {broker}=brokerFixture();broker.assignments.queue={size:3,busy:false};broker.chatQueue={busy:false,list:()=>[{status:'queued'},{status:'held'}]};let resumed=0;
 await broker.recoverLocalRuntime(async()=>{assert(broker.backingUp,'Existing queue admission uses this fence');resumed++;});assert.equal(resumed,1);assert.equal(broker.assignments.queue.size,3);assert.equal(broker.chatQueue.list().length,2);
 broker.assignments.queue.busy=true;await assert.rejects(broker.recoverLocalRuntime(async()=>assert.fail('Active queued dispatch must finish')),/active work/);
 broker.assignments.queue.busy=false;broker.chatQueue.busy=true;await assert.rejects(broker.recoverLocalRuntime(async()=>assert.fail('Active chat dispatch must finish')),/active work/);
});
test('offline tool reviews can only deny the exact owned pending review',async()=>{
 const service=Object.create(ToolService.prototype),owner=randomUUID(),id=randomUUID(),decisions=[];service.approvals=new Map([[id,{user:owner,resolve:value=>decisions.push(value)}]]);
 assert.throws(()=>service.denyLocal(randomUUID(),id),/your account/);assert.equal(service.approvals.size,1);service.denyLocal(owner,id);assert.deepEqual(decisions,[false]);assert.equal(service.approvals.size,0);assert.throws(()=>service.denyLocal(owner,id),/no longer waiting/);
 const {broker}=brokerFixture();broker.tools=service;await assert.rejects(broker.offlineControl('tools.decide',{id,approved:true}),/Only Deny/);
});
test('offline OAuth cancellation aborts only an existing exact owned pending scope',async()=>{
 const owner=randomUUID(),scope={owner,agent:randomUUID(),connection:randomUUID()},controller=new AbortController(),oauth=Object.create(McpOAuth.prototype);oauth.pendingScopes=new Map([[mcpOAuthScopeKey(scope),scope]]);oauth.pending=new Map([[mcpOAuthScopeKey(scope),controller]]);
 assert.throws(()=>oauth.cancelPending({...scope,owner:randomUUID()}),/no longer pending/);assert.throws(()=>oauth.cancelPending({...scope,connection:randomUUID()}),/no longer pending/);assert(!controller.signal.aborted);oauth.cancelPending(scope);assert(controller.signal.aborted);
 const f=brokerFixture(),calls=[];f.broker.mcpOAuth={cancelPending:scope=>calls.push(scope)};await f.broker.offlineControl('composio.mcp.cancel',{});assert.deepEqual(calls,[{owner:f.owner,accountConnector:'composio'}]);await assert.rejects(f.broker.offlineControl('composio.mcp.cancel',{owner:randomUUID()}),/another account/);assert.equal(calls.length,1);
});
function nativeFixture(){const owner=randomUUID(),requestId=randomUUID(),threadId=randomUUID(),h=Object.create(CodexHarness.prototype),calls=[],worker={owner,children:new Map(),client:{request:async(method,args)=>{calls.push([method,args]);if(method.endsWith('/list'))return {data:[],nextCursor:null};return {terminated:true};}}},record={owner,worker,request:{id:requestId},state:{threadId,turnId:randomUUID(),approvals:[],items:[]},waiting:new Map(),controller:new AbortController(),ended:false};Object.assign(h,{contexts:new Map([[requestId,record]]),running:new Map(),emit:()=>{},guard:()=>assert.fail('Offline deny/stop must not read account'),persist:()=>assert.fail('Offline controls must not dispatch a database action')});return {owner,requestId,threadId,h,record,worker,calls};}
test('offline native denial consumes only a matching cached approval and cannot accept or answer questions',()=>{
 const f=nativeFixture(),id=randomUUID(),decisions=[];f.record.state.approvals.push({id,kind:'command',status:'pending'});f.record.waiting.set(id,{resolve:value=>decisions.push(value)});
 assert.throws(()=>f.h.declineLocally(f.owner,f.requestId,id,'accept'),/Only Deny/);assert.throws(()=>f.h.declineLocally(randomUUID(),f.requestId,id,'decline'),/your account/);assert.throws(()=>f.h.declineLocally(f.owner,randomUUID(),id,'decline'),/your account/);
 f.h.declineLocally(f.owner,f.requestId,id,'decline');assert.deepEqual(decisions,[{decision:'decline'}]);assert.equal(f.record.waiting.size,0);assert.equal(f.record.state.approvals[0].status,'answered');assert.throws(()=>f.h.declineLocally(f.owner,f.requestId,id,'decline'),/no longer waiting/);
 const input=randomUUID();f.record.state.approvals.push({id:input,kind:'input',status:'pending'});f.record.waiting.set(input,{resolve:()=>assert.fail('Question must not be answered')});assert.throws(()=>f.h.declineLocally(f.owner,f.requestId,input,'cancel'),/no longer waiting/);
});
test('offline child stop validates the exact parent, thread and turn and leaves report delivery held',async()=>{
 const f=nativeFixture(),thread=randomUUID(),turn=randomUUID(),controller=new AbortController(),view={threadId:thread,turnId:turn,status:'running',delivery:'waiting',state:{threadId:thread,turnId:turn,approvals:[],items:[]}},child={root:f.record,controller,view,turnRunning:true};f.worker.children.set(thread,child);
 await assert.rejects(f.h.cancelChildLocally(f.owner,f.requestId,thread,randomUUID()),/at this turn/);assert(!controller.signal.aborted);assert.deepEqual(f.calls,[]);
 await f.h.cancelChildLocally(f.owner,f.requestId,thread,turn);assert(controller.signal.aborted);assert.equal(view.status,'cancelled');assert.equal(view.delivery,'failed');assert.deepEqual(f.calls.map(c=>c[0]),['turn/interrupt','thread/backgroundTerminals/clean','thread/backgroundTerminals/list']);
});
test('offline background stop requires its live registry identity and never terminates a substituted process',async()=>{
 const f=nativeFixture(),entry={threadId:f.threadId,turnId:f.record.state.turnId,item:{id:'item',type:'commandExecution',processId:'native-process',status:'inProgress'}};f.record.state.items.push(entry);
 await assert.rejects(f.h.stopBackgroundLocally(f.owner,f.requestId,f.threadId,'item','other-process'),/unavailable/);assert.deepEqual(f.calls,[]);
 f.worker.client.request=async(method,args)=>{f.calls.push([method,args]);return method.endsWith('/list')?{data:[{itemId:'item',processId:'native-process'}]}:{terminated:true};};
 assert.deepEqual(await f.h.stopBackgroundLocally(f.owner,f.requestId,f.threadId,'item','native-process'),{terminated:true});assert.equal(entry.background,'stopped');assert.deepEqual(f.calls.map(c=>c[0]),['thread/backgroundTerminals/list','thread/backgroundTerminals/terminate']);
});
