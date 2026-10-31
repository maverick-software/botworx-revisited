const test=require('node:test'),assert=require('node:assert/strict');
const {mkdtemp,mkdir,writeFile,rm}=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {CodexGateway}=require('../build/codex-gateway.js'),{CodexClient,CODEX_VERSION}=require('../build/codex-client.js');
const {Providers}=require('../build/providers.js');
const {CodexHarness}=require('../build/codex-harness.js');

test('native steering and approvals reject other accounts, stale requests, and revoked administrator permission',async()=>{
 const harness=new CodexHarness({}, {}, '', '',()=>{},async()=>{}),approval={id:'approval',threadId:'thread',turnId:'turn',itemId:'item',kind:'command',status:'pending'};let decision;
 const record={owner:'alice',admin:false,conversation:'conversation',options:{permission:'ask',mode:'chat'},ended:false,state:{threadId:'thread',turnId:'turn',steering:[],approvals:[approval]},waiting:new Map([['approval',{resolve:value=>decision=value,method:'item/commandExecution/requestApproval'}]])};harness.running.set('request',record);
 await assert.rejects(harness.steer('bob','request','turn','forged guidance','input'),/no longer running/);
 await assert.rejects(harness.answer('bob','request','approval',{decision:'accept'},true),/no longer waiting/);
 await assert.rejects(harness.answer('alice','request','approval',{decision:'accept'},false),/Administrator/);assert.equal(decision,undefined);
 const denied=await harness.serverRequest(record,{method:'item/commandExecution/requestApproval',id:7,params:{threadId:'thread',turnId:'turn',itemId:'item'}},()=>{},new AbortController().signal);assert.deepEqual(denied,{decision:'decline'});
 await harness.answer('alice','request','approval',{decision:'decline'},false);assert.deepEqual(decision,{decision:'decline'});await assert.rejects(harness.answer('alice','request','approval',{decision:'accept'},true),/no longer waiting/);
 assert.deepEqual(harness.active('bob'),[]);
});

test('native history scopes survive OAuth renewal and separate changed ChatGPT accounts or shared OpenRouter credentials',()=>{
 const values=new Map(),providers=new Providers({get:key=>values.get(key)},'fixture-host');values.set('openai:alice',{subject:'first-account',client_id:'client',access_token:'first-token'});const first=providers.harnessScope('openai-oauth','alice');values.set('openai:alice',{subject:'first-account',client_id:'client',access_token:'renewed-token'});assert.equal(providers.harnessScope('openai-oauth','alice'),first);values.set('openai:alice',{subject:'second-account',client_id:'client',access_token:'other-token'});assert.notEqual(providers.harnessScope('openai-oauth','alice'),first);values.set('openrouter',{key:'first-private-key'});const router=providers.harnessScope('openrouter','alice');values.set('openrouter',{key:'replaced-private-key'});assert.notEqual(providers.harnessScope('openrouter','alice'),router);assert(!router.includes('private-key'));
});

