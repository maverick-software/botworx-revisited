const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{randomUUID}=require('node:crypto');
const build=process.env.AGENTOPIA_DELIVERY_BUILD,{Broker}=require(path.join(build,'broker.js')),{CodexHarness}=require(path.join(build,'codex-harness.js')),{defaultAgentPolicy}=require(path.join(build,'agent-contracts.js')),{chatDeliveryText}=require(path.join(build,'chat-origin.js'));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
 const user={id:randomUUID(),admin:true},chat=randomUUID(),agent=randomUUID(),shared=randomUUID(),privateFile=randomUUID(),project={id:randomUUID(),name:'Receiver',revision:1,instructions:'Project instructions',file_ids:[shared,privateFile],reference_id:null,memory_enabled:false},options={provider:'openai-oauth',model:'fixture-model',thinking:'default',permission:'ask',mode:'chat',files:[shared]};
 const parent={instance_id:randomUUID(),agent_id:randomUUID(),revision:1,project_id:null};
 const row={id:randomUUID(),user_id:user.id,source_request:randomUUID(),source_chat:randomUUID(),target_chat:chat,source_thread:null,status:'queued',delivery:'queue',text:'@someone-else Review this task.',authorized_once:true,grant_id:null,target_request:null,dispatch_started_at:null,created_at:new Date().toISOString(),snapshot:{source_chat:randomUUID(),source_message:randomUUID(),source_agent:parent.agent_id,source_name:'Researcher',source_revision:1,target_chat:chat,target_agent:agent,target_title:'Receiver chat',target_name:'Builder',target_revision:1,source_project:null,target_project:project,source_options:options,target_options:{...options,permission:'full',files:[shared,privateFile]},source_policy:defaultAgentPolicy,target_policy:defaultAgentPolicy,policy_ceiling:defaultAgentPolicy,authority_chain:[parent],depth:1}};
 row.source_chat=row.snapshot.source_chat;
 const profile={agent_id:agent,user_id:user.id,handle:'builder',role:'Build websites',sops:'',guardrails:'',skills:[],policy:defaultAgentPolicy,revision:1,memory_revision:0,definition:{name:'Builder',active:true}},request={id:row.id,conversation_id:chat,user_message_id:randomUUID(),assistant_message_id:randomUUID(),agent_instance_id:randomUUID(),project:{...project,file_ids:[shared]},chat_delivery:{id:row.id}};
 const events=[],executions=[],calls=[],contextFiles=[],tokens=[];let release,identity=user,contextHook,claimHook;const work=new Promise(resolve=>release=resolve),broker=Object.create(Broker.prototype);
 const db={from(table){const q={select(){return q},eq(){return q},maybeSingle:async()=>({data:table==='desktop_project_chats'?{project_id:project.id}:null}),single:async()=>({data:table==='agents'?{id:agent,system_instructions:'Base instructions',agent_llm_preferences:[{provider:'openrouter',model:'other-model'}]}:table==='conversation_sessions'?{id:chat}:table==='desktop_projects'?project:{status:'completed'}})};return q;},rpc:async(name,args)=>{calls.push({name,args});return {data:null};}};
 const deliveries={read:async()=>structuredClone(row),maybeRead:async()=>structuredClone(row),claim:async()=>{assert(broker.startingChats.has(row.id),'Reserve the conversation before claiming');if(claimHook)await claimHook();row.status='dispatching';row.dispatch_started_at='now';calls.push({name:'claim'});return {...structuredClone(row),claimed:true};},begin:async(owner,record,files,plan)=>{assert.equal(owner,user.id);calls.push({name:'begin',record,files,plan});row.target_request=request.id;return structuredClone(request);},finish:async(owner,id,status,target,receipt)=>{assert.equal(owner,user.id);assert.equal(id,row.id);row.status=status;row.target_request=target;calls.push({name:'finish',status,receipt});return structuredClone(row);},hold:async(owner,id,error)=>{row.status='held';calls.push({name:'hold',error});}};
 Object.assign(broker,{admin:db,currentOwner:user.id,signedOut:false,closing:false,backingUp:false,scopeChanging:false,agentMutations:new Set(),active:new Map(),startingChats:new Map(),cancelledQueued:new Set(),goals:new Map(),startingGoals:new Set(),goalScopes:new Map(),tools:{deliveries,agents:{profile:async()=>structuredClone(profile),context:async()=>({profile:structuredClone(profile),instance:{authority_chain:[{...parent,delivery_id:row.id}]}})},planning:{get:async()=>null}},providers:{token:async(provider)=>{tokens.push(provider);return 'unused-fixture-token';}},terminal:{authorize:()=>{},permissions:()=>({full:true})},files:{list:()=>[shared,privateFile].map(id=>({id,path:'D:/fixtures/'+id,kind:'file'})),context:async(owner,files)=>{contextFiles.push(files);if(contextHook)await contextHook();return [];}},native:{childScope:()=>false},identity:async()=>identity,catalog:async()=>[{id:'fixture-model',supportsTools:true}],loadMessages:async()=>[],executeNative:async(...args)=>{calls.push({name:'execute'});executions.push(args);await work;},executeChat:()=>assert.fail('Delivery must use the actual Codex path'),assignments:{queue:{notify:()=>{}}},chatQueue:{pump:()=>{},hold:async()=>{}},emit:event=>events.push(event)});
 // These handoffs have no scheduled ancestor; the real service returns an
 // empty scope set after checking their ownership and ancestry.
 broker.scheduled={store:{validate:async(owner,id)=>{assert.equal(owner,user.id);assert.equal(id,request.id);calls.push({name:'validateSchedule'});return [];}}};
 return {broker,user,row,request,project,options,profile,agent,shared,privateFile,calls,events,executions,contextFiles,tokens,release,identity:value=>identity=value,contextHook:value=>contextHook=value,claimHook:value=>claimHook=value,
  cached:()=>({id:row.id,deliveryId:row.id,conversationId:chat,agentId:randomUUID(),text:'Injected cached text',options:{...options,provider:'openrouter',permission:'full',files:[privateFile]},createdAt:'now',status:'starting'})};
}
test('the broker reloads authority, reserves first, retains the recipient model and starts Codex only after its handoff is saved',async()=>{
 const f=fixture();await f.broker.launchQueuedChat(f.user.id,f.cached());assert.equal(f.executions.length,1);const [user,request,agent,pref,selected,token,controller,options]=f.executions[0];assert.equal(selected,'openai-oauth');assert.deepEqual(f.tokens,['openai-oauth']);assert.equal(options.permission,'ask');assert.deepEqual(options.files,[f.shared]);assert.deepEqual(f.contextFiles,[[f.shared]]);assert.equal(request.agent_authority_chain[0].delivery_id,f.row.id);assert.match(agent.system_instructions,/automated assignment/);assert.equal(f.calls.find(c=>c.name==='begin').record.text,f.row.text);assert(f.calls.findIndex(c=>c.name==='finish')<f.calls.findIndex(c=>c.name==='execute'));assert.equal(f.events[0].kind,'started');f.release();await tick();
});
test('a second start cannot enter the receiving conversation while its delivery claim is preparing',async()=>{
 const f=fixture();let release;f.claimHook(()=>new Promise(resolve=>release=resolve));const start=f.broker.launchQueuedChat(f.user.id,f.cached());await tick();await assert.rejects(f.broker.startChat(f.user,{requestId:randomUUID(),conversationId:f.row.target_chat,agentId:f.agent,text:'Other message',options:f.options}),/already working/);release();await start;f.release();
});
test('an explicit OpenRouter recipient remains OpenRouter without selecting the cached or source model',async()=>{
 const f=fixture();f.row.snapshot.target_options={...f.row.snapshot.target_options,provider:'openrouter'};await f.broker.launchQueuedChat(f.user.id,f.cached());assert.deepEqual(f.tokens,['openrouter']);assert.equal(f.executions[0][4],'openrouter');assert.equal(f.executions[0][7].model,'fixture-model');f.release();
});
test('a changed account while context loads cannot create or infer the receiving request',async()=>{
 const f=fixture();f.contextHook(async()=>f.identity({id:randomUUID(),admin:false}));await assert.rejects(f.broker.launchQueuedChat(f.user.id,f.cached()),/account changed/);assert.equal(f.executions.length,0);assert(!f.calls.some(c=>c.name==='begin'));assert.equal(f.row.status,'held');
});
test('Stop during context loading aborts preparation before the receiving request or provider call',async()=>{
 const f=fixture();f.contextHook(async()=>{const operation=f.broker.startingChats.get(f.row.id);operation.cancelled=true;operation.controller.abort();});await assert.rejects(f.broker.launchQueuedChat(f.user.id,f.cached()),/cancelled/);assert.equal(f.executions.length,0);assert(!f.calls.some(c=>c.name==='begin'));assert.equal(f.row.status,'held');
});
test('Stop before the queued sender has finished authenticating cannot be lost',async()=>{
 const f=fixture();let release;f.broker.identity=()=>new Promise(resolve=>release=resolve);const sending=f.broker.launchQueuedChat(f.user.id,f.cached());f.broker.cancelledQueued.add(f.row.id);release(f.user);await assert.rejects(sending,/stopped before sending/);assert.equal(f.executions.length,0);assert(!f.calls.some(c=>c.name==='claim'));assert.equal(f.broker.cancelledQueued.size,0);
});
test('a stopped source root cannot launch new work, while the native child scope is treated independently',async()=>{
 const f=fixture(),controller=new AbortController();controller.abort();f.broker.active.set(f.row.source_request,{userId:f.user.id,conversationId:f.row.source_chat,controller});await assert.rejects(f.broker.launchQueuedChat(f.user.id,f.cached()),/sending turn was stopped/);assert.equal(f.executions.length,0);
 const child=fixture();child.row.source_thread='owned-child';child.broker.native.childScope=()=>true;child.broker.active.set(child.row.source_request,{userId:child.user.id,conversationId:child.row.source_chat,controller});await child.broker.launchQueuedChat(child.user.id,child.cached());assert.equal(child.executions.length,1);child.release();
});
test('terminal saved handoffs do not start another native turn',async()=>{const f=fixture();f.row.status='delivered';await f.broker.launchQueuedChat(f.user.id,f.cached());assert.equal(f.executions.length,0);assert.equal(f.events.length,0);});

