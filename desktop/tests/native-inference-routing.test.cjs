const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {CodexGateway,NativeAuthorizationError}=require(path.join(process.env.AGENTOPIA_GOAL_BUILD,'codex-gateway.js')),{CodexHarness}=require(path.join(process.env.AGENTOPIA_GOAL_BUILD,'codex-harness.js'));
const threadId=randomUUID(),turnId=randomUUID(),headers=()=>({'thread-id':threadId,'x-codex-turn-metadata':JSON.stringify({thread_id:threadId,turn_id:turnId})}),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('missing, mismatched and oversized routing are rejected before credential retrieval',async()=>{
 let credentials=0;const gateway=await new CodexGateway('openrouter',async()=>{credentials++;throw Error('No credential expected');},new Set(['owned-model'])).start(),fetcher=global.fetch;
 try{for(const extra of [{},{...headers(),'thread-id':randomUUID()},{...headers(),'x-codex-turn-metadata':'invalid JSON'},{...headers(),'x-codex-turn-metadata':JSON.stringify({thread_id:threadId,turn_id:'not-a-turn'})},{...headers(),'x-codex-turn-metadata':JSON.stringify({thread_id:threadId,turn_id:turnId,padding:'x'.repeat(8193)})}]){const reply=await fetcher(gateway.baseUrl+'/responses',{method:'POST',headers:{Authorization:'Bearer '+gateway.bearer,'Content-Type':'application/json',...extra},body:JSON.stringify({model:'owned-model',input:[]})});assert.equal(reply.status,400);assert((await reply.text()).includes('native_turn_not_authorized'));}assert.equal(credentials,0);}finally{gateway.close();}
});
test('a local execution refusal returns a non-retryable 403 and never forwards inference',async()=>{
 const original=global.fetch;let upstream=0,credentialScope;const gateway=await new CodexGateway('openrouter',async scope=>{credentialScope=scope;throw new NativeAuthorizationError('This native turn has been stopped.');},new Set(['owned-model'])).start();global.fetch=async()=>{upstream++;throw Error('No upstream request expected');};try{const reply=await original(gateway.baseUrl+'/responses',{method:'POST',headers:{Authorization:'Bearer '+gateway.bearer,'Content-Type':'application/json',...headers(),'session-id':randomUUID()},body:JSON.stringify({model:'owned-model',input:[]})});assert.equal(reply.status,403);assert.equal(upstream,0);assert.equal(credentialScope.threadId,threadId);assert.equal(credentialScope.turnId,turnId);assert(credentialScope.signal instanceof AbortSignal);}finally{global.fetch=original;gateway.close();}
});
function fixture(){const harness=new CodexHarness({}, {},'unused','unused',()=>{},async()=>{}),owner=randomUUID(),parent=new AbortController(),child=new AbortController(),root={owner,ended:false,rootFinished:true,turnRunning:false,controller:parent,save:Promise.resolve(),validate:async()=>{},state:{threadId:randomUUID(),turnId:randomUUID()}},view={threadId,turnId,status:'running',state:{threadId,turnId},delivery:'waiting'},worker={owner,children:new Map([[threadId,{view,root,controller:child,starting:false}]])};return {harness,worker,root,parent,child,view,scope:{threadId,turnId,signal:new AbortController().signal}};}
test('a child uses its own live controller and does not validate a cancelled parent or unrelated sibling',async()=>{
 const f=fixture();f.parent.abort();let validations=0;f.root.validate=async()=>validations++;const sibling=new AbortController();sibling.abort();f.worker.children.set(randomUUID(),{view:{status:'running',state:{threadId:randomUUID(),turnId:randomUUID()}},root:{...f.root,validate:async()=>{throw Error('Unrelated sibling validation');}},controller:sibling});assert.equal(await f.harness.inferenceOwner(f.worker,f.scope),f.root);assert.equal(validations,1);f.child.abort();await assert.rejects(f.harness.inferenceOwner(f.worker,f.scope),error=>error instanceof NativeAuthorizationError&&error.status===403);
});

test('native tools preserve independent child ownership after parent completion and validate the calling thread',async()=>{
 const f=fixture();f.parent.abort();let observed;f.root.validate=async thread=>{observed=thread;};
 const result=await f.harness.toolOwner(f.worker,threadId,new AbortController().signal);
 assert.equal(result.record,f.root);assert.equal(observed,threadId);assert.equal(result.signal.aborted,false);
});

