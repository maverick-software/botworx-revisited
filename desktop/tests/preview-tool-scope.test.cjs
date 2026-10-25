const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),os=require('node:os');
const {mkdtemp,mkdir,writeFile,readFile,rm}=require('node:fs/promises');
const build=process.env.AGENTOPIA_PREVIEW_BUILD||path.resolve(__dirname,'../build');
const {previewToolScope,resolvePreviewToolScope,toolActivityTable,previewScopedToolNames}=require(path.join(build,'tool-execution-scope.js'));
const {ToolService}=require(path.join(build,'tool-service.js'));
const {WorkspaceFiles}=require(path.join(build,'workspace.js'));
const {WorkspaceTools,workspaceDefinitions,hashText}=require(path.join(build,'workspace-tools.js'));
const owner='11111111-1111-4111-8111-111111111111',other='99999999-9999-4999-8999-999999999999',requestId='22222222-2222-4222-8222-222222222222',session='33333333-3333-4333-8333-333333333333';
const user={id:owner,email:'preview-tools@example.invalid',admin:true},request={id:requestId,conversation_id:session,assistant_message_id:requestId+':assistant'};
const policy=()=>({tools:null,delegation:true,delegateAgents:null,memory:true,memoryWrite:true,maxDepth:2,maxTurns:10});
const options=()=>({permission:'ask',mode:'chat',thinking:'default',files:[]});
const make=(extra={})=>({owner,request:requestId,conversation:session,options:options(),policy:policy(),definitions:[],validate:async()=>{},...extra});

test('a serialized token cannot select preview storage and scope identity/options cannot be replaced',async()=>{
 assert.throws(()=>resolvePreviewToolScope({kind:'agent-draft-preview'},user,request,options()),/not created by the broker/);assert.throws(()=>toolActivityTable('foreign'),/Unknown/);
 const input=make(),token=previewToolScope(input),scope=resolvePreviewToolScope(token,user,request,{files:[],thinking:'default',mode:'chat',permission:'ask'});await scope.validate();
 for(const [u,r,o]of [[{...user,id:other},request,options()],[user,{...request,id:session},options()],[user,{...request,conversation_id:requestId},options()],[user,{...request,assistant_message_id:session},options()],[user,request,{...options(),permission:'full'}]])assert.throws(()=>resolvePreviewToolScope(token,u,r,o),/changed/);
 let release;const gate=new Promise(resolve=>release=resolve),changing=options(),held=resolvePreviewToolScope(previewToolScope(make({options:changing,validate:()=>gate})),user,request,changing),work=held.validate();changing.permission='full';release();await assert.rejects(work,/changed/);
});
test('scope policy and declarations are independent copies; incomplete execution families cannot be advertised',()=>{
 const input=make({definitions:[{name:'read_file',parameters:{type:'object',properties:{}}}]}),token=previewToolScope(input);input.policy.tools=[];input.definitions[0].name='run_command';const resolved=resolvePreviewToolScope(token,user,request,options());assert.equal(resolved.policy.tools,null);assert.equal(resolved.definitions[0].name,'read_file');
 for(const name of ['run_command','manage_file','invoke_agent','generate_image','browser_click'])assert.throws(()=>previewToolScope(make({definitions:[{name,parameters:{}}]})),/not implemented/);
});

