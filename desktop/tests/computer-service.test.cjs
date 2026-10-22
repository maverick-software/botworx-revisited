const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {ComputerService}=require('../build/computer-service.js'),{computerDefinitions}=require('../build/computer-definitions.js'),{chatOptions}=require('../build/composer.js'),{nativeMcpResult}=require('../build/mcp-content.js');
const owner={id:randomUUID(),email:'fixture@example.test',admin:true},other={...owner,id:randomUUID()},guard=async()=>{},signal=()=>new AbortController().signal;
const box={left:-800,top:40,width:800,height:600};
function fixture(){
 let pixels='original',captures=0,size={width:400,height:300};const window={handle:'42',pid:123,started:'639278142276790679',app:'Verification',title:'Controlled fixture',className:'Fixture',client:{...box},frame:{...box},outer:{...box},captures:[],rootOwner:'42',popup:'42',enabled:true,minimized:false,foreground:false,blocked:null};
 const client={epoch:randomUUID(),calls:[],async request(method,args,abort){abort.throwIfAborted();this.calls.push({method,args});if(method==='windows')return [{...window}];if(method==='inspect')return structuredClone(window);if(method==='snapshot')return {id:randomUUID(),window:structuredClone(window),nodes:[{ref:'e1',role:'Edit',name:'Note',automationId:'note',bounds:{left:-700,top:140,width:200,height:40},enabled:true,focused:true}],focused:'e1',truncated:false};if(method==='action')return {sent:true,kind:args.kind};throw new Error('Unexpected native method');},async close(){this.epoch=randomUUID();}};
 const image=()=>{const version=pixels;return {getSize:()=>({...size}),toJPEG:()=>Buffer.from([255,216,255,217]),crop:()=>({toBitmap:()=>Buffer.from(version)})};};
 const service=new ComputerService('',async()=>{captures++;return image();},client);
 return {service,client,window,setSize:value=>size=value,setPixels:value=>pixels=value,get captures(){return captures;},async grant(){const choices=await service.choicesFor(owner,[],guard),[ref]=await service.select(owner,[choices[0].id],[],guard);return {ref,options:{thinking:'default',mode:'chat',permission:'ask',files:[],windows:[ref.id]}};}};
}
const snapshot=async(f,options,ref)=>await(await f.service.prepare(owner,options,'computer_snapshot',{window_id:ref.id},guard)).run(signal());
const click=(ref,snap)=>({window_id:ref.id,snapshot_id:snap.snapshot_id,ref:null,x:100,y:100,button:'left',count:1});

