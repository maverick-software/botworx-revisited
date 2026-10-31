const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {AgentReportQueue}=require(path.join(process.env.SYLVANA_AGENT_REPORT_BUILD??path.resolve(__dirname,'../build'),'agent-report-queue.js'));
const {AgentReportDeferred,AgentReportNotSubmitted}=require(path.join(process.env.SYLVANA_AGENT_REPORT_BUILD??path.resolve(__dirname,'../build'),'agent-report-queue.js'));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const source=(changes={})=>({childRequestId:randomUUID(),childInstanceId:randomUUID(),parentRequestId:randomUUID(),parentConversationId:randomUUID(),...changes});
function fixture({available=false,launch,parallel=2}={}){
 const owner=randomUUID(),values=new Map(),calls=[],events=[];let permitted=available,failWrite=()=>false;
 const store={get:key=>structuredClone(values.get(key)),set:async(key,value)=>{if(failWrite(value))throw Error('Generated storage outage');values.set(key,structuredClone(value));}};
 const queue=new AgentReportQueue(store,()=>permitted,async(user,rows,id,signal)=>{calls.push({user,rows,id,signal});for(const row of rows){const saved=queue.list(user).find(saved=>saved.childRequestId===row.childRequestId);assert.equal(saved.status,'running');assert.equal(saved.attemptId,id);assert.equal(saved.dispatchStarted,true);}await launch?.(user,rows,id,signal);},(user,conversation)=>events.push({user,conversation}),parallel);
 return {owner,values,calls,events,queue,store,allow(){permitted=true;queue.pump(owner);},block(){permitted=false;},fail(fn){failWrite=fn;}};
}
test('a background completion reports once with its persisted attempt and immutable parent binding',async()=>{
 const f=fixture(),row=source();await f.queue.watch(f.owner,row);await f.queue.watch(f.owner,row);await f.queue.ready(f.owner,row.childRequestId);assert.equal(f.calls.length,0);f.allow();await tick();await f.queue.settled();assert.equal(f.calls.length,1);assert.equal(f.calls[0].user,f.owner);assert.deepEqual(f.calls[0].rows.map(({childRequestId,parentRequestId})=>({childRequestId,parentRequestId})),[{childRequestId:row.childRequestId,parentRequestId:row.parentRequestId}]);assert.equal(f.queue.list(f.owner)[0].status,'delivered');await f.queue.ready(f.owner,row.childRequestId);await f.queue.watch(f.owner,row);f.queue.pump(f.owner);await tick();assert.equal(f.calls.length,1);await f.queue.close();
});
test('duplicate completion events during dispatch do not start another parent turn',async()=>{
 let release;const f=fixture({available:true,launch:()=>new Promise(resolve=>release=resolve)}),row=source();await f.queue.watch(f.owner,row);await f.queue.ready(f.owner,row.childRequestId);await tick();await Promise.all(Array.from({length:12},()=>f.queue.ready(f.owner,row.childRequestId)));assert.equal(f.calls.length,1);release();await f.queue.settled();assert.equal(f.queue.list(f.owner)[0].status,'delivered');await f.queue.close();
});
test('simultaneous children of the same parent are combined without crossing parent requests',async()=>{
 const f=fixture(),first=source(),second=source({parentRequestId:first.parentRequestId,parentConversationId:first.parentConversationId}),other=source({parentConversationId:first.parentConversationId});for(const row of [first,second,other]){await f.queue.watch(f.owner,row);await f.queue.ready(f.owner,row.childRequestId);}f.allow();await tick();await f.queue.settled();await tick();await f.queue.settled();assert.equal(f.calls.length,2);assert.equal(f.calls[0].rows.length,2);assert.equal(f.calls[1].rows.length,1);assert.equal(new Set(f.calls.flatMap(call=>call.rows.map(row=>row.childRequestId))).size,3);for(const call of f.calls)assert.equal(new Set(call.rows.map(row=>row.parentRequestId)).size,1);await f.queue.close();
});
test('queued human work keeps specialist reports pending until the host allows continuation',async()=>{
 const f=fixture(),row=source();await f.queue.watch(f.owner,row);await f.queue.ready(f.owner,row.childRequestId);for(let i=0;i<4;i++){f.queue.pump(f.owner);await tick();}assert.equal(f.calls.length,0);assert.equal(f.queue.list(f.owner)[0].status,'ready');f.allow();await tick();await f.queue.settled();assert.equal(f.calls.length,1);await f.queue.close();
});
test('a manually read completed result is acknowledged and produces no redundant continuation',async()=>{
 const f=fixture(),row=source();await f.queue.watch(f.owner,row);await f.queue.ready(f.owner,row.childRequestId);await f.queue.acknowledge(f.owner,row.parentRequestId,row.childInstanceId);f.allow();await tick();assert.equal(f.calls.length,0);assert.equal(f.queue.list(f.owner)[0].status,'acknowledged');await f.queue.close();
});
test('acknowledgement cannot consume another parent or specialist result',async()=>{
 const f=fixture(),row=source();await f.queue.watch(f.owner,row);await f.queue.acknowledge(f.owner,randomUUID(),row.childInstanceId);await f.queue.acknowledge(f.owner,row.parentRequestId,randomUUID());assert.equal(f.queue.list(f.owner)[0].status,'waiting');await f.queue.close();
});
test('reusing a child request with a different parent or identity is rejected',async()=>{
 const f=fixture(),row=source();await f.queue.watch(f.owner,row);for(const key of ['parentRequestId','childInstanceId','parentConversationId'])await assert.rejects(f.queue.watch(f.owner,{...row,[key]:randomUUID()}),/another parent/);assert.equal(f.queue.list(f.owner).length,1);await f.queue.close();
});
test('parent cancellation before dispatch persists a tombstone against late callbacks',async()=>{
 const f=fixture(),row=source();await f.queue.watch(f.owner,row);await f.queue.cancelParent(f.owner,row.parentRequestId);await f.queue.ready(f.owner,row.childRequestId);await f.queue.watch(f.owner,row);f.allow();await tick();assert.equal(f.calls.length,0);assert.equal(f.queue.list(f.owner)[0].status,'cancelled');await f.queue.close();
});
test('stopping a parent aborts its running report and never changes another parent',async()=>{
 const f=fixture({available:true,launch:async(_,rows,id,signal)=>new Promise(resolve=>signal.addEventListener('abort',resolve,{once:true}))}),first=source(),other=source();await f.queue.watch(f.owner,first);await f.queue.ready(f.owner,first.childRequestId);await tick();await f.queue.watch(f.owner,other);await f.queue.cancelParent(f.owner,first.parentRequestId);await f.queue.settled();assert(f.calls[0].signal.aborted);assert.equal(f.queue.list(f.owner,first.parentRequestId)[0].status,'cancelled');assert.equal(f.queue.list(f.owner,other.parentRequestId)[0].status,'waiting');await f.queue.close();
});
test('restart holds unsent reports and does not restart inference',async()=>{
 const f=fixture(),row=source();await f.queue.watch(f.owner,row);await f.queue.ready(f.owner,row.childRequestId);const fresh=new AgentReportQueue(f.store,()=>true,async()=>{throw Error('A restart must not dispatch');});await fresh.recover(f.owner);fresh.pump(f.owner);await tick();assert.equal(fresh.list(f.owner)[0].status,'held');assert.equal(f.calls.length,0);await fresh.close();await f.queue.close();
});
test('restart preserves successful report receipts and ignores duplicate callbacks',async()=>{
 const f=fixture({available:true}),row=source();await f.queue.watch(f.owner,row);await f.queue.ready(f.owner,row.childRequestId);await tick();await f.queue.settled();const fresh=new AgentReportQueue(f.store,()=>true,async()=>{throw Error('A delivered receipt was replayed');});await fresh.recover(f.owner);await fresh.watch(f.owner,row);await fresh.ready(f.owner,row.childRequestId);await tick();assert.equal(fresh.list(f.owner)[0].status,'delivered');assert.equal(f.calls.length,1);await fresh.close();await f.queue.close();
});
test('a possibly submitted response stays held after failure and cannot use the unsent-resume action',async()=>{
 const f=fixture({available:true,launch:async()=>{throw Error('Observation timed out after submission');}}),row=source();await f.queue.watch(f.owner,row);await f.queue.ready(f.owner,row.childRequestId);await tick();await f.queue.settled();const saved=f.queue.list(f.owner)[0];assert.equal(saved.status,'held');assert.equal(saved.dispatchStarted,true);await assert.rejects(f.queue.resumeUnsent(f.owner,row.childRequestId),/may already have run/);await f.queue.ready(f.owner,row.childRequestId);f.queue.pump(f.owner);await tick();assert.equal(f.calls.length,1);await f.queue.close();
});
test('an explicitly resumed unsent report gets one continuation after restart',async()=>{
 const f=fixture(),row=source();await f.queue.watch(f.owner,row);await f.queue.ready(f.owner,row.childRequestId);await f.queue.recover(f.owner);f.allow();await f.queue.resumeUnsent(f.owner,row.childRequestId);await tick();await f.queue.settled();assert.equal(f.calls.length,1);assert.equal(f.queue.list(f.owner)[0].status,'delivered');await f.queue.close();
});
test('failed dispatch-marker storage prevents any model call',async()=>{
 const f=fixture(),row=source();await f.queue.watch(f.owner,row);await f.queue.ready(f.owner,row.childRequestId);f.fail(rows=>rows.some(row=>row.status==='running'));f.allow();await tick();await f.queue.settled();assert.equal(f.calls.length,0);assert.match(f.queue.fault(f.owner),/storage outage/);f.fail(()=>false);await f.queue.close();
});
test('failure to save the submitted marker prevents reaching the launch callback',async()=>{
 const f=fixture(),row=source();await f.queue.watch(f.owner,row);await f.queue.ready(f.owner,row.childRequestId);f.fail(rows=>rows.some(row=>row.dispatchStarted===true));f.allow();await tick();await f.queue.settled();assert.equal(f.calls.length,0);assert.equal(f.queue.list(f.owner)[0].status,'held');f.fail(()=>false);await f.queue.close();
});
test('failure to save completion keeps its submitted marker so a fresh process cannot replay it',async()=>{
 const f=fixture(),row=source();await f.queue.watch(f.owner,row);await f.queue.ready(f.owner,row.childRequestId);f.fail(rows=>rows.some(row=>['delivered','held'].includes(row.status)));f.allow();await tick();await f.queue.settled();assert.equal(f.calls.length,1);assert.equal(f.queue.list(f.owner)[0].status,'running');assert(f.queue.fault(f.owner));f.fail(()=>false);const fresh=new AgentReportQueue(f.store,()=>true,async()=>{throw Error('Uncertain report replayed');});await fresh.recover(f.owner);await assert.rejects(fresh.resumeUnsent(f.owner,row.childRequestId),/may already have run/);assert.equal(f.calls.length,1);await fresh.close();await f.queue.close();
});
test('account queues are isolated and callers cannot mutate stored records through list',async()=>{
 const f=fixture(),row=source(),other=randomUUID();await f.queue.watch(f.owner,row);assert.deepEqual(f.queue.list(other),[]);await f.queue.ready(other,row.childRequestId);await f.queue.cancelParent(other,row.parentRequestId);const listed=f.queue.list(f.owner);listed[0].parentConversationId=randomUUID();assert.equal(f.queue.list(f.owner)[0].parentConversationId,row.parentConversationId);await f.queue.close();
});
test('malformed, injected or duplicate persisted metadata is rejected before inference',async()=>{
 const f=fixture({available:true}),row=source();for(const field of ['childRequestId','childInstanceId','parentRequestId','parentConversationId'])await assert.rejects(f.queue.watch(f.owner,{...row,[field]:'invalid'}),/identifier/);await f.queue.watch(f.owner,row);const saved=f.queue.list(f.owner)[0];for(const damaged of [[{...saved,secret:'not-allowed'}],[saved,saved],[{...saved,status:'delivered'}],[{...saved,dispatchStarted:'true'}]]){f.values.set('agent-reports:'+f.owner,damaged);assert.throws(()=>f.queue.list(f.owner));f.queue.pump(f.owner);await tick();assert.equal(f.calls.length,0);}f.values.set('agent-reports:'+f.owner,[saved]);await f.queue.close();
});
test('known provider credentials are removed from held diagnostics',async()=>{
 const secret='sk-proj-'+'x'.repeat(50),f=fixture({available:true,launch:async()=>{throw Error('Generated credential '+secret);}}),row=source();await f.queue.watch(f.owner,row);await f.queue.ready(f.owner,row.childRequestId);await tick();await f.queue.settled();assert.equal(f.queue.list(f.owner)[0].status,'held');assert(!JSON.stringify(f.queue.list(f.owner)).includes(secret));await f.queue.close();
});
test('close aborts active reporting, holds pending work and rejects later registration',async()=>{
 const f=fixture({available:true,launch:async(_,rows,id,signal)=>new Promise(resolve=>signal.addEventListener('abort',resolve,{once:true}))}),row=source();await f.queue.watch(f.owner,row);await f.queue.ready(f.owner,row.childRequestId);await tick();await f.queue.close();assert(f.calls[0].signal.aborted);assert.equal(f.queue.list(f.owner)[0].status,'held');await assert.rejects(f.queue.watch(f.owner,source()),/closed/);assert.equal(f.calls.length,1);
});

