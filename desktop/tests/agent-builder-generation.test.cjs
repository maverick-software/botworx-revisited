const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{createHash}=require('node:crypto');
const build=process.env.SYLVANA_PREVIEW_BUILD||path.resolve(__dirname,'../build');
const {builderInstructions,legacyBuilderInstructions,legacyBuilderInstructions83,legacyBuilderInstructions85,builderSnapshot,builderProposal,builderGenerationIssues,builderGenerationProposal,applyBuilderProposal,applyStarterGeneration}=require(path.join(build,'agent-builder.js'));
const {agentDraftSnapshot}=require(path.join(build,'agent-draft-preview-contracts.js'));
const basis=()=>({name:'',description:'',instructions:'',behavior:{handle:'new-agent',role:'',sops:'',guardrails:'',skills:[],policy:{tools:null,delegation:true,delegateAgents:null,memory:true,memoryWrite:true,maxDepth:2,maxTurns:10}},appearance:{version:1,icon:'bot',color:'gray',starters:null}});
const instructions='## ROLE\nReview supplied invoices for small business owners.\n\n## INSTRUCTIONS\nRead the supplied records, compare amounts, and report discrepancies with references to the records.\n\n## CONSTRAINTS\nPreserve source facts. Ask for missing records before making an unsupported conclusion.';
const complete=()=>({name:'Invoice Review Assistant',description:'Reviews supplied invoices and explains missing records and amount discrepancies.',instructions,icon:'briefcase',color:'green',starters:[{id:'review',title:'Review invoices',prompt:'Review these supplied invoices and explain any discrepancies with references to the records.'}]});
const output=changes=>JSON.stringify({message:'Updated the agent draft.',changes});