function nativeFixture(){
 const owner=randomUUID(),id=randomUUID(),calls=[],harness=new CodexHarness({}, {}, '', '',()=>{},async()=>{}),state={threadId:'root',turnId:'turn-one',steering:[],items:[],approvals:[],version:'fixture'},controller=new AbortController();
 const record={owner,state,controller,ended:false,rootFinished:false,turnRunning:true,options:{permission:'ask',mode:'chat',provider:'openai-oauth',model:'fixture-model',thinking:'default',files:[]},request:{agent_id:'agent',agent_profile:{agent_id:'agent',revision:3,policy:defaultAgentPolicy}},validate:async()=>{},worker:{client:{request:async(method,args)=>{calls.push({method,args});}}}};
 harness.running.set(id,record);harness.publish=()=>{};harness.persist=async()=>{};return {owner,id,calls,harness,record};
}
test('native steering validates the actual turn and supplies untrusted sender attribution without duplicating it in the visible text',async()=>{
 const f=nativeFixture(),source={id:randomUUID(),sourceConversationId:randomUUID(),sourceMessageId:randomUUID(),sourceAgentId:'source',sourceAgentName:'Researcher',citation:'agentopia-chat://fixture'};
 await f.harness.steer(f.owner,f.id,'turn-one','Review this result','message-one',undefined,source);assert.equal(f.calls.length,1);assert.equal(f.calls[0].args.input[0].text,chatDeliveryText('Review this result',source));assert.equal(f.record.state.steering[0].text,'Review this result');assert.equal(f.record.state.steering[0].source.id,source.id);await f.harness.steer(f.owner,f.id,'turn-one','Review this result','message-one',undefined,source);assert.equal(f.calls.length,1);await assert.rejects(f.harness.steer(f.owner,f.id,'turn-one','Changed','message-one'),/another message/);
});
test('a native turn changing during permission reads rejects steering before its app-server call',async()=>{
 const f=nativeFixture();f.record.validate=async()=>f.record.state.turnId='turn-two';await assert.rejects(f.harness.steer(f.owner,f.id,'turn-one','Guidance','message'),/changed while/);assert.equal(f.calls.length,0);await assert.rejects(f.harness.steeringScope(f.owner,f.id,'turn-one'),/changed or/);await assert.rejects(f.harness.steeringScope(randomUUID(),f.id),/changed or/);
});
test('native steering scopes are snapshots and cannot modify the live permission record',async()=>{const f=nativeFixture(),scope=await f.harness.steeringScope(f.owner,f.id);scope.options.files.push('other');scope.policy.delegation=false;assert.deepEqual(f.record.options.files,[]);assert.equal(f.record.request.agent_profile.policy.delegation,true);});

