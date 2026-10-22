const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {AgentQueue}=require(path.join(process.env.AGENTOPIA_AGENT_TEST_BUILD??path.resolve(__dirname,'../build'),'agent-queue.js'));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('named work queues honestly, never duplicates a receipt, and respects actual capacity',async()=>{
 let capacity=false;const started=[],finished=[],release=[];const queue=new AgentQueue(()=>capacity,2);
 const job=id=>({id,owner:'alice',agentId:'mira',run:async()=>{started.push(id);await new Promise(resolve=>release.push(resolve));finished.push(id);},interrupted:async reason=>{throw Error('Unexpected interruption: '+reason);}});
 queue.enqueue(job('one'));queue.enqueue(job('two'));queue.enqueue(job('three'));queue.enqueue(job('one'));await tick();assert.deepEqual(started,[]);assert.equal(queue.size,3);
 capacity=true;queue.notify();await tick();assert.deepEqual(started,['one','two']);release.shift()();await tick();await tick();assert.deepEqual(started,['one','two','three']);assert.deepEqual(finished,['one']);
 release.splice(0).forEach(resolve=>resolve());await tick();await queue.close();assert.equal(queue.size,0);
});
test('queued cancellation and shutdown preserve explicit interruption without launching inference',async()=>{
 const interrupted=[];const queue=new AgentQueue(()=>false);const job=(id,owner)=>({id,owner,agentId:'mira',run:async()=>{throw Error('Must not launch');},interrupted:async reason=>interrupted.push({id,reason})});
 queue.enqueue(job('one','alice'));queue.enqueue(job('two','bob'));assert(await queue.cancelQueued('one'));assert.equal(await queue.cancelQueued('one'),false);await queue.close();assert.deepEqual(interrupted.map(row=>row.id),['one','two']);assert.match(interrupted[1].reason,/closed/);assert.throws(()=>queue.enqueue(job('three','alice')),/closed/);
});
