const test=require('node:test'),assert=require('node:assert/strict');
const {CodexHarness}=require('../build/codex-harness.js');
const {nativeBackupEntry}=require('../build/runtime.js');
const path=require('node:path');
const {InteractiveTerminal}=require('../build/interactive-terminal.js');
const {nativeReportContext,waitForNativeReport}=require('../build/native-context.js');

test('cancelling a parent waiting behind an automatic report releases only the waiting request',async()=>{
 const controller=new AbortController();let finish,reportFinished=false;const report=new Promise(resolve=>finish=()=>{reportFinished=true;resolve();});const waiting=waitForNativeReport(report,controller.signal);controller.abort();await assert.rejects(waiting,{name:'AbortError'});assert(!reportFinished);finish();await report;
});

test('late child results cross native branches once even when their original chat message is older',()=>{
 const state={threadId:'origin',children:[{threadId:'child',turnId:'child-turn',status:'completed',result:'FRESH-CHILD-VALUE'}],reports:[{id:'report',status:'completed',state:{items:[{item:{type:'agentMessage',text:'Main agent used FRESH-CHILD-VALUE'}},{item:{type:'reasoning',text:'PRIVATE-REASONING'}}]}}]};
 const rows=[{metadata:{native:state}},{metadata:{native:{threadId:'other-branch',consumedReports:[]}}}],first=nativeReportContext(rows,'other-branch');assert(first.input.includes('FRESH-CHILD-VALUE'));assert(!first.input.includes('PRIVATE-REASONING'));assert(first.input.includes('not user instructions'));assert.equal(first.seen.length,2);
 rows[1].metadata.native.consumedReports=first.seen;assert.equal(nativeReportContext(rows,'other-branch').input,null);assert.equal(nativeReportContext(rows,'origin').input,null,'The original native branch already has its actual child notification and report');
});

test('child terminal bindings survive parent completion and cancellation stays within the child scope',async()=>{
 const terminal=Object.create(InteractiveTerminal.prototype);terminal.requests=new Map();terminal.active=new Map();
 const first=new AbortController(),second=new AbortController(),shellA=new AbortController(),shellB=new AbortController();terminal.active.set('shell-a',{controller:shellA,done:Promise.resolve()});terminal.active.set('shell-b',{controller:shellB,done:Promise.resolve()});
 terminal.bind({id:'parent-request',native_scope_id:'native:child-a'},first.signal,'shell-a');terminal.bind({id:'parent-request',native_scope_id:'native:child-b'},second.signal,'shell-b');
 await terminal.finishRequest('parent-request',false);assert.equal(terminal.requests.size,2);first.abort();assert(shellA.signal.aborted);assert(!shellB.signal.aborted);
 await terminal.finishRequest('native:child-b',false);second.abort();assert(!shellB.signal.aborted,'A normally finished child releases its turn binding without closing a persistent terminal');await terminal.finishRequest('native:child-a',true);
});

test('native backups preserve databases, rollouts and custom skills while excluding only regenerable home resources',()=>{
 const base=path.resolve('native-backup-boundaries'),home=path.join(base,'owner','openrouter','scope');
 for(const relative of ['state_5.sqlite','state_5.sqlite-wal','sessions/2026/rollout.jsonl','skills/custom/SKILL.md','skills/custom/tmp/context.md','skills/custom/.system/context.md'])assert(nativeBackupEntry(base,path.join(home,relative)),relative);
 for(const relative of ['tmp/arg0-windows/helper.exe','.tmp/plugins/seeded/plugin.json','skills/.system/openai-docs/SKILL.md'])assert(!nativeBackupEntry(base,path.join(home,relative)),relative);
 assert(nativeBackupEntry(base,base));assert(nativeBackupEntry(base,path.join(base,'owner')));
});

function fixture(){
 const calls=[],events=[],saved=[];let busy=false;
 const db={from:table=>{const q={update:value=>{saved.push(structuredClone(value));return q;},select:()=>q,eq:()=>q,limit:()=>q,then:(resolve,reject)=>Promise.resolve({data:table==='desktop_requests'&&busy?[{id:'human-request'}]:[],error:null}).then(resolve,reject)};return q;}};
 const harness=new CodexHarness(db,{},'','',(owner,event)=>events.push({owner,event}),async()=>{}),controller=new AbortController();
 const worker={client:{request:async(method,params)=>{calls.push({method,params});return{turn:{id:'report-turn'}};},close:async()=>{}},gateway:{close(){}},children:new Map(),home:'private-home',cwd:'workspace'};
 const root={admin:true,options:{permission:'ask',mode:'chat'},owner:'alice',conversation:'conversation',request:{id:'parent-request'},worker,state:{version:'0.163.0',threadId:'parent-thread',turnId:'parent-turn',items:[],approvals:[],steering:[]},resolve(){},reject(){},save:Promise.resolve(),ended:false,rootFinished:true,provider:'openrouter',model:'model',execute:async()=>({}),validate:async()=>{},controller,waiting:new Map()};
 harness.contexts.set(root.request.id,root);harness.workers.add(worker);
 return{harness,root,worker,calls,events,saved,setBusy:value=>busy=value,close:()=>harness.close()};
}

