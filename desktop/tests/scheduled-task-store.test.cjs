const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {taskSnapshot,PostgresScheduledTasks}=require('../build/scheduled-task-store.js');
function fixture(){const owner=randomUUID(),id=randomUUID(),snapshot={name:'Scheduled fixture',instructions:'Read the generated marker',agentId:randomUUID(),agentRevision:1,projectId:null,projectRevision:null,conversationId:randomUUID(),options:{provider:'openai-oauth',model:'controlled',thinking:'default',mode:'chat',permission:'chat',files:[]},files:[]};return {owner,id,snapshot};}
test('scheduled snapshots retain exact settings and discard fields outside the chat contract',()=>{
 const f=fixture(),result=taskSnapshot({...f.snapshot,options:{...f.snapshot.options,harness:'codex',authorization:'model assertion'}});assert.equal(result.options.provider,'openai-oauth');assert.equal(result.options.authorization,undefined);assert.equal(result.options.harness,'codex');assert.equal(result.options.model,'controlled');
});
test('scheduled snapshots reject incomplete models, inherited goals and legacy execution',()=>{
 const f=fixture();for(const options of [{...f.snapshot.options,provider:undefined},{...f.snapshot.options,model:undefined},{...f.snapshot.options,goalId:randomUUID()},{...f.snapshot.options,harness:'legacy'}])assert.throws(()=>taskSnapshot({...f.snapshot,options}));
});
test('scheduled file bindings must match the selected IDs exactly, preserving their path bytes',()=>{
 const f=fixture(),id=randomUUID(),file={id,path:'D:\\Workspace\\Résumé ',kind:'folder'},value={...f.snapshot,options:{...f.snapshot.options,permission:'files',files:[id]},files:[file]};assert.equal(taskSnapshot(value).files[0].path,file.path);
 for(const changed of [{...value,files:[]},{...value,files:[file,file]},{...value,files:[{...file,id:randomUUID()}]},{...value,options:{...value.options,permission:'chat'}}])assert.throws(()=>taskSnapshot(changed));
});
test('project snapshots require a matching project revision and reject malformed ownership identifiers',()=>{
 const f=fixture();for(const changed of [{...f.snapshot,agentRevision:0},{...f.snapshot,agentId:'another account'},{...f.snapshot,projectId:randomUUID(),projectRevision:null},{...f.snapshot,projectRevision:1}])assert.throws(()=>taskSnapshot(changed));
});
test('saving uses an atomic owner/revision RPC and an explicit future occurrence',async()=>{
 const f=fixture(),calls=[],store=new PostgresScheduledTasks({rpc:async(name,args)=>{calls.push({name,args});return {data:{id:f.id,owner:f.owner,revision:2,status:args.p_status,cadence:args.p_value.cadence,anchor:args.p_value.anchor,nextAt:args.p_next,missed:args.p_value.missed,snapshot:args.p_value.snapshot,note:null},error:null};}});
 const saved=await store.save(f.owner,f.id,1,{snapshot:f.snapshot,cadence:{kind:'interval',minutes:7},missed:'skip',status:'active'},new Date('2026-01-01T00:00:00Z'));assert.equal(calls[0].name,'desktop_save_schedule');assert.equal(calls[0].args.p_user,f.owner);assert.equal(calls[0].args.p_revision,1);assert.equal(saved.nextAt,'2026-01-01T00:07:00.000Z');
});
test('past one-time schedules cannot be enabled and no database mutation is attempted',async()=>{
 const f=fixture();let calls=0;const store=new PostgresScheduledTasks({rpc:async()=>{calls++;throw Error('Unexpected mutation');}});await assert.rejects(store.save(f.owner,f.id,null,{snapshot:f.snapshot,cadence:{kind:'once',at:'2020-01-01T00:00:00Z'},missed:'skip',status:'active'},new Date('2026-01-01')),/future time/);assert.equal(calls,0);
});
test('claiming and completing runs keep caller ownership and stable run identifiers',async()=>{
 const f=fixture(),run=randomUUID(),request=randomUUID(),calls=[],store=new PostgresScheduledTasks({rpc:async(name,args)=>{calls.push({name,args});return {data:name==='desktop_claim_schedule_run'?{id:run,taskId:f.id,owner:f.owner,taskRevision:1,requestId:request,scheduledFor:'2026-01-01T00:00:00Z',trigger:'manual',status:'starting',snapshot:f.snapshot,conversationId:null,error:null,unread:false}:null,error:null};}});
 assert.equal((await store.claim(f.owner,run)).requestId,request);await store.finish(f.owner,run,{status:'completed',conversationId:f.snapshot.conversationId});assert(calls.every(call=>call.args.p_user===f.owner&&call.args.p_run===run));assert.equal(calls[1].args.p_conversation,f.snapshot.conversationId);
});
test('a database scope failure reaches the host and cannot become an empty allowed scope',async()=>{
 const f=fixture(),store=new PostgresScheduledTasks({rpc:async()=>({data:null,error:{message:'Scheduled assignment revoked'}})});await assert.rejects(store.validate(f.owner,randomUUID()),/revoked/);
});