function steeringFixture(){
 const f=fixture(),requestId=randomUUID(),controller=new AbortController(),steered=[];
 f.broker.nativeControls=0;f.row.snapshot.target_project=null;
 f.broker.active.set(requestId,{userId:f.user.id,conversationId:f.row.target_chat,controller});
 f.broker.native.steeringScope=async(owner,id,expected)=>{assert.equal(owner,f.user.id);assert.equal(id,requestId);assert(!expected||expected==='actual-turn');return {turnId:'actual-turn',agentId:f.agent,revision:1,policy:defaultAgentPolicy,options:{...f.options,files:[f.shared]}};};
 f.broker.native.steer=async(...args)=>steered.push(args);
 f.broker.tools.deliveries.claimSteering=async(owner,id,target)=>{assert.equal(owner,f.user.id);assert.equal(id,f.row.id);assert.equal(target,requestId);f.row.status='dispatching';f.row.target_request=requestId;return {...structuredClone(f.row),claimed:true};};
 f.broker.emitOwned=(owner,event)=>{assert.equal(owner,f.user.id);f.events.push(event);};
 return {...f,requestId,controller,steered};
}
test('broker steering binds the actual recipient turn, inherited scope and sender before acknowledging delivery',async()=>{
 const f=steeringFixture(),receipt=await f.broker.steerDelivery(f.user.id,f.row,new AbortController().signal,{requestId:f.requestId,turnId:'actual-turn'});
 assert.equal(f.steered.length,1);const [owner,id,turn,text,messageId,options,source]=f.steered[0];
 assert.equal(owner,f.user.id);assert.equal(id,f.requestId);assert.equal(turn,'actual-turn');assert.equal(text,f.row.text);assert.equal(messageId,f.row.id);assert.deepEqual(options.files,[f.shared]);assert.equal(source.sourceConversationId,f.row.source_chat);assert.equal(receipt.status,'delivered');assert.equal(receipt.target_request_id,f.requestId);assert.equal(f.broker.nativeControls,0);assert.equal(f.controller.signal.aborted,false);assert.equal(f.calls.find(c=>c.name==='finish').receipt.delivery,'steer');
});
test('broker rejects steering into a broader running scope before claiming or sending',async()=>{
 const f=steeringFixture();f.broker.native.steeringScope=async()=>({turnId:'actual-turn',agentId:f.agent,revision:1,policy:defaultAgentPolicy,options:{...f.options,permission:'full'}});
 await assert.rejects(f.broker.steerDelivery(f.user.id,f.row,new AbortController().signal),/broader permissions/);assert.equal(f.row.status,'queued');assert.equal(f.steered.length,0);assert.equal(f.controller.signal.aborted,false);assert.equal(f.broker.nativeControls,0);
});
test('an uncertain native steering acknowledgement is held and stops the affected recipient without replay',async()=>{
 const f=steeringFixture();f.broker.native.steer=async()=>{throw Error('Connection closed after submission');};
 await assert.rejects(f.broker.steerDelivery(f.user.id,f.row,new AbortController().signal),/after submission/);assert.equal(f.row.status,'held');assert.equal(f.row.target_request,f.requestId);assert.equal(f.controller.signal.aborted,true);assert.equal(f.broker.nativeControls,0);
 await assert.rejects(f.broker.steerDelivery(f.user.id,f.row,new AbortController().signal),/Review and resume/);
});
test('a sender stopped during the saved steering claim cancels its unsent handoff and leaves the recipient working',async()=>{
 const f=steeringFixture(),source=new AbortController(),claim=f.broker.tools.deliveries.claimSteering;
 f.broker.tools.deliveries.claimSteering=async(...args)=>{const row=await claim(...args);source.abort();return row;};
 await assert.rejects(f.broker.steerDelivery(f.user.id,f.row,source.signal),/abort/i);assert.equal(f.steered.length,0);assert.equal(f.row.status,'cancelled');assert.equal(f.row.target_request,null);assert.equal(f.controller.signal.aborted,false);assert.equal(f.broker.nativeControls,0);
});
test('source cancellation during native permission validation cannot submit steering or stop the recipient',async()=>{
 const f=nativeFixture(),source=new AbortController(),{NativeSteeringNotSubmittedError}=require(path.join(build,'codex-harness.js'));f.record.validate=async()=>source.abort();
 await assert.rejects(f.harness.steer(f.owner,f.id,'turn-one','Guidance','cancelled-guidance',undefined,undefined,source.signal),error=>error instanceof NativeSteeringNotSubmittedError);assert.equal(f.calls.length,0);assert.equal(f.record.controller.signal.aborted,false);assert.deepEqual(f.record.state.steering,[]);
 const broker=steeringFixture();broker.broker.native.steer=async()=>{throw new NativeSteeringNotSubmittedError(Error('The sending task was stopped before submission'));};
 await assert.rejects(broker.broker.steerDelivery(broker.user.id,broker.row,new AbortController().signal),/before submission/);assert.equal(broker.row.status,'cancelled');assert.equal(broker.row.target_request,null);assert.equal(broker.controller.signal.aborted,false);
});
test('revoking coordination stops owned dependent work and holds its queue while unrelated work remains active',async()=>{
 const f=fixture(),grant=randomUUID(),dependent=randomUUID(),unrelated=randomUUID(),queued=randomUUID(),foreign=randomUUID(),controllers=new Map([dependent,unrelated,queued,foreign].map(id=>[id,new AbortController()])),held=[],stopped=[],jobs=[];
 f.broker.active.set(dependent,{userId:f.user.id,controller:controllers.get(dependent)});f.broker.active.set(unrelated,{userId:f.user.id,controller:controllers.get(unrelated)});f.broker.active.set(foreign,{userId:'another-account',controller:controllers.get(foreign)});
 f.broker.startingChats.set(queued,{userId:f.user.id,controller:controllers.get(queued)});
 Object.assign(f.broker.tools.deliveries,{revoke:async(owner,id)=>{assert.equal(owner,f.user.id);assert.equal(id,grant);},dependents:async()=>[dependent,foreign],pending:async()=>[{id:queued,grant_id:grant,target_chat:f.row.target_chat}]});
 f.broker.chatQueue={list:()=>[],holdItem:async(...args)=>held.push(args)};f.broker.emitOwned=()=>{};f.broker.native.stopRequests=async(...args)=>stopped.push(args);
 f.broker.assignments.queue.interruptWhere=async predicate=>{for(const job of [{id:dependent,owner:f.user.id},{id:unrelated,owner:f.user.id},{id:foreign,owner:'another-account'}])if(predicate(job))jobs.push(job.id);};
 await f.broker.revokeChatGrant(f.user.id,grant);assert.equal(controllers.get(dependent).signal.aborted,true);assert.equal(controllers.get(queued).signal.aborted,true);assert.equal(controllers.get(unrelated).signal.aborted,false);assert.equal(controllers.get(foreign).signal.aborted,false);assert.equal(held[0][1],queued);assert.deepEqual(jobs,[dependent]);assert.equal(stopped[0][0],f.user.id);assert.equal(f.broker.cancelledQueued.has(queued),true);
});
test('revoking a completed context cannot dispose the newer root reusing its native worker',async()=>{
 const f=nativeFixture(),disposed=[],newer={request:{id:randomUUID()},ended:false,turnRunning:true};f.record.request.id=f.id;f.record.ended=true;f.record.rootFinished=true;f.record.turnRunning=false;f.record.worker.current=newer;f.record.worker.children=new Map();f.harness.contexts.set(f.id,f.record);f.harness.dispose=async worker=>disposed.push(worker);
 await f.harness.stopRequests(f.owner,new Set([f.id]));assert.equal(disposed.length,0);
});
test('revocation cancels affected children while preserving completed results and an unrelated newer root',async()=>{
 const f=nativeFixture(),disposed=[],finished=[],waiting=[],paused=[],newer={request:{id:randomUUID()},ended:false,turnRunning:true},old=f.record;old.request.id=f.id;old.ended=true;old.turnRunning=false;old.rootFinished=true;
 function child(id,status,delivery){return {root:old,controller:new AbortController(),turnRunning:status==='running',view:{threadId:id,turnId:'turn-'+id,status,delivery,state:{},result:'Saved result'}};}
 const active=child('active','running','waiting'),report=child('completed-report','completed','waiting'),done=child('done','completed','delivered');
 old.worker.current=newer;old.worker.children=new Map([active,report,done].map(c=>[c.view.threadId,c]));f.harness.contexts.set(f.id,old);f.harness.dispose=async worker=>disposed.push(worker);f.harness.cancelWaiting=(r,thread)=>waiting.push(thread);f.harness.pauseNativeGoal=async(w,state)=>paused.push(state);f.harness.finishTools=async(...args)=>finished.push(args);
 await f.harness.stopRequests(f.owner,new Set([f.id]));assert.equal(disposed.length,0);assert.equal(active.controller.signal.aborted,true);assert.equal(active.view.status,'cancelled');assert.equal(active.view.delivery,'failed');assert.equal(report.view.status,'completed');assert.equal(report.view.result,'Saved result');assert.equal(report.view.delivery,'failed');assert.equal(done.controller.signal.aborted,false);assert.equal(done.view.delivery,'delivered');assert.deepEqual(waiting,['active','completed-report']);assert.equal(finished.length,2);assert.equal(f.calls.length,1);assert.equal(f.calls[0].args.threadId,'active');
});

