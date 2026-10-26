const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const path=require('node:path'),schedulerBuild=process.env.AGENTOPIA_PREVIEW_BUILD??path.join(__dirname,'../build');
const {TaskScheduler}=require(path.join(schedulerBuild,'task-scheduler.js'));
const {ScheduledTaskNotSubmitted}=require(path.join(schedulerBuild,'scheduled-task-contracts.js'));
const deferred=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve};};
const wait=async predicate=>{for(let n=0;n<200;n++){if(predicate())return;await new Promise(r=>setImmediate(r));}throw Error('Scheduler outcome did not settle.');};
function setup(){
 const owner=randomUUID(),task={id:randomUUID(),owner,revision:1,status:'active',cadence:{kind:'interval',minutes:5},anchor:'2026-01-01T00:00:00Z',nextAt:'2026-01-01T00:05:00.000Z',missed:'skip',snapshot:{name:'Fixture',instructions:'Generated verification only',agentId:randomUUID(),agentRevision:1,projectId:null,projectRevision:null,conversationId:randomUUID(),options:{provider:'openai-oauth',model:'controlled',thinking:'default',mode:'chat',permission:'chat',files:[]},files:[]},note:null};
 const runs=[],effects=[],notices=[],store={
  async recover(){for(const run of runs)if(['starting','running'].includes(run.status))run.status='held';},
  async tasks(user){return user===owner?[structuredClone(task)]:[];},
  async pending(user){return runs.filter(r=>r.owner===user&&r.status==='pending').map(r=>structuredClone(r));},
  async stage(snapshot,due,next,skip){if(snapshot.revision!==task.revision||snapshot.status!==task.status||snapshot.nextAt!==task.nextAt||runs.some(r=>r.taskId===task.id&&['pending','starting','running','held'].includes(r.status)))return null;const run={id:randomUUID(),owner,taskId:task.id,taskRevision:task.revision,requestId:randomUUID(),scheduledFor:due,trigger:'schedule',status:skip?'skipped':'pending',snapshot:structuredClone(task.snapshot),conversationId:task.snapshot.conversationId,error:null,unread:false};runs.push(run);task.nextAt=next;return structuredClone(run);},
  async claim(user,id){const run=runs.find(r=>r.owner===user&&r.id===id&&r.status==='pending');if(!run)return null;run.status='starting';return structuredClone(run);},
  async defer(user,id){const run=runs.find(r=>r.owner===user&&r.id===id&&r.status==='starting');if(!run||effects.includes(run.requestId))return false;run.status='pending';return true;},
  async finish(user,id,outcome){const run=runs.find(r=>r.owner===user&&r.id===id);assert(run);Object.assign(run,{status:outcome.status,error:outcome.error??null,conversationId:outcome.conversationId??run.conversationId});},
  async hold(user,id,error){const run=runs.find(r=>r.owner===user&&r.id===id);assert(run);Object.assign(run,{status:'held',error});},
 };
 let identity=owner,available=true,now='2026-01-01T00:05:05Z';const host={owner:()=>identity,available:()=>available,now:()=>new Date(now),changed:user=>notices.push(user),launch:async(run,signal)=>{signal.throwIfAborted();effects.push(run.requestId);return {status:'completed',conversationId:run.conversationId};}};
 return {owner,task,runs,effects,notices,store,host,setOwner:v=>identity=v,setAvailable:v=>available=v,setNow:v=>now=v,create:()=>new TaskScheduler(store,host)};
}
test('a due task launches once and repeated ticks retain its saved completed outcome',async()=>{
 const f=setup(),scheduler=f.create();await scheduler.initialize();await scheduler.tick();await wait(()=>f.runs[0]?.status==='completed');await scheduler.tick();assert.equal(f.effects.length,1);assert.equal(f.task.nextAt,'2026-01-01T00:10:00.000Z');await scheduler.close();
});
test('missed tasks are recorded as skipped while latest policy admits only one run',async()=>{
 const f=setup();f.setNow('2026-02-01T12:00:00Z');const scheduler=f.create();await scheduler.tick();assert.equal(f.runs[0].status,'skipped');assert.equal(f.effects.length,0);f.task.missed='latest';f.task.nextAt='2026-01-01T00:05:00Z';await scheduler.tick();await wait(()=>f.runs[1]?.status==='completed');assert.equal(f.effects.length,1);await scheduler.close();
});
test('busy conversations leave a persisted pending run and coalesce later occurrences',async()=>{
 const f=setup(),scheduler=f.create();f.setAvailable(false);await scheduler.tick();assert.equal(f.runs[0].status,'pending');f.setNow('2026-01-01T03:00:00Z');await scheduler.tick();assert.equal(f.runs.length,1);f.setAvailable(true);await scheduler.tick();await wait(()=>f.effects.length===1);await scheduler.close();
});
test('two scheduler instances cannot both claim the same persisted occurrence',async()=>{
 const f=setup(),a=f.create(),b=f.create();await Promise.all([a.tick(),b.tick()]);await wait(()=>f.runs[0]?.status==='completed');assert.equal(f.effects.length,1);assert.equal(f.runs.length,1);await Promise.all([a.close(),b.close()]);
});
test('account changes during a claim hold its run before executing any action',async()=>{
 const f=setup(),gate=deferred(),original=f.store.claim;f.store.claim=async(...args)=>{const run=await original(...args);f.setOwner(null);await gate.promise;return run;};const scheduler=f.create(),tick=scheduler.tick();await wait(()=>f.runs[0]?.status==='starting');gate.resolve();await tick;assert.equal(f.runs[0].status,'held');assert.equal(f.effects.length,0);await scheduler.close();
});
test('uncertain launches are held across recovery without executing their effects again',async()=>{
 const f=setup();f.host.launch=async run=>{f.effects.push(run.requestId);throw Error('Connection lost after submission');};const first=f.create();await first.tick();await wait(()=>f.runs[0]?.status==='held');await first.close();const second=f.create();await second.initialize();await second.tick();assert.equal(f.effects.length,1);assert.equal(f.runs[0].status,'held');await second.close();
});
test('completed effects with an unsaved receipt are not replayed and expose a persistent fault',async()=>{
 const f=setup();f.store.finish=async()=>{throw Error('Database unavailable');};f.store.hold=async()=>{throw Error('Still unavailable');};const scheduler=f.create();await scheduler.tick();await wait(()=>scheduler.error);assert.match(scheduler.error,/outcome could not be saved/);await scheduler.tick();assert.equal(f.effects.length,1);assert.match(scheduler.error,/outcome could not be saved/);await scheduler.close();
});
test('Stop cancels only the selected owned run and preserves its cancellation receipt',async()=>{
 const f=setup();f.host.launch=async(run,signal)=>{f.effects.push(run.requestId);await new Promise(resolve=>signal.addEventListener('abort',resolve,{once:true}));return {status:'cancelled'};};const scheduler=f.create();await scheduler.tick();await wait(()=>f.effects.length===1);assert.equal(await scheduler.stop(randomUUID(),f.runs[0].id),false);assert.equal(await scheduler.stop(f.owner,f.runs[0].id),true);assert.equal(f.runs[0].status,'cancelled');await scheduler.close();
});
test('closing during a claim prevents a late launch and keeps the saved run inspectable',async()=>{
 const f=setup(),gate=deferred(),original=f.store.claim;f.store.claim=async(...args)=>{const run=await original(...args);await gate.promise;return run;};const scheduler=f.create(),tick=scheduler.tick();await wait(()=>f.runs[0]?.status==='starting');const closing=scheduler.close();gate.resolve();await Promise.all([tick,closing]);assert.equal(f.effects.length,0);assert.equal(f.runs[0].status,'held');
});
test('paused tasks and signed-out accounts do not create runs',async()=>{
 const f=setup(),scheduler=f.create();f.task.status='paused';await scheduler.tick();f.task.status='active';f.setOwner(null);await scheduler.tick();assert.equal(f.runs.length,0);await scheduler.close();
});
test('a known pre-submission busy refusal returns its run to pending without repeating effects',async()=>{
 const f=setup();let first=true;f.host.launch=async(run)=>{if(first){first=false;f.setAvailable(false);throw new ScheduledTaskNotSubmitted('The conversation became busy');}f.effects.push(run.requestId);return {status:'completed',conversationId:run.conversationId};};const scheduler=f.create();await scheduler.tick();await wait(()=>f.runs[0]?.status==='pending');assert.equal(f.effects.length,0);f.setAvailable(true);await scheduler.tick();await wait(()=>f.runs[0]?.status==='completed');assert.equal(f.effects.length,1);await scheduler.close();
});
test('a pre-submission label cannot release a run that already has effects',async()=>{
 const f=setup();f.host.launch=async run=>{f.effects.push(run.requestId);throw new ScheduledTaskNotSubmitted('Incorrect pre-submission classification');};const scheduler=f.create();await scheduler.tick();await wait(()=>f.runs[0]?.status==='held');await scheduler.tick();assert.equal(f.effects.length,1);await scheduler.close();
});
test('claim reservations count as busy before the native response is launched',async()=>{
 const f=setup(),gate=deferred(),original=f.store.claim;f.store.claim=async(...args)=>{await gate.promise;return original(...args);};const scheduler=f.create(),tick=scheduler.tick();await wait(()=>scheduler.busy);assert.equal(f.effects.length,0);gate.resolve();await tick;await wait(()=>f.runs[0]?.status==='completed'&&!scheduler.busy);await scheduler.close();
});
test('database staging is reserved against backup even before a claim begins',async()=>{const f=setup(),gate=deferred(),original=f.store.tasks;f.store.tasks=async(...args)=>{await gate.promise;return original(...args);};const scheduler=f.create(),work=scheduler.tick();assert.equal(scheduler.busy,true);assert.equal(f.runs.length,0);gate.resolve();await work;await wait(()=>f.runs[0]?.status==='completed'&&!scheduler.busy);await scheduler.close();});