test('computer tools require administrator, explicit sharing and input permissions; Plan remains read-only',()=>{
 const options={thinking:'high',permission:'ask',mode:'chat',files:[],windows:[randomUUID()]};assert.equal(computerDefinitions(owner,options).length,7);
 for(const value of [{...options,windows:[]},{...options,permission:'chat'},{...options,permission:'files'}])assert.equal(computerDefinitions(owner,value).length,0);
 assert.equal(computerDefinitions({...owner,admin:false},options).length,0);assert.deepEqual(computerDefinitions(owner,{...options,mode:'plan'}).map(d=>d.name),['computer_windows','computer_snapshot']);
 assert.deepEqual(chatOptions({...options,provider:'openrouter'}).windows,options.windows);assert.deepEqual(chatOptions({...options,provider:'openai-oauth'}).windows,options.windows);
 for(const windows of ['bad',[42],Array.from({length:6},()=>randomUUID())])assert.throws(()=>chatOptions({...options,windows}));
});
test('sharing is an explicit owner-bound grant, with stale-list and duplicate protection',async()=>{
 const f=fixture(),choices=await f.service.choicesFor(owner,[],guard);await assert.rejects(f.service.select(other,[choices[0].id],[],guard));await assert.rejects(f.service.select(owner,[choices[0].id,choices[0].id],[],guard));
 await f.service.choicesFor(owner,[],guard);await assert.rejects(f.service.select(owner,[choices[0].id],[],guard),/expired/);
 const {ref,options}=await f.grant();assert(!f.service.references(other.id,[ref.id])[0].available);await assert.rejects(f.service.prepare(other,options,'computer_snapshot',{window_id:ref.id},guard));await assert.rejects(f.service.prepare(owner,{...options,windows:[]},'computer_snapshot',{window_id:ref.id},guard));
 f.service.revoke(owner.id,ref.id);await assert.rejects(snapshot(f,options,ref));assert.equal(f.captures,0);await f.service.stop();
});
test('observations map negative desktop coordinates and return follow-up images as native image content',async()=>{
 const f=fixture(),{ref,options}=await f.grant();assert.equal((await f.service.prepare(owner,options,'computer_snapshot',{window_id:ref.id},guard)).review,false);const observed=await snapshot(f,options,ref);assert.equal(observed.width,400);assert.equal(observed.nodes[0].bounds.x,50);assert.equal(observed.nodes[0].bounds.y,50);assert.equal(observed.window.foreground,false);
 const prepared=await f.service.prepare(owner,options,'computer_click',click(ref,observed),guard);assert(prepared.review);assert.equal(f.client.calls.filter(c=>c.method==='action').length,0);
 const result=await prepared.run(signal()),action=f.client.calls.find(c=>c.method==='action');assert.equal(action.args.x,-600);assert.equal(action.args.y,240);assert(result.sent&&result.observation.snapshot_id);assert.equal(result.observation.content,undefined);
 const native=nativeMcpResult(result);assert.equal(native.content[1].type,'image');assert(!native.content[0].text.includes(result.content[0].data));await assert.rejects(prepared.run(signal()),/stale/);await f.service.stop();
});
test('revoked windows, changed target pixels, helper restarts and resized windows prevent reviewed input',async()=>{
 for(const change of ['revoke','pixels','restart','geometry']){const f=fixture(),{ref,options}=await f.grant(),observed=await snapshot(f,options,ref),prepared=await f.service.prepare(owner,options,'computer_click',click(ref,observed),guard);
  if(change==='revoke')f.service.revoke(owner.id,ref.id);if(change==='pixels')f.setPixels('changed');if(change==='restart')f.client.epoch=randomUUID();if(change==='geometry')f.window.client.left++;
  await assert.rejects(prepared.run(signal()));assert.equal(f.client.calls.filter(c=>c.method==='action').length,0,change);await f.service.stop();}
});
test('uncertain native input consumes its snapshot; failed follow-up capture preserves a sent receipt',async()=>{
 const f=fixture(),{ref,options}=await f.grant(),observed=await snapshot(f,options,ref),prepared=await f.service.prepare(owner,options,'computer_click',click(ref,observed),guard),request=f.client.request.bind(f.client);
 f.client.request=async(method,args,s)=>{if(method==='action')throw new Error('Uncertain input outcome');return request(method,args,s);};await assert.rejects(prepared.run(signal()),/Uncertain/);await assert.rejects(prepared.run(signal()),/stale/);
 f.client.request=request;const next=await snapshot(f,options,ref),input=await f.service.prepare(owner,options,'computer_click',click(ref,next),guard);let sent=false;
 f.client.request=async(method,args,s)=>{if(method==='action'){sent=true;return {sent:true};}if(sent&&method==='snapshot')throw new Error('Window closed after input');return request(method,args,s);};const result=await input.run(signal());assert(result.sent);assert.match(result.observation_error,/closed/);await f.service.stop();
});
test('the OS queue serializes calls and emergency stop aborts in-flight and queued work',async()=>{
 const f=fixture(),{ref,options}=await f.grant(),observed=await snapshot(f,options,ref),prepared=await f.service.prepare(owner,options,'computer_click',click(ref,observed),guard),request=f.client.request.bind(f.client);let started;const running=new Promise(resolve=>started=resolve);let active=0,max=0;
 f.client.request=async(method,args,s)=>{if(method==='action'){active++;max=Math.max(max,active);started();try{await new Promise((resolve,reject)=>{s.addEventListener('abort',()=>reject(s.reason),{once:true});if(s.aborted)reject(s.reason);});}finally{active--;}}return request(method,args,s);};
 const first=prepared.run(signal());first.catch(()=>{});await running;const queued=snapshot(f,options,ref);queued.catch(()=>{});assert(f.service.status(owner.id).active);await f.service.stop(owner.id);await assert.rejects(first);await assert.rejects(queued);assert.equal(max,1);assert.equal(f.service.status(owner.id).selected,0);
});
test('expired grants can be replaced atomically and removal is idempotent without changing another owner',async()=>{
 const f=fixture(),{ref}=await f.grant(),stale=randomUUID(),choices=await f.service.choicesFor(owner,[ref.id,stale],guard),selected=await f.service.select(owner,[choices[0].id],[ref.id,stale],guard);assert.equal(selected[0].id,ref.id);f.service.revoke(owner.id,stale);
 const theirs=await f.service.choicesFor(other,[],guard),[foreign]=await f.service.select(other,[theirs[0].id],[],guard),ours=await f.service.choicesFor(owner,[ref.id],guard);await assert.rejects(f.service.select(owner,[],[ref.id,foreign.id],guard),/another account/);assert(f.service.references(owner.id,[ref.id])[0].available);assert(f.service.references(other.id,[foreign.id])[0].available);assert.throws(()=>f.service.revoke(owner.id,foreign.id));
 f.service.revoke(owner.id,ref.id);f.service.revoke(owner.id,ref.id);await f.service.stop();
});
test('capture geometry includes Chromium resize-border cropping and refuses ambiguous image bounds',async()=>{
 const f=fixture();Object.assign(f.window,{client:{left:108,top:131,width:760,height:500},frame:{left:107,top:100,width:762,height:532},outer:{left:100,top:100,width:776,height:539},captures:[{left:104,top:101,width:768,height:534}]});f.setSize({width:1280,height:890});const {ref,options}=await f.grant(),observed=await snapshot(f,options,ref),prepared=await f.service.prepare(owner,options,'computer_click',click(ref,observed),guard);await prepared.run(signal());const action=f.client.calls.find(c=>c.method==='action');assert.equal(action.args.x,164);assert.equal(action.args.y,161);await f.service.stop();
 const ambiguous=fixture();ambiguous.window.outer={left:-808,top:32,width:816,height:612};const grant=await ambiguous.grant();await assert.rejects(snapshot(ambiguous,grant.options,grant.ref),/ambiguous/);await ambiguous.service.stop();
});
test('window-only drafts survive reload and clearing an existing chat cannot restore an earlier window grant',async()=>{
 const {ChatDrafts}=require('../build/chat-drafts.js'),values=new Map(),drafts=new ChatDrafts({get:key=>values.get(key),set:async(key,value)=>values.set(key,value)}),scope='conversation:'+randomUUID(),fresh='new:'+randomUUID()+':home',id=randomUUID();
 await drafts.save(owner.id,scope,{text:'',options:{files:[],windows:[id]}});assert.deepEqual(drafts.get(owner.id,scope).options.windows,[id]);await drafts.save(owner.id,scope,{text:'',options:{files:[],windows:[]}});assert.deepEqual(drafts.get(owner.id,scope).options.windows,[]);assert.equal(drafts.get(other.id,scope),null);
 await drafts.save(owner.id,fresh,{text:'',options:{files:[],windows:[]}});assert.equal(drafts.get(owner.id,fresh),null);await drafts.remove(owner.id,scope);assert.equal(drafts.get(owner.id,scope),null);
});
test('input review identifies the observed control and its local preview is owner-bound and revocable',async()=>{
 const f=fixture(),{ref,options}=await f.grant(),observed=await snapshot(f,options,ref),prepared=await f.service.prepare(owner,options,'computer_click',{...click(ref,observed),ref:'e1',x:null,y:null},guard);
 assert.equal(prepared.approval.arguments.target,'Note (Edit)');assert.equal(prepared.approval.arguments.ref,undefined);assert.equal(prepared.approval.preview.snapshotId,observed.snapshot_id);assert.deepEqual(prepared.approval.preview.target,{x:50,y:50,width:100,height:20});assert(f.service.preview(owner,observed.snapshot_id).image.startsWith('data:image/jpeg;base64,'));assert.throws(()=>f.service.preview(other,observed.snapshot_id));assert.throws(()=>f.service.preview({...owner,admin:false},observed.snapshot_id));
 f.client.epoch=randomUUID();assert.throws(()=>f.service.preview(owner,observed.snapshot_id));const next=await snapshot(f,options,ref);f.service.revoke(owner.id,ref.id);assert.throws(()=>f.service.preview(owner,next.snapshot_id));await f.service.stop();
});

