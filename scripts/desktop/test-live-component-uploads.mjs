import {chromium,expect} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';
import {checkpointWriter} from './checkpoint.mjs';
import {openModelCatalog} from './model-controls.mjs';

desktopOperation('installed native ChatGPT and OpenRouter component file uploads');
const configFile=path.resolve(process.argv[2]??''),cfg=JSON.parse(await readFile(configFile,'utf8')),info=JSON.parse(await readFile(path.join(cfg.output,'server-info.json'),'utf8'));
assert.equal(cfg.format,1);assert.equal(path.dirname(configFile),cfg.output);assert(path.isAbsolute(cfg.file));
const out=cfg.output,progress=path.join(out,'progress.json'),continuing=process.argv.includes('--continue-first'),continuationTag=process.argv.find(value=>value.startsWith('--checkpoint-name='))?.slice('--checkpoint-name='.length)??'first';assert(/^[a-z][a-z0-9-]{0,50}$/.test(continuationTag));const state=continuing?JSON.parse(await readFile(progress,'utf8')):{format:1,version:'0.43.3',inference:true,simulated:false,phase:'prepared',nonce:cfg.nonce,url:info.url,runs:[],reviews:[]};
if(continuing){assert.equal(state.phase,'first-completed');assert.equal(state.runs.length,1);assert(!state.secondRequestId&&!state.secondUserText);assert(state.editedFile&&state.nativeFilePickerCompleted);await writeFile(path.join(out,'continuation-'+continuationTag+'-baseline.json'),JSON.stringify(state,null,2),{flag:'wx'});state.priorVerifierError=state.error;delete state.error;state.continuedCompletedFirst=true;}else await writeFile(progress,JSON.stringify(state,null,2),{flag:'wx'});const writeState=checkpointWriter(progress),save=()=>writeState(state);
let browser,page,owner,navigation,composer,preferences,originalReferences,reference,conversation,request,tab;
const call=(action,args)=>page.evaluate(({action,args})=>window.agentopia.call(action,args),{action,args});
const server=async suffix=>{const response=await fetch(info.url+suffix,{method:suffix==='status'?'GET':'POST',headers:{Authorization:'Bearer '+cfg.controlToken}});assert(response.ok,'Fixture control failed: '+suffix);return suffix==='status'?response.json():response.text();};
const reply=async id=>(await call('messages.list',{conversationId:conversation})).find(message=>message.role==='assistant'&&message.metadata.timing?.requestId===id);
async function wait(id,index){
 const approved=new Set(),until=Date.now()+420000;
 while(Date.now()<until){
  const message=await reply(id);
  for(const tool of message?.metadata.tools??[]){
   if(tool.name==='browser_open'&&tool.status==='completed'&&!tab){tab=tool.result.tab_id;state.tabId=tab;await save();}
   if(tool.status!=='awaiting_approval'||approved.has(tool.id))continue;
   assert(['browser_open','browser_snapshot','browser_upload','browser_list'].includes(tool.name),'Unexpected reviewed tool: '+tool.name);
   assert.equal(tool.approval.arguments.url,info.url);
   if(tool.name==='browser_open')assert.equal(index,0,'The second provider must use the existing tab.');
   if(tool.name==='browser_upload'){
    const files=tool.approval.arguments.files;assert.equal(files.length,1);assert.equal(files[0].name,cfg.filename);assert.equal(files[0].sha256,(index===0?cfg.first:cfg.second).sha256);
    assert.equal(tool.approval.arguments.element.name,index===0?'Component report':'Closed report');
    assert(!state.reviews.some(review=>review.requestId===id&&review.name==='browser_upload'),'Never approve a repeated upload.');
    assert.equal((await server('status')).uploads.length,index);
   }
   const panels=page.locator('.tool-awaiting_approval').filter({hasText:'Agentopia browser'}),panel=tool.name==='browser_upload'?panels.filter({has:page.locator('.browser-upload-review')}):panels.filter({hasText:tool.approval.tool});
   await expect(panel).toHaveCount(1);await expect(panel).toBeVisible();
   state.pendingReview={requestId:id,toolId:tool.id,name:tool.name,arguments:tool.approval.arguments};await save();
   if(tool.name==='browser_upload')await page.screenshot({path:path.join(out,index===0?'chatgpt-upload-review.png':'openrouter-upload-review.png'),animations:'disabled'});
   await panel.getByRole('button',{name:'Approve tool call',exact:true}).click();approved.add(tool.id);state.reviews.push(state.pendingReview);delete state.pendingReview;await save();
  }
  assert(!message?.metadata.native?.approvals.some(approval=>approval.status==='pending'),'Unexpected native command or file approval.');
  if(message&&message.metadata.status!=='running'){assert.equal(message.metadata.status,'completed',message.metadata.error??message.content.text);return message;}
  await new Promise(resolve=>setTimeout(resolve,600));
 }
 throw new Error('Observation expired. Inspect the saved request and fixture receipts; never replay the request.');
}
async function validate(message,index){
 assert.equal(message.metadata.native?.version,'0.163.0');assert(message.content.text.includes(cfg.receipts[index]));
 assert(message.metadata.tools.every(tool=>['browser_open','browser_list','browser_snapshot','browser_upload'].includes(tool.name)));
 assert(!message.metadata.native.items.some(entry=>['commandExecution','collabAgentToolCall'].includes(entry.item.type)));
 const uploads=message.metadata.tools.filter(tool=>tool.name==='browser_upload'&&tool.status==='completed');assert.equal(uploads.length,1);assert.equal(uploads[0].result.tab_id,tab);
 const received=await server('status');assert.equal(received.uploads.length,index+1);assert.equal(received.violations.length,0);assert(received.uploads.every(row=>row.valid&&row.cookieMatched));
 assert(received.uploads.every(row=>row.inputValue==='C:\\fakepath\\'+cfg.filename));state.server=received;
}
try{
 browser=await chromium.connectOverCDP(process.env.AGENTOPIA_CDP_URL??'http://127.0.0.1:9237');page=browser.contexts().flatMap(context=>context.pages()).find(page=>page.url().startsWith('agentopia://app'));assert(page);page.setDefaultTimeout(30000);
 await expect(page.getByRole('button',{name:'Account menu',exact:true})).toBeVisible({timeout:240000});owner=(await call('auth.state')).identity.id;assert.equal((await call('native.active')).length,0);
 if(continuing){assert.equal(owner,state.restoration.owner);({navigation,composer,preferences,originalReferences}=state.restoration);reference=state.referenceId;conversation=state.conversationId;tab=state.tabId;request=state.firstRequestId;}else{navigation=await call('navigation.state',{owner});composer=await call('composer.get');preferences=await call('preferences.get');originalReferences=await call('files.list');state.restoration={owner,navigation,composer,preferences,originalReferences};}await save();
 const providers=await call('providers.status');assert(providers.openrouter&&providers.chatgpt?.authorized);assert((await call('terminal.permissions',{owner})).full,'Use the existing Full grant; do not enable it implicitly.');
 const agent=(await call('agents.list')).find(agent=>agent.name==='Native Codex Assistant');assert(agent);state.agentId=agent.id;
 const firstId=continuing?state.firstRequestId:randomUUID();
 if(continuing){assert.equal((await call('messages.list',{conversationId:conversation})).length,2,'An existing second message needs inspection rather than another Send.');const first=await reply(firstId);assert.equal(first.metadata.status,'completed');assert.equal(first.metadata.native.threadId,state.runs[0].threadId);await validate(first,0);assert((await server('status')).receiptHidden);assert.equal(createHash('sha256').update(await readFile(cfg.file)).digest('hex'),cfg.second.sha256);await page.goto('agentopia://app/conversations/'+conversation);await expect(page.locator('.chat-stage .messages')).toBeVisible();delete state.recovery;}else{
 assert.equal(createHash('sha256').update(await readFile(cfg.file)).digest('hex'),cfg.first.sha256);
 state.phase='native-file-picker-pending';await save();const picked=await call('files.pick',{kind:'file'});
 assert.equal(picked.selected.length,1);reference=picked.selected[0];const selected=(await call('files.list')).find(file=>file.id===reference);assert.equal(path.normalize(selected.path),path.normalize(cfg.file));assert.equal(selected.name,cfg.filename);state.referenceId=reference;state.nativeFilePickerCompleted=true;await save();
 request=firstId;state.firstRequestId=firstId;state.phase='first-dispatch-pending';await save();
 const started=await call('chat.start',{requestId:firstId,agentId:agent.id,text:'Component upload verification '+cfg.nonce+'. Use only Agentopia browser tools through agentopia_host MCP. Open exactly one tab at '+info.url+'. Inspect file_inputs in browser_snapshot. Use browser_upload to attach the selected '+cfg.filename+' to the field named Component report inside the nested web component. Use its u-ref and attached reference ID. Select the file exactly once; the site immediately sends it. Take fresh snapshots and report the exact server receipt, leaving this tab open. Do not click Submit, send keys, use scripts, commands, files tools or subagents.',options:{harness:'codex',provider:'openai-oauth',model:'gpt-6.1-sol',thinking:'high',permission:'full',mode:'chat',files:[reference],tools:[]}});
 conversation=started.conversation_id;state.conversationId=conversation;state.phase='first-running';await save();await page.goto('agentopia://app/conversations/'+conversation);await expect(page.locator('.chat-stage .messages')).toBeVisible();
 const first=await wait(firstId,0);await validate(first,0);state.runs.push({provider:'openai-oauth',requestId:firstId,threadId:first.metadata.native.threadId,reply:first.content.text});state.phase='first-completed';await save();
 await server('hide');await expect.poll(async()=>(await server('status')).receiptHidden,{timeout:30000}).toBe(true);
 await writeFile(cfg.file,Buffer.from(cfg.secondBytes,'base64'));assert.equal(createHash('sha256').update(await readFile(cfg.file)).digest('hex'),cfg.second.sha256);state.editedFile=true;await save();
 }
 await openModelCatalog(page);await page.getByRole('button',{name:'OpenRouter',exact:true}).click();await page.getByRole('textbox',{name:'Search models',exact:true}).fill('gpt-6.1-sol');await page.locator('[data-model-id="openai/gpt-6.1-sol"]').click();
 await page.getByRole('button',{name:'Add to chat',exact:true}).click();await page.getByRole('menuitem',{name:'Files and folders',exact:true}).click();const filesDialog=page.getByRole('dialog',{name:'Files and folders',exact:true}),selectedRow=filesDialog.locator('.file-reference-row').filter({has:page.getByText(cfg.filename,{exact:true})});await expect(selectedRow).toHaveCount(1);for(const row of await filesDialog.locator('.file-reference-row').all()){if(await row.getByRole('checkbox').isChecked()&&!await row.getByText(cfg.filename,{exact:true}).count())await row.getByRole('checkbox').uncheck();}await selectedRow.getByRole('checkbox').check();assert.equal(await filesDialog.locator('input:checked').count(),1);await filesDialog.getByRole('button',{name:'Done',exact:true}).click();
 await expect(page.locator('.composer [aria-label="Message attachments"]')).toContainText(cfg.filename);
 await expect.poll(async()=>(await call('drafts.get',{owner,scope:'conversation:'+conversation}))?.options.files).toEqual([reference]);
 const choices=await call('composer.get');assert.equal(choices.provider,'openrouter');assert.equal(choices.model,'openai/gpt-6.1-sol');assert.equal(choices.thinking,'high');assert.equal(choices.harness,'codex');
 const secondText='Continue component upload verification '+cfg.nonce+' in the same existing Agentopia browser tab. The attached '+cfg.filename+' has been edited. Use only browser_list, browser_snapshot and browser_upload through agentopia_host MCP. Inspect file_inputs and upload the current attached report to the Closed report field inside the closed web component, exactly once. It sends immediately on selection. Report the new server receipt and our earlier receipt from ChatGPT. Do not open another tab, click Submit, send keys, use scripts, commands, other file tools or subagents.';
 await page.getByRole('textbox',{name:'Message',exact:true}).fill(secondText);state.phase='second-ui-dispatch-pending';state.secondUserText=secondText;await save();await page.getByRole('button',{name:'Send',exact:true}).click();
 let second;await expect.poll(async()=>{second=(await call('messages.list',{conversationId:conversation})).find(message=>message.role==='assistant'&&message.metadata.timing?.requestId!==firstId);return !!second?.metadata.timing?.requestId;},{timeout:45000}).toBe(true);
 request=second.metadata.timing.requestId;state.secondRequestId=request;state.phase='second-running';await save();second=await wait(request,1);await validate(second,1);assert(second.content.text.includes(cfg.receipts[0]));assert(second.metadata.tools.every(tool=>['browser_list','browser_snapshot','browser_upload'].includes(tool.name)));
 state.runs.push({provider:'openrouter',requestId:request,threadId:second.metadata.native.threadId,reply:second.content.text});
 const saved=await call('messages.list',{conversationId:conversation}),submitted=saved.find(message=>message.role==='user'&&message.metadata.options?.provider==='openrouter');assert(submitted);assert.deepEqual(submitted.metadata.options.files,[reference]);assert.equal(submitted.metadata.options.model,'openai/gpt-6.1-sol');assert.equal(submitted.metadata.options.thinking,'high');assert.equal(submitted.metadata.options.harness,'codex');await page.reload();await expect(page.locator('.message.assistant').last()).toContainText(cfg.receipts[1]);assert.deepEqual(await call('messages.list',{conversationId:conversation}),saved);
 state.savedMessagesUnchanged=true;state.sameTabAndCookie=true;state.editedBytesVerified=true;state.priorReceiptRecalled=true;state.alwaysReviewedEvenFull=true;state.phase='completed';state.success=true;await save();await page.screenshot({path:path.join(out,'provider-continuity.png'),animations:'disabled'});
 console.log('PASS actual installed Codex ChatGPT → OpenRouter: native file picker, nested and closed component uploads, reviewed first and edited bytes, same tab/cookie, prior receipt recall, saved history.');
}catch(error){state.error=error.message.slice(0,1800);if(page)await page.screenshot({path:path.join(out,continuing?'continuation-'+continuationTag+'-failure.png':'failure.png'),animations:'disabled'}).catch(()=>{});throw error;}
finally{
 let cleanupFailure;
 try{
 if(page){
  if(request&&conversation){const current=await reply(request).catch(()=>null);if(current?.metadata.status==='running')await call('chat.cancel',{requestId:request}).catch(error=>{state.cancelError=error.message;});}
  if(state.success){
   if(tab){await call('browser.open',{id:tab,url:info.url+'forget',navigate:true}).catch(error=>{state.cookieCleanupError=error.message;});await call('browser.close',{id:tab}).catch(error=>{state.tabCleanupError=error.message;});}
   if(reference)await call('files.remove',{id:reference}).catch(error=>{state.referenceCleanupError=error.message;});assert.deepEqual(await call('files.list'),originalReferences);state.originalReferencesRestored=true;
   if(conversation)await call('conversations.manage',{conversationId:conversation,action:'archive'}).catch(error=>{state.archiveError=error.message;});
  }
  if(navigation){await call('navigation.save',{owner,state:navigation});if(composer)await call('composer.save',{userId:owner,options:composer});if(preferences)await call('preferences.save',{userId:owner,preferences});await page.goto('agentopia://app/login');await expect(page.getByRole('button',{name:'Account menu',exact:true})).toBeVisible({timeout:60000});state.originalUiRestored=true;}
 }
 if(state.success){state.server=await server('status');assert(state.server.forgotten);await server('stop');state.fixtureStopRequested=true;}else state.recovery='Keep the owned fixture server, tab and file reference for inspection. Never replay saved submissions.';
 }catch(error){cleanupFailure=error;state.cleanupError=error.message;state.success=false;}
 await save();await browser?.close();await writeFile(path.join(out,continuing?'continued-'+continuationTag+'-evidence.json':'evidence.json'),JSON.stringify(state,null,2),{flag:'wx'});
 if(cleanupFailure)throw cleanupFailure;
}