test('revocation preserves independently owned children after the newer root has already finished',async()=>{
 const f=nativeFixture(),old=f.record,other={request:{id:randomUUID()}},disposed=[],waiting=[];old.request.id=f.id;old.ended=true;old.rootFinished=true;old.turnRunning=false;
 const affected={root:old,controller:new AbortController(),turnRunning:true,view:{threadId:'affected',turnId:'one',status:'running',delivery:'waiting',state:{}}},unrelated={root:other,controller:new AbortController(),turnRunning:true,view:{threadId:'unrelated',turnId:'two',status:'running',delivery:'waiting',state:{}}};
 old.worker.current=undefined;old.worker.children=new Map([[affected.view.threadId,affected],[unrelated.view.threadId,unrelated]]);f.harness.contexts.set(f.id,old);f.harness.dispose=async()=>disposed.push(true);f.harness.cancelWaiting=(_,id)=>waiting.push(id);f.harness.pauseNativeGoal=async()=>{};
 await f.harness.stopRequests(f.owner,new Set([f.id]));assert.equal(disposed.length,0);assert.equal(affected.view.status,'cancelled');assert.equal(unrelated.controller.signal.aborted,false);assert.equal(unrelated.view.status,'running');assert.deepEqual(waiting,['affected']);
});
test('stopping an active goal preserves an older independent child in the same worker',async()=>{
 const f=nativeFixture(),goal=randomUUID(),disposed=[],rejections=[];f.record.request.id=f.id;f.record.options.goalId=goal;f.record.reject=error=>rejections.push(error);f.record.worker.current=f.record;
 const child={root:{request:{id:randomUUID()}},controller:new AbortController(),turnRunning:true,view:{threadId:'independent',status:'running',delivery:'waiting',state:{}}};f.record.worker.children=new Map([['independent',child]]);f.harness.contexts.set(f.id,f.record);f.harness.dispose=async()=>disposed.push(true);
 await f.harness.stopGoal(f.owner,goal);assert.equal(disposed.length,0);assert.equal(f.record.controller.signal.aborted,true);assert.equal(child.controller.signal.aborted,false);assert.match(rejections[0].message,/goal stopped/);
});
test('pausing an old goal cannot stop the user response now reusing its native worker',async()=>{
 const f=nativeFixture(),goal=randomUUID(),disposed=[],controller=new AbortController();f.record.request.id=f.id;f.record.options.goalId=goal;f.record.rootFinished=true;f.record.turnRunning=false;f.record.ended=true;f.record.worker.current={request:{id:randomUUID()},ended:false,turnRunning:true,controller};f.record.worker.children=new Map();f.harness.contexts.set(f.id,f.record);f.harness.dispose=async()=>disposed.push(true);
 await f.harness.stopGoal(f.owner,goal);assert.equal(disposed.length,0);assert.equal(controller.signal.aborted,false);
});

