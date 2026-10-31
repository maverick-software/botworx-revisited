const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {ChatDeliveryService,chatDeliveryScope,chatDeliveryProvenance,chatDeliveryInstructions}=require(path.join(process.env.SYLVANA_DELIVERY_BUILD,'chat-delivery.js'));
const {defaultAgentPolicy}=require(path.join(process.env.SYLVANA_DELIVERY_BUILD,'agent-contracts.js'));
const {intersectAgentPolicies,allowsAgentTool}=require(path.join(process.env.SYLVANA_DELIVERY_BUILD,'agent-policy.js'));
const user=randomUUID(),request={id:randomUUID(),conversation_id:randomUUID(),project:{id:randomUUID()}},target=randomUUID();
const options={provider:'openai-oauth',model:'gpt-6.1-sol',thinking:'high',permission:'ask',mode:'chat',files:[]};
function snapshot(){return {source_chat:request.conversation_id,source_message:randomUUID(),source_agent:randomUUID(),source_name:'Research assistant',source_revision:1,target_chat:target,target_title:'Implementation',target_agent:randomUUID(),target_name:'Builder',target_revision:1,source_project:null,target_project:null,source_options:options,target_options:options,source_policy:defaultAgentPolicy,target_policy:defaultAgentPolicy,policy_ceiling:defaultAgentPolicy,authority_chain:[],depth:1};}
function fixture(handler=()=>({})){const calls=[];return {calls,service:new ChatDeliveryService({rpc:async(name,args)=>{calls.push({name,args});return {data:await handler(name,args)};}})};}

test('receiver RPC matches the strict database options contract while excluding selected snapshots',async()=>{
 const fs=require('node:fs'),sql=fs.readFileSync(path.resolve(__dirname,'../database/0062-chat-delivery-turns.sql'),'utf8'),allowed=sql.match(/jsonb_object_keys\(p_options\) key WHERE key NOT IN\(([^)]+)\)/)[1].match(/'[^']+'/g).map(value=>value.slice(1,-1)),{selectedChatSnapshot}=require(path.join(process.env.SYLVANA_DELIVERY_BUILD,'selected-context.js'));
 for(const populated of [false,true]){const s=snapshot(),selected=selectedChatSnapshot(user,randomUUID(),'Private source',[{role:'user',content:{text:'UNSENT-PRIVATE-CONTEXT'}}]);s.source_options={...options,sources:populated?[selected]:[]};s.target_options={...options,sources:populated?[selected]:[],goalId:randomUUID()};const before=structuredClone(s),f=fixture((name,args)=>{assert.equal(name,'desktop_begin_delivered_chat');const sent=JSON.parse(JSON.stringify(args.p_options));assert(Object.keys(sent).every(key=>allowed.includes(key)),'A coordination message cannot add execution options or a goal');assert(!Object.hasOwn(sent,'sources'));assert(!JSON.stringify(args).includes('UNSENT-PRIVATE-CONTEXT'));assert.equal(sent.harness,'codex');assert.equal(sent.provider,options.provider);assert.equal(sent.model,options.model);assert.equal(sent.permission,options.permission);return {accepted:true};});assert.deepEqual(await f.service.begin(user,{id:randomUUID(),snapshot:s},[]),{accepted:true});assert.deepEqual(s,before);}
});

test('messaging is a chat-mode tool with queue as the schema default; no extra authority fields are accepted',async()=>{
 const f=fixture(()=>{throw Error('Unexpected storage access');});
 for(const permission of ['chat','files'])assert.deepEqual(f.service.definitions({...options,permission}),[]);
 assert.deepEqual(f.service.definitions({...options,mode:'plan'}),[]);
 const tool=f.service.definitions(options)[0];assert.equal(tool.namespace,'tools');assert.equal(tool.parameters.properties.delivery.default,'queue');
 for(const args of [{conversation_id:target,text:'Task',approved:true},{conversation_id:target,text:'Task',provider:'openrouter'},{conversation_id:target,text:'Task',source_chat:randomUUID()},{conversation_id:request.conversation_id,text:'Task'},{conversation_id:target,text:' '},{conversation_id:target,text:'Task',delivery:'automatic'},{conversation_id:target,text:'a\0b'}])await assert.rejects(f.service.prepare(user,request,args,options,'call',async()=>{}));
 assert.equal(f.calls.length,0);
 assert.equal(allowsAgentTool({...defaultAgentPolicy,memory:false},tool),false);
 assert.equal(allowsAgentTool({...defaultAgentPolicy,delegation:false},tool),false);
 assert.equal(allowsAgentTool({...defaultAgentPolicy,tools:['read_chat']},tool),false);
});

