const test=require('node:test'),assert=require('node:assert/strict');
const {CodexHarness}=require('../build/codex-harness.js');
const state=(threadId='root')=>({version:'0.163.0',threadId,turnId:'turn',items:[],approvals:[],steering:[]});
const command=(threadId='root',processId='opaque-process',id='command')=>({threadId,turnId:'turn',completed:false,item:{type:'commandExecution',id,processId,status:'inProgress',command:'node preview.cjs',cwd:'C:/owned',aggregatedOutput:'ready',exitCode:null}});
function fixture(){
 const calls=[],events=[],h=new CodexHarness({}, {},'unused','unused',(_,event)=>events.push(event),async()=>{});
 h.persist=async()=>{};
 const w={owner:'alice',children:new Map(),client:{request:async(method,args)=>{calls.push({method,args});if(method==='thread/backgroundTerminals/list')return {data:[{...r.state.items[0].item,itemId:'command'}],nextCursor:null};return {terminated:true};}}};
 const r={owner:'alice',conversation:'chat',request:{id:'request'},worker:w,state:state(),rootFinished:true,ended:false,save:Promise.resolve(),validate:async()=>{}};
 r.state.items.push(command());h.contexts.set('request',r);h.workers.add(w);return {h,w,r,calls,events};
}
test('a background native terminal keeps its worker busy after the parent response',()=>{
 const {h,w}=fixture();assert.equal(h.busy,true);assert.equal(h.freeWorkers,7);h.settle(w);assert.equal(w.idle,undefined);assert(w.backgroundTimer);clearTimeout(w.backgroundTimer);
});
test('actual scoped terminal enumeration retains a running command and marks an absent one exited',async()=>{
 const {h,w,r,calls}=fixture();await h.refreshBackgrounds(w);assert.equal(r.state.items[0].background,'running');assert.equal(h.busy,true);
 w.client.request=async(method,args)=>{calls.push({method,args});return {data:[],nextCursor:null};};await h.refreshBackgrounds(w);assert.equal(r.state.items[0].background,'exited');assert.equal(h.busy,false);assert.equal(r.state.items[0].item.exitCode,null);h.settle(w);assert(w.idle);clearTimeout(w.idle);
});
test('terminal listing failure preserves a working server and does not arm idle disposal',async()=>{
 const {h,w,r}=fixture();w.client.request=async()=>{throw Error('temporary transport failure');};await assert.rejects(h.refreshBackgrounds(w),/temporary/);assert.equal(h.busy,true);assert.equal(r.state.items[0].background,undefined);h.settle(w);assert(!w.idle);clearTimeout(w.backgroundTimer);
});
test('an older background command remains discoverable while a later turn is running, without probing its foreground command',async()=>{
 const {h,w,r,calls}=fixture();w.current={state:state(),turnRunning:true};w.current.state.turnId='later';w.current.state.items.push({...command('root','new-process','new-command'),turnId:'later'});h.contexts.set('later',{...r,request:{id:'later'},state:w.current.state,rootFinished:false});
 const list=await h.backgrounds('alice','request','root');assert.equal(list.length,1);assert.equal(list[0].processId,'opaque-process');assert.equal(w.current.state.items[0].background,undefined);assert.equal(calls.length,1);
});
test('stopping binds account, request, thread, item and opaque native process before sending an RPC',async()=>{
 const {h,w,r,calls}=fixture();
 for(const args of [['bob','request','root','command','opaque-process'],['alice','other','root','command','opaque-process'],['alice','request','child','command','opaque-process'],['alice','request','root','other','opaque-process'],['alice','request','root','command','12345']])await assert.rejects(h.stopBackground(...args),/unavailable|belong/);
 assert.equal(calls.length,0);await h.stopBackground('alice','request','root','command','opaque-process');assert.equal(r.state.items[0].background,'stopped');assert.deepEqual(calls.find(c=>c.method.endsWith('/terminate')).args,{threadId:'root',processId:'opaque-process'});assert.equal(h.busy,false);clearTimeout(w.idle);
});
test('a changed native item identity cannot terminate a replacement process',async()=>{
 const {h,w,r,calls}=fixture();w.client.request=async(method,args)=>{calls.push({method,args});return {data:[{itemId:'replacement',processId:'opaque-process'}],nextCursor:null};};
 await assert.rejects(h.stopBackground('alice','request','root','command','opaque-process'),/already|changed|no longer/);assert(!calls.some(c=>c.method.endsWith('/terminate')));assert.equal(r.state.items[0].background,'exited');
});
test('late command output and completion route to the original completed request during a later turn',()=>{
 const {h,w,r}=fixture();h.publish=()=>{};h.settle=()=>{};w.current={...r,request:{id:'next'},state:state()};w.current.state.turnId='later';
 h.dispatch(w,'item/commandExecution/outputDelta',{threadId:'root',turnId:'turn',itemId:'command',delta:' later output'});
 assert.equal(r.state.items[0].item.aggregatedOutput,'ready later output');assert.equal(w.current.state.items.length,0);
 h.dispatch(w,'item/completed',{threadId:'root',turnId:'turn',item:{...r.state.items[0].item,status:'completed',exitCode:0}});
 assert.equal(r.state.items[0].completed,true);assert.equal(r.state.items[0].item.exitCode,0);assert.equal(h.busy,true);w.current=undefined;assert.equal(h.busy,false);
});
test('a child terminal is mirrored once in live controls and stopping it leaves a sibling running',async()=>{
 const {h,w,r}=fixture(),childState=state('child');childState.items.push(command('child','child-process','child-command'));r.state.items.push(structuredClone(childState.items[0]));
 r.state.children=[{threadId:'child',status:'completed',delivery:'delivered',state:childState}];w.children.set('child',{root:r,view:r.state.children[0]});
 w.client.request=async(method,args)=>method.endsWith('/list')?{data:[{itemId:args.threadId==='root'?'command':'child-command',processId:args.threadId==='root'?'opaque-process':'child-process'}],nextCursor:null}:{terminated:true};
 const list=await h.backgrounds('alice','request','child');assert.equal(list.length,1);await h.stopBackground('alice','request','child','child-command','child-process');assert.equal(childState.items[0].background,'stopped');assert.equal(r.state.items[1].background,'stopped');assert.equal(r.state.items[0].background,'running');assert.equal(h.busy,true);clearTimeout(w.backgroundTimer);
});
test('revoking an old request stops its terminal while a later independently owned turn remains active',async()=>{
 const {h,w,r,calls}=fixture();let disposed=false;h.dispose=async()=>{disposed=true;};w.current={owner:'alice',request:{id:'later'},ended:false,turnRunning:true};
 await h.stopRequests('alice',new Set(['request']),'Coordination grant revoked.');assert.equal(r.state.items[0].background,'stopped');assert.equal(r.state.items[0].backgroundNote,'Coordination grant revoked.');assert.equal(disposed,false);assert.equal(w.current.request.id,'later');assert(calls.some(call=>call.method.endsWith('/terminate')));
});
test('restart recovery visits later pages and marks prior-session commands interrupted without executing them',async()=>{
 const {h,r}=fixture(),rows=Array.from({length:501},(_,n)=>({request_id:'saved-'+n,user_id:'alice',state:state('root-'+n)})),calls=[];rows[500].state.items.push(command('root-500'));
 h.db={from(){let offset=0,patch,request;const q={select(){return q;},order(){return q;},range(n){offset=n;return q;},update(value){patch=value;return q;},eq(key,value){if(key==='request_id')request=value;return q;},then(resolve){if(patch){calls.push(request);Object.assign(rows.find(row=>row.request_id===request),structuredClone(patch));return Promise.resolve({data:[],error:null}).then(resolve);}return Promise.resolve({data:structuredClone(rows.slice(offset,offset+500)),error:null}).then(resolve);}};return q;}};
 await h.recover();assert.deepEqual(calls,['saved-500']);assert.equal(rows[500].state.items[0].background,'interrupted');assert.match(rows[500].state.items[0].backgroundNote,/not restarted/);assert.equal(r.state.items[0].background,undefined);
});