test('legacy import sends an owned source revision and validated context without an enable flag',async()=>{
 const f=fixture(),legacy=randomUUID(),updated='2026-01-01T00:00:00.000Z',calls=[],store=new PostgresScheduledTasks({rpc:async(name,args)=>{calls.push({name,args});return {data:{id:f.id,user_id:f.owner,revision:1,status:'paused',cadence:args.p_value.cadence,anchor:args.p_value.anchor,next_at:args.p_next,missed:args.p_value.missed,snapshot:args.p_value.snapshot,legacy_task_id:legacy,legacy_updated_at:updated},error:null};}});
 const result=await store.importLegacy(f.owner,legacy,updated,{snapshot:f.snapshot,cadence:{kind:'interval',minutes:10},missed:'skip'},new Date(updated));assert.equal(result.status,'paused');assert.equal(result.legacyTaskId,legacy);assert.equal(calls[0].name,'desktop_import_legacy_schedule');assert.equal(calls[0].args.p_user,f.owner);assert.equal(calls[0].args.p_updated,updated);assert.equal(calls[0].args.p_value.status,undefined);assert.equal(calls[0].args.p_next,'2026-01-01T00:10:00.000Z');
});
test('workspace mutation and resolution use owner/run RPCs and preserve the durable preparation marker',async()=>{
 const f=fixture(),run=randomUUID(),request=randomUUID(),source={id:randomUUID(),path:'F:\\Source67',kind:'folder'},workspace={mode:'worktree',source,sourceFiles:[source],commonDirectory:source.path+'\\.git',ref:'HEAD'},snapshot={...f.snapshot,conversationId:null,projectId:randomUUID(),projectRevision:1,files:[source],options:{...f.snapshot.options,permission:'files',files:[source.id]},workspace},calls=[],stamp='2026-10-22T07:00:00.000Z';
 const row={id:run,taskId:f.id,owner:f.owner,taskRevision:1,requestId:request,scheduledFor:stamp,trigger:'schedule',status:'starting',snapshot,conversationId:null,error:null,unread:false,workspaceStartedAt:stamp};
 const store=new PostgresScheduledTasks({rpc:async(name,args)=>{calls.push({name,args});return {data:name==='desktop_begin_schedule_workspace'?row:{...row,snapshot:{...snapshot,files:args.p_resolution.files,options:{...snapshot.options,files:args.p_resolution.files.map(file=>file.id)},workspace:{...workspace,resolved:args.p_resolution.resolved}}},error:null};}});
 assert.equal((await store.beginWorkspace(f.owner,run)).workspaceStartedAt,stamp);const checkout={id:randomUUID(),path:'F:\\Generated67\\'+run,kind:'folder'},resolution={files:[checkout],resolved:{runId:run,path:checkout.path,commit:'b'.repeat(40)}},ready=await store.resolveWorkspace(f.owner,run,resolution);assert.equal(ready.workspaceStartedAt,stamp);assert.deepEqual(ready.snapshot.files,[checkout]);assert.equal(ready.requestId,request);assert(calls.every(call=>call.args.p_user===f.owner&&call.args.p_run===run));assert.deepEqual(calls.map(call=>call.name),['desktop_begin_schedule_workspace','desktop_resolve_schedule_workspace']);assert.deepEqual(calls[1].args.p_resolution,resolution);
});
test('workspace transaction failures stay visible and cannot become a ready execution scope',async()=>{const f=fixture(),store=new PostgresScheduledTasks({rpc:async()=>({data:null,error:{message:'Workspace preparation outcome needs inspection'}})});await assert.rejects(store.beginWorkspace(f.owner,randomUUID()),/inspection/);await assert.rejects(store.resolveWorkspace(f.owner,randomUUID(),{files:[],resolved:{runId:randomUUID(),path:'F:\\Unknown',commit:'a'.repeat(40)}}),/inspection/);});