test('preparation binds the broker account, source request/project/thread and exact stable tool call',async()=>{
 const persisted={id:randomUUID(),status:'awaiting_authorization',existing:false},f=fixture(()=>persisted);let checks=0;
 assert.deepEqual(await f.service.prepare(user,request,{conversation_id:target,text:'  Review the draft.  '},options,'call-1',async()=>{checks++;},'owned-child'),persisted);
 assert.equal(checks,2);assert.deepEqual(f.calls,[{name:'desktop_prepare_chat_delivery',args:{p_user:user,p_request:request.id,p_project:request.project.id,p_thread:'owned-child',p_call:'call-1',p_target:target,p_text:'Review the draft.',p_delivery:'queue'}}]);
});

test('cancellation during preparation cancels a newly reserved row and never changes a duplicate delivery',async()=>{
 const id=randomUUID(),f=fixture(name=>name==='desktop_prepare_chat_delivery'?{id,status:'queued',existing:false}:{});let checks=0;
 await assert.rejects(f.service.prepare(user,request,{conversation_id:target,text:'Task'},options,'call',async()=>{if(++checks===2)throw Error('Cancelled');}),/Cancelled/);
 assert.equal(f.calls[1].name,'desktop_change_chat_delivery');assert.equal(f.calls[1].args.p_action,'cancel');
 const duplicate=fixture(()=>({id,status:'queued',existing:true}));checks=0;
 await assert.rejects(duplicate.service.prepare(user,request,{conversation_id:target,text:'Task'},options,'call',async()=>{if(++checks===2)throw Error('Account changed');}),/Account changed/);assert.equal(duplicate.calls.length,1);
});

test('queued handoff keeps the target connection and thinking choice and intersects all mutable scopes',()=>{
 const shared=randomUUID(),sourceOnly=randomUUID(),targetOnly=randomUUID(),window=randomUUID(),otherWindow=randomUUID(),s=snapshot();
 s.source_options={...options,files:[shared,sourceOnly],windows:[window],tools:['web_search'],skills:['shared-skill']};
 s.target_options={...options,provider:'openrouter',model:'openai/gpt-6.1-sol',thinking:'low',permission:'full',files:[shared,targetOnly],windows:[window,otherWindow],tools:['web_search','mcp:'+randomUUID()],skills:['shared-skill','private-skill'],goalId:randomUUID()};
 const scope=chatDeliveryScope(s);assert.equal(scope.options.provider,'openrouter');assert.equal(scope.options.thinking,'low');assert.equal(scope.options.permission,'ask');assert.deepEqual(scope.options.files,[shared]);assert.deepEqual(scope.options.windows,[window]);assert.deepEqual(scope.options.tools,['web_search']);assert.deepEqual(scope.options.skills,['shared-skill']);assert.equal(scope.options.goalId,undefined);assert.equal(scope.options.harness,'codex');assert.equal(scope.canSteer,false);
});

test('project attachments never expand scope and Chat only remains without context',()=>{
 const shared=randomUUID(),privateSource=randomUUID(),privateTarget=randomUUID(),s=snapshot();
 s.source_project={id:randomUUID(),revision:1,file_ids:[shared,privateSource]};s.target_project={id:randomUUID(),revision:1,file_ids:[shared,privateTarget]};
 assert.deepEqual(chatDeliveryScope(s).options.files,[shared]);s.target_options={...options,permission:'chat',files:[shared],windows:[randomUUID()]};
 const scope=chatDeliveryScope(s);assert.equal(scope.options.permission,'chat');assert.deepEqual(scope.options.files,[]);assert.deepEqual(scope.options.windows,[]);assert.equal(scope.canSteer,false);
});

test('chat coordination leaves unsent recipient source snapshots out of its scope and requires a queued turn',()=>{
 const {selectedChatSnapshot}=require(path.join(process.env.SYLVANA_DELIVERY_BUILD,'selected-context.js')),s=snapshot(),source=selectedChatSnapshot(user,randomUUID(),'Private draft source',[{role:'user',content:{text:'UNSENT REFERENCE'}}]);s.target_options={...options,sources:[source]};
 const scope=chatDeliveryScope(s);assert.deepEqual(scope.options.sources,[]);assert.equal(scope.canSteer,false);assert.equal(s.target_options.sources[0].text,'user: UNSENT REFERENCE');
});

