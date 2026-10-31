const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const build=process.env.SYLVANA_PREVIEW_BUILD||path.resolve(__dirname,'../build');
const {AgentDraftPreviews}=require(path.join(build,'agent-draft-previews.js'));
const {agentDraftPreviewInput}=require(path.join(build,'agent-draft-preview-contracts.js'));
const {draftPreviewProfile}=require(path.join(build,'codex-draft-preview.js'));
const {agentInstructions}=require(path.join(build,'agent-policy.js'));
const {createHash}=require('node:crypto');
const owner='11111111-1111-4111-8111-111111111111',other='99999999-9999-4999-8999-999999999999',session='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333',next='44444444-4444-4444-8444-444444444444';
const user={id:owner,email:'generated@example.invalid',admin:true};
const behavior=()=>({handle:'draft-mira',role:'Verify project handoffs.',sops:'Read the supplied facts before reporting.',guardrails:'Retain every original seal.',skills:[{id:next,name:'Handoff review',description:'Review supplied facts.',content:'Keep HANDOFF-SKILL-SEAL-76 in the answer.'}],policy:{tools:['read_file','workspace.write_file'],delegation:true,delegateAgents:null,memory:true,memoryWrite:true,maxDepth:2,maxTurns:10}});
const input=(extra={})=>({sessionId:session,requestId:id,sourceAgentId:null,text:'  Review this generated example.\n\nKeep spacing.  ',snapshot:{name:'Draft Mira',description:'Unsaved role',instructions:'Keep the supplied facts.',personality:'',provider:'openai-oauth',model:'test-model',thinking:'default',behavior:behavior()},...extra});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};

test('accepted default connections scope cancellation by captured source and plugin while unrelated previews continue',async()=>{
 const f=fixture();f.runGate=deferred();const source=next,connection='mcp:'+other,peer='mcp:'+id,value=(requestId,sessionId)=>input({requestId,sessionId,sourceAgentId:source,snapshot:{...input().snapshot,execution:{permission:'ask',mode:'chat',files:[]}}});
 f.prepareContext={definitions:[],remoteTools:{sources:[{id:connection,plugin:'composio'}]}};const first=value(id,session);await f.service.start(user,first);
 f.prepareContext={definitions:[],remoteTools:{sources:[{id:peer,plugin:'mcp'}]}};const second=value(next,other);await f.service.start(user,second);for(let n=0;n<50&&f.runs.length<2;n++)await new Promise(resolve=>setImmediate(resolve));assert.equal(f.runs.length,2);
 const copy=f.service.remoteSources(owner,other,next);assert.deepEqual(copy,[{id:peer,plugin:'mcp'}]);copy.length=0;assert.equal(f.service.remoteSources(owner,other,next).length,1);assert.equal(f.service.remoteSources(owner,session,next),undefined);
 await f.service.stopScope({owner,remoteOnly:true,remoteConnectionId:'mcp:'+source});assert.equal(f.rows.get(id).status,'running');assert.equal(f.rows.get(next).status,'running');
 await f.service.stopScope({owner,remoteOnly:true,remotePlugin:'composio'});assert.equal(f.rows.get(id).status,'cancelled');assert.equal(f.rows.get(next).status,'running');f.runGate.resolve();await settled(f.service);assert.equal(f.rows.get(next).status,'completed');
});