test('native inference gateway authenticates locally, limits models/routes, retains streaming, and keeps the upstream credential private',async()=>{
 const actual=global.fetch;let sent,credentialCalls=0,rejected=false;const gateway=await new CodexGateway('openrouter',async()=>{credentialCalls++;return 'PRIVATE-UPSTREAM-CREDENTIAL';},new Set(['openai/gpt-6.1-sol'])).start();
 global.fetch=async(url,options)=>{if(String(url).startsWith('https://openrouter.ai/')){sent={url,options,body:JSON.parse(options.body)};if(rejected)return new Response('Invalid key: PRIVATE-UPSTREAM-CREDENTIAL',{status:401});return new Response('event: response.output_text.delta\ndata: {"delta":"native stream"}\n\nevent: response.completed\ndata: {}\n\n',{headers:{'content-type':'text/event-stream'}});}return actual(url,options);};
 try{
  const post=(route,body,token=gateway.bearer)=>actual(gateway.baseUrl+route,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','thread-id':'11111111-1111-4111-8111-111111111111','x-codex-turn-metadata':JSON.stringify({thread_id:'11111111-1111-4111-8111-111111111111',turn_id:'22222222-2222-4222-8222-222222222222'})},body:JSON.stringify(body)});
  assert.equal((await post('/responses',{model:'openai/gpt-6.1-sol'},'wrong')).status,401);
  assert.equal((await post('/chat/completions',{model:'openai/gpt-6.1-sol'})).status,404);
  assert.equal((await post('/responses',{model:'other'})).status,400);
  assert.equal((await post('/responses',{model:'openai/gpt-6.1-sol',previous_response_id:'other-account'})).status,400);
  assert.equal((await post('/responses',{model:'openai/gpt-6.1-sol',input:[{type:'agent_message'}]})).status,400);
  assert.equal(credentialCalls,0,'Unauthorized routes must never obtain the real provider key');
  const response=await post('/responses',{model:'openai/gpt-6.1-sol',store:true,stream:false,input:[{role:'user',content:'hello'}]});assert.equal(response.status,200);const stream=await response.text();assert(stream.includes('response.completed'));assert(stream.includes('native stream'));assert(!stream.includes('PRIVATE-UPSTREAM'));
  assert.equal(sent.url,'https://openrouter.ai/api/v1/responses');assert.equal(sent.options.headers.Authorization,'Bearer PRIVATE-UPSTREAM-CREDENTIAL');assert.equal(sent.body.store,false);assert.equal(sent.body.stream,true);assert.deepEqual(sent.body.input,[{role:'user',content:'hello'}]);assert.equal(credentialCalls,1);
  rejected=true;const denied=await post('/responses',{model:'openai/gpt-6.1-sol',input:[]});assert.equal(denied.status,401);const message=await denied.text();assert(!message.includes('PRIVATE-UPSTREAM'));assert(message.includes('Reconnect'));
 }finally{global.fetch=actual;gateway.close();}
});

test('bundled real Codex initializes over stdio, discovers workspace skills, starts a persistent native thread, and rejects stale steering',async()=>{
 const folder=await mkdtemp(path.join(os.tmpdir(),'sylvana-native-protocol-')),home=path.join(folder,'private-runtime'),workspace=path.join(folder,'workspace'),skill=path.join(workspace,'.agents/skills/protocol-check');await mkdir(home,{recursive:true});await mkdir(skill,{recursive:true});await writeFile(path.join(skill,'SKILL.md'),'---\nname: protocol-check\ndescription: Protocol discovery check.\n---\nUse the native skill input item.\n');
 const bin=path.join(process.env.SYLVANA_NATIVE_TEST_RESOURCES??path.resolve('desktop/resources'),'codex/x86_64-pc-windows-msvc/bin/codex.exe'),client=new CodexClient(bin,['-c','model_provider="sylvana"','-c','model_providers.sylvana.name="Local protocol verification"','-c','model_providers.sylvana.base_url="http://127.0.0.1:1/v1"','-c','model_providers.sylvana.wire_api="responses"','-c','model_providers.sylvana.requires_openai_auth=false'],{SystemRoot:process.env.SystemRoot,PATH:process.env.PATH,USERPROFILE:folder,APPDATA:path.join(folder,'appdata'),LOCALAPPDATA:path.join(folder,'local'),TEMP:os.tmpdir(),TMP:os.tmpdir(),CODEX_HOME:home},workspace);
 try{
  const initialized=await client.initialize();assert(initialized.userAgent.includes(CODEX_VERSION));
  const skills=await client.request('skills/list',{cwds:[workspace],forceReload:true});assert(skills.data.some(e=>e.skills.some(s=>s.name==='protocol-check'&&s.enabled)));
  const started=await client.request('thread/start',{model:'gpt-6.1-sol',cwd:workspace,sandbox:'read-only',approvalPolicy:'untrusted'});assert(started.thread.id);assert.equal(started.thread.cwd.toLowerCase(),workspace.toLowerCase());
  const command=await client.request('command/exec',{command:['powershell.exe','-NoProfile','-Command',"Write-Output 'NATIVE-SANDBOX-READY'"],cwd:workspace,sandboxPolicy:{type:'readOnly',networkAccess:false},timeoutMs:10000});assert.equal(command.exitCode,0);assert(command.stdout.includes('NATIVE-SANDBOX-READY'));
  await assert.rejects(client.request('turn/steer',{threadId:started.thread.id,expectedTurnId:'stale-turn',input:[{type:'text',text:'stale input',text_elements:[]}]}),/active|turn|steer/i);
 }finally{await client.close();/* Retain the bounded verification folder for native diagnostics. */}
});
