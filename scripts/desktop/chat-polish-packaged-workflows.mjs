import {expect} from '@playwright/test';
import {readFile,writeFile,copyFile,mkdir} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const servers=new Map(),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const api=page=>(action,args)=>page.evaluate(({action,args})=>window.agentopia.call(action,args),{action,args});
async function finish(application,id){await expect.poll(()=>application.evaluate(async(_,id)=>{const result=await globalThis.__coordination.broker.admin.from('desktop_requests').select('status,error').eq('id',id).single();if(result.error)throw Error(result.error.message);if(['failed','cancelled','interrupted'].includes(result.data.status))throw Error(result.data.error??result.data.status);return result.data.status;},id),{timeout:60000}).toBe('completed');}
async function open(page,id){await page.goto('agentopia://app/conversations/'+id);await expect(page.getByRole('textbox',{name:'Message',exact:true})).toBeVisible({timeout:30000});}
async function plan(application,id,rule){await application.evaluate((_,{id,rule})=>globalThis.__coordination.requests[id]=rule,{id,rule});}

export async function runChatPolishPackaged({application,page,out,profile,evidence,save,check}){
 const call=api(page),owner=(await call('auth.state')).identity.id,root=path.resolve(import.meta.dirname,'../..');
 assert.equal(owner,evidence.fixtureUser);
 await application.evaluate(async({dialog})=>{globalThis.__polishPermissionDialog=dialog.showMessageBox;dialog.showMessageBox=async(...args)=>args.at(-1)?.title==='Enable Full access?'?{response:1,checkboxChecked:false}:globalThis.__polishPermissionDialog(...args);});
 try{assert((await call('permissions.full')).full);}finally{await application.evaluate(({dialog})=>{dialog.showMessageBox=globalThis.__polishPermissionDialog;});}
 const agent=await call('agents.save',{name:'Chat polish verification',description:'Generated file and browser acceptance',instructions:'Use only the prepared verification steps and report confirmed results.',provider:'openai-oauth',model:'gpt-6.1-sol'}),agentProfile=await call('agents.profile',{agentId:agent});
 await call('agents.profile.save',{agentId:agent,value:{...agentProfile,policy:{...agentProfile.policy,tools:null,delegation:false,memory:false,memoryWrite:false}}});
 const options={harness:'codex',provider:'openai-oauth',model:'gpt-6.1-sol',thinking:'default',permission:'full',mode:'chat',files:[]},id=randomUUID(),hold='polish-files-'+randomUUID();
 const code='const tool=ALL_TOOLS.find(t=>t.name.endsWith("exec_command"));if(!tool)throw Error("Missing command tool");text(await tools[tool.name]({cmd:"Get-Location",max_output_tokens:1000}));';
 await plan(application,id,{steps:[{kind:'exec',code,hold},{text:'Prepared output links'}]});
 const started=await call('chat.start',{requestId:id,agentId:agent,text:'Prepare the generated file-opening verification outputs.',options});
 await expect.poll(()=>application.evaluate((_,hold)=>globalThis.__coordination.streams.has(hold),hold),{timeout:60000}).toBe(true);
 const location=await application.evaluate(async(_,id)=>{const b=globalThis.__coordination.broker,r=b.native.running.get(id),mapping=await b.admin.from('desktop_codex_threads').select('scope').eq('conversation_id',r.conversation).eq('user_id',r.owner).single();if(mapping.error)throw Error(mapping.error.message);return {cwd:r.worker.cwd,conversation:r.conversation,scope:mapping.data.scope,owner:r.owner};},id);
 assert.equal(location.owner,owner);assert.equal(location.conversation,started.conversation_id);assert.equal(path.basename(location.cwd),started.conversation_id+'-'+location.scope);
 const legacy=path.join(profile,'workspaces',owner,path.basename(location.cwd));assert(path.resolve(legacy).startsWith(path.resolve(profile)+path.sep));await mkdir(legacy,{recursive:true});
 const outputs=[];
 for(const [extension,kind]of [['docx','word'],['pdf','pdf'],['xlsx','spreadsheet'],['pptx','presentation']]){const name='Polish.'+extension,file=path.join(legacy,name);await copyFile(path.join(root,'desktop/tests/fixtures/documents/sample.'+extension),file);outputs.push({name,kind,file,href:pathToFileURL(file).href,sha256:hash(await readFile(file))});}
 for(const [name,content,kind]of [['Polish.py','print("READABLE-CODE-43")\n','code'],['Polish.html','<!doctype html><title>Polish canvas43</title><h1>READABLE-HTML-43</h1>','html']]){const file=path.join(legacy,name);await writeFile(file,content,{flag:'wx'});outputs.push({name,kind,file,href:pathToFileURL(file).href,sha256:hash(await readFile(file))});}
 const text='Generated outputs: '+outputs.map(row=>'['+row.name+']('+row.href+')').join(', ');
 await application.evaluate((_,{id,hold,text})=>{const state=globalThis.__coordination;state.requests[id].steps[1].text=text;state.streams.get(hold).release();},{id,hold,text});
 await finish(application,id);await open(page,started.conversation_id);
 for(const output of outputs){await page.getByRole('link',{name:output.name,exact:true}).click();
  if(output.kind==='html')await expect.poll(()=>application.evaluate(({webContents})=>webContents.getAllWebContents().some(c=>c.getTitle()==='Polish canvas43')),{timeout:15000}).toBe(true);
  else await expect(page.getByRole('region',{name:'Workspace preview',exact:true})).toContainText(output.kind==='code'?'READABLE-CODE-43':output.name,{timeout:15000});
  await expect.poll(async()=>{const state=await call('workspace.state',{owner,scope:started.conversation_id});return state.tabs.find(row=>row.id===state.active)?.name;},{timeout:10000}).toBe(output.name);
  const state=await call('workspace.state',{owner,scope:started.conversation_id}),tab=state.tabs.find(row=>row.id===state.active),reference=(await call('files.list')).find(row=>row.id===tab.referenceId);
  assert(reference&&tab.kind==='file');assert(!reference.path.startsWith(profile+path.sep));assert.equal(hash(await readFile(reference.path)),output.sha256);assert.equal(hash(await readFile(output.file)),output.sha256);Object.assign(output,{referenceId:reference.id,exported:reference.path});
  const preview=await call('workspace.read',{owner,referenceId:reference.id,path:''});if(!['code','html'].includes(output.kind)){assert.equal(preview.document.kind,output.kind);assert(preview.document.hasText);}
 }
 const word=outputs[0],saved=path.join(out,'saved-polish.docx');
 await application.evaluate(({dialog,shell},saved)=>{globalThis.__polishDesktop={showSaveDialog:dialog.showSaveDialog,openPath:shell.openPath,showItemInFolder:shell.showItemInFolder,calls:[]};dialog.showSaveDialog=async()=>({canceled:false,filePath:saved});shell.openPath=async file=>{globalThis.__polishDesktop.calls.push({action:'open',file});return '';};shell.showItemInFolder=file=>globalThis.__polishDesktop.calls.push({action:'reveal',file});},saved);
 let desktopCalls;
 try{for(const name of ['Save a copy…','Open in Word / default app','Show in File Explorer']){await page.getByRole('link',{name:word.name,exact:true}).click({button:'right'});await page.getByRole('menuitem',{name,exact:true}).click();}await expect.poll(async()=>{try{return hash(await readFile(saved));}catch{return null;}},{timeout:10000}).toBe(word.sha256);await expect.poll(()=>application.evaluate(()=>globalThis.__polishDesktop.calls.map(row=>row.action)),{timeout:10000}).toEqual(['open','reveal']);desktopCalls=await application.evaluate(()=>globalThis.__polishDesktop.calls);assert.deepEqual(desktopCalls.map(row=>row.action),['open','reveal']);assert(desktopCalls.every(row=>row.file===word.exported));}
 finally{await application.evaluate(({dialog,shell})=>{const old=globalThis.__polishDesktop;dialog.showSaveDialog=old.showSaveDialog;shell.openPath=old.openPath;shell.showItemInFolder=old.showItemInFolder;});}
 evidence.polish={owner,agent,requestId:id,conversation:started.conversation_id,legacy,outputs,savedCopy:saved,desktopCalls,actualShellDispatch:false};await save();
 await check('The packaged Codex transcript opens actual legacy-profile DOCX/PDF/XLSX/PPTX/code/HTML outputs in its right pane; exports and Save a copy preserve bytes, and context-menu actions reach the desktop API.');
 const server=createServer((_req,res)=>{res.writeHead(200,{'Content-Type':'text/html'});res.end('<title>Full access43</title><h1>FULL-READ-43</h1>');});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));servers.set(out,server);const url='http://127.0.0.1:'+server.address().port+'/';evidence.polish.browser=[];
 for(const mode of ['chat','plan']){const requestId=randomUUID(),code='const tool=ALL_TOOLS.find(t=>t.name.endsWith("browser_open"));if(!tool)throw Error("Missing browser tool");text(await tools[tool.name]('+JSON.stringify({url})+'));';await plan(application,requestId,{steps:[{kind:'exec',code},{text:'FULL-BROWSER-'+mode.toUpperCase(),requireInput:'tab_id'}]});const started=await call('chat.start',{requestId,agentId:agent,text:'Open the generated local verification page in '+mode+' mode.',options:{...options,mode}});await finish(application,requestId);const result=await application.evaluate(async(_,id)=>{const b=globalThis.__coordination.broker,rows=await b.admin.from('desktop_tool_calls').select('id,name,status,approval,result').eq('request_id',id).eq('user_id',(await b.identity()).id);if(rows.error)throw Error(rows.error.message);return rows.data;},requestId);const browser=result.find(row=>row.name==='browser_open');assert(browser&&browser.status==='completed'&&!browser.approval&&browser.result.url===url);await open(page,started.conversation_id);await expect(page.getByRole('button',{name:'Approve tool call',exact:true})).toHaveCount(0);evidence.polish.browser.push({mode,requestId,conversation:started.conversation_id,tool:browser});await save();}
 await check('Actual packaged Codex/MCP browser calls complete under Full access in Chat and read-only Plan mode with no per-call review or approval decision.');
 await open(page,evidence.parallel.b);await expect(page.getByRole('textbox',{name:'Message',exact:true})).toHaveValue(evidence.parallel.markers.draftB);await save();
}

export async function verifyChatPolishReopen({application,page,out,evidence,save,check}){
 const call=api(page),p=evidence.polish;assert(p&&p.browser.length===2);await open(page,p.conversation);await page.getByRole('link',{name:p.outputs[0].name,exact:true}).click();await expect(page.getByRole('region',{name:'Workspace preview',exact:true})).toContainText('WORD-ALPHA-641',{timeout:15000});
 for(const output of p.outputs){assert.equal(hash(await readFile(output.file)),output.sha256);assert.equal(hash(await readFile(output.exported)),output.sha256);}
 assert.equal(hash(await readFile(p.savedCopy)),p.outputs[0].sha256);assert.equal((await call('native.active')).length,0);const network=await application.evaluate(()=>({calls:globalThis.__coordination.calls,blocked:globalThis.__coordination.blocked}));assert.deepEqual(network.calls,[]);assert.deepEqual(network.blocked,[]);p.coldReopen={success:true,noInferenceReplay:true,filesPreserved:true};await save();await check('A cold reopening retains the generated links, extracted Word preview, exported originals and saved copy without replaying native work or browser calls.');await open(page,evidence.parallel.b);
}
export async function stopChatPolishFixture(out){const server=servers.get(out);if(server){servers.delete(out);server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}}
