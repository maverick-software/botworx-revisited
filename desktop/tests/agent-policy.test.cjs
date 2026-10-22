const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const build=process.env.AGENTOPIA_AGENT_TEST_BUILD??path.resolve(__dirname,'../build');
const {agentPolicy,profileInput,defaultAgentPolicy}=require(path.join(build,'agent-contracts.js'));
const {allowsAgentTool,intersectAgentPolicies,agentInstructions}=require(path.join(build,'agent-policy.js'));

test('agent policy denies disabled memory/delegation and matches exact tool names',()=>{
 const policy=agentPolicy({...defaultAgentPolicy,tools:['tools.read_agent_memory','read_file'],delegation:false,memoryWrite:false});
 assert(allowsAgentTool(policy,{name:'read_file',namespace:'workspace'}));
 assert(allowsAgentTool(policy,{name:'read_agent_memory',namespace:'tools'}));
 for(const name of ['read_file_extra','write_file','save_agent_memory','invoke_agent'])assert.equal(allowsAgentTool(policy,{name,namespace:'tools'}),false);
 assert.equal(allowsAgentTool({...policy,memory:false},{name:'read_agent_memory',namespace:'tools'}),false);
 assert.throws(()=>agentPolicy({...defaultAgentPolicy,tools:['tools.*']}),/exact tool/);
 assert.throws(()=>agentPolicy({...defaultAgentPolicy,maxDepth:-1}),/whole number/);
 assert.throws(()=>agentPolicy({...defaultAgentPolicy,maxTurns:1.5}),/whole number/);
 assert.throws(()=>agentPolicy({...defaultAgentPolicy,delegation:'true'}),/enabled/);
});

test('delegated policy cannot broaden caller permissions, budgets, or permitted agents',()=>{
 const caller={...defaultAgentPolicy,tools:['read_file'],delegateAgents:['a','b'],maxDepth:1,maxTurns:3,memoryWrite:false};
 const result=intersectAgentPolicies({...defaultAgentPolicy,tools:['read_file','write_file'],delegateAgents:['b','c']},caller);
 assert.deepEqual(result.tools,['read_file']);assert.deepEqual(result.delegateAgents,['b']);assert.equal(result.maxDepth,1);assert.equal(result.maxTurns,3);assert.equal(result.memoryWrite,false);
 assert.deepEqual(intersectAgentPolicies(defaultAgentPolicy,caller),caller);
 result.tools.push('another');assert.deepEqual(caller.tools,['read_file']);
 assert.deepEqual(intersectAgentPolicies({...defaultAgentPolicy,tools:['workspace.read_file']},caller).tools,['workspace.read_file']);
 assert.deepEqual(intersectAgentPolicies({...defaultAgentPolicy,tools:['tools.read_file']},{...caller,tools:['workspace.read_file']}).tools,[]);
});

test('agent profile validates durable handles, distinct skills, and expected revision',()=>{
 const skill={id:'8a87d659-b529-4448-91e7-86bdd7045870',name:'Research',description:'Verify sources',content:'Read the primary source before reporting a claim.'};
 const input={handle:'Mira',role:'Researcher',sops:'Verify conclusions',guardrails:'Ask when evidence conflicts',skills:[skill],policy:defaultAgentPolicy,revision:1};
 assert.equal(profileInput(input).handle,'mira');assert.equal(profileInput(input).skills[0].content,skill.content);
 assert.throws(()=>profileInput({...input,skills:[skill,skill]}),/distinct/);
 assert.throws(()=>profileInput({...input,handle:'two words'}),/handle/);
 assert.throws(()=>profileInput({...input,revision:0}),/whole number/);
 const instructions=agentInstructions({...profileInput(input),agent_id:'agent',definition:{name:'Mira'},revision:4});
 assert(instructions.includes('Mira (@mira)'));assert(instructions.includes('revision 4'));assert(instructions.includes(skill.content));
});