test('recovery reserves a staging write but can invalidate a passive task read',async()=>{const f=setup(),gate=deferred(),original=f.store.stage;let entered=false;f.setAvailable(false);f.store.stage=async(...args)=>{entered=true;await gate.promise;return original(...args);};const scheduler=f.create(),work=scheduler.tick();await wait(()=>entered);assert(scheduler.recoveryBusy);assert.throws(()=>scheduler.invalidatePolling(),/writes and executions/);gate.resolve();await work;assert(!scheduler.recoveryBusy);assert.equal(f.effects.length,0);assert.equal(f.runs[0].status,'pending');await scheduler.close();});

test('a claim reservation covers the subsequent safe-defer write',async()=>{const f=setup(),claimGate=deferred(),deferGate=deferred(),claim=f.store.claim,defer=f.store.defer;let deferring=false,permitted=true;f.host.canPoll=()=>permitted;f.store.claim=async(...args)=>{const run=await claim(...args);await claimGate.promise;permitted=false;return run;};f.store.defer=async(...args)=>{deferring=true;await deferGate.promise;return defer(...args);};const scheduler=f.create(),work=scheduler.tick();await wait(()=>f.runs[0]?.status==='starting');assert(scheduler.recoveryBusy);claimGate.resolve();await wait(()=>deferring);assert(scheduler.recoveryBusy);assert.throws(()=>scheduler.invalidatePolling(),/writes and executions/);deferGate.resolve();await work;assert(!scheduler.recoveryBusy);assert.equal(f.runs[0].status,'pending');assert.equal(f.effects.length,0);await scheduler.close();});