test('a proven pre-submission deferral waits without retaining an uncertain attempt',async()=>{const f=fixture({available:true,launch:async()=>{f.block();throw new AgentReportDeferred('User work took priority');}}),row=source();await f.queue.watch(f.owner,row);await f.queue.ready(f.owner,row.childRequestId);await tick();await f.queue.settled();const saved=f.queue.list(f.owner)[0];assert.equal(saved.status,'ready');assert.equal(saved.dispatchStarted,false);assert.equal(saved.attemptId,undefined);assert.equal(f.calls.length,1);await f.queue.close();});

test('a proven local preflight failure is held with an unsent resume action',async()=>{let fail=true;const f=fixture({available:true,launch:async()=>{if(fail)throw new AgentReportNotSubmitted('Saved definition needs review');}}),row=source();await f.queue.watch(f.owner,row);await f.queue.ready(f.owner,row.childRequestId);await tick();await f.queue.settled();assert.equal(f.queue.list(f.owner)[0].dispatchStarted,false);assert.equal(f.queue.list(f.owner)[0].status,'held');fail=false;await f.queue.resumeUnsent(f.owner,row.childRequestId);await tick();await f.queue.settled();assert.equal(f.calls.length,2);assert.equal(f.queue.list(f.owner)[0].status,'delivered');await f.queue.close();});

test('confirmation of a matching completed receipt never submits another continuation',async()=>{const f=fixture({available:true,launch:async()=>{throw Error('Generated observation failure');}}),row=source();await f.queue.watch(f.owner,row);await f.queue.ready(f.owner,row.childRequestId);await tick();await f.queue.settled();const saved=f.queue.list(f.owner)[0];await assert.rejects(f.queue.confirmDelivered(f.owner,row.childRequestId,randomUUID()),/does not match/);await f.queue.confirmDelivered(f.owner,row.childRequestId,saved.attemptId);assert.equal(f.queue.list(f.owner)[0].status,'delivered');assert.equal(f.calls.length,1);await f.queue.close();});

test('damaged report metadata does not prevent account departure or application closure and remains preserved',async()=>{const f=fixture(),row=source();await f.queue.watch(f.owner,row);const damaged=[{...f.queue.list(f.owner)[0],unrecognized:'generated-damage'}];f.values.set('agent-reports:'+f.owner,damaged);await f.queue.pauseOwner(f.owner,'Account changed');assert(f.queue.fault(f.owner));await f.queue.close();assert.deepEqual(f.values.get('agent-reports:'+f.owner),damaged);assert.equal(f.calls.length,0);});