class Secrets{rows=new Map();get(key){return this.rows.get(key);}async set(key,value){this.rows.set(key,value);}}
function storage(){
 const rows=[],tables=[],requestRow={id:requestId,user_id:owner,conversation_id:session,status:'completed'};
 return {rows,tables,requestRow,from(table){tables.push(table);if(!['desktop_preview_tool_calls','desktop_preview_requests'].includes(table))throw Error('An ordinary table was queried: '+table);let mode='read',insert,patch,filters=[];
  const query={select(){return query;},insert(value){mode='insert';insert=value;return query;},update(value){mode='update';patch=value;return query;},eq(key,value){filters.push(row=>key==='arguments->>provider_call_id'?row.arguments.provider_call_id===value:row[key]===value);return query;},is(key,value){filters.push(row=>(row[key]??null)===value);return query;},order(){return query;},single(){return execute(true);},maybeSingle(){return execute(true);},then(a,b){return execute(false).then(a,b);}};
  async function execute(single){
   if(table==='desktop_preview_requests')return {data:filters.every(test=>test(requestRow))?{...requestRow}:null,error:null};
   if(mode==='insert'){if(rows.some(row=>row.request_id===insert.request_id&&(row.native_thread_id??'')===(insert.native_thread_id??'')&&row.arguments.provider_call_id===insert.arguments.provider_call_id))return {data:null,error:{message:'duplicate preview tool identity'}};rows.push({...structuredClone(insert),created_at:new Date().toISOString()});return {data:structuredClone(rows.at(-1)),error:null};}
   const found=rows.filter(row=>filters.every(test=>test(row)));if(mode==='update')for(const row of found)Object.assign(row,structuredClone(patch));return {data:structuredClone(single?found[0]??null:found),error:null};
  }return query;
 }};
}
async function fixture(t,permission='ask'){
 const base=await mkdtemp(path.join(os.tmpdir(),'draft-preview-tools-'));t.after(async()=>{const target=path.resolve(base),parent=path.resolve(os.tmpdir());assert(target.startsWith(parent+path.sep)&&path.basename(target).startsWith('draft-preview-tools-'));await rm(target,{recursive:true,force:true});});
 const folder=path.join(base,'workspace');await mkdir(folder);await writeFile(path.join(folder,'note.md'),'Original\n');const files=new WorkspaceFiles(new Secrets()),[reference]=await files.add(owner,[folder]),workspace=new WorkspaceTools(files),db=storage(),events=[];
 const f={base,folder,files,reference,workspace,db,events,allowed:true,identity:{...user}},opts={...options(),permission,files:[reference.id]};
 const tools=new ToolService(db,workspace,(_,event)=>events.push(event),async()=>f.identity,undefined,undefined,{authorize(current){assert(current.admin);}});tools.planning.definitions=async()=>{throw Error('Normal saved-chat planning was called.');};tools.validateExecution=async()=>{throw Error('Normal request validation was called.');};tools.deliverChat=async()=>{throw Error('Normal delivery was called.');};
 const definitions=workspaceDefinitions(opts).filter(tool=>previewScopedToolNames.includes(tool.name)),guard=async()=>{if(!f.allowed)throw Error('Preview source or resource changed.');},scope=previewToolScope(make({options:opts,definitions,validate:guard}));
 const execute=(id,name,args,signal=new AbortController().signal,token=scope)=>tools.execute(user,request,{id,name,arguments:JSON.stringify(args)},opts,signal,undefined,undefined,'preview-native-thread',token);
 const args={reference_id:reference.id,path:'note.md'},change={...args,expected_hash:hashText('Original\n'),content:'Reviewed\n',reason:'Review the generated note.'};
 const pending=async id=>{for(let n=0;n<200;n++){const row=db.rows.find(row=>row.arguments.provider_call_id===id&&row.status==='awaiting_approval');if(row)return row;await new Promise(resolve=>setTimeout(resolve,2));}throw Error('No preview review appeared.');};
 return Object.assign(f,{tools,opts,scope,execute,args,change,pending});
}
test('the shared executor reads selected files with independent receipts and enforces the unsaved tool policy',async t=>{
 const f=await fixture(t);assert.equal((await f.execute('read','read_file',f.args)).content,'Original\n');assert.equal((await f.tools.list(owner,session,'agent-draft-preview')).length,1);assert(f.db.tables.every(table=>table==='desktop_preview_tool_calls'));
 const denied=previewToolScope(make({options:f.opts,definitions:workspaceDefinitions(f.opts).filter(tool=>tool.name==='write_file'),policy:{...policy(),tools:['workspace.read_file']}}));assert.match((await f.execute('forbidden','write_file',f.change,undefined,denied)).error,/draft agent policy/);assert.equal(f.db.rows.length,1);assert.equal(await readFile(path.join(f.folder,'note.md'),'utf8'),'Original\n');
});
test('preview review denial and exact retries never apply a file change',async t=>{
 const f=await fixture(t),work=f.execute('denied','write_file',f.change),row=await f.pending('denied');assert.equal(await readFile(path.join(f.folder,'note.md'),'utf8'),'Original\n');assert.equal(row.arguments.content,undefined);await f.tools.decide(owner,row.id,false);assert((await work).denied);assert((await f.execute('denied','write_file',f.change)).duplicate);assert.equal(f.db.rows.length,1);assert.equal(await readFile(path.join(f.folder,'note.md'),'utf8'),'Original\n');
});
test('approved preview file changes apply once, reject changed calls and support guarded undo',async t=>{
 const f=await fixture(t),work=f.execute('approved','write_file',f.change),row=await f.pending('approved');await f.tools.decide(owner,row.id,true);assert.equal((await work).sha256,hashText('Reviewed\n'));assert.equal(await readFile(path.join(f.folder,'note.md'),'utf8'),'Reviewed\n');assert((await f.execute('approved','write_file',f.change)).duplicate);assert.match((await f.execute('approved','write_file',{...f.change,content:'Different\n'})).error,/different arguments/);assert.match((await f.execute('approved','read_file',f.args)).error,/different arguments/);await f.tools.revert(owner,row.id,'agent-draft-preview');assert.equal(await readFile(path.join(f.folder,'note.md'),'utf8'),'Original\n');assert.equal(f.db.rows[0].status,'reverted');
});
test('a raced preview call has one review and one file mutation',async t=>{
 const f=await fixture(t),work=[f.execute('race','write_file',f.change),f.execute('race','write_file',f.change)];for(const promise of work)promise.catch(()=>{});const row=await f.pending('race');await f.tools.decide(owner,row.id,true);await Promise.allSettled(work);assert.equal(f.db.rows.length,1);assert.equal(f.events.filter(event=>event.tool?.status==='awaiting_approval').length,1);assert.equal(await readFile(path.join(f.folder,'note.md'),'utf8'),'Reviewed\n');
});
test('Stop, account changes and source revocation block pending preview writes',async t=>{
 for(const mode of ['stop','account','source']){const f=await fixture(t),controller=new AbortController(),work=f.execute(mode,'write_file',f.change,controller.signal);work.catch(()=>{});const row=await f.pending(mode);if(mode==='stop'){controller.abort();await assert.rejects(work);}else{if(mode==='account')f.identity={...user,id:other};else f.allowed=false;await f.tools.decide(owner,row.id,true);assert.match((await work).error,/account changed|source or resource changed/);}assert.equal(await readFile(path.join(f.folder,'note.md'),'utf8'),'Original\n');assert.equal(f.db.rows[0].status,mode==='stop'?'interrupted':'failed');}
});
test('the final file-commit guard rechecks preview authority after preparing bytes',async t=>{
 const f=await fixture(t),apply=f.workspace.apply.bind(f.workspace);f.workspace.apply=(u,o,p,s,guard)=>{let calls=0;return apply(u,o,p,s,async()=>{if(++calls===2)f.allowed=false;await guard();});};
 const work=f.execute('last-guard','write_file',f.change),row=await f.pending('last-guard');await f.tools.decide(owner,row.id,true);assert.match((await work).error,/source or resource changed/);assert.equal(await readFile(path.join(f.folder,'note.md'),'utf8'),'Original\n');
});
test('Full access uses the shared automatic path and still requires current administrator access',async t=>{
 const f=await fixture(t,'full');assert.equal((await f.execute('full','write_file',f.change)).sha256,hashText('Reviewed\n'));assert(!f.events.some(event=>event.tool?.status==='awaiting_approval'));f.identity={...user,admin:false};await assert.rejects(f.execute('revoked','read_file',f.args),/Full access is unavailable/);assert.equal(f.db.rows.length,1);
});

