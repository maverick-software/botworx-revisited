const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{randomUUID}=require('node:crypto');
const build=process.env.AGENTOPIA_DELIVERY_BUILD,{ToolService}=require(path.join(build,'tool-service.js')),{defaultAgentPolicy}=require(path.join(build,'agent-contracts.js')),{chatDeliveryReceipt}=require(path.join(build,'chat-delivery.js'));
const options={provider:'openai-oauth',model:'fixture-model',thinking:'high',permission:'ask',mode:'chat',files:[]};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture({grant=false,policy=defaultAgentPolicy}={}){
 const user={id:randomUUID(),admin:true},request={id:randomUUID(),conversation_id:randomUUID(),assistant_message_id:randomUUID(),agent_instance_id:randomUUID()},target=randomUUID(),agent=randomUUID();
 const tools=[],deliveries=new Map(),calls=[],events=[],sent=[],errors=[],validations=[];let owner=user.id,service,callback;
 const snapshot={source_chat:request.conversation_id,source_message:randomUUID(),source_agent:agent,source_name:'Researcher',source_revision:1,target_chat:target,target_title:'Build the site',target_agent:randomUUID(),target_name:'Builder',target_revision:1,source_project:null,target_project:null,source_options:options,target_options:options,source_policy:policy,target_policy:defaultAgentPolicy,policy_ceiling:policy,authority_chain:[],depth:1};
 const matches=(row,filters)=>filters.every(([key,value])=>key==='arguments->>provider_call_id'?row.arguments.provider_call_id===value:row[key]===value);
 const db={from(table){const filters=[];let inserted,patch;const rows=()=>table==='desktop_tool_calls'?tools:[...deliveries.values()];const result=()=>{let values=rows().filter(row=>matches(row,filters));if(patch)for(const row of values)Object.assign(row,structuredClone(patch));if(inserted)values=[inserted];return {data:values};};const q={select(){return q},eq(key,value){filters.push([key,value]);return q},is(key,value){filters.push([key,value]);return q},insert(row){inserted=structuredClone(row);if(table==='desktop_tool_calls')tools.push(inserted);else throw Error('Unexpected direct insert');return q},update(value){patch=value;return q},maybeSingle:async()=>({data:result().data[0]??null}),single:async()=>{const row=result().data[0];return row?{data:structuredClone(row)}:{error:{message:'Record unavailable'}};},then(resolve,reject){return Promise.resolve(result()).then(resolve,reject);}};return q;},rpc:async(name,args)=>{
  if(name==='desktop_validate_chat_delivery_request'){validations.push(structuredClone(args));return {data:null};}
  calls.push({name,args:structuredClone(args)});
  if(name==='desktop_prepare_chat_delivery'){
   const previous=[...deliveries.values()].find(row=>row.call_id===args.p_call&&row.source_thread===args.p_thread);
   if(previous)return {data:{...structuredClone(previous),existing:true}};
   const row={id:randomUUID(),user_id:user.id,source_request:request.id,source_chat:request.conversation_id,target_chat:target,source_thread:args.p_thread,call_id:args.p_call,text:args.p_text,delivery:args.p_delivery,status:grant?'queued':'awaiting_authorization',snapshot:structuredClone(snapshot),target_request:null,grant_id:grant?randomUUID():null,error:null};deliveries.set(row.id,row);return {data:{...structuredClone(row),existing:false}};
  }
  if(name==='desktop_authorize_chat_delivery'){
   const row=deliveries.get(args.p_id);if(!row||row.user_id!==args.p_user||row.status!=='awaiting_authorization')return {error:{message:'Authorization no longer active'}};
   row.status=args.p_decision==='deny'?'denied':'queued';row.authorized_once=args.p_decision==='once';row.grant_id=args.p_decision==='pair'?randomUUID():null;return {data:structuredClone(row)};
  }
  if(name==='desktop_change_chat_delivery'){const row=deliveries.get(args.p_id);assert.equal(args.p_action,'cancel');row.status='cancelled';return {data:structuredClone(row)};}
  throw Error('Unexpected RPC '+name);
 }};
 service=new ToolService(db,{},(who,event)=>{events.push(structuredClone(event));if(callback)callback(who,event);},async()=>({...user,id:owner}));
 service.planning.definitions=async()=>[];service.agents.context=async()=>({instance:{id:request.agent_instance_id},profile:{agent_id:agent,policy}});service.agents.validate=async()=>{};
 service.deliverChat=async(who,row,signal)=>{assert(!signal.aborted);sent.push({who,id:row.id});return chatDeliveryReceipt(row);};
 const call={id:'stable-call',name:'send_message_to_chat',namespace:'tools',arguments:JSON.stringify({conversation_id:target,text:'Review the exact draft.'})};
 return {service,user,request,target,agent,tools,deliveries,calls,events,sent,errors,validations,call,options,owner:value=>owner=value,onEvent:value=>callback=value,
  execute:(overrides={},opts=options,signal=new AbortController().signal,thread='native-child')=>service.execute(user,request,{...call,...overrides},opts,signal,undefined,agent,thread),
  approval:()=>tools.find(row=>row.status==='awaiting_approval')};
}

