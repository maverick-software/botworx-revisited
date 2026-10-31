const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const build=process.env.SYLVANA_PREVIEW_BUILD||path.resolve(__dirname,'../build');
const {builderConfiguration,builderProposal,builderSnapshot,applyBuilderProposal}=require(path.join(build,'agent-builder.js'));
const {agentDraftSnapshot}=require(path.join(build,'agent-draft-preview-contracts.js'));
const {previewEditorScope,editorDraftPayload}=require(path.join(build,'agent-editor-draft-contracts.js'));
const {AgentEditorDrafts}=require(path.join(build,'agent-editor-drafts.js'));
const owner='11111111-1111-4111-8111-111111111111',source='22222222-2222-4222-8222-222222222222',session='33333333-3333-4333-8333-333333333333',write='44444444-4444-4444-8444-444444444444';
const config=()=>({name:'Generated builder test',description:'Retain café — 東京 🟣',instructions:'Keep original instructions.',behavior:{handle:'builder-test',role:'Reviewer',sops:'Read the source.',guardrails:'Preserve source facts.',skills:[],policy:{tools:null,delegation:true,delegateAgents:null,memory:true,memoryWrite:true,maxDepth:2,maxTurns:10}},appearance:{version:1,icon:'bot',color:'violet',starters:null}});
const proposal=changes=>builderProposal(JSON.stringify({message:'Proposed changes.',changes}));

test('builder preserves full passive configuration, unfinished starters and long instruction text',()=>{
 const value=config();value.instructions='x'.repeat(100000);value.behavior.sops='s'.repeat(50000);value.appearance.starters=[{id:'unfinished',title:'',prompt:''}];
 const snapshot=agentDraftSnapshot(builderSnapshot(value,'openai-oauth','generated-model'));
 assert.deepEqual(snapshot.builder,value);assert.equal(snapshot.behavior.policy.tools.length,0);assert.equal(snapshot.behavior.policy.memory,false);assert.equal(snapshot.behavior.policy.delegation,false);assert.equal(snapshot.execution.permission,'chat');assert.equal(snapshot.builder.instructions.length,100000);
});
test('builder snapshot rejects changed instructions, permissions, tools and delegated access',()=>{
 for(const change of [s=>s.instructions='Run target instructions',s=>s.behavior.policy.tools=null,s=>s.behavior.policy.delegation=true,s=>s.execution.permission='full',s=>s.execution.files=[source],s=>s.execution.skills=['anything']]){const snapshot=builderSnapshot(config(),'openrouter','generated-model');change(snapshot);assert.throws(()=>agentDraftSnapshot(snapshot),/builder/);}
});
test('proposal validation rejects permission, connection, provider and prototype fields before application',()=>{
 for(const changes of [{policy:{}},{provider:'openrouter'},{connectionId:source},{model:'new-model'},JSON.parse('{"__proto__":{"tools":null}}'),{instructions:'bad\0text'},{name:''},{starters:[{id:'same',title:'one',prompt:'one'},{id:'same',title:'two',prompt:'two'}]}])assert.throws(()=>proposal(changes));
});
test('proposal applies all supported fields while preserving policy and unrelated manual edits',()=>{
 const basis=config(),current=config();current.description='New manual description';
 const change=proposal({name:'Invoice specialist',instructions:'Keep café — 東京 🟣',handle:'invoice-specialist',icon:'briefcase',color:'green',starters:[{id:'review',title:'Review invoices',prompt:'Review my supplied invoice records.'}]});
 const next=applyBuilderProposal(current,basis,change);assert.equal(next.description,current.description);assert.equal(next.name,'Invoice specialist');assert.deepEqual(next.behavior.skills,current.behavior.skills);assert.deepEqual(next.behavior.policy,current.behavior.policy);assert.equal(next.appearance.starters[0].title,'Review invoices');assert.equal(current.name,basis.name);
});
test('a changed proposed field refuses the complete application without altering either draft',()=>{
 const basis=config(),current=config();current.instructions='New manual instructions';const original=structuredClone(current);
 assert.throws(()=>applyBuilderProposal(current,basis,proposal({name:'Should not apply',instructions:'Stale replacement'})),/instructions field changed/);assert.deepEqual(current,original);
});
test('clarification and non-JSON output remain distinguishable from actionable edits',()=>{
 assert.deepEqual(proposal({}).changes,{});assert.throws(()=>builderProposal('Which audience should this agent serve?'),/no structured changes/);assert.equal(builderProposal('```json\n{"message":"Question","changes":{}}\n```').message,'Question');
});
test('builder and preview locations persist independently for both new and saved agents',async()=>{
 const records=new Map(),store={get:k=>records.get(k),set:async(k,v)=>records.set(k,structuredClone(v))},drafts=new AgentEditorDrafts(store);
 for(const creation of [false,true]){const scope=previewEditorScope(creation?null:source,creation?source:undefined,'builder'),preview=previewEditorScope(creation?null:source,creation?source:undefined),payload=JSON.stringify({version:creation?2:1,owner,source:creation?null:source,...(creation?{creationId:source}:{}),sessionId:session,prompt:'Keep my unsent request',thinking:'default',execution:{permission:'chat',mode:'chat',files:[]},pending:null});
  assert.notEqual(scope,preview);assert.equal(editorDraftPayload(owner,scope,payload),payload);await drafts.write(owner,{scope,expectedRevision:0,writeId:write,payload},async()=>{});assert.equal((await drafts.read(owner,scope)).payload,payload);assert.equal(await drafts.read(owner,preview),null);assert.throws(()=>editorDraftPayload(source,scope,payload),/another account/);
 }
});
test('retained builder pending request keeps the original full configuration and current source',()=>{
 const scope=previewEditorScope(null,source,'builder'),pending={sessionId:session,requestId:write,sourceAgentId:null,creationId:source,text:'Improve this agent',snapshot:builderSnapshot(config(),'openai-oauth','generated-model')},envelope={version:2,owner,source:null,creationId:source,sessionId:session,prompt:'Improve this agent',thinking:'default',execution:{permission:'chat',mode:'chat',files:[]},pending};
 assert.equal(editorDraftPayload(owner,scope,JSON.stringify(envelope)),JSON.stringify(envelope));envelope.pending.creationId=write;assert.throws(()=>editorDraftPayload(owner,scope,JSON.stringify(envelope)),/changed scope/);
});
