const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{randomUUID}=require('node:crypto');
const build=process.env.AGENTOPIA_TEST_BUILD||path.resolve(__dirname,'../build');
const {ChromeRuntime}=require(path.join(build,'chrome-runtime.js'));
function fixture(){
 const owner=randomUUID(),other=randomUUID(),runtime=new ChromeRuntime('unused','unused'),calls=[];
 let rows=[{id:1,url:'https://example.test/first',title:'First page',selected:true},{id:2,url:'https://example.test/second',title:'Second page',selected:false}];
 const session={phase:'connected',epoch:randomUUID(),mode:'existing',controller:new AbortController(),queue:Promise.resolve(),staged:new Map(),tools:['list_pages','select_page','evaluate_script'].map(name=>({name})),client:{callTool:async({name,arguments:args})=>{
  calls.push({name,args});
  if(name==='list_pages')return {structuredContent:{pages:structuredClone(rows)}};
  if(name==='select_page'){if(!rows.some(row=>row.id===args.pageId))throw Error('Page closed');rows.forEach(row=>row.selected=row.id===args.pageId);return {};}
  if(name==='evaluate_script'){assert(!('filePath'in args)&&!('sourcePath'in args));const row=rows.find(row=>row.id===args.pageId);assert(row);return {content:[{type:'text',text:'Script ran on page and returned:\n```json\n'+JSON.stringify({url:row.url,title:row.title,text:'Visible public page text',truncated:false})+'\n```'}]};}
  throw Error('Unexpected tool');
 }}};
 runtime.sessions.set(owner,session);
 return {owner,other,runtime,session,calls,guard:async()=>{},signal:new AbortController().signal,get rows(){return rows},set rows(value){rows=value}};
}
test('connected tab metadata has stable opaque handles and requires no page read',async()=>{
 const f=fixture(),a=await f.runtime.context.list(f.owner,f.signal,f.guard),b=await f.runtime.context.list(f.owner,f.signal,f.guard);
 assert.equal(a.tabs.length,2);assert.deepEqual(a,b);assert(a.tabs.every(row=>/^[a-f0-9-]{36}$/.test(row.id)&&row.browser==='chrome'));assert(f.calls.every(row=>row.name==='list_pages'));
});
test('selecting a Chrome tab captures bounded source text without changing the earlier target or focusing',async()=>{
 const f=fixture(),{tabs}=await f.runtime.context.list(f.owner,f.signal,f.guard),source=await f.runtime.context.read(f.owner,tabs[1].id,tabs[1].url,f.signal,f.guard);
 assert.equal(source.id,tabs[1].id);assert.equal(source.text,'Visible public page text');assert.match(source.notice,/form values and editable fields are excluded/);assert.equal(f.rows.find(row=>row.selected).id,1);
 assert(!f.calls.some(row=>row.name==='select_page'));assert.equal(f.calls.find(row=>row.name==='evaluate_script').args.pageId,2);
});
test('disconnected and foreign accounts have no context catalog, and foreign handles cannot read',async()=>{
 const f=fixture(),{tabs}=await f.runtime.context.list(f.owner,f.signal,f.guard);assert.deepEqual(await f.runtime.context.list(f.other,f.signal,f.guard),{tabs:[]});
 const count=f.calls.length;await assert.rejects(f.runtime.context.read(f.other,tabs[0].id,tabs[0].url,f.signal,f.guard),/available Chrome tab/);assert.equal(f.calls.length,count);
});
test('non-web and credential-bearing URLs are excluded from the picker',async()=>{
 const f=fixture();f.rows.push(...['file:///private.txt','chrome://settings','https://user:secret@example.test/','javascript:alert(1)'].map((url,i)=>({id:i+3,url,title:'Excluded'})));
 assert.equal((await f.runtime.context.list(f.owner,f.signal,f.guard)).tabs.length,2);
});
test('closed and navigated tabs are refused before text evaluation',async()=>{
 for(const closed of [false,true]){const f=fixture(),{tabs}=await f.runtime.context.list(f.owner,f.signal,f.guard);if(closed)f.rows=[];else f.rows[0].url='https://example.test/new';
  await assert.rejects(f.runtime.context.read(f.owner,tabs[0].id,tabs[0].url,f.signal,f.guard),/closed or navigated/);assert(!f.calls.some(row=>row.name==='evaluate_script'));
 }
});
test('a reconnect invalidates old handles even when the same page ID and URL return',async()=>{
 const f=fixture(),{tabs}=await f.runtime.context.list(f.owner,f.signal,f.guard);f.session.epoch=randomUUID();
 await assert.rejects(f.runtime.context.read(f.owner,tabs[0].id,tabs[0].url,f.signal,f.guard),/connection changed/);
 const fresh=await f.runtime.context.list(f.owner,f.signal,f.guard);assert.notEqual(fresh.tabs[0].id,tabs[0].id);
});
test('account or plugin revocation during a read cannot return page text',async()=>{
 const f=fixture(),{tabs}=await f.runtime.context.list(f.owner,f.signal,f.guard);let revoked=false;
 const original=f.session.client.callTool;f.session.client.callTool=async args=>{const value=await original(args);if(args.name==='evaluate_script')revoked=true;return value;};
 await assert.rejects(f.runtime.context.read(f.owner,tabs[0].id,tabs[0].url,f.signal,async()=>{if(revoked)throw Error('Account changed');}),/Account changed/);
});
test('navigation during evaluation prevents returning a snapshot',async()=>{
 const f=fixture(),{tabs}=await f.runtime.context.list(f.owner,f.signal,f.guard),original=f.session.client.callTool;
 f.session.client.callTool=async args=>{const value=await original(args);if(args.name==='evaluate_script')f.rows[0].url='https://example.test/new';return value;};
 await assert.rejects(f.runtime.context.read(f.owner,tabs[0].id,tabs[0].url,f.signal,f.guard),/page or connection changed/);
});
test('aborted or replaced sessions refuse work before reading a page',async()=>{
 for(const replace of [false,true]){const f=fixture(),{tabs}=await f.runtime.context.list(f.owner,f.signal,f.guard);if(replace)f.runtime.sessions.delete(f.owner);else f.session.controller.abort();
  await assert.rejects(f.runtime.context.read(f.owner,tabs[0].id,tabs[0].url,f.signal,f.guard));assert(!f.calls.some(row=>row.name==='evaluate_script'));
 }
});
test('malformed, oversized and failed snapshot results never become attached context',async()=>{
 for(const result of [{isError:true},{content:[]},{content:[{type:'text',text:'Script ran on page and returned:\n```json\n'+JSON.stringify({url:'https://example.test/first',title:'Title',text:'x'.repeat(12001),truncated:true})+'\n```'}]}]){
  const f=fixture(),{tabs}=await f.runtime.context.list(f.owner,f.signal,f.guard),original=f.session.client.callTool;f.session.client.callTool=args=>args.name==='evaluate_script'?Promise.resolve(result):original(args);
  await assert.rejects(f.runtime.context.read(f.owner,tabs[0].id,tabs[0].url,f.signal,f.guard),/snapshot|could not read/);
 }
});
test('the entire context read is serialized with existing agent Chrome operations',async()=>{
 const f=fixture(),{tabs}=await f.runtime.context.list(f.owner,f.signal,f.guard),original=f.session.client.callTool;let release,reading;
 const started=new Promise(resolve=>reading=resolve);f.session.client.callTool=async args=>{if(args.name==='evaluate_script'){reading();await new Promise(resolve=>release=resolve);}return original(args);};
 const first=f.runtime.context.read(f.owner,tabs[1].id,tabs[1].url,f.signal,f.guard);await started;
 const second=f.runtime.call(f.owner,'list_pages',{},f.signal,f.guard);const before=f.calls.length;await new Promise(resolve=>setImmediate(resolve));assert.equal(f.calls.length,before);release();await first;await second;
 assert.equal(f.calls.at(-2).name,'list_pages');assert.equal(f.calls.at(-1).name,'list_pages');assert(!f.calls.some(row=>row.name==='select_page'));
});