test('tools stay unavailable until the broker supplies a delivery handler',async()=>{
 const f=fixture();f.service.deliverChat=undefined;assert.deepEqual(f.service.deliveryDefinitions(options),[]);
 const result=await f.execute();assert.match(result.error,/not enabled/);assert.equal(f.calls.length,0);assert.equal(f.tools.length,0);
});

test('Full access authorizes exactly one coordination handoff automatically without per-call review',async()=>{
 const f=fixture(),result=await f.execute({}, {...options,permission:'full'});assert.equal(f.tools[0].approval,undefined);
 assert.equal(result.status,'queued');assert.equal(f.sent.length,1);assert.equal(f.calls.find(c=>c.name==='desktop_authorize_chat_delivery').args.p_decision,'once');assert.equal(f.tools[0].status,'completed');assert.match(result.notice,/not confirmed completion/);
 assert(f.validations.length>=2);assert(f.validations.every(v=>v.p_user===f.user.id&&v.p_request===f.request.id));
});

test('a fast pair decision is registered before its review is emitted; saved pair grants avoid repeated reviews',async()=>{
 const f=fixture();f.onEvent((owner,event)=>{if(event.tool?.status==='awaiting_approval')f.service.decide(owner,event.tool.id,true,true).catch(error=>f.errors.push(error));});
 const result=await f.execute();assert.equal(result.status,'queued');assert.equal(f.errors.length,0);assert.equal(f.sent.length,1);assert.equal(f.calls.find(c=>c.name==='desktop_authorize_chat_delivery').args.p_decision,'pair');
 const authorized=fixture({grant:true});await authorized.execute();assert.equal(authorized.sent.length,1);assert(!authorized.events.some(e=>e.tool?.status==='awaiting_approval'));assert(!authorized.calls.some(c=>c.name==='desktop_authorize_chat_delivery'));
});

test('denial persists its outcome without dispatch or an automatic retry',async()=>{
 const f=fixture(),work=f.execute();await tick();await f.service.decide(f.user.id,f.approval().id,false);const result=await work;
 assert.equal(result.status,'denied');assert.equal(f.sent.length,0);assert.equal(f.tools[0].status,'denied');assert.equal(f.calls.filter(c=>c.name==='desktop_authorize_chat_delivery').length,1);
});

test('cancelling a pending review removes the waiter, cancels the reserved message and cannot later dispatch it',async()=>{
 const f=fixture(),controller=new AbortController(),work=f.execute({},options,controller.signal);work.catch(()=>{});await tick();const id=f.approval().id;controller.abort();await assert.rejects(work);
 assert.equal(f.sent.length,0);assert.equal([...f.deliveries.values()][0].status,'cancelled');assert.equal(f.tools[0].status,'interrupted');await assert.rejects(f.service.decide(f.user.id,id,true),/no longer active/);
});

