const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{createHash}=require('node:crypto'),{readFileSync}=require('node:fs');
const build=process.env.SYLVANA_PREVIEW_BUILD||path.resolve(__dirname,'../build');
const {builderConfiguration,builderProposal,builderSnapshot,applyBuilderProposal,builderValue,builderInstructions,legacyBuilderInstructions,legacyBuilderInstructions83}=require(path.join(build,'agent-builder.js'));
const {builderResources,builderResourceSelection}=require(path.join(build,'agent-builder-resources.js'));
const {agentDraftSnapshot}=require(path.join(build,'agent-draft-preview-contracts.js'));
const {editorDraftPayload}=require(path.join(build,'agent-editor-draft-contracts.js'));
const resource=(id,assigned=false)=>({id,name:'Catalog '+id,description:'Public description café 東京.',enabled:true,configured:true,assigned});
const config=()=>({name:'Reader',description:'Retain description',instructions:'Retain facts',behavior:{handle:'reader',role:'',sops:'',guardrails:'',skills:[],policy:{tools:['read_file'],delegation:true,delegateAgents:null,memory:true,memoryWrite:false,maxDepth:2,maxTurns:10}},appearance:{version:1,icon:'bot',color:'blue',starters:null},resources:{revision:7,apps:[resource('existing',true),resource('new-app')],skills:[{...resource('11111111-1111-4111-8111-111111111111'),digest:'a'.repeat(64)}]}});
const proposal=changes=>builderProposal(JSON.stringify({message:'Proposed configuration.',changes}));

