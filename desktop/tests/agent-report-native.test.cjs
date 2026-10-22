const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{randomUUID}=require('node:crypto');
const build=process.env.AGENTOPIA_AGENT_REPORT_BUILD??path.resolve(__dirname,'../build'),{CodexHarness}=require(path.join(build,'codex-harness.js')),{AgentReportDeferred}=require(path.join(build,'agent-report-queue.js'));
function fixture(){
 const owner=randomUUID(),requestId=randomUUID(),conversation=randomUUID(),calls=[],saved=[];let active=false,revoked=false,checks=0,start;
 const db={from:()=>{const q={select:()=>q,eq:()=>q,limit:async()=>({data:active?[{id:'new-human-turn'}]:[]})};return q;}},h=new CodexHarness(db,{},'unused','unused',()=>{},async()=>{});
 h.persist=async r=>saved.push(structuredClone(r.state));h.publish=()=>{};h.settle=()=>{};
 const w={owner,children:new Map(),client:{request:async(method,args)=>{calls.push({method,args});if(method==='turn/start'){if(start)return start(args);setImmediate(()=>{h.event(w.report,'turn/started',{threadId:'parent-thread',turn:{id:'report-turn'}});h.event(w.report,'turn/completed',{threadId:'parent-thread',turn:{id:'report-turn',status:'completed'}});});return {turn:{id:'report-turn'}};}return {};}}};
 const r={owner,conversation,request:{id:requestId},options:{},worker:w,state:{version:'0.163.0',threadId:'parent-thread',turnId:'parent-turn',items:[],approvals:[],steering:[]},rootFinished:true,ended:false,controller:new AbortController(),save:Promise.resolve(),validate:async()=>{checks++;if(revoked)throw Error('Parent permissions revoked');}};h.contexts.set(requestId,r);h.workers.add(w);
 const result={invocationId:randomUUID(),instanceId:randomUUID(),conversationId:randomUUID(),messageId:randomUUID(),agentId:randomUUID(),name:'Generated specialist',status:'completed',text:'Generated saved result',citation:'agentopia-chat://generated/message/source'};
 return {h,w,r,result,owner,requestId,calls,saved,get checks(){return checks;},active(){active=true;},revoke(){revoked=true;},start(fn){start=fn;}};
}
test('a named specialist result continues the existing parent native thread with a durable report receipt',async()=>{
 const f=fixture(),attempt=randomUUID();let sourceChecks=0;await f.h.reportNamedAssignments(f.owner,f.requestId,attempt,[f.result],new AbortController().signal,async()=>{sourceChecks++;});
 const sent=f.calls.find(call=>call.method==='turn/start');assert.equal(sent.args.threadId,'parent-thread');assert.equal(sent.args.clientUserMessageId,attempt);assert(sent.args.input[0].text.includes('not a new message from the user'));assert(sent.args.input[0].text.includes('existing permissions'));assert(sent.args.input[0].text.includes(f.result.instanceId));assert.equal(f.r.state.reports[0].status,'completed');assert.deepEqual(f.r.state.reports[0].assignments,[f.result]);assert.equal(f.r.state.reports[0].children.length,0);assert(f.saved.some(state=>state.reports?.[0].status==='running'));assert(f.checks>=2&&sourceChecks>=2);assert.equal(f.w.report,undefined);assert.equal(f.w.reportDone,undefined);
});
test('a repeated successful report ID is acknowledged without repeating the native turn',async()=>{
 const f=fixture(),attempt=randomUUID();for(let i=0;i<2;i++)await f.h.reportNamedAssignments(f.owner,f.requestId,attempt,[f.result],new AbortController().signal,async()=>{});assert.equal(f.calls.filter(call=>call.method==='turn/start').length,1);
 await assert.rejects(f.h.reportNamedAssignments(f.owner,f.requestId,attempt,[{...f.result,text:'Changed source'}],new AbortController().signal,async()=>{}),/saved attempt/);
});
test('another account, unavailable context and active user work cannot start a parent report',async()=>{
 const f=fixture();await assert.rejects(f.h.reportNamedAssignments(randomUUID(),f.requestId,randomUUID(),[f.result],new AbortController().signal,async()=>{}),AgentReportDeferred);f.active();await assert.rejects(f.h.reportNamedAssignments(f.owner,f.requestId,randomUUID(),[f.result],new AbortController().signal,async()=>{}),AgentReportDeferred);assert(!f.calls.some(call=>call.method==='turn/start'));assert.equal(f.r.state.reports,undefined);
});
test('revoked parent or specialist authority stops reporting before a model turn',async()=>{
 const f=fixture();f.revoke();await assert.rejects(f.h.reportNamedAssignments(f.owner,f.requestId,randomUUID(),[f.result],new AbortController().signal,async()=>{}),/revoked/);assert.equal(f.calls.length,0);
 const other=fixture();await assert.rejects(other.h.reportNamedAssignments(other.owner,other.requestId,randomUUID(),[other.result],new AbortController().signal,async()=>{throw Error('Specialist source revoked');}),/source revoked/);assert.equal(other.calls.length,0);
});
test('a source revoked after receipt persistence cannot enter the provider',async()=>{
 const f=fixture();let checks=0;await assert.rejects(f.h.reportNamedAssignments(f.owner,f.requestId,randomUUID(),[f.result],new AbortController().signal,async()=>{if(++checks===2)throw Error('Source changed before dispatch');}),/Source changed/);assert.equal(f.calls.filter(call=>call.method==='turn/start').length,0);assert.equal(f.r.state.reports[0].status,'failed');assert.equal(f.w.report,undefined);assert.equal(f.w.reportDone,undefined);
});
test('an aborted report interrupts its exact native turn and leaves another worker untouched',async()=>{
 const f=fixture(),controller=new AbortController();f.start(async()=>{setImmediate(()=>{happened();});return {turn:{id:'report-turn'}};});
 const old=f.w.client.request;f.w.client.request=async(method,args)=>{if(method==='turn/interrupt'){f.calls.push({method,args});setImmediate(()=>f.h.event(f.w.report,'turn/completed',{threadId:'parent-thread',turn:{id:'report-turn',status:'interrupted'}}));return {};}return old(method,args);};
 const unrelated={owner:f.owner,current:{request:{id:'unrelated'}},client:{request:async()=>{throw Error('Unrelated worker interrupted');}}};f.h.workers.add(unrelated);
 const happened=()=>controller.abort();await assert.rejects(f.h.reportNamedAssignments(f.owner,f.requestId,randomUUID(),[f.result],controller.signal,async()=>{}),/interrupted/);assert(f.calls.some(call=>call.method==='turn/interrupt'&&call.args.threadId==='parent-thread'&&call.args.turnId==='report-turn'));assert.equal(f.r.state.reports[0].status,'cancelled');assert.equal(unrelated.current.request.id,'unrelated');
});
test('an uncertain native start retains a failed receipt instead of silently resending',async()=>{
 const f=fixture(),attempt=randomUUID();f.start(async()=>{throw Error('Native acknowledgement unavailable');});await assert.rejects(f.h.reportNamedAssignments(f.owner,f.requestId,attempt,[f.result],new AbortController().signal,async()=>{}),/acknowledgement/);assert.equal(f.r.state.reports[0].status,'failed');await assert.rejects(f.h.reportNamedAssignments(f.owner,f.requestId,attempt,[f.result],new AbortController().signal,async()=>{}),/saved attempt/);assert.equal(f.calls.filter(call=>call.method==='turn/start').length,1);
});
test('duplicates, oversized batches and empty reports never reach native execution',async()=>{
 const f=fixture();for(const rows of [[],[f.result,f.result],Array.from({length:17},()=>({...f.result,invocationId:randomUUID()}))])await assert.rejects(f.h.reportNamedAssignments(f.owner,f.requestId,randomUUID(),rows,new AbortController().signal,async()=>{}),/bounded group/);assert.equal(f.calls.length,0);
});