test('an accepted empty remote snapshot stays independent of additions while preparing default selection is still cancelled',async()=>{
 const f=fixture();f.runGate=deferred();const value=input({sourceAgentId:next,snapshot:{...input().snapshot,execution:{permission:'ask',mode:'chat',files:[]}}});await f.service.start(user,value);for(let n=0;n<50&&!f.runs.length;n++)await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(f.service.remoteSources(owner,session,id),[]);await f.service.stopScope({owner,remoteOnly:true,remoteConnectionId:'mcp:'+other});assert.equal(f.rows.get(id).status,'running');f.runGate.resolve();await settled(f.service);assert.equal(f.rows.get(id).status,'completed');
 const pending=fixture();pending.prepareGate=deferred();const starting=pending.service.start(user,value);void starting.catch(()=>{});for(let n=0;n<50&&!pending.prepareCalls;n++)await new Promise(resolve=>setImmediate(resolve));assert.equal(pending.service.remoteSources(owner,session,id),undefined);const stopping=pending.service.stopScope({owner,remoteOnly:true,remoteConnectionId:'mcp:'+other});assert(pending.service.activeRequests[0].cancelling);pending.prepareGate.resolve();await stopping;await assert.rejects(starting,/abort/i);assert.equal(pending.rows.size,0);
});
async function settled(service){for(let n=0;n<200&&service.busy;n++)await new Promise(resolve=>setImmediate(resolve));assert.equal(service.busy,false);}
function fixture(){
 const rows=new Map(),events=[],runs=[],f={rows,events,runs,allowed:true,sourceOwned:true,available:true,catalogGate:null,runGate:null,prepareGate:null,prepareCalls:0,prepareContext:null};
 const store={
  async begin(owner,value,context=null){const key=value.requestId,prior=rows.get(key);if(prior){assert.equal(prior.user_id,owner);assert.equal(prior.conversation_id,value.sessionId);assert.deepEqual(prior.snapshot,value.snapshot);assert.equal(prior.input_text,value.text);assert.deepEqual(prior.execution_context,context);return {...structuredClone(prior),existing:true};}const row={id:key,user_id:owner,conversation_id:value.sessionId,snapshot:structuredClone(value.snapshot),execution_context:structuredClone(context),input_text:value.text,output_text:'',status:'running',error:null,created_at:new Date().toISOString()};rows.set(key,row);return structuredClone(row);},
  async lookup(owner,session,id){const row=rows.get(id);return row?.user_id===owner&&row.conversation_id===session?structuredClone(row):null;},
  async read(owner,session){return structuredClone([...rows.values()].filter(row=>row.user_id===owner&&row.conversation_id===session));},
  async finish(owner,id,status,output,error){const row=rows.get(id);assert.equal(row.user_id,owner);assert.equal(row.status,'running');Object.assign(row,{status,output_text:output,error});},
  async source(owner,id){if(!f.sourceOwned)throw Error('The source agent is unavailable.');},
  async recover(){for(const row of rows.values())if(row.status==='running')Object.assign(row,{status:'interrupted',error:'Recovered without replay.'});}
 };
 const runner={async prepare(user,value,signal,validate){f.prepareCalls++;if(f.prepareGate)await f.prepareGate.promise;await validate();return structuredClone(f.prepareContext);},async run(user,request,history,signal,validate){await validate();runs.push(structuredClone({user,request,history}));if(f.runGate)await Promise.race([f.runGate.promise,new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Stopped','AbortError')),{once:true}))]);signal.throwIfAborted();return 'Verified draft reply.';},async stopOwner(){},async recover(){f.recovered=true;},async close(){f.closed=true;}};
 const service=new AgentDraftPreviews(store,runner,async()=>{if(!f.allowed)throw Error('Account changed.');},async()=>{f.catalogCalls=(f.catalogCalls??0)+1;if(f.catalogError)throw f.catalogError;if(f.catalogGate)await f.catalogGate.promise;return [{id:'test-model',name:'Test model',thinking:['high'],supportsTools:f.supportsTools,inputModalities:f.inputModalities}];},()=>f.available,(owner,row)=>events.push(structuredClone({owner,row})));
 return Object.assign(f,{service,store,runner});
}
test('draft input keeps exact text and rejects authority/context injection before storage',()=>{
 const value=input(),parsed=agentDraftPreviewInput(value);assert.equal(parsed.text,value.text);assert.deepEqual(parsed.snapshot,value.snapshot);value.snapshot.instructions='Changed after parsing';assert.equal(parsed.snapshot.instructions,'Keep the supplied facts.');
 for(const extra of [{options:{permission:'full'}},{snapshot:{...input().snapshot,tools:['run_command']}},{snapshot:{...input().snapshot,model:''}},{sourceAgentId:other+'x'},{snapshot:{...input().snapshot,instructions:'x'.repeat(500001)}}])assert.throws(()=>agentDraftPreviewInput(input(extra)));
});
test('draft behavior uses saved-agent normalization and copies nested policy and skills',()=>{
 const value=input();value.snapshot.behavior.handle=' DRAFT-MIRA ';value.snapshot.behavior.policy.tools.push('read_file');const parsed=agentDraftPreviewInput(value);
 assert.equal(parsed.snapshot.behavior.handle,'draft-mira');assert.deepEqual(parsed.snapshot.behavior.policy.tools,['read_file','workspace.write_file']);value.snapshot.behavior.skills[0].content='Changed later';value.snapshot.behavior.policy.tools.push('run_command');assert.equal(parsed.snapshot.behavior.skills[0].content,behavior().skills[0].content);assert.deepEqual(parsed.snapshot.behavior.policy.tools,['read_file','workspace.write_file']);
});
test('malformed behavior, excessive skills and nested authority injection are refused',()=>{
 const base=behavior(),bad=[undefined,{...base,revision:99},{...base,role:'x'.repeat(1001)},{...base,skills:[...base.skills,...base.skills]},{...base,skills:[{...base.skills[0],sha256:'supplied'}]},{...base,skills:[{...base.skills[0],content:'bad\0text'}]},{...base,skills:Array.from({length:5},(_,n)=>({...base.skills[0],id:`00000000-0000-4000-8000-00000000000${n}`,content:'x'.repeat(50000)}))},{...base,policy:{...base.policy,admin:true}},{...base,policy:{...base.policy,tools:['workspace.*']}},{...base,policy:{...base.policy,delegation:'true'}},{...base,policy:{...base.policy,maxTurns:51}}];
 for(const value of bad)assert.throws(()=>agentDraftPreviewInput(input({snapshot:{...input().snapshot,behavior:value}})));
});
test('the normal instruction assembler includes all draft behavior while Chat only caps actual authority',()=>{
 const value=agentDraftPreviewInput(input()),profile=draftPreviewProfile(owner,{snapshot:value.snapshot,conversation_id:session,created_at:'2026-10-23T00:00:00Z'}),prompt=agentInstructions(profile,'draft');
 for(const text of [value.snapshot.name,'@draft-mira',behavior().role,behavior().sops,behavior().guardrails,behavior().skills[0].name,behavior().skills[0].description,behavior().skills[0].content])assert(prompt.includes(text),text);
 assert(prompt.includes('unsaved Sylvana draft'));assert(!prompt.includes('Your persistent Sylvana identity'));assert(agentInstructions(profile).includes('Your persistent Sylvana identity'));assert.deepEqual(profile.policy,{tools:[],delegation:false,delegateAgents:[],memory:false,memoryWrite:false,maxDepth:0,maxTurns:1});assert.deepEqual(value.snapshot.behavior.policy,behavior().policy);assert.equal(profile.skills[0].sha256,createHash('sha256').update(behavior().skills[0].content).digest('hex'));
});
test('a duplicate request during preparation shares one acceptance and starts inference once',async()=>{
 const f=fixture();f.catalogGate=deferred();f.runGate=deferred();const first=f.service.start(user,input()),duplicate=f.service.start(user,input());assert.equal(f.service.activeCount,1);f.catalogGate.resolve();const [a,b]=await Promise.all([first,duplicate]);assert.equal(a.id,b.id);assert.equal(b.existing,true);await assert.rejects(f.service.start(user,input({requestId:next})),/already working/);await assert.rejects(f.service.start(user,input({text:'Changed same request'})),/different instructions or text/);for(let n=0;n<20&&!f.runs.length;n++)await new Promise(resolve=>setImmediate(resolve));assert.equal(f.runs.length,1);f.runGate.resolve();await settled(f.service);assert.equal(f.rows.get(id).status,'completed');assert.equal(f.events.length,2);
});
test('mutating the accepted UI result cannot replace the execution snapshot',async()=>{
 const f=fixture();f.runGate=deferred();const accepted=await f.service.start(user,input());accepted.snapshot.instructions='Replaced by UI';accepted.input_text='Replaced text';for(let n=0;n<20&&!f.runs.length;n++)await new Promise(resolve=>setImmediate(resolve));assert.equal(f.runs[0].request.snapshot.instructions,'Keep the supplied facts.');assert.equal(f.runs[0].request.input_text,input().text);f.runGate.resolve();await settled(f.service);
});
test('changed draft behavior cannot reuse a request or mutate an accepted nested snapshot',async()=>{
 const f=fixture();f.runGate=deferred();const accepted=await f.service.start(user,input());accepted.snapshot.behavior.skills[0].content='Replaced skill';accepted.snapshot.behavior.policy.tools.push('run_command');
 for(let n=0;n<20&&!f.runs.length;n++)await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(f.runs[0].request.snapshot.behavior,behavior());
 for(const change of [{role:'New role'},{sops:'New procedure'},{guardrails:'New guardrail'},{skills:[]},{policy:{...behavior().policy,memory:false}}])await assert.rejects(f.service.start(user,input({snapshot:{...input().snapshot,behavior:{...behavior(),...change}}})),/different instructions or text/);
 f.runGate.resolve();await settled(f.service);assert.deepEqual(f.rows.get(id).snapshot.behavior,behavior());
});
test('stopping during provider validation submits no durable request or model call',async()=>{
 const f=fixture();f.catalogGate=deferred();const starting=f.service.start(user,input());await f.service.stop(owner,session);f.catalogGate.resolve();await assert.rejects(starting,/abort/i);await settled(f.service);assert.equal(f.rows.size,0);assert.equal(f.runs.length,0);
});
test('an unavailable model or thinking choice is refused before a request is accepted',async()=>{
 const f=fixture();await assert.rejects(f.service.start(user,input({snapshot:{...input().snapshot,model:'missing'}})),/connected account/);await settled(f.service);await assert.rejects(f.service.start(user,input({snapshot:{...input().snapshot,thinking:'ultra'}})),/thinking level/);await settled(f.service);assert.equal(f.rows.size,0);assert.equal(f.runs.length,0);
});
test('a model that cannot read images refuses pasted images and document page images before acceptance',async()=>{
 const image='data:image/png;base64,'+require('../../scripts/desktop/preview-clipboard104-png.cjs').png.toString('base64');
 for(const file of [{name:'generated.png',image},{name:'generated.pdf',pageImages:[image]}]){const f=fixture();f.inputModalities=['text'];f.prepareContext={definitions:[],inputFiles:[file]};await assert.rejects(f.service.start(user,input()),/cannot read images/);await settled(f.service);assert.equal(f.rows.size,0);assert.equal(f.runs.length,0);f.inputModalities=['text','image'];await f.service.start(user,input());await settled(f.service);assert.equal(f.rows.get(id).status,'completed');assert.equal(f.runs.length,1);}
});
test('account or saved-agent ownership loss prevents inference',async()=>{
 for(const mode of ['account','source']){const f=fixture();f.catalogGate=deferred();const start=f.service.start(user,input({sourceAgentId:next}));await new Promise(resolve=>setImmediate(resolve));if(mode==='account')f.allowed=false;else f.sourceOwned=false;f.catalogGate.resolve();await assert.rejects(start,/Account changed|source agent/);await settled(f.service);assert.equal(f.runs.length,0);assert.equal(f.rows.size,0);}
});
test('stopping one preview preserves a distinct owner and its pending test',async()=>{
 const f=fixture();f.runGate=deferred();await Promise.all([f.service.start(user,input()),f.service.start({...user,id:other},input({sessionId:next,requestId:'55555555-5555-4555-8555-555555555555'}))]);for(let n=0;n<20&&f.runs.length<2;n++)await new Promise(resolve=>setImmediate(resolve));await f.service.stop(owner,session);for(let n=0;n<20&&f.rows.get(id).status==='running';n++)await new Promise(resolve=>setImmediate(resolve));assert.equal(f.rows.get(id).status,'cancelled');assert.equal(f.service.activeCount,1);f.runGate.resolve();await settled(f.service);assert.equal(f.rows.get('55555555-5555-4555-8555-555555555555').status,'completed');
});
test('retrying a completed request returns its saved result without another inference',async()=>{
 const f=fixture();await f.service.start(user,input());await settled(f.service);const retry=await f.service.start(user,input());await settled(f.service);assert.equal(retry.existing,true);assert.equal(retry.output_text,'Verified draft reply.');assert.equal(f.runs.length,1);assert.equal(f.rows.size,1);
});
test('restart recovery marks uncertain work interrupted and a new message preserves the old request',async()=>{
 const f=fixture();await f.store.begin(owner,agentDraftPreviewInput(input()));await f.service.recover();assert.equal(f.recovered,true);assert.equal(f.runs.length,0);assert.equal(f.rows.get(id).status,'interrupted');await f.service.start(user,input({requestId:next,text:'A new explicitly submitted test.'}));await settled(f.service);assert.equal(f.runs.length,1);assert.equal(f.runs[0].history.length,2);assert.equal(f.rows.get(id).status,'interrupted');await f.service.close();assert.equal(f.closed,true);await assert.rejects(f.service.start(user,input({requestId:'66666666-6666-4666-8666-666666666666'})),/free execution slot/);
});
test('stopping while execution context is being captured accepts no request and runs no model',async()=>{
 const f=fixture();f.prepareGate=deferred();const starting=f.service.start(user,input());for(let n=0;n<30&&!f.prepareCalls;n++)await new Promise(resolve=>setImmediate(resolve));assert.equal(f.prepareCalls,1);await f.service.stop(owner,session);f.prepareGate.resolve();await assert.rejects(starting,/abort/i);await settled(f.service);assert.equal(f.rows.size,0);assert.equal(f.runs.length,0);
});
test('accepted execution context is immutable and completed retries reuse it without preparing tools again',async()=>{
 const f=fixture();f.prepareContext={version:1,owner,key:'prepared-before-acceptance',options:{permission:'chat'},references:[],roots:[],inputFiles:[{name:'Generated',text:'Original attached facts.'}],definitions:[],policy:{tools:[]}};f.runGate=deferred();const accepted=await f.service.start(user,input());accepted.execution_context.inputFiles[0].text='Changed UI reply';for(let n=0;n<30&&!f.runs.length;n++)await new Promise(resolve=>setImmediate(resolve));assert.equal(f.runs[0].request.execution_context.inputFiles[0].text,'Original attached facts.');f.runGate.resolve();await settled(f.service);f.prepareGate=deferred();const retry=await f.service.start(user,input());await settled(f.service);assert(retry.existing);assert.equal(f.prepareCalls,1);assert.equal(f.runs.length,1);assert.equal(retry.execution_context.inputFiles[0].text,'Original attached facts.');
});

test('a known model without tool support is rejected before request acceptance or inference',async()=>{
 const f=fixture();f.supportsTools=false;f.prepareContext={definitions:[{name:'read_file'}]};await assert.rejects(f.service.start(user,input()),/supports tool calls/);await settled(f.service);assert.equal(f.rows.size,0);assert.equal(f.runs.length,0);
});
test('a completed request retry remains readable when its provider catalog is unavailable',async()=>{
 const f=fixture();await f.service.start(user,input());await settled(f.service);const calls=f.catalogCalls;f.catalogError=Error('Provider disconnected');const saved=await f.service.start(user,input());await settled(f.service);assert(saved.existing);assert.equal(f.catalogCalls,calls);assert.equal(f.runs.length,1);
});
test('targeted source cancellation waits for its running request and leaves another source active',async()=>{
 const f=fixture();f.runGate=deferred();await f.service.start(user,input({sourceAgentId:next}));await f.service.start(user,input({sessionId:other,requestId:'55555555-5555-4555-8555-555555555555',sourceAgentId:session}));for(let n=0;n<30&&f.runs.length<2;n++)await new Promise(resolve=>setImmediate(resolve));await f.service.stopScope({owner,sourceAgentId:next});assert.equal(f.rows.get(id).status,'cancelled');assert.equal(f.service.activeCount,1);f.runGate.resolve();await settled(f.service);assert.equal(f.rows.get('55555555-5555-4555-8555-555555555555').status,'completed');
});
test('explicit inspection holds abandoned running requests without replay and preserves active preparation or native work',async()=>{
 const f=fixture();await f.store.begin(owner,agentDraftPreviewInput(input()));await f.service.inspect(owner,session,()=>true);assert.equal(f.rows.get(id).status,'running');f.runner.executionUsage={requests:[id],other:0};await f.service.inspect(owner,session);assert.equal(f.rows.get(id).status,'running');f.runner.executionUsage={requests:[],other:0};await f.service.inspect(owner,session);assert.equal(f.rows.get(id).status,'interrupted');assert.equal(f.runs.length,0);
});

test('plugin cancellation waits for matching tool-capable sources while leaving Chat only and unrelated previews running',async()=>{const f=fixture();f.runGate=deferred();const choices=[{sessionId:session,requestId:id,sourceAgentId:next,permission:'files'},{sessionId:other,requestId:other,sourceAgentId:next,permission:'chat'},{sessionId:next,requestId:next,sourceAgentId:session,permission:'files'}];for(const choice of choices)await f.service.start(user,input({sessionId:choice.sessionId,requestId:choice.requestId,sourceAgentId:choice.sourceAgentId,snapshot:{...input().snapshot,execution:{permission:choice.permission,mode:'chat',files:[]}}}));for(let n=0;n<30&&f.runs.length<3;n++)await new Promise(resolve=>setImmediate(resolve));await f.service.stopScope({owner,pluginAgentIds:[next]});assert.equal(f.rows.get(id).status,'cancelled');assert.equal(f.rows.get(other).status,'running');assert.equal(f.rows.get(next).status,'running');assert.equal(f.service.activeCount,2);f.runGate.resolve();await settled(f.service);});

test('creation resource changes stop only the matching accepted new-agent preview',async()=>{const f=fixture();f.runGate=deferred();await f.service.start(user,input({creationId:id}));await f.service.start(user,input({creationId:next,sessionId:other,requestId:next}));for(let n=0;n<50&&f.runs.length<2;n++)await new Promise(resolve=>setImmediate(resolve));assert.equal(f.runs.length,2);await f.service.stopScope({owner,creationId:id});assert.equal(f.rows.get(id).status,'cancelled');assert.equal(f.rows.get(next).status,'running');f.runGate.resolve();await settled(f.service);assert.equal(f.rows.get(next).status,'completed');});


test('native preview policy is enabled only by the captured native command capability and unrestricted draft policy',()=>{
 const value=input();value.snapshot.behavior.policy.tools=null;const request={snapshot:value.snapshot,conversation_id:session,created_at:new Date().toISOString()},ceiling={...value.snapshot.behavior.policy,tools:['workspace.read_file','workspace.run_command'],delegation:false,memory:false,memoryWrite:false,maxDepth:0,maxTurns:1};assert.equal(draftPreviewProfile(owner,request,ceiling,true).policy.tools,null);assert.deepEqual(draftPreviewProfile(owner,request,ceiling,false).policy.tools,ceiling.tools);assert.deepEqual(draftPreviewProfile(owner,request,{...ceiling,tools:[]},true).policy.tools,[]);request.snapshot.behavior.policy.tools=['read_file'];assert.deepEqual(draftPreviewProfile(owner,request,ceiling,true).policy.tools,['workspace.read_file']);assert.equal(draftPreviewProfile(owner,{...request,snapshot:{...request.snapshot,behavior:{...request.snapshot.behavior,policy:{...request.snapshot.behavior.policy,tools:null}}}},ceiling,true).policy.delegation,false);
});

test('native preview delegation enables the native registry without granting commands or persistent memory',()=>{
 const value=input();value.snapshot.behavior.policy.tools=null;const request={snapshot:value.snapshot,conversation_id:session,created_at:new Date().toISOString()},ceiling={...value.snapshot.behavior.policy,tools:[],delegation:true,delegateAgents:[],memory:false,memoryWrite:false,maxDepth:1,maxTurns:1},profile=draftPreviewProfile(owner,request,ceiling,false);assert.equal(profile.policy.tools,null);assert.equal(profile.policy.maxDepth,1);assert.equal(profile.policy.memory,false);assert.equal(profile.policy.memoryWrite,false);assert.deepEqual(draftPreviewProfile(owner,request,{...ceiling,maxDepth:0},false).policy.tools,[]);
});

test('an image-incapable preview model refuses saved computer tools before accepting or running a draft',async()=>{
 const f=fixture();f.inputModalities=['text'];f.supportsTools=true;f.prepareContext={definitions:[{name:'computer_windows'}],inputFiles:[]};await assert.rejects(f.service.start(user,input()),/cannot read images/);assert.equal(f.rows.size,0);assert.equal(f.runs.length,0);
});