test('an account-change hold remains reserved until its persistence completes',async()=>{const f=setup(),gate=deferred(),claim=f.store.claim,hold=f.store.hold;let holding=false;f.store.claim=async(...args)=>{const run=await claim(...args);f.setOwner(null);return run;};f.store.hold=async(...args)=>{holding=true;await gate.promise;return hold(...args);};const scheduler=f.create(),work=scheduler.tick();await wait(()=>holding);assert(scheduler.recoveryBusy);assert.throws(()=>scheduler.invalidatePolling(),/writes and executions/);gate.resolve();await work;assert.equal(f.runs[0].status,'held');assert(!scheduler.recoveryBusy);assert.equal(f.effects.length,0);await scheduler.close();});

test('execution remains reserved while its final result is being saved',async()=>{const f=setup(),gate=deferred(),finish=f.store.finish;let finishing=false;f.store.finish=async(...args)=>{finishing=true;await gate.promise;return finish(...args);};const scheduler=f.create();await scheduler.tick();await wait(()=>finishing);assert(scheduler.recoveryBusy);assert.throws(()=>scheduler.invalidatePolling(),/writes and executions/);gate.resolve();await wait(()=>!scheduler.recoveryBusy);assert.equal(f.runs[0].status,'completed');assert.equal(f.effects.length,1);await scheduler.close();});

test('a persisted claim with a lost acknowledgement never starts or replays after recovery',async()=>{const f=setup(),claim=f.store.claim;f.store.claim=async(...args)=>{await claim(...args);throw Error('Claim acknowledgement lost');};const scheduler=f.create();await scheduler.tick();assert.equal(f.runs[0].status,'starting');assert.equal(f.effects.length,0);assert(!scheduler.recoveryBusy);scheduler.invalidatePolling();await scheduler.tick();assert.equal(f.runs[0].status,'starting');assert.equal(f.effects.length,0);await scheduler.close();});

test('an invalidated read cannot publish an old connection error after recovery',async()=>{const f=setup();let reject;f.store.tasks=()=>new Promise((_,fail)=>reject=fail);const scheduler=f.create(),work=scheduler.tick();scheduler.invalidatePolling();reject(Error('Old connection failed'));await work;assert.equal(scheduler.error,null);assert.equal(f.notices.length,0);await scheduler.close();});

test('a temporary identity check after claiming defers an unsubmitted run without reporting an account change',async()=>{
 const f=setup();let permitted=true;f.host.canPoll=()=>permitted;const claim=f.store.claim;f.store.claim=async(...args)=>{const run=await claim(...args);permitted=false;return run;};const scheduler=f.create();await scheduler.tick();assert.equal(f.runs[0].status,'pending');assert.equal(f.effects.length,0);assert.equal(f.runs[0].error,null);
 f.store.claim=claim;permitted=true;await scheduler.tick();await wait(()=>f.runs[0]?.status==='completed');assert.equal(f.effects.length,1);await scheduler.close();
});

test('a temporarily blocked claim is held when persistence cannot prove it is safe to defer',async()=>{
 const f=setup();let permitted=true;f.host.canPoll=()=>permitted;const claim=f.store.claim;f.store.claim=async(...args)=>{const run=await claim(...args);permitted=false;return run;};f.store.defer=async()=>false;const scheduler=f.create();await scheduler.tick();assert.equal(f.runs[0].status,'held');assert.match(f.runs[0].error,/could not be deferred/);assert.equal(f.effects.length,0);permitted=true;await scheduler.tick();assert.equal(f.effects.length,0);await scheduler.close();
});
