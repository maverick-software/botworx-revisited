import {_electron,expect} from '@playwright/test';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('packaged native parent and child compatibility');
const root=path.resolve(import.meta.dirname,'../..'),version=JSON.parse(await readFile(path.join(root,'package.json'),'utf8')).version;
const exe=path.join(process.env.LOCALAPPDATA,'AgentopiaDesktop','app-'+version,'Agentopia.exe'),out=path.join(root,'.supabase/desktop-native-paths/installer/qualification');await mkdir(out,{recursive:true});
const live=JSON.parse(await readFile(path.join(root,'.supabase/desktop-native-paths/live/evidence.json'),'utf8'));assert(live.success);
const evidence={at:new Date().toISOString(),inference:false,controlledProvider:true,minimalPath:true};let app,page,location,owner;
const call=(action,args)=>page.evaluate(({action,args})=>window.agentopia.call(action,args),{action,args});
try{
 app=await _electron.launch({executablePath:exe,args:[],cwd:os.tmpdir(),env:{...process.env,AGENTOPIA_TEST_PROFILE:'',PATH:[process.env.SYSTEMROOT+'\\System32',process.env.SYSTEMROOT,process.env.SYSTEMROOT+'\\System32\\Wbem'].join(';')},timeout:60000});
 page=await app.firstWindow();page.setDefaultTimeout(30000);await expect(page.getByRole('button',{name:'Account menu',exact:true})).toBeVisible({timeout:240000});evidence.version=await app.evaluate(({app})=>app.getVersion());assert.equal(evidence.version,version);
 owner=(await call('auth.state')).identity.id;location=await call('navigation.state',{owner});assert.equal((await call('native.active')).length,0);
 console.log('Installed application ready; checking the actual packaged native runtime.');
 evidence.runtime=await app.evaluate(async({app})=>{
  const path=process.getBuiltinModule('path'),os=process.getBuiltinModule('os'),fs=process.getBuiltinModule('fs/promises'),http=process.getBuiltinModule('http'),require=process.getBuiltinModule('module').createRequire(path.join(app.getAppPath(),'package.json'));
  const {CodexClient}=require('./build/codex-client.js'),{nativePatchPolicy,nativeToml,trustNativePatchPolicy}=require('./build/native-patch-policy.js'),{scriptEnvironment,prepareScriptRuntimes}=require('./build/script-runtimes.js');
  const resources=path.join(process.resourcesPath,'resources'),folder=await fs.mkdtemp(path.join(os.tmpdir(),'agentopia-packaged-guard-')),home=path.join(folder,'home'),workspace=path.join(folder,'workspace'),from='Report café 🟢.md',to='report café 🟢.md';
  await fs.mkdir(home);await fs.mkdir(workspace);await fs.writeFile(path.join(workspace,from),'Before packaged patch\n');
  const events=[];let client,parentId,childId,parentCalls=0,childCalls=0;
  const patch=(destination,before,after)=>'*** Begin Patch\n*** Update File: '+from+'\n'+(destination?'*** Move to: '+destination+'\n':'')+'@@\n-'+before+'\n+'+after+'\n*** End Patch';
  const server=http.createServer((req,res)=>{let body='';req.setEncoding('utf8');req.on('data',chunk=>body+=chunk);req.on('end',()=>{try{
   if(req.url!=='/v1/responses')throw new Error('Unexpected local endpoint');const request=JSON.parse(body),child=JSON.stringify(request.input?.filter(row=>row.role==='user').at(-1)??'').includes('CHILD-PACKAGED-GUARD'),n=child?++childCalls:++parentCalls,id=(child?'child-':'parent-')+n;let item;
   if(child&&n===1||!child&&n===2)item={type:'custom_tool_call',name:'exec',input:'text(await tools.apply_patch('+JSON.stringify(patch(to,'After packaged patch','Must never be written'))+'));'};
   else if(!child&&n===1)item={type:'custom_tool_call',name:'exec',input:'text(await tools.apply_patch('+JSON.stringify(patch(null,'Before packaged patch','After packaged patch'))+'));'};
   else if(!child&&n===3)item={type:'custom_tool_call',name:'exec',input:'text(await tools.multi_agent_v1__spawn_agent({message:"CHILD-PACKAGED-GUARD: execute the controlled call and finish."}));'};
   else item={type:'message',role:'assistant',content:[{type:'output_text',text:child?'CHILD-PACKAGED-COMPLETE':'PARENT-PACKAGED-COMPLETE',annotations:[]}]};
   item={...item,id:'item-'+id,...(item.type==='message'?{}:{call_id:'call-'+id}),status:'completed'};res.writeHead(200,{'Content-Type':'text/event-stream'});
   const send=(type,value)=>res.write('event: '+type+'\ndata: '+JSON.stringify({type,...value})+'\n\n');send('response.created',{response:{id,object:'response',status:'in_progress',output:[]}});send('response.output_item.added',{output_index:0,item});send('response.output_item.done',{output_index:0,item});send('response.completed',{response:{id,object:'response',status:'completed',output:[item],usage:{input_tokens:1,output_tokens:1,total_tokens:2}}});res.end();
  }catch(error){res.writeHead(500);res.end(error.message);}});});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
   await prepareScriptRuntimes(resources);
   const config={...await nativePatchPolicy(resources),model_provider:'fixture',model:'gpt-6.1-sol',model_catalog_json:path.join(resources,'codex/models.json'),'model_providers.fixture.name':'Packaged local compatibility qualification','model_providers.fixture.base_url':'http://127.0.0.1:'+server.address().port+'/v1','model_providers.fixture.wire_api':'responses','model_providers.fixture.requires_openai_auth':false,'model_providers.fixture.supports_websockets':false,'features.code_mode':false,'features.shell_tool':false,'features.apps':false,'features.multi_agent':true,'features.multi_agent_v2':false,web_search:'disabled'};
   client=new CodexClient(path.join(resources,'codex/x86_64-pc-windows-msvc/bin/codex.exe'),Object.entries(config).flatMap(([k,v])=>['-c',k+'='+nativeToml(v)]),{...scriptEnvironment(resources),CODEX_HOME:home,USERPROFILE:home,APPDATA:path.join(home,'appdata'),LOCALAPPDATA:path.join(home,'local')},workspace);
   client.onEvent=(method,params)=>{events.push({method,params});if(params.item?.type==='collabAgentToolCall'&&params.item.tool==='spawnAgent'&&params.item.receiverThreadIds?.length)childId=params.item.receiverThreadIds[0];};await client.initialize();const trust=await trustNativePatchPolicy(client,resources,workspace);
   const thread=await client.request('thread/start',{model:'gpt-6.1-sol',cwd:workspace,sandbox:'danger-full-access',approvalPolicy:'never'});parentId=thread.thread.id;await client.request('turn/start',{threadId:parentId,input:[{type:'text',text:'Run the controlled packaged parent and child compatibility sequence.',text_elements:[]}]});
   const done=id=>events.some(event=>event.method==='turn/completed'&&event.params.threadId===id&&event.params.turn.status==='completed'),deadline=Date.now()+60000;while(Date.now()<deadline&&!(childId&&done(parentId)&&done(childId)))await new Promise(resolve=>setTimeout(resolve,100));
   if(!childId||!done(parentId)||!done(childId))throw new Error('Packaged native parent/child did not complete: '+JSON.stringify({parentCalls,childCalls,childId,errors:events.filter(e=>e.method==='error').map(e=>e.params)}));
   const blocked=events.filter(event=>event.method==='hook/completed'&&event.params.run.entries?.some(entry=>entry.text.includes('manage_file')));
   if(!blocked.some(e=>e.params.threadId===parentId)||!blocked.some(e=>e.params.threadId===childId))throw new Error('Packaged compatibility hook did not block both paths.');
   if(await fs.readFile(path.join(workspace,from),'utf8')!=='After packaged patch\n'||JSON.stringify(await fs.readdir(workspace))!==JSON.stringify([from]))throw new Error('Packaged native patch did not preserve the exact file and spelling.');
   return {resources,parentId,childId,trust,codeMode:true,normalPatch:true,parentDenied:true,childDenied:true,originalSpellingPreserved:true,bundledCommandTools:true};
  }finally{await client?.close();await new Promise(resolve=>server.close(resolve));if(!path.resolve(folder).startsWith(path.resolve(os.tmpdir())+path.sep))throw new Error('Unexpected fixture cleanup path');await fs.rm(folder,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
 });
 console.log('PASS packaged Codex: normal patch applied; code-mode parent and actual V1 child case-only moves blocked; original file preserved using bundled tools with developer programs absent from PATH.');
 const rows=await call('messages.list',{conversationId:live.conversation});assert.equal(rows.length,4);const users=rows.filter(row=>row.role==='user');assert.deepEqual(users.map(row=>row.metadata.options.provider),['openai-oauth','openrouter']);assert.deepEqual(users.map(row=>row.metadata.options.model),['gpt-6.1-sol','openai/gpt-6.1-sol']);
 const child=rows.filter(row=>row.role==='assistant').at(-1).metadata.native.children[0];assert.equal(child.status,'completed');assert.equal(child.delivery,'delivered');
 await page.goto('agentopia://app/conversations/'+live.conversation);await expect(page.locator('.message.assistant').last()).toContainText(live.codes[1]);await expect(page.locator('.changed-files-card').last()).toContainText('café');
 await page.screenshot({path:path.join(out,'packaged-saved-native-chat.png'),animations:'disabled'});await page.reload();await expect(page.locator('.message.assistant').last()).toContainText(live.codes[1]);assert.deepEqual(await call('messages.list',{conversationId:live.conversation}),rows);
 evidence.savedLiveProviders=true;evidence.savedChildResult=true;evidence.messagesUnchanged=true;evidence.success=true;console.log('PASS packaged saved chat: exact ChatGPT/OpenRouter model choices, native child result and file card reopen without inference or message changes.');
}catch(error){evidence.error=error.message;if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw error;}
finally{if(app){if(location){await call('navigation.save',{owner,state:location}).catch(()=>{});await page.goto('agentopia://app/login').catch(()=>{});await expect(page.getByRole('button',{name:'Account menu',exact:true})).toBeVisible({timeout:60000}).catch(()=>{});}await app.close().catch(()=>{});}await writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));}