async function computerFixture(t,permission='ask'){
 const f=await fixture(t,permission),window='44444444-4444-4444-8444-444444444444',opts={...f.opts,files:[],windows:[window]},definitions=require(path.join(build,'computer-definitions.js')).computerDefinitions(user,opts);let sent=0,ended=0;
 f.db.requestRow.status='running';f.tools.computer={indicate:async()=>{},finishRequest:()=>ended++,stop:async()=>{},prepare:async(_user,_options,_name,_args,guard)=>{await guard();return {key:window,review:true,approval:{source:'Generated window',tool:'Type',arguments:{text_length:4},description:'Review exact test input.'},run:async signal=>{await guard();signal.throwIfAborted();return {sent:++sent};}};}};
 const scope=previewToolScope(make({options:opts,definitions,validate:async()=>{if(!f.allowed)throw Error('Preview source or resource changed.');}})),execute=(id,args={},signal=new AbortController().signal)=>f.tools.execute(user,request,{id,name:'computer_type',arguments:JSON.stringify({window_id:window,snapshot_id:requestId,text:'Test',...args})},opts,signal,undefined,undefined,'preview-computer-thread',scope);return Object.assign(f,{opts,scope,execute,sent:()=>sent,ended:()=>ended});
}

test('preview computer input uses preview ownership/review receipts and prevents duplicate or changed input',async t=>{
 const f=await computerFixture(t),work=f.execute('first'),row=await f.pending('first');assert.equal(f.sent(),0);await f.tools.decide(owner,row.id,true);assert.equal((await work).sent,1);assert((await f.execute('first')).duplicate);assert.match((await f.execute('first',{text:'Changed'})).error,/different arguments/);assert.equal(f.sent(),1);assert(f.db.tables.every(table=>table.startsWith('desktop_preview_')));
});