test('another account cannot decide a review, and an account change before dispatch cancels the message',async()=>{
 const f=fixture(),work=f.execute();await tick();const id=f.approval().id;await assert.rejects(f.service.decide(randomUUID(),id,true),/unavailable/);assert.equal(f.calls.filter(c=>c.name==='desktop_authorize_chat_delivery').length,0);
 f.owner(randomUUID());await f.service.decide(f.user.id,id,true);const result=await work;assert.match(result.error,/account changed/);assert.equal(f.sent.length,0);assert.equal([...f.deliveries.values()][0].status,'cancelled');
});

test('the model cannot supply approval, pair authorization or another sender through its tool arguments',async()=>{
 for(const extra of [{approved:true},{rememberChatPair:true},{source_request:randomUUID()}]){
  const f=fixture(),result=await f.execute({arguments:JSON.stringify({conversation_id:f.target,text:'Task',...extra})});assert.match(result.error,/schema/);assert.equal(f.sent.length,0);assert.equal(f.calls.length,0);
 }
});

test('exact tool-call replay returns the saved receipt; changed text cannot reuse that call and another native thread is distinct',async()=>{
 const f=fixture({grant:true});await f.execute();const result=await f.execute();assert.equal(result.duplicate,true);assert.equal(f.sent.length,1);assert.equal(f.calls.filter(c=>c.name==='desktop_prepare_chat_delivery').length,1);
 const changed=await f.execute({arguments:JSON.stringify({conversation_id:f.target,text:'Changed task'})});assert.match(changed.error,/different arguments/);assert.equal(f.sent.length,1);
 await f.execute({},options,new AbortController().signal,'another-child');assert.equal(f.sent.length,2);assert.equal(f.calls.filter(c=>c.name==='desktop_prepare_chat_delivery').length,2);
});

test('a queued outbox record left by an earlier attempt is reported without dispatching it again',async()=>{
 const f=fixture({grant:true});await f.service.deliveries.prepare(f.user.id,f.request,{conversation_id:f.target,text:'Review the exact draft.'},options,f.call.id,async()=>{},'native-child');
 const result=await f.execute();assert.equal(result.status,'queued');assert.equal(f.sent.length,0);assert(!f.events.some(e=>e.tool?.status==='awaiting_approval'));
});

test('failed queue persistence cancels the unaccepted message and preserves a failed tool result',async()=>{
 const f=fixture({grant:true});f.service.deliverChat=async()=>{throw Error('Queue storage unavailable');};const result=await f.execute();assert.match(result.error,/Queue storage unavailable/);assert.equal([...f.deliveries.values()][0].status,'cancelled');assert.equal(f.tools[0].status,'failed');
});

test('agent memory/delegation policy and Plan mode block the tool before an outbox record is created',async()=>{
 for(const policy of [{...defaultAgentPolicy,memory:false},{...defaultAgentPolicy,delegation:false},{...defaultAgentPolicy,tools:['read_chat']}]){
  const f=fixture({policy}),result=await f.execute();assert.match(result.error,/disabled/);assert.equal(f.calls.length,0);
 }
 const f=fixture(),result=await f.execute({}, {...options,mode:'plan'});assert.match(result.error,/not enabled/);assert.equal(f.calls.length,0);
});

test('pair decisions cannot be attached to a denial or another tool review',async()=>{
 const f=fixture(),work=f.execute();await tick();const id=f.approval().id;await assert.rejects(f.service.decide(f.user.id,id,false,true),/Pair authorization/);await f.service.decide(f.user.id,id,false);await work;
 f.tools.push({id:'other-tool',user_id:f.user.id,status:'awaiting_approval'});f.service.approvals.set('other-tool',{user:f.user.id,name:'computer',resolve:()=>assert.fail('Other review unexpectedly resolved')});
 await assert.rejects(f.service.decide(f.user.id,'other-tool',true,true),/Pair authorization/);
});

test('a revoked incoming delivery blocks tool execution before any new activity or outbound message',async()=>{
 const f=fixture({grant:true});f.service.deliveries.validateRequest=async()=>{throw Error('Chat coordination permission was revoked');};
 await assert.rejects(f.execute(),/permission was revoked/);assert.equal(f.sent.length,0);assert.equal(f.tools.length,0);assert.equal(f.calls.length,0);
});