test('the actual broker receiving path runs bundled Codex, passes sender provenance to the controlled provider and saves the reply',async()=>{
 const fs=require('node:fs/promises'),os=require('node:os'),{chatDeliveryProvenance}=require(path.join(build,'chat-delivery.js')),f=fixture(),directory=await fs.mkdtemp(path.join(os.tmpdir(),'agentopia-delivery-native-')),savedEnv={},originalFetch=global.fetch,tables=new Map(),requests=[],validated=[];
 for(const [key,value]of Object.entries({USERPROFILE:directory,APPDATA:path.join(directory,'appdata'),LOCALAPPDATA:path.join(directory,'local')})){savedEnv[key]=process.env[key];process.env[key]=value;}
 const originalFrom=f.broker.admin.from;
 f.broker.admin.from=name=>{
  if(!['desktop_codex_threads','desktop_codex_turns'].includes(name))return originalFrom(name);
  const rows=tables.get(name)??[];tables.set(name,rows);let mode='select',values,filters=[];
  const perform=()=>{let selected=rows.filter(row=>filters.every(([key,value])=>row[key]===value));if(mode==='insert'){const inserted=Array.isArray(values)?values:[values];rows.push(...structuredClone(inserted));selected=inserted;mode='done';}else if(mode==='update'){for(const row of selected)Object.assign(row,structuredClone(values));mode='done';}return {data:selected,error:null};};
  const q={select(){return q},eq(key,value){filters.push([key,value]);return q},insert(value){values=value;mode='insert';return q},update(value){values=value;mode='update';return q},maybeSingle:async()=>({data:perform().data[0]??null,error:null}),single:async()=>({data:perform().data[0]??null,error:null}),then(resolve,reject){return Promise.resolve(perform()).then(resolve,reject)}};return q;
 };
 const options={...f.options,model:'gpt-6.1-sol',files:[]};f.row.snapshot.source_options=options;f.row.snapshot.target_options={...options,permission:'full'};f.row.snapshot.target_project.file_ids=[];f.project.file_ids=[];f.request.project.file_ids=[];
 f.broker.catalog=async()=>[{id:'gpt-6.1-sol',supportsTools:true}];f.broker.providers={harnessScope:()=> 'controlled-chat-delivery',models:async()=>[{id:'gpt-6.1-sol'}],token:async()=> 'CONTROLLED-NO-LIVE-CREDENTIAL'};
 Object.assign(f.broker.tools,{computerDefinitions:()=>[],browserDefinitions:()=>[],pluginDefinitions:async()=>[],imageDefinitions:async()=>[],remote:{plan:async()=>({definitions:[]})},deliveryDefinitions:()=>[],deliverChat:async()=>{},memory:{definitions:()=>[],snapshot:async()=>[],validate:async()=>{}},chats:{definitions:()=>[],validate:async()=>{}}});
 Object.assign(f.broker.tools.agents,{definitions:()=>[],search:async()=>[],instances:async()=>[],validateExecution:async()=>{}});f.broker.tools.planning.definitions=async()=>[];
 f.broker.tools.deliveries.validateRequest=async(owner,id)=>{assert.equal(owner,f.user.id);assert.equal(id,f.row.id);assert.equal(f.row.status,'delivered');validated.push(id);};
 Object.assign(f.broker.terminal,{definitions:()=>[],permissions:()=>({enabled:false}),sessions:{finishRequest:async()=>{}}});f.broker.emitOwned=(owner,event)=>{assert.equal(owner,f.user.id);f.events.push(event);};
 f.broker.loadMessages=async()=>[{id:f.request.user_message_id,role:'user',content:{text:f.row.text},metadata:{chat_delivery:chatDeliveryProvenance(f.row)}},{id:f.request.assistant_message_id,role:'assistant',content:{text:''},metadata:{}}];
 f.broker.executeNative=Broker.prototype.executeNative;
 const harness=new CodexHarness(f.broker.admin,f.broker.providers,directory,process.env.AGENTOPIA_DELIVERY_RESOURCES,(_,event)=>f.events.push(event),async()=>{});f.broker.native=harness;
 global.fetch=async(url,init)=>{
  assert.equal(String(url),'https://api.openai.com/v1/responses','Only the controlled response endpoint may be used');requests.push(JSON.parse(init.body));assert.equal(requests.length,1,'The receiving task must not be replayed');
  const item={id:'message-'+randomUUID(),type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:'CONTROLLED-RECEIVER-RESULT',annotations:[]}]},response={id:'response-'+randomUUID(),object:'response',status:'completed',output:[item],usage:{input_tokens:5,output_tokens:2,total_tokens:7}};
  return new Response(['response.created','response.output_item.added','response.output_item.done','response.completed'].map(type=>'event: '+type+'\ndata: '+JSON.stringify({type,...(type==='response.created'?{response:{...response,status:'in_progress',output:[]}}:type==='response.completed'?{response}:{output_index:0,item})})+'\n\n').join(''),{headers:{'content-type':'text/event-stream'}});
 };
 const timeout=setTimeout(()=>{for(const active of f.broker.active.values())active.controller.abort();},25000);
 try{
  await f.broker.launchQueuedChat(f.user.id,f.cached());await f.broker.active.get(f.row.id)?.done;
  assert.equal(f.events.findLast(event=>event.status)?.status,'completed',JSON.stringify(f.events.filter(event=>event.error)));assert.equal(requests.length,1);assert(validated.length>0);assert.equal(f.row.status,'delivered');
  const input=JSON.stringify(requests[0].input);assert(input.includes(f.row.text));assert(input.includes(f.row.source_chat));assert(input.includes('Researcher'));
  const saved=tables.get('desktop_codex_turns').find(row=>row.request_id===f.row.id);assert(saved.state.items.some(entry=>entry.item.type==='agentMessage'&&entry.item.text==='CONTROLLED-RECEIVER-RESULT'));assert.equal(saved.context.options.provider,'openai-oauth');assert.equal(saved.context.options.permission,'ask');assert.deepEqual(saved.context.options.files,[]);
  const checkpoint=f.calls.find(call=>call.name==='desktop_checkpoint_chat');assert.equal(checkpoint.args.p_text,'CONTROLLED-RECEIVER-RESULT');assert.equal(checkpoint.args.p_status,'completed');
  await fs.writeFile(path.join(process.env.AGENTOPIA_DELIVERY_OUTPUT,'actual-native-receiver.json'),JSON.stringify({success:true,actualBrokerPreparation:true,actualBrokerExecution:true,actualCodex:true,controlledDatabase:true,controlledProvider:true,modelRequests:requests.length,liveInferenceRequests:0,provenanceInInput:true,deliveryValidated:true,replyCheckpointed:true},null,2));
 }finally{
  clearTimeout(timeout);for(const active of f.broker.active.values())active.controller.abort();await harness.close();global.fetch=originalFetch;
  for(const [key,value]of Object.entries(savedEnv))if(value===undefined)delete process.env[key];else process.env[key]=value;
  assert.equal(path.dirname(await fs.realpath(directory)),await fs.realpath(os.tmpdir()));await fs.rm(directory,{recursive:true,force:true,maxRetries:10,retryDelay:100});
 }
});