test('revoking a share interrupts initial capture and final pixel revalidation before native input',async()=>{
 for(const phase of ['snapshot','review']){
  const f=fixture(),{ref,options}=await f.grant();let prepared;if(phase==='review'){const observed=await snapshot(f,options,ref);prepared=await f.service.prepare(owner,options,'computer_click',click(ref,observed),guard);}
  let started,capturedSignal;const reached=new Promise(resolve=>started=resolve);f.service.capture=async(window,abort)=>{capturedSignal=abort;started();await new Promise((resolve,reject)=>{abort.addEventListener('abort',()=>reject(abort.reason),{once:true});if(abort.aborted)reject(abort.reason);});};
  const work=phase==='snapshot'?snapshot(f,options,ref):prepared.run(signal());work.catch(()=>{});await reached;f.service.revoke(owner.id,ref.id);await assert.rejects(work);assert(capturedSignal.aborted);assert.equal(f.client.calls.filter(c=>c.method==='action').length,0);await f.service.stop();
 }
});

test('modal routing follows an explicit bounded owner chain and rejects unrelated windows or changed processes',async()=>{
 for(const mode of ['owned','nested','unowned','cycle','foreign','restarted']){
  const f=fixture(),{ref,options}=await f.grant(),base=structuredClone(f.window);f.window.popup='43';f.window.owner='0';f.window.enabled=false;
  const popup={...base,handle:'43',rootOwner:'43',owner:mode==='nested'||mode==='cycle'?'44':'42',popup:'43',title:'Owned verification details',enabled:true},middle={...base,handle:'44',rootOwner:'44',owner:mode==='cycle'?'43':'42',popup:'43'};
  if(mode==='unowned')popup.owner='0';if(mode==='foreign')popup.pid++;if(mode==='restarted')popup.started='different-process-start';const rows=new Map([['42',f.window],['43',popup],['44',middle]]),request=f.client.request.bind(f.client);
  f.client.request=async(method,args,abort)=>{if(method==='inspect'){f.client.calls.push({method,args});return structuredClone(rows.get(args.handle));}const result=await request(method,args,abort);return method==='snapshot'?{...result,window:structuredClone(rows.get(args.handle))}:result;};
  if(['owned','nested'].includes(mode)){const value=await snapshot(f,options,ref);assert.equal(value.window.title,popup.title);assert.equal(f.client.calls.find(c=>c.method==='snapshot').args.handle,'43');}
  else{await assert.rejects(snapshot(f,options,ref),/outside the shared window/);assert.equal(f.captures,0);assert(f.client.calls.length<10);}
  await f.service.stop();
 }
});
