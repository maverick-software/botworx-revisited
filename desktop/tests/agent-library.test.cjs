const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),os=require('node:os');
const fs=require('node:fs/promises'),{randomUUID}=require('node:crypto');
const build=process.env.SYLVANA_AGENT_DOCUMENT_BUILD||path.join(__dirname,'../build');
const {AgentDocuments}=require(path.join(build,'agent-documents.js'));
const {libraryExpected,libraryMetadata,libraryMutation}=require(path.join(build,'agent-library-contracts.js'));
const owner=randomUUID(),agent=randomUUID(),id=randomUUID(),expected={version:1,updatedAt:'2026-10-23T01:00:00.123456+00:00'};
const signal=()=>new AbortController().signal;

test('library details are bounded and a precise timestamp survives validation',()=>{
 assert.deepEqual(libraryExpected(expected),expected);
 assert.deepEqual(libraryMetadata({name:'  Orchard ',category:' Team ',tags:[' fruit ','fruit'],description:' Note '}),{name:'Orchard',category:'Team',tags:['fruit'],description:'Note'});
 for(const input of [{...expected,version:0},{...expected,updatedAt:'invalid'},null])assert.throws(()=>libraryExpected(input));
 for(const input of [{name:'',category:'Team',tags:[],description:''},{name:'File',category:' ',tags:[],description:''},{name:'File',category:'Team',tags:Array(21).fill('x'),description:''},{name:'File',category:'Team',tags:['x'.repeat(41)],description:''}])assert.throws(()=>libraryMetadata(input));
});
test('only the explicit human library operations are accepted',()=>{
 for(const operation of ['archive','restore','delete'])assert.equal(libraryMutation({id,expected,operation}).operation,operation);
 for(const operation of ['restore_version','delete_version'])assert.equal(libraryMutation({id,expected,operation,value:{version:2}}).value.version,2);
 assert.throws(()=>libraryMutation({id,expected,operation:'execute',value:{command:'anything'}}));
 assert.throws(()=>libraryMutation({id,expected,operation:'restore_version',value:{version:0}}));
});
test('a replacement uses the stable original reader and sends one optimistic mutation',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'agent-library-')),file=path.join(dir,'Replacement.md'),calls=[];
 await fs.writeFile(file,'New orchard reference: 93 apples.');
 const docs=new AgentDocuments({rpc:async(name,args)=>{calls.push({name,args});return {data:{id,version:2}};}},{},()=>{});
 try{
  const result=await docs.replace(owner,agent,id,expected,file,async()=>{},signal());assert.equal(result.version,2);assert.equal(calls.length,1);
  assert.equal(calls[0].name,'desktop_update_library_document');assert.equal(calls[0].args.p_operation,'replace');assert.equal(calls[0].args.p_expected_updated_at,expected.updatedAt);
  assert.equal(Buffer.from(calls[0].args.p_value.base64,'base64').toString(),'New orchard reference: 93 apples.');
 }finally{assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert(path.basename(dir).startsWith('agent-library-'));await fs.rm(dir,{recursive:true,force:true});}
});
test('invalid replacement tokens fail before opening a local file',async()=>{
 let checked=false;const docs=new AgentDocuments({rpc:()=>assert.fail('No mutation expected')},{},()=>{checked=true;});
 await assert.rejects(docs.replace(owner,agent,id,{version:0,updatedAt:'invalid'},'not-a-file',async()=>{},signal()),/Refresh the library/);assert.equal(checked,false);
});
test('cancellation and identity changes prevent or report mutations without replay',async()=>{
 let calls=0;const docs=new AgentDocuments({rpc:async()=>{calls++;return {data:{id}};}},{},()=>{}),input={id,expected,operation:'archive'};
 await assert.rejects(docs.mutate(owner,agent,input,async()=>{throw Error('Account changed');},signal()),/Account changed/);assert.equal(calls,0);
 const cancelled=new AbortController();cancelled.abort(Error('Stopped'));await assert.rejects(docs.mutate(owner,agent,input,async()=>{},cancelled.signal),/Stopped/);assert.equal(calls,0);
 let guards=0;await assert.rejects(docs.mutate(owner,agent,input,async()=>{if(++guards===2)throw Error('Account changed after commit');},signal()),/after commit/);assert.equal(calls,1);
});
test('version listing remains scoped and contains no implicit assignment operation',async()=>{
 let args;const docs=new AgentDocuments({rpc:async(name,value)=>{assert.equal(name,'desktop_library_document_versions');args=value;return {data:[{version:1,current:true}]};}},{},()=>{});
 assert.deepEqual(await docs.versions(owner,agent,id,async()=>{}),[{version:1,current:true}]);assert.deepEqual(args,{p_user:owner,p_agent:agent,p_id:id});
 const tools=docs.definitions({permission:'full',mode:'chat',files:[],thinking:'default'});assert.equal(tools.length,4);assert(tools.every(tool=>!tool.name.includes('replace')&&!tool.name.includes('delete')&&!tool.name.includes('archive')));
});

const Module=require('node:module'),load=Module._load,dialog={};let Broker;
Module._load=function(name,...args){return name==='electron'?{dialog,shell:{},nativeImage:{},safeStorage:{}}:load.call(this,name,...args);};
try{Broker=require(path.join(build,'broker.js')).Broker;}finally{Module._load=load;}
function broker(){
 const query={select(){return this},eq(){return this},async single(){return {data:{id:agent},error:null}}};
 return {workspaceMonitor:{generation:0},identity:async()=>({id:owner,admin:false}),attachmentOwner:async()=>{},admin:{from:()=>query},nativeControls:0,
  backingUp:false,closing:false,signedOut:false,active:new Map(),startingChats:new Map(),goals:new Map(),agentMutations:new Set(),scopeChanging:false,
  native:{busy:false,quiesce:async()=>{}},assignments:{queue:{size:0}},scheduledControls:0,scheduled:{scheduler:{busy:false}},scheduledQueue:{busy:false},
  files:{},agentDocuments:{replace:()=>assert.fail('Cancelled picker must not replace a file')}};
}
test('an open library picker holds the backup barrier and releases it after cancellation',{timeout:10000},async()=>{
 const host=broker();let release,entered;const opened=new Promise(resolve=>entered=resolve);dialog.showOpenDialog=async()=>{entered();return new Promise(resolve=>release=resolve);};
 const pending=Broker.prototype.call.call(host,'agentSettings.documents.replace',{agentId:agent,id,expected});
 try{await Promise.race([opened,pending.then(()=>{throw Error('The picker did not open');})]);assert.equal(host.nativeControls,1);
  await assert.rejects(Broker.prototype.backup.call(host,async()=>assert.fail('Backup cannot race document import')),/Finish|consistent backup/);
 }finally{release?.({canceled:true,filePaths:[]});assert.deepEqual(await pending,{cancelled:true});}
 assert.equal(host.nativeControls,0);
});
test('picker errors release the library operation barrier',async()=>{
 const host=broker();dialog.showOpenDialog=async()=>{throw Error('Picker unavailable');};
 await assert.rejects(Broker.prototype.call.call(host,'agentSettings.documents.pick',{agentId:agent}),/Picker unavailable/);assert.equal(host.nativeControls,0);
});