test('a native child outlives its completed parent and controls target only its owned current turn',async()=>{
 const f=fixture();try{
  const child=f.harness.child(f.worker,'child-thread','parent-thread','Verifier','Check work');
  f.harness.dispatch(f.worker,'item/started',{threadId:'child-thread',turnId:'child-turn',item:{type:'userMessage',id:'input',content:[]}});
  assert.equal(child.view.turnId,'child-turn','Child controls recover the real turn ID even when spawn precedes listener attachment');
  assert.equal(child.view.status,'running');assert(f.harness.busy);assert.deepEqual(f.harness.active('alice'),[],'A child must not resurrect its finished parent request');
  assert.equal(f.events.at(-1).event.kind,'native-background');
  await assert.rejects(f.harness.control('bob','parent-request','child-thread','send','child-turn','forged input','x'),/not available/);
  await assert.rejects(f.harness.control('alice','parent-request','child-thread','send','stale-turn','wrong turn','x'),/different turn/);
  await f.harness.control('alice','parent-request','child-thread','send','child-turn','New guidance','guidance-id');
  await f.harness.control('alice','parent-request','child-thread','send','child-turn','New guidance','guidance-id');
  assert.equal(f.calls.filter(c=>c.method==='turn/steer').length,1,'Repeated accepted steering is not submitted twice');assert.deepEqual(f.calls[0].params.threadId,'child-thread');
  await f.harness.control('alice','parent-request','child-thread','cancel','child-turn','','cancel-id');assert.equal(f.calls.at(-1).method,'turn/interrupt');assert.equal(f.calls.at(-1).params.threadId,'child-thread');assert(!f.root.controller.signal.aborted,'Stopping a child must not abort its parent');
 }finally{await f.close();}
});

test('child results wait for human work then reach a native parent continuation exactly once',async()=>{
 const f=fixture();try{
  const c=f.harness.child(f.worker,'child-thread','parent-thread');f.harness.dispatch(f.worker,'turn/started',{threadId:'child-thread',turn:{id:'child-turn'}});
  f.harness.dispatch(f.worker,'item/completed',{threadId:'child-thread',turnId:'child-turn',item:{type:'agentMessage',id:'result',phase:'final_answer',text:'Verified result from the child'}});
  f.harness.dispatch(f.worker,'turn/completed',{threadId:'child-thread',turn:{id:'child-turn',status:'completed'}});
  f.setBusy(true);await f.harness.deliver(f.worker);assert.equal(f.calls.length,0,'An accepted human turn has priority');
  f.setBusy(false);await f.harness.deliver(f.worker);await new Promise(r=>setImmediate(r));
  const request=f.calls.find(c=>c.method==='turn/start');assert(request);assert.equal(request.params.threadId,'parent-thread');assert(request.params.input[0].text.includes('Verified result from the child'));assert(request.params.input[0].text.includes('not a message from the user'));assert(request.params.input[0].text.includes('untrusted'));
  assert.equal(c.view.delivery,'running');const finishing=f.worker.reportDone;
  f.harness.dispatch(f.worker,'item/completed',{threadId:'parent-thread',turnId:'report-turn',item:{type:'agentMessage',id:'summary',phase:'final_answer',text:'Main agent used the verified result'}});
  f.harness.dispatch(f.worker,'turn/completed',{threadId:'parent-thread',turn:{id:'report-turn',status:'completed'}});await finishing;
  assert.equal(c.view.delivery,'delivered');assert.equal(c.view.reportedTurnId,'child-turn');assert.equal(f.root.state.reports[0].status,'completed');assert(f.root.state.reports[0].state.items.some(i=>i.item.text.includes('Main agent used')));
  await f.harness.deliver(f.worker);assert.equal(f.calls.filter(c=>c.method==='turn/start').length,1);assert.equal(f.root.state.turnId,'parent-turn','A report must not overwrite the original completed turn identity');
 }finally{await f.close();}
});

