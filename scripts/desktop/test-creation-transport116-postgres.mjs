import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {createClient} from '@supabase/supabase-js';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash,list} from './phased-backup-control.mjs';

desktopOperation('qualify creation-owned MCP transport against actual private PostgreSQL');
const root=path.resolve(import.meta.dirname,'../..');
const sourceFile=(await json(path.join(root,'.supabase/desktop-draft-preview76/source-current.json'))).evidence,source=await json(sourceFile);
assert(source.success&&source.sourceHashes['desktop/src/creation-remote-resources.ts']);
const pgFile=(await json(path.join(root,'.supabase/desktop-draft-preview76-postgres/current.json'))).evidence,pg=await json(pgFile),cfg=await json(path.join(pg.out,'intent.json')),fixtures=await json(path.join(pg.out,'private-fixtures.json'));
assert(pg.success&&pg.qaServicesStopped);assert(!(await list(true)).includes(cfg.distribution));
for(const [file,digest]of Object.entries(source.sourceHashes))assert.equal(await hash(path.join(root,file)),digest,file);
const out=path.join(root,'.supabase/desktop-draft-preview76','transport116-postgres-'+Date.now());await mkdir(out);
const require=createRequire(import.meta.url),load=name=>require(path.join(source.build,name+'.js')),{Runtime}=load('runtime'),{Plugins}=load('plugins'),{pluginDigest}=load('plugin-validation'),{CreationToolResources}=load('creation-tool-resources'),{creationPrincipal}=load('creation-resource-principal'),{creationConnectionId}=load('creation-remote-resources'),{RemoteTools}=load('remote-tools');
const calls=[],server=createServer(async(req,res)=>{
 if(req.method!=='POST'){res.writeHead(405).end();return;}
 try{let raw='';for await(const part of req)raw+=part;const body=JSON.parse(raw);if(body.id===undefined){res.writeHead(202).end();return;}
  assert.equal(req.headers.authorization,undefined,'A creation must not borrow another connection token.');let result;
  if(body.method==='initialize')result={protocolVersion:body.params.protocolVersion,capabilities:{tools:{}},serverInfo:{name:'creation116-private',version:'1'}};
  else if(body.method==='tools/list')result={tools:[{name:'record_note',description:'Record a generated qualification note.',inputSchema:{type:'object',properties:{note:{type:'string'}},required:['note'],additionalProperties:false}}]};
  else if(body.method==='tools/call'){assert.equal(body.params.name,'record_note');calls.push(body.params.arguments.note);result={content:[{type:'text',text:'Retained generated note.'}]};}else{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({jsonrpc:'2.0',id:body.id,error:{code:-32601,message:'Method not found'}}));return;}
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({jsonrpc:'2.0',id:body.id,result}));
 }catch{res.writeHead(400).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const address='http://127.0.0.1:'+server.address().port+'/mcp',e={success:false,out,sourceQualification:sourceFile,databaseQualification:pgFile,sourceHashes:source.sourceHashes,controllerSha256:await hash(import.meta.filename),checks:[],actualPostgres:true,actualMcpTransport:true,providerRequests:0,actualHttpActions:0,productionAccess:false,previewAcceptanceIntegrated:false};
const must=result=>{if(result.error)throw Error(result.error.message);return result.data;},check=async(name,work)=>{await work();e.checks.push(name);console.log('PASS '+name);};let runtime;
try{
 runtime=new Runtime(cfg.assets,cfg.profile,status=>console.log('Runtime: '+status.message));const ready=await runtime.start(),db=createClient(ready.env.API_URL,ready.env.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}}),registry=new Plugins(db),resources=new CreationToolResources(db),remote=new RemoteTools(db),owner=fixtures[0].owner,other=fixtures[1].owner,creationId=randomUUID();
 assert(owner!==other);const pkg={manifest:{$schema:'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',name:'creation-mcp116-'+randomUUID().slice(0,8),version:'1.0.0',description:'Generated creation-owned transport.'},mcp:{$schema:'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json',mcpServers:{notes:{type:'streamable-http',url:address,extensions:{'com.openai':{auth:{type:'none'}}}},signin:{type:'streamable-http',url:address+'/oauth',extensions:{'com.openai':{auth:{type:'oauth'}}}}}}},digest=pluginDigest(pkg),grant={name:pkg.manifest.name,digest};
 for(const id of [owner,other])await registry.call('plugins.install',{package:pkg,digest},{id,email:'generated116@qa.invalid',admin:true});
 let scope,principal,principalB,connection,plan,prepared,baseline;
 const signal=AbortSignal.timeout(120000),options={permission:'ask',mode:'chat',files:[],thinking:'default'},args=()=>({connection_id:connection,tool_name:'record_note',arguments_json:JSON.stringify({note:'UNSAVED-CREATION116'})});
 await check('Two owners stage the same creation UUID independently without creating an agent, saved connection or profile.',async()=>{
  baseline={};for(const table of ['agents','agent_mcp_connections','desktop_agent_profiles','desktop_plugin_connections'])baseline[table]=must(await db.from(table).select('*').order(table==='desktop_agent_profiles'?'agent_id':table==='desktop_plugin_connections'?'connection_id':'id'));
  scope=await resources.write(owner,{creationId,expectedRevision:0,writeId:randomUUID(),grants:[grant]});principal=creationPrincipal(scope);principalB=creationPrincipal(await resources.write(other,{creationId,expectedRevision:0,writeId:randomUUID(),grants:[grant]}));assert.notEqual(principal.id,principalB.id);
  for(const table of Object.keys(baseline))assert.deepEqual(must(await db.from(table).select('*').order(table==='desktop_agent_profiles'?'agent_id':table==='desktop_plugin_connections'?'connection_id':'id')),baseline[table]);
 });
 await check('Creation-specific source IDs are stable; OAuth is unavailable; foreign identities and foreign connection IDs are refused.',async()=>{
  const sources=await remote.sources(owner,principal);assert.equal(sources.length,2);assert.equal(sources.find(s=>s.name.endsWith(' · signin')).ready,false);connection=creationConnectionId(principal,pkg.manifest.name,'notes');assert(sources.some(s=>s.id==='mcp:'+connection&&s.ready));assert(!JSON.stringify(sources).includes(address));assert.deepEqual(await remote.sources(owner,principal),sources);
  const foreign=creationConnectionId(principalB,pkg.manifest.name,'notes');assert.notEqual(connection,foreign);await assert.rejects(remote.sources(other,principal),/changed|account/);await assert.rejects(remote.fingerprint(owner,principal,'mcp:'+foreign,signal),/not selected/);await assert.rejects(remote.fingerprint(owner,principal,'mcp:'+creationConnectionId(principal,pkg.manifest.name,'signin'),signal),/own browser sign-in/);
 });
 await check('Chat only, Selected files, Plan mode and explicit empty connection selections expose no external calls.',async()=>{
  for(const changed of [{permission:'chat'},{permission:'files'},{mode:'plan'},{tools:[]}])assert.deepEqual((await remote.plan(owner,principal,{...options,...changed})).definitions,[]);
 });
 await check('Actual shared transport discovers and prepares an unsaved creation call; one explicit run performs one local action.',async()=>{
  plan=await remote.plan(owner,principal,{...options,tools:['mcp:'+connection]});assert.deepEqual(plan.definitions.map(d=>d.name),['mcp_search','mcp_call']);const found=await remote.discover(owner,principal,{query:'record_note',connection_id:connection,cursor:0},plan,signal);assert.equal(found.tools[0].name,'record_note');prepared=await remote.prepare(owner,principal,'mcp_call',args(),plan,signal);assert.equal(prepared.approval.arguments.note,'UNSAVED-CREATION116');assert.equal(calls.length,0);await prepared.run(signal);assert.deepEqual(calls,['UNSAVED-CREATION116']);
  for(const table of Object.keys(baseline))assert.deepEqual(must(await db.from(table).select('*').order(table==='desktop_agent_profiles'?'agent_id':table==='desktop_plugin_connections'?'connection_id':'id')),baseline[table]);
 });
 await check('Changing the staged revision invalidates an already prepared action; another owner’s independent creation remains usable.',async()=>{
  prepared=await remote.prepare(owner,principal,'mcp_call',args(),plan,signal);scope=await resources.write(owner,{creationId,expectedRevision:1,writeId:randomUUID(),grants:[grant]});await assert.rejects(prepared.run(signal),/changed/);assert.equal((await remote.sources(other,principalB)).length,2);assert.deepEqual(calls,['UNSAVED-CREATION116']);principal=creationPrincipal(scope);
 });
 await check('Disabling the reviewed package invalidates creation discovery and prepared actions without performing another write.',async()=>{
  prepared=await remote.prepare(owner,principal,'mcp_call',args(),plan,signal);await registry.call('plugins.enable',{name:pkg.manifest.name,enabled:false},{id:owner,admin:true});await assert.rejects(prepared.run(signal),/disabled|changed/);await assert.rejects(remote.sources(owner,principal),/disabled|changed/);assert.equal((await remote.sources(other,principalB)).length,2);await registry.call('plugins.enable',{name:pkg.manifest.name,enabled:true},{id:owner,admin:true});assert.deepEqual(calls,['UNSAVED-CREATION116']);
 });
 await check('Explicitly selecting search adds only that search app and exposes no protected credential in catalogue or fingerprints.',async()=>{
  const search=must(await db.from('desktop_plugins').select('name,digest').eq('user_id',owner).eq('name','serper-search').single());scope=await resources.write(owner,{creationId,expectedRevision:2,writeId:randomUUID(),grants:[grant,search]});principal=creationPrincipal(scope);const sources=await remote.sources(owner,principal);assert.equal(sources.filter(s=>s.id==='web_search').length,1);if(!sources.find(s=>s.id==='web_search').ready)must(await db.rpc('desktop_store_setting_secret',{p_user:owner,p_scope:'api-key',p_id:'serper_api',p_secret:'generated-creation116-'+randomUUID(),p_value:{name:'Generated search qualification'}}));const fingerprint=await remote.fingerprint(owner,principal,'web_search',signal);assert.match(fingerprint,/^[a-f0-9]{64}$/);assert(!JSON.stringify(sources).includes('vault_secret'));e.searchFingerprint=fingerprint;
 });
 await check('Atomic Save binds the creation to its real agent and immediately invalidates the previous unsaved action authority.',async()=>{
  plan=await remote.plan(owner,principal,{...options,tools:['mcp:'+connection]});prepared=await remote.prepare(owner,principal,'mcp_call',args(),plan,signal);const agentId=must(await db.rpc('desktop_create_agent_with_tools',{p_user:owner,p_creation:creationId,p_tool_revision:3,p_name:'Saved creation116',p_description:'Generated authority handoff.',p_instructions:'Preserve user data.',p_provider:'openai-oauth',p_model:'fixture-model',p_appearance:{version:1,icon:'shield',color:'violet',starters:null},p_avatar:null,p_behavior:null}));assert.equal((await resources.read(owner,creationId)).boundAgentId,agentId);await assert.rejects(prepared.run(signal),/changed|saved/);await assert.rejects(remote.sources(owner,principal),/changed|saved/);assert((await remote.sources(owner,agentId)).some(s=>s.plugin===pkg.manifest.name&&s.ready));assert.deepEqual(calls,['UNSAVED-CREATION116']);e.creation={creationId,principalId:principal.id,agentId,connection};
 });
 const before=await resources.read(owner,creationId),otherBefore=await resources.read(other,creationId);await runtime.stop();assert(!(await list(true)).includes(cfg.distribution));const cold=await runtime.start(),coldDb=createClient(cold.env.API_URL,cold.env.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}}),coldResources=new CreationToolResources(coldDb),coldRemote=new RemoteTools(coldDb);
 await check('Cold reopening retains the exact creation identities and saved binding, reuses the other owner’s stable source IDs and performs no replay.',async()=>{assert.deepEqual(await coldResources.read(owner,creationId),before);assert.deepEqual(await coldResources.read(other,creationId),otherBefore);await assert.rejects(coldRemote.sources(owner,principal),/changed|saved/);const sources=await coldRemote.sources(other,principalB);assert(sources.some(s=>s.id==='mcp:'+creationConnectionId(principalB,pkg.manifest.name,'notes')));assert.deepEqual(calls,['UNSAVED-CREATION116']);});
 e.checksPassed=true;
}catch(error){e.error=error.stack;process.exitCode=1;}finally{
 server.closeAllConnections();await new Promise(resolve=>server.close(resolve));if(runtime)await runtime.stop();e.qaServicesStopped=!(await list(true)).includes(cfg.distribution);e.actualHttpActions=calls.length;e.success=!!(e.checksPassed&&e.qaServicesStopped);await writeFile(path.join(out,'evidence.json'),JSON.stringify(e,null,2));
}
console.log(JSON.stringify({success:e.success,evidence:path.join(out,'evidence.json'),checks:e.checks.length,actualHttpActions:e.actualHttpActions,error:e.error}));