test('preview computer refusal, Stop and changed preview authority send no input',async t=>{
 const denied=await computerFixture(t);let work=denied.execute('deny'),row=await denied.pending('deny');await denied.tools.decide(owner,row.id,false);assert((await work).denied);assert((await denied.execute('deny')).duplicate);assert((await denied.execute('new-id-after-denial')).denied);assert.equal(denied.sent(),0);const stopped=await computerFixture(t);work=stopped.execute('stop');await stopped.pending('stop');await stopped.tools.stopComputer(owner);assert((await work).denied);assert.equal(stopped.sent(),0);const f=await computerFixture(t);work=f.execute('source-change');row=await f.pending('source-change');f.allowed=false;await f.tools.decide(owner,row.id,true);assert.match((await work).error,/source or resource changed/);assert.equal(f.sent(),0);
});

test('automatic preview computer input requires a still-running owned preview and current administrator',async t=>{
 const f=await computerFixture(t,'full');assert.equal((await f.execute('auto')).sent,1);assert(!f.db.rows.some(row=>row.status==='awaiting_approval'));f.db.requestRow.status='completed';assert.match((await f.execute('late')).error,/preview.*no longer|preview.*active/i);assert.equal(f.sent(),1);f.db.requestRow.status='running';f.db.requestRow.user_id=other;assert.match((await f.execute('foreign')).error,/preview.*no longer|preview.*active/i);assert.equal(f.sent(),1);f.db.requestRow.user_id=owner;f.identity={...user,admin:false};await assert.rejects(f.execute('admin-revoked'),/Full access is unavailable/);assert.equal(f.sent(),1);
});


async function browserFixture(t,permission='ask'){
 const f=await fixture(t,permission);f.db.requestRow.status='running';f.runs=0;f.scopes=[];f.tools.browser={prepare:async(account,conversation,name,args,opts,signal,guard,readFile,readFolder,scope)=>{assert.equal(account,owner);assert.equal(conversation,session);assert.equal(scope,'agent-draft-preview');f.scopes.push(scope);await guard();return {key:'browser:'+args.url,approval:{source:'Generated browser',tool:'Open page',arguments:args,description:'Generated site review'},run:async()=>{await guard();signal.throwIfAborted();f.runs++;return {tab_id:session,url:args.url};}};}};
 f.browserScope=previewToolScope(make({options:f.opts,definitions:f.tools.browserDefinitions(f.opts),validate:async()=>{if(!f.allowed)throw Error('Preview source changed.');}}));f.open=(id,signal)=>f.execute(id,'browser_open',{url:'https://generated.test/'},signal,f.browserScope);return f;
}
test('preview browser review, denial and a new call ID cannot repeat declined input',async t=>{
 const f=await browserFixture(t),work=f.open('declined'),row=await f.pending('declined');assert.equal(f.runs,0);await f.tools.decide(owner,row.id,false);assert((await work).denied);assert((await f.open('new-call-after-denial')).denied);assert.equal(f.runs,0);assert(f.db.rows.every(row=>row.status==='denied'));assert(f.db.tables.every(table=>table.startsWith('desktop_preview_')));
});
test('preview browser approval and duplicates execute once through the preview scope',async t=>{
 const f=await browserFixture(t),work=f.open('approved'),row=await f.pending('approved');await assert.rejects(f.tools.decide(other,row.id,true));await f.tools.decide(owner,row.id,true);assert.equal((await work).url,'https://generated.test/');assert((await f.open('approved')).duplicate);assert.equal(f.runs,1);assert.equal(f.db.rows.length,1);assert.equal(f.scopes[0],'agent-draft-preview');
});
test('preview browser stop, current ownership and ended request refuse execution',async t=>{
 const stopped=await browserFixture(t),controller=new AbortController(),work=stopped.open('stop',controller.signal);await stopped.pending('stop');controller.abort();await assert.rejects(work);assert.equal(stopped.runs,0);
 for(const change of [f=>f.db.requestRow.status='completed',f=>f.db.requestRow.user_id=other,f=>f.allowed=false,f=>f.identity={...user,id:other}]){const f=await browserFixture(t,'full');change(f);try{const result=await f.open('refused');assert(result.error);}catch(error){assert.match(error.message,/preview|Preview|account/);}assert.equal(f.runs,0);}
});
test('preview browser Full access still requires current administrator authority',async t=>{
 const f=await browserFixture(t,'full');await f.open('automatic');assert.equal(f.runs,1);assert.equal(f.db.rows[0].status,'completed');f.identity={...user,admin:false};await assert.rejects(f.open('no-longer-admin'));assert.equal(f.runs,1);
});