test('a tool request cannot revive a stopped or completed native child',async()=>{
 for(const status of ['cancelled','completed','failed','interrupted']){
  const f=fixture();f.view.status=status;let validations=0;f.root.validate=async()=>validations++;
  await assert.rejects(f.harness.toolOwner(f.worker,threadId,new AbortController().signal),/active owned native thread/);
  assert.equal(f.view.status,status);assert.equal(validations,0);
 }
 const aborted=fixture();aborted.child.abort();await assert.rejects(aborted.harness.toolOwner(aborted.worker,threadId,new AbortController().signal),error=>error.name==='AbortError');
});

test('root tool calls require a live root turn and recheck cancellation after asynchronous permission validation',async()=>{
 const f=fixture();f.worker.current=f.root;f.root.rootFinished=false;f.root.turnRunning=true;f.worker.children.clear();
 assert.equal((await f.harness.toolOwner(f.worker,f.root.state.threadId,new AbortController().signal)).record,f.root);
 f.root.turnRunning=false;await assert.rejects(f.harness.toolOwner(f.worker,f.root.state.threadId,new AbortController().signal),/active owned native thread/);
 const child=fixture();child.root.validate=async()=>{child.view.status='cancelled';};await assert.rejects(child.harness.toolOwner(child.worker,threadId,new AbortController().signal),/stopped before/);
 const moved=fixture();moved.root.validate=async()=>{moved.view.state.turnId=randomUUID();};await assert.rejects(moved.harness.toolOwner(moved.worker,threadId,new AbortController().signal),/stopped before/);
 const foreign=fixture();foreign.root.owner=randomUUID();await assert.rejects(foreign.harness.toolOwner(foreign.worker,threadId,new AbortController().signal),/active owned/);
});
test('an unknown thread cannot borrow another active execution while awaiting trusted ownership',async()=>{
 const f=fixture(),signal=new AbortController();let checked=0;f.root.validate=async()=>checked++;const pending=f.harness.inferenceOwner(f.worker,{threadId:randomUUID(),turnId,signal:signal.signal});await sleep(30);assert.equal(checked,0);signal.abort();await assert.rejects(pending,error=>error.name==='AbortError');assert.equal(f.worker.activity.size,0);
});
test('trusted start notification wakes an early HTTP request without authorizing its previous turn',async()=>{
 const f=fixture();f.view.state.turnId='';f.view.turnId='';let done=false;const pending=f.harness.inferenceOwner(f.worker,f.scope).then(value=>{done=true;return value;});await sleep(20);assert.equal(done,false);f.view.state.turnId=turnId;f.view.turnId=turnId;f.harness.wake(f.worker);assert.equal(await pending,f.root);assert.equal(f.worker.activity.size,0);
});
test('permission changes during validation prevent authorization and unrelated workers remain available',async()=>{
 const f=fixture();f.root.validate=async()=>f.child.abort();await assert.rejects(f.harness.inferenceOwner(f.worker,f.scope),error=>error instanceof NativeAuthorizationError&&error.status===403);const other=fixture();assert.equal(await other.harness.inferenceOwner(other.worker,other.scope),other.root);
});
test('a caller abort during credential retrieval cannot start an upstream request',async()=>{
 const original=global.fetch;let scope,release,upstream=0;const gate=new Promise(resolve=>release=resolve),gateway=await new CodexGateway('openrouter',async value=>{scope=value;await gate;return 'OWNED-UNSENT-KEY';},new Set(['owned-model'])).start(),controller=new AbortController();global.fetch=async()=>{upstream++;throw Error('No upstream request expected');};
 try{const pending=original(gateway.baseUrl+'/responses',{method:'POST',headers:{Authorization:'Bearer '+gateway.bearer,'Content-Type':'application/json',...headers()},body:JSON.stringify({model:'owned-model',input:[]}),signal:controller.signal});void pending.catch(()=>{});for(let i=0;i<100&&!scope;i++)await sleep(5);assert(scope);controller.abort();await assert.rejects(pending,error=>error.name==='AbortError');for(let i=0;i<100&&!scope.signal.aborted;i++)await sleep(5);assert(scope.signal.aborted);release();await sleep(20);assert.equal(upstream,0);}finally{release();global.fetch=original;gateway.close();}
});