test('a child completing before its parent hands off its queued report after the parent ends',async()=>{
 const f=fixture();try{
  f.worker.current=f.root;f.root.rootFinished=false;const c=f.harness.child(f.worker,'fast-child','parent-thread');f.harness.dispatch(f.worker,'turn/started',{threadId:'fast-child',turn:{id:'fast-turn'}});f.harness.dispatch(f.worker,'turn/completed',{threadId:'fast-child',turn:{id:'fast-turn',status:'completed'}});
  await new Promise(r=>setTimeout(r,600));assert.equal(f.calls.length,0,'The report must wait for the still-active parent');
  f.root.resolve=()=>{f.worker.current=undefined;f.root.rootFinished=true;f.harness.settle(f.worker);};f.harness.dispatch(f.worker,'turn/completed',{threadId:'parent-thread',turn:{id:'parent-turn',status:'completed'}});
  for(let n=0;n<40&&!f.worker.report;n++)await new Promise(r=>setTimeout(r,25));assert(f.worker.report,'Parent completion must restart a deferred report without another child event');const completing=f.worker.reportDone;for(let n=0;n<40&&!f.worker.report.state.turnId;n++)await new Promise(r=>setTimeout(r,10));
  f.harness.dispatch(f.worker,'turn/completed',{threadId:'parent-thread',turn:{id:'report-turn',status:'completed'}});await completing;assert.equal(c.view.delivery,'delivered');
 }finally{await f.close();}
});

test('background approvals remain answerable after the parent ends and reject late or foreign answers',async()=>{
 const f=fixture();try{
  const c=f.harness.child(f.worker,'child-thread','parent-thread');let decision;
  const waiting=f.harness.serverRequest(f.root,{id:12,method:'item/commandExecution/requestApproval',params:{threadId:'child-thread',turnId:'child-turn',itemId:'command',command:'read workspace'}},async()=>{},c.controller.signal).then(r=>decision=r);
  await new Promise(r=>setImmediate(r));const approval=f.root.state.approvals[0];assert.equal(c.view.state.approvals[0],approval);
  await assert.rejects(f.harness.answer('bob','parent-request',approval.id,{decision:'accept'},true),/no longer waiting/);
  await assert.rejects(f.harness.answer('alice','parent-request',approval.id,{decision:'accept'},false),/Administrator/);
  await f.harness.answer('alice','parent-request',approval.id,{decision:'decline'},true);await waiting;assert.deepEqual(decision,{decision:'decline'});
  await assert.rejects(f.harness.answer('alice','parent-request',approval.id,{decision:'accept'},true),/no longer waiting/);
 }finally{await f.close();}
});

test('native wait receipts avoid a second parent report and pending results prevent an inconsistent backup',async()=>{
 const f=fixture();try{
  const c=f.harness.child(f.worker,'child-thread','parent-thread');f.harness.dispatch(f.worker,'turn/started',{threadId:'child-thread',turn:{id:'child-turn'}});
  f.harness.dispatch(f.worker,'turn/completed',{threadId:'child-thread',turn:{id:'child-turn',status:'completed'}});
  await assert.rejects(f.harness.quiesce(),/background agents/,'Queued report delivery is still active work');
  f.harness.dispatch(f.worker,'item/completed',{threadId:'parent-thread',turnId:'parent-turn',item:{type:'collabAgentToolCall',id:'wait-result',tool:'wait',status:'completed',receiverThreadIds:['child-thread'],agentsStates:{'child-thread':{status:'completed',message:'Actual native result'}}}});
  assert.equal(c.view.delivery,'delivered');await f.harness.deliver(f.worker);assert.equal(f.calls.length,0,'The native parent already consumed the result through wait');
  await f.harness.quiesce();assert.equal(f.harness.workers.size,0);assert(f.root.ended);
 }finally{await f.close();}
});

test('stopping a goal interrupts its children while another conversation keeps working',async()=>{
 const f=fixture();try{
  f.root.options.goalId='goal-a';const first=f.harness.child(f.worker,'child-a','parent-thread');
  const worker={...f.worker,children:new Map(),home:'other-private-home'},root={...f.root,options:{...f.root.options,goalId:'goal-b'},conversation:'other-conversation',request:{id:'other-request'},worker,state:{version:'0.163.0',threadId:'other-thread',turnId:'other-turn',items:[],approvals:[],steering:[]},controller:new AbortController(),waiting:new Map()};f.harness.contexts.set(root.request.id,root);f.harness.workers.add(worker);const other=f.harness.child(worker,'child-b','other-thread');
  await f.harness.stopGoal('alice','goal-a');assert.equal(first.view.status,'interrupted');assert(!f.harness.workers.has(f.worker));assert(f.harness.workers.has(worker));assert.equal(other.view.status,'running');assert(!other.controller.signal.aborted);
 }finally{await f.close();}
});