test('bounded public resources survive canonical snapshot while selected model and chat-only authority remain exact',()=>{
 const value=config(),snapshot=agentDraftSnapshot(builderSnapshot(value,'openrouter','owner-selected','high'));
 assert.deepEqual(snapshot.builder,value);assert.equal(snapshot.provider,'openrouter');assert.equal(snapshot.model,'owner-selected');assert.equal(snapshot.thinking,'high');
 assert.deepEqual(snapshot.behavior.policy,{tools:[],delegation:false,delegateAgents:[],memory:false,memoryWrite:false,maxDepth:0,maxTurns:1});assert.deepEqual(snapshot.execution,{permission:'chat',mode:'chat',files:[]});
 assert.deepEqual(builderValue(value,'apps'),['existing']);assert.deepEqual(builderResourceSelection(value.resources,'skills'),[]);
});
test('catalog parser rejects unsupported credentials, URLs, invalid text, identifiers, flags, revisions and duplicate or excessive entries',()=>{
 for(const mutate of [r=>r.token='secret',r=>r.apps[0].url='https://example.com',r=>r.apps[0].id='https://example.com',r=>r.apps[0].id='../foreign',r=>r.apps[0].name='',r=>r.apps[0].description='x'.repeat(1001),r=>r.apps[0].description='bad\0text',r=>r.apps[0].enabled='true',r=>r.apps[0].digest='invalid',r=>r.apps.push(r.apps[0]),r=>r.revision=0,r=>r.revision=Number.MAX_SAFE_INTEGER+1,r=>delete r.revision,r=>r.skills=Array.from({length:499},(_,n)=>resource('skill'+n))]){const r=config().resources;mutate(r);assert.throws(()=>builderResources(r));}
 const r=config().resources;r.revision=null;assert.equal(builderResources(r).revision,null);
});
test('core and complete resource proposals apply deterministically, preserve unrelated edits and never modify source policy or catalogs',()=>{
 const basis=config(),current=config(),before=structuredClone(current);current.description='Manually improved description';
 const desired={name:'Invoice specialist',instructions:'Read supplied invoices and report exact totals.',icon:'briefcase',color:'green',starters:[{id:'review',title:'Review invoices',prompt:'Review my supplied invoice.'}],apps:['new-app','existing'],assignedSkills:[basis.resources.skills[0].id]};
 const next=applyBuilderProposal(current,basis,proposal(desired));assert.equal(next.name,desired.name);assert.equal(next.description,current.description);assert.deepEqual(next.behavior,current.behavior);assert.deepEqual(builderValue(next,'apps'),['existing','new-app']);assert.deepEqual(builderValue(next,'assignedSkills'),desired.assignedSkills);assert.deepEqual(current.resources,before.resources);
 assert.deepEqual(applyBuilderProposal(current,basis,proposal({...desired,apps:['existing','new-app']})),next);
});
test('foreign, fabricated, unavailable and duplicate desired IDs refuse the entire proposal before any mutation',()=>{
 for(const changes of [{apps:['foreign-account-app']},{assignedSkills:['22222222-2222-4222-8222-222222222222']},{apps:['new-app','new-app']},{apps:['https://example.com']}]){const basis=config(),before=structuredClone(basis);assert.throws(()=>applyBuilderProposal(basis,basis,proposal({name:'Cannot partly apply',...changes})));assert.deepEqual(basis,before);}
 for(const flag of ['enabled','configured']){const basis=config();basis.resources.apps[1][flag]=false;assert.throws(()=>applyBuilderProposal(basis,basis,proposal({apps:['existing','new-app']})),/unavailable/);}
 const old=config();delete old.resources;assert.throws(()=>applyBuilderProposal(old,old,proposal({apps:[]})),/Reload/);
});
test('unavailable existing assignments can be retained or removed while unavailable additions remain rejected',()=>{
 const basis=config();basis.resources.apps[0].enabled=false;basis.resources.apps[0].configured=false;
 assert.deepEqual(builderValue(applyBuilderProposal(basis,basis,proposal({apps:['existing','new-app']})),'apps'),['existing','new-app']);
 assert.deepEqual(builderValue(applyBuilderProposal(basis,basis,proposal({apps:[]})),'apps'),[]);
});
test('catalog revision, availability, content digest and manual selected inventory changes stale resource proposals; unrelated core proposals still work',()=>{
 for(const mutate of [c=>c.resources.revision++,c=>c.resources.apps[1].enabled=false,c=>c.resources.skills[0].digest='b'.repeat(64),c=>c.resources.apps[1].assigned=true,c=>c.resources.apps.push(resource('later-app'))]){
  const basis=config(),current=config();mutate(current);const before=structuredClone(current);
  assert.throws(()=>applyBuilderProposal(current,basis,proposal({name:'Must not partly apply',apps:['existing','new-app']})),/catalog changed/);assert.deepEqual(current,before);
  assert.equal(applyBuilderProposal(current,basis,proposal({name:'Core edit'})).name,'Core edit');
 }
 const basis=config(),current=config();current.resources.apps.reverse();assert.deepEqual(builderValue(applyBuilderProposal(current,basis,proposal({apps:['new-app']})),'apps'),['new-app']);
});
test('legacy builder texts remain immutable and accepted exactly with original optional-resource-free configuration',()=>{
 for(const [instructions,sha]of [[legacyBuilderInstructions,'ecb65c8c9490241ae900665362f08e993a27e8ae8a7477869b19003783c42f07'],[legacyBuilderInstructions83,'c82c00bc3b54fa00330f79acc39568b3c289403a75174251b70f8ad553816089']]){
  assert.equal(createHash('sha256').update(instructions).digest('hex'),sha);const value=config();delete value.resources;const captured={...builderSnapshot(value,'openai-oauth','historical-model'),instructions};assert.deepEqual(agentDraftSnapshot(captured),captured);assert.deepEqual(builderConfiguration(value),value);
 }
 assert(builderInstructions.includes('complete purpose-built configuration'));assert(builderInstructions.includes('assignedSkills'));assert(builderInstructions.includes('persist immediately'));
});
test('resource proposals cannot change model, provider, permissions or legacy inline skills',()=>{
 for(const changes of [{provider:'openrouter'},{model:'fabricated'},{resources:{}},{policy:{tools:null}},{skills:[]},{connectionIds:[]},{execution:{permission:'full'}}])assert.throws(()=>proposal(changes));
});
test('optional handled receipts preserve old journal bytes and require bounded canonical identifiers in the builder location',()=>{
 const owner='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222',envelope={version:1,owner,source:null,sessionId:id,prompt:'Retained composer',thinking:'default',execution:{permission:'chat',mode:'chat',files:[]},pending:null};
 for(const extra of [{},{builderAppliedIds:[id]}]){const raw=JSON.stringify({...envelope,...extra});assert.equal(editorDraftPayload(owner,'builder:new',raw),raw);}
 for(const ids of [[id,id],['foreign-id'],[id.toUpperCase()+'A'],Array(1001).fill(id)])assert.throws(()=>editorDraftPayload(owner,'builder:new',JSON.stringify({...envelope,builderAppliedIds:ids})));
 assert.throws(()=>editorDraftPayload(owner,'preview:new',JSON.stringify({...envelope,builderAppliedIds:[id]})),/Unsupported/);
});
test('SQL90 replaces exactly two pinned passive checks and leaves historical preview checks intact',()=>{
 const root=path.resolve(__dirname,'../..'),old=readFileSync(path.join(root,'desktop/database/0083-agent-builder-context.sql'),'utf8'),migration=readFileSync(path.join(root,'desktop/database/0090-agent-builder-resources.sql'),'utf8');
 const needles=[...migration.matchAll(/needle='((?:[^']|'')*)';/g)].map(match=>match[1].replaceAll("''","'"));assert.equal(needles.length,2);
 for(const needle of needles)assert.equal(old.split(needle).length-1,1);
 const changed=old.replace(needles[0],needles[0].replace("'appearance']","'appearance','resources']")).replace(needles[1],"  IF reference ? 'resources' THEN PERFORM public.desktop_validate_builder_resources(reference->'resources'); END IF;\n"+needles[1]);
 const restored=changed.replace("'appearance','resources']","'appearance']").replace("  IF reference ? 'resources' THEN PERFORM public.desktop_validate_builder_resources(reference->'resources'); END IF;\n",'');assert.equal(restored,old);
 assert(migration.includes("jsonb_array_length(p_resources->'apps')+jsonb_array_length(p_resources->'skills')>500"));assert(!migration.includes('p_text'));assert(!migration.includes('UPDATE '));
});