test('new creation contract accepts full purpose-built configuration and preserves account model and execution authority',()=>{
 const captured=basis(),before=structuredClone(captured),proposal=builderGenerationProposal(output(complete()),captured,{creation:true});
 assert.deepEqual(builderGenerationIssues(proposal,captured,{creation:true}),[]);const next=applyBuilderProposal(captured,captured,proposal);
 assert.deepEqual(captured,before);assert.equal(next.name,complete().name);assert.equal(next.description,complete().description);assert.equal(next.instructions,instructions);assert.deepEqual(next.appearance,{version:1,icon:'briefcase',color:'green',starters:complete().starters});assert.deepEqual(next.behavior,captured.behavior);
 const snapshot=agentDraftSnapshot(builderSnapshot(next,'openrouter','owner-chosen-model','high'));
 assert.equal(snapshot.model,'owner-chosen-model');assert.equal(snapshot.provider,'openrouter');assert.equal(snapshot.thinking,'high');assert.deepEqual(snapshot.behavior.policy,{tools:[],delegation:false,delegateAgents:[],memory:false,memoryWrite:false,maxDepth:0,maxTurns:1});assert.deepEqual(snapshot.execution,{permission:'chat',mode:'chat',files:[]});
});
test('every creation field must be supplied even when its old editor value is populated',()=>{
 for(const key of ['name','description','instructions','icon','color','starters']){const changes=complete();delete changes[key];const captured=applyBuilderProposal(basis(),basis(),builderProposal(output(complete())));assert(builderGenerationIssues(output(changes),captured,{creation:true}).some(issue=>issue.includes(key==='starters'?'starters':key)));assert.throws(()=>builderGenerationProposal(output(changes),captured,{creation:true}),/incomplete or invalid/);}
 for(const key of ['name','description','instructions']){const changes=complete();changes[key]=' \n ';assert(builderGenerationIssues(output(changes),basis(),{creation:true}).length>0);}
 for(const starters of [null,[],[{id:'blank',title:' ',prompt:'Prompt'}],[{id:'blank',title:'Title',prompt:' '}],Array.from({length:7},(_,n)=>({id:'id'+n,title:'Title',prompt:'Prompt'}))])assert(builderGenerationIssues(output({...complete(),starters}),basis(),{creation:true}).length>0);
 for(const changes of [{icon:'generated-image'},{color:'cyan'}])assert(builderGenerationIssues(output({...complete(),...changes}),basis(),{creation:true}).length>0);
});
test('generated instructions need uppercase Markdown headings and useful content in each section',()=>{
 for(const title of ['ROLE','INSTRUCTIONS','CONSTRAINTS']){
  const missing=instructions.replace('## '+title,title);assert(builderGenerationIssues(output({...complete(),instructions:missing}),basis(),{creation:true}).some(issue=>issue.includes(title+' heading')));
  const empty='## ROLE\n'+(title==='ROLE'?'':'Role text.')+'\n## INSTRUCTIONS\n'+(title==='INSTRUCTIONS'?'':'Working steps.')+'\n## CONSTRAINTS\n'+(title==='CONSTRAINTS'?'':'Limits.');assert(builderGenerationIssues(output({...complete(),instructions:empty}),basis(),{creation:true}).some(issue=>issue.includes(title+' section')));
 }
 assert(builderGenerationIssues(output({...complete(),instructions:instructions.replace('## ROLE','## Role')}),basis(),{creation:true}).some(issue=>issue.includes('ROLE heading')));
 assert(builderGenerationIssues(output({...complete(),instructions:'```markdown\n'+instructions+'\n```'}),basis(),{creation:true}).some(issue=>issue.includes('ROLE heading')));
 assert.deepEqual(builderGenerationIssues(output({...complete(),instructions:instructions.replaceAll('## ','### ')}),basis(),{creation:true}),[]);
});
test('follow-up edits preserve unrelated text and require sections only when replacing instructions',()=>{
 const captured={...basis(),name:'Existing agent',description:'User description',instructions:'Older instructions without headings'},changes={color:'blue'};
 const proposal=builderGenerationProposal(output(changes),captured,{creation:false}),next=applyBuilderProposal(captured,captured,proposal);
 assert.equal(next.instructions,captured.instructions);assert.equal(next.description,captured.description);assert.equal(next.name,captured.name);assert.equal(next.appearance.color,'blue');assert.deepEqual(next.behavior,captured.behavior);
 assert.throws(()=>builderGenerationProposal(output({instructions:'Changed without headings'}),captured,{creation:false}),/ROLE heading/);
 assert.equal(builderGenerationProposal(output({instructions}),captured,{creation:false}).changes.instructions,instructions);
 assert.deepEqual(builderGenerationProposal(output({}),captured,{creation:false}).changes,{});
});
test('JSONB object ordering preserves full proposal application while actual starter changes remain stale',()=>{
 const jsonb=value=>Array.isArray(value)?value.map(jsonb):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort((a,b)=>a.length-b.length||a.localeCompare(b)).map(key=>[key,jsonb(value[key])])):value;
 const current={...basis(),name:'Existing',description:'Existing description',instructions:'Existing instructions',resources:{revision:2,apps:[{id:'records',name:'Records',description:'Read supplied records.',enabled:true,configured:true,assigned:false}],skills:[{id:'invoice-skill',name:'Invoice skill',description:'Compare invoice records.',digest:'a'.repeat(64),enabled:true,configured:true,assigned:false}]}};
 current.appearance.starters=[{prompt:'Use the existing supplied records.',title:'Old review',id:'old-review'}];
 const captured=jsonb(current),before=structuredClone(current),changes={...complete(),handle:'invoice-review',apps:['records'],assignedSkills:['invoice-skill']};
 assert.notEqual(JSON.stringify(captured),JSON.stringify(current));
 assert.deepEqual(applyStarterGeneration(current,captured,output({starters:complete().starters})).appearance.starters,complete().starters);
 const proposal=builderGenerationProposal(output(changes),captured,{creation:true}),next=applyBuilderProposal(current,captured,proposal);
 assert.equal(next.name,changes.name);assert.equal(next.description,changes.description);assert.equal(next.instructions,changes.instructions);assert.equal(next.behavior.handle,changes.handle);assert.equal(next.appearance.icon,changes.icon);assert.equal(next.appearance.color,changes.color);assert.deepEqual(next.appearance.starters,changes.starters);assert(next.resources.apps[0].assigned);assert(next.resources.skills[0].assigned);assert.deepEqual(current,before);
 const edited=structuredClone(current);edited.appearance.starters[0].prompt='A genuine manual change.';assert.throws(()=>applyBuilderProposal(edited,captured,proposal),/starters field changed/);
});
test('generation reports parse and authority errors for one correction while legacy parsing remains unchanged',()=>{
 for(const reply of ['Plain answer','{}',output({policy:{tools:null}}),output({provider:'openrouter'}),output({model:'other'}),output({skills:[]}),output({apps:['invented']})]){const issues=builderGenerationIssues(reply,basis(),{creation:true});assert(issues.length);assert(issues.every(issue=>typeof issue==='string'&&issue.trim()));}
 assert.deepEqual(builderProposal(output({})).changes,{});assert.equal(builderProposal(output({instructions:'Retained older reply'})).changes.instructions,'Retained older reply');
 assert.equal(builderProposal(output({role:'Old role'}),{legacy:true}).changes.role,'Old role');
});
test('all historical builder texts remain byte exact and saved snapshots retain their original instructions',()=>{
 for(const [instructions,sha]of [[legacyBuilderInstructions,'ecb65c8c9490241ae900665362f08e993a27e8ae8a7477869b19003783c42f07'],[legacyBuilderInstructions83,'c82c00bc3b54fa00330f79acc39568b3c289403a75174251b70f8ad553816089'],[legacyBuilderInstructions85,'ee830ec92914b3cb9ad33d0b7d563d4345d8cdd7fb35b83d4c628212ed86d45e']]){
  assert.equal(createHash('sha256').update(instructions).digest('hex'),sha);const snapshot={...builderSnapshot(basis(),'openai-oauth','original-model'),instructions};assert.deepEqual(agentDraftSnapshot(snapshot),snapshot);
 }
 for(const title of ['## ROLE','## INSTRUCTIONS','## CONSTRAINTS'])assert(builderInstructions.includes(title));
 assert(builderInstructions.includes('applied directly to the unsaved editor'));assert(builderInstructions.includes('existing Save/Create control commits'));assert(!builderInstructions.includes('User reviews changes and applies'));
});