test('named assignment watches persist in the original SQL native state before delegation is acknowledged',async()=>{
 const f=fixture();await f.h.registerNamedAssignment(f.owner,f.requestId,f.result.invocationId,f.result.instanceId);assert.deepEqual(f.saved[0].namedAssignments.map(({childRequestId,childInstanceId})=>({childRequestId,childInstanceId})),[{childRequestId:f.result.invocationId,childInstanceId:f.result.instanceId}]);await f.h.registerNamedAssignment(f.owner,f.requestId,f.result.invocationId,f.result.instanceId);assert.equal(f.r.state.namedAssignments.length,1);await assert.rejects(f.h.registerNamedAssignment(f.owner,f.requestId,f.result.invocationId,randomUUID()),/different specialist/);await assert.rejects(f.h.registerNamedAssignment(randomUUID(),f.requestId,randomUUID(),randomUUID()),/no longer available/);
});

test('a deferral after native start is uncertain and cannot silently enter the unsent retry path',async()=>{
 const f=fixture();f.start(async()=>{throw new AgentReportDeferred('Generated transport lost its acknowledgement');});await assert.rejects(f.h.reportNamedAssignments(f.owner,f.requestId,randomUUID(),[f.result],new AbortController().signal,async()=>{}),error=>!(error instanceof AgentReportDeferred)&&/lost its acknowledgement/.test(error.message));assert.equal(f.r.state.reports[0].status,'failed');assert.equal(f.calls.filter(call=>call.method==='turn/start').length,1);
});

test('a failed automatic report settles without failing a subsequent human turn waiting for its worker',async()=>{
 const f=fixture();let fail;f.start(()=>new Promise((_,reject)=>fail=reject));const processing=f.h.reportNamedAssignments(f.owner,f.requestId,randomUUID(),[f.result],new AbortController().signal,async()=>{});while(!fail)await new Promise(resolve=>setImmediate(resolve));const settling=f.w.reportDone;assert(settling);fail(Error('Generated report transport failure'));await assert.rejects(processing,/transport failure/);await settling;assert.equal(f.r.state.reports[0].status,'failed');assert.equal(f.w.report,undefined);
});

test('active report snapshots are owner-bound and exclude settled reports without claiming an ordinary response',async()=>{const f=fixture(),view={id:randomUUID(),status:'running'},report={...f.r,report:view};f.w.report=report;assert.deepEqual(f.h.activeReports(f.owner),[{requestId:f.requestId,conversationId:f.r.conversation,reportId:view.id}]);assert.deepEqual(f.h.activeReports(randomUUID()),[]);assert.deepEqual(f.h.active(f.owner),[]);view.status='completed';assert.deepEqual(f.h.activeReports(f.owner),[]);});
