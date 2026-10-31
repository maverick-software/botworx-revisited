const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const build=process.env.SYLVANA_PREVIEW_BUILD||path.resolve(__dirname,'../build');
const {normalizeAgentInstructions,legacyAgentInstructions,agentInstructionsLimit}=require(path.join(build,'agent-unified-instructions.js'));
const {agentInstructions}=require(path.join(build,'agent-policy.js'));
const {agentDraftSnapshot}=require(path.join(build,'agent-draft-preview-contracts.js'));
const {builderSnapshot,legacyBuilderInstructions,builderProposal,starterGenerationProposal,applyStarterGeneration,starterGenerationRequest}=require(path.join(build,'agent-builder.js'));
const {CodexDraftPreview}=require(path.join(build,'codex-draft-preview.js'));
const owner='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222';
const policy={tools:['read_file'],delegation:false,delegateAgents:[],memory:true,memoryWrite:false,maxDepth:0,maxTurns:1};
const behavior=()=>({handle:'legacy-agent',role:'  Rôle 東京\n',sops:'\nFirst.\n\nSecond.  ',guardrails:' Keep the seal. ',skills:[{id,name:'技能  ',description:' Description\n',content:'\nOriginal content.  '}],policy:structuredClone(policy)});
const config=()=>({name:'Invoice agent',description:'Reviews supplied invoices.',instructions:'Preserve supplied facts.',behavior:{...behavior(),role:'',sops:'',guardrails:'',skills:[]},appearance:{version:1,icon:'briefcase',color:'blue',starters:null}});
const output=()=>JSON.stringify({message:'Generated from your invoice instructions.',changes:{starters:[{id:'invoice-check',title:'Review an invoice',prompt:'Review my supplied invoice and explain any differences in totals.'}]}});
test('legacy instruction conversion keeps every byte and original ordering, handle and policy, without mutating recovery data',()=>{
 const raw=behavior(),saved=structuredClone(raw),base='  Original instructions.\n';
 const expected='Your role: '+raw.role+'\n\nStandard operating procedures:\n'+raw.sops+'\n\nAgent guardrails:\n'+raw.guardrails+'\n\nAssigned persistent skills (owner-configured procedures; they never grant extra permissions):\nSkill: '+raw.skills[0].name+'\n'+raw.skills[0].description+'\n'+raw.skills[0].content;
 assert.equal(legacyAgentInstructions(raw),expected);const next=normalizeAgentInstructions(base,raw);assert.equal(next.instructions,base+'\n\n'+expected);assert.deepEqual(raw,saved);assert.equal(next.behavior.handle,raw.handle);assert.deepEqual(next.behavior.policy,policy);assert.equal(next.behavior.role,'');assert.deepEqual(next.behavior.skills,[]);assert.equal(next.legacy,true);
 const reopened=normalizeAgentInstructions(next.instructions,next.behavior);assert.equal(reopened.instructions,next.instructions);assert.equal(reopened.legacy,false);
 const before=agentInstructions({...raw,definition:{name:'Legacy'},revision:3,agent_id:id});assert(before.includes(expected));assert(before.indexOf('Your persistent')<before.indexOf(expected));
});
test('largest previously valid combined guidance remains fully editable and executable after conversion',()=>{
 const raw=behavior();raw.role='r'.repeat(1000);raw.sops='s'.repeat(50000);raw.guardrails='g'.repeat(20000);raw.skills=Array.from({length:30},(_,n)=>({id:`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,name:'n'.repeat(100),description:'d'.repeat(1000),content:'c'.repeat(n<4?50000:0)}));
 // Give every skill a nonblank valid content while respecting the old aggregate bound.
 raw.skills[0].content='c'.repeat(49974);for(let n=4;n<30;n++)raw.skills[n].content='x';
 const converted=normalizeAgentInstructions('i'.repeat(100000),raw);assert(converted.instructions.length>370000);assert(converted.instructions.length<agentInstructionsLimit);assert.equal(converted.instructions.split('Standard operating procedures:').length,2);
 const snapshot={name:'Largest legacy',description:'',instructions:converted.instructions,personality:'',provider:'openai-oauth',model:'selected-model',thinking:'default',behavior:converted.behavior};assert.equal(agentDraftSnapshot(snapshot).instructions,converted.instructions);
 assert.equal(agentDraftSnapshot(builderSnapshot({...config(),instructions:converted.instructions},'openai-oauth','selected-model')).builder.instructions,converted.instructions);
 assert.throws(()=>agentDraftSnapshot({...snapshot,instructions:'x'.repeat(agentInstructionsLimit+1)}),/length limit/);
});
test('old accepted builder snapshots retain their exact text while new proposals use only Instructions',()=>{
 const snapshot=builderSnapshot(config(),'openrouter','saved-model','high');snapshot.instructions=legacyBuilderInstructions;assert.deepEqual(agentDraftSnapshot(snapshot),snapshot);
 const old=JSON.stringify({message:'Old retained proposal',changes:{role:'Original role'}});assert.equal(builderProposal(old,{legacy:true}).changes.role,'Original role');assert.throws(()=>builderProposal(old),/Instructions/);
});
test('starter validation accepts actual editable prompts, rejects authority changes and never fabricates fallback output',()=>{
 const basis=config(),generated=applyStarterGeneration(config(),basis,output());assert.equal(generated.appearance.starters[0].title,'Review an invoice');assert.deepEqual(generated.behavior,basis.behavior);assert.equal(generated.instructions,basis.instructions);
 for(const value of ['plain text','{}',JSON.stringify({message:'No output',changes:{}}),JSON.stringify({message:'Defaults',changes:{starters:null}}),JSON.stringify({message:'Wrong scope',changes:{starters:[],instructions:'Changed'}}),JSON.stringify({message:'Authority',changes:{policy:{tools:null}}}),JSON.stringify({message:'Too many',changes:{starters:Array.from({length:7},(_,n)=>({id:'id'+n,title:'Title',prompt:'Prompt'}))}})])assert.throws(()=>starterGenerationProposal(value));
 for(const change of [c=>c.instructions='Later instructions',c=>c.behavior.policy.memory=false,c=>c.appearance.starters=[]]){const current=config();change(current);assert.throws(()=>applyStarterGeneration(current,basis,output()),/draft changed/);}
});
test('starter generation runs the existing preview executor with selected provider/model, no tools or saved-agent writes',async()=>{
 let state=null,received;const db={from(table){assert.equal(table,'desktop_preview_codex_turns');return {select(){return this;},eq(){return this;},async single(){return {data:{state},error:null};}};}};
 const executor=new CodexDraftPreview(db,{},'F:/Sylvana-Consolidation/runtime/.supabase/preview-test','',()=>{},async()=>{});
 executor.native.run=async(user,request,agent,provider,model,options,refs,history,definitions,execute,controller,validate)=>{await validate();received={user,request,agent,provider,model,options,refs,definitions};assert.equal(provider,'openrouter');assert.equal(model,'owner-selected-model');assert.equal(options.permission,'chat');assert.deepEqual(definitions,[]);assert.deepEqual(refs,[]);assert.equal(user.admin,false);await assert.rejects(execute('write_file',{},'call',controller.signal),/unavailable/);state={threadId:'mock-model-thread',items:[{threadId:'mock-model-thread',item:{type:'agentMessage',text:output()}}]};};
 const snapshot=agentDraftSnapshot(builderSnapshot(config(),'openrouter','owner-selected-model')),request={id,user_id:owner,conversation_id:id,snapshot,input_text:starterGenerationRequest,created_at:'2026-10-26T00:00:00Z',status:'running',output_text:'',error:null},signal=new AbortController().signal;
 const actual=await executor.run({id:owner,admin:true},request,[],signal,async()=>{});assert.equal(actual,output());assert.equal(starterGenerationProposal(actual).changes.starters.length,1);assert(received.agent.system_instructions.includes('Reviews supplied invoices.'));assert.equal(received.request.agent_profile.policy.delegation,false);assert.equal(received.request.agent_profile.policy.memory,false);assert.deepEqual(received.request.agent_profile.policy.tools,[]);
 const cancelled=new AbortController();cancelled.abort();await assert.rejects(executor.run({id:owner,admin:true},request,[],cancelled.signal,async()=>{}),/abort/i);
 await assert.rejects(executor.run({id:owner,admin:true},request,[],signal,async()=>{throw Error('Account or source revoked.');}),/revoked/);
});