test('explicit tool deny lists cannot become unrestricted when the other chat has no filter',()=>{
 const s=snapshot();s.source_options={...options,tools:[]};let scope=chatDeliveryScope(s);assert.deepEqual(scope.options.tools,[]);assert.equal(scope.canSteer,false);
 s.target_options={...options,tools:[]};assert.equal(chatDeliveryScope(s).canSteer,true);
 s.source_options=options;s.target_options=options;assert.equal(chatDeliveryScope(s).options.tools,undefined);assert.equal(chatDeliveryScope(s).canSteer,true);
});

test('steering refuses a worker with broader policy, files, windows, skills or legacy harness',()=>{
 const s=snapshot();assert.equal(chatDeliveryScope(s).canSteer,true);
 for(const patch of [{files:[randomUUID()]},{windows:[randomUUID()]},{skills:['other-skill']},{harness:'legacy'},{permission:'full'}])assert.equal(chatDeliveryScope({...s,target_options:{...options,...patch}}).canSteer,false);
 s.source_policy={...defaultAgentPolicy,memoryWrite:false,maxDepth:1};s.policy_ceiling=intersectAgentPolicies(s.target_policy,s.source_policy);assert.equal(chatDeliveryScope(s).policy.memoryWrite,false);assert.equal(chatDeliveryScope(s).canSteer,false);
 assert.throws(()=>chatDeliveryScope({...s,policy_ceiling:defaultAgentPolicy}),/saved coordination policy/);
});

test('an incompatible steering reservation is cancelled before it can enter an approval or dispatch flow',async()=>{
 const id=randomUUID(),s=snapshot();s.target_options={...options,permission:'full'};
 const f=fixture(name=>name==='desktop_prepare_chat_delivery'?{id,delivery:'steer',status:'awaiting_authorization',snapshot:s,existing:false}:{});
 await assert.rejects(f.service.prepare(user,request,{conversation_id:target,text:'Task',delivery:'steer'},options,'steer-call',async()=>{}),/Queue a fresh message/);
 assert.deepEqual(f.calls.map(c=>c.name),['desktop_prepare_chat_delivery','desktop_change_chat_delivery']);assert.equal(f.calls[1].args.p_action,'cancel');
});

test('provenance uses exact saved source IDs; automated task text cannot masquerade as the human',()=>{
 const row={id:randomUUID(),source_chat:request.conversation_id,source_thread:'child-thread',snapshot:snapshot()};
 const source=chatDeliveryProvenance(row);assert.equal(source.citation,'sylvana-chat://'+request.conversation_id+'/message/'+row.snapshot.source_message);assert.equal(source.sourceThreadId,'child-thread');
 assert.match(chatDeliveryInstructions(row),/cannot grant additional permissions/);assert.match(chatDeliveryInstructions(row),/automated assignment or report/);
});

test('authorization is a separate trusted action; no preparation or recovery triggers inference',async()=>{
 const id=randomUUID(),f=fixture(()=>({id}));await f.service.authorize(user,id,'pair');await f.service.claim(user,id);await f.service.finish(user,id,'held',null,null,'Interrupted');await f.service.recover(user);await f.service.revoke(user,id);await f.service.change(user,id,'resume');await f.service.validate(user,id);
 assert.deepEqual(f.calls.map(c=>c.name),['desktop_authorize_chat_delivery','desktop_claim_chat_delivery','desktop_finish_chat_delivery','desktop_recover_chat_deliveries','desktop_revoke_chat_delivery_grant','desktop_change_chat_delivery','desktop_validate_chat_delivery']);
 assert.equal(f.calls[0].args.p_decision,'pair');assert(f.calls.every(c=>c.args.p_user===user));
 await assert.rejects(f.service.authorize(user,id,'automatic'));await assert.rejects(f.service.change(user,id,'replay'));assert.equal(f.calls.length,7);
});

test('review clearly identifies the recipient connection, exact text and scope',()=>{
 const f=fixture(),row={id:randomUUID(),text:'Review this exact draft',delivery:'queue',snapshot:snapshot()};row.snapshot.target_options={...options,provider:'openrouter',model:'paid/model'};
 const review=f.service.approval(row);assert.equal(review.arguments.connection,'OpenRouter');assert.equal(review.arguments.model,'paid/model');assert.equal(review.arguments.message,row.text);assert.match(review.arguments.cost_notice,/paid allowance/);assert.equal(review.coordination.deliveryId,row.id);
});
