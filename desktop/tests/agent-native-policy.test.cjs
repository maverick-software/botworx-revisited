const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {CodexHarness}=require(path.join(process.env.AGENTOPIA_AGENT_TEST_BUILD??path.resolve(__dirname,'../build'),'codex-harness.js'));

test('restricted agent policy cannot approve native shell or patches under Full access',async()=>{
 const harness=new CodexHarness({}, {}, '', '',()=>{},async()=>{});
 const record={owner:'owner',admin:true,options:{permission:'full',mode:'chat'},request:{agent_profile:{policy:{tools:['read_file']}}}};
 for(const method of ['item/commandExecution/requestApproval','item/fileChange/requestApproval']){
  assert.deepEqual(await harness.serverRequest(record,{method,id:1,params:{}},()=>{throw Error('Native operation must not execute');},new AbortController().signal),{decision:'decline'});
 }
});

test('retiring one named agent stops its workers while retaining another agent worker',async()=>{
 const harness=new CodexHarness({}, {}, '', '',()=>{},async()=>{}),stopped=[];
 const own={current:{reject:()=>{}}},other={current:{reject:()=>{}}},foreign={current:{reject:()=>{}}};
 harness.contexts.set('one',{owner:'alice',request:{agent_id:'mira'},worker:own});
 harness.contexts.set('two',{owner:'alice',request:{agent_id:'other'},worker:other});
 harness.contexts.set('three',{owner:'bob',request:{agent_id:'mira'},worker:foreign});
 harness.dispose=async worker=>stopped.push(worker);
 await harness.stopAgent('alice','mira');assert.deepEqual(stopped,[own]);
});
test('requester retirement and goal stops reach dependent named instances while preserving unrelated work',async()=>{
 const harness=new CodexHarness({}, {}, '', '',()=>{},async()=>{}),stopped=[];
 const dependent={children:new Map()},unrelated={children:new Map()},record={owner:'alice',ended:false,rootFinished:false,turnRunning:true,reject:()=>{},options:{},request:{id:'dependent',agent_id:'specialist',agent_authority_chain:[{agent_id:'mira',goal_id:'goal'}]},worker:dependent},other={owner:'alice',ended:false,rootFinished:false,turnRunning:true,reject:()=>{},options:{},request:{id:'unrelated',agent_id:'other'},worker:unrelated};dependent.current=record;unrelated.current=other;
 harness.contexts.set('dependent',record);harness.contexts.set('unrelated',other);harness.dispose=async worker=>stopped.push(worker);
 await harness.stopAgent('alice','mira');assert.deepEqual(stopped,[dependent]);stopped.length=0;await harness.stopGoal('alice','goal');assert.deepEqual(stopped,[dependent]);
});
test('stopping one instance reaches its named descendants and leaves unrelated instances of the same identity running',async()=>{
 const harness=new CodexHarness({}, {}, '', '',()=>{},async()=>{}),stopped=[],dependent={current:{reject:()=>{}}},unrelated={current:{reject:()=>{}}};
 harness.contexts.set('dependent',{owner:'alice',request:{agent_instance_id:'child',agent_authority_chain:[{instance_id:'parent'}]},worker:dependent});harness.contexts.set('unrelated',{owner:'alice',request:{agent_instance_id:'other',agent_authority_chain:[]},worker:unrelated});harness.dispose=async worker=>stopped.push(worker);await harness.stopInstance('alice','parent');assert.deepEqual(stopped,[dependent]);
});
