import {chromium,expect} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';
import {checkpointWriter} from './checkpoint.mjs';
import {openModelCatalog} from './model-controls.mjs';

desktopOperation('installed native embedded form continuity; ChatGPT OAuth by default');
const version=JSON.parse(await readFile(new URL('../../package.json',import.meta.url),'utf8')).version;
const configFile=path.resolve(process.argv[2]??''),cfg=JSON.parse(await readFile(configFile,'utf8')),info=JSON.parse(await readFile(path.join(cfg.output,'server-info.json'),'utf8'));
assert.equal(cfg.format,1);assert.equal(path.dirname(configFile),cfg.output);assert(path.isAbsolute(cfg.file));
const out=cfg.output,progress=path.join(out,'progress.json'),recovering=process.argv.includes('--resume-before-first-upload'),state=recovering?JSON.parse(await readFile(progress,'utf8')):{format:1,version,inference:true,simulated:false,phase:'prepared',nonce:cfg.nonce,url:info.url,frameUrl:info.frameUrl,runs:[],reviews:[]};
const secondProvider=process.argv.includes('--with-openrouter')?'openrouter':'openai-oauth',secondModel=secondProvider==='openrouter'?'openai/gpt-6.1-sol':'gpt-6.1-sol';state.secondProvider=secondProvider;
if(recovering){assert.equal(state.phase,'first-running');assert.equal(state.runs.length,0);assert(!state.secondRequestId&&!state.secondUserText);await writeFile(path.join(out,'recovery-baseline.json'),JSON.stringify(state,null,2),{flag:'wx'});state.verifierError=state.error;delete state.error;state.initialRequestId=state.firstRequestId;state.initialTurnCancelledBeforeUpload=true;}else await writeFile(progress,JSON.stringify(state,null,2),{flag:'wx'});const writeState=checkpointWriter(progress),save=()=>writeState(state);
const allowed=['browser_open','browser_list','browser_snapshot','browser_frames','browser_frame_snapshot','browser_action','browser_select','browser_press','browser_upload'];
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
   assert(allowed.includes(tool.name),'Unexpected reviewed tool: '+tool.name);
   const args=tool.approval.arguments;assert.equal(args.url,info.url);
   if(tool.name==='browser_open')assert.equal(index,0,'The second provider must use the existing tab.');
   if(args.frame_url){assert.equal(args.frame_url,info.frameUrl);assert.equal(args.frame_name,'Embedded report form');}
   if(['browser_action','browser_select','browser_press','browser_upload'].includes(tool.name)){
    if(recovering&&index===0)assert(!['browser_action','browser_select'].includes(tool.name),'Recovery must preserve the completed form setup.');
    assert.equal(args.frame_url,info.frameUrl,'Input must target the reviewed embedded document.');
    if(tool.name==='browser_action'){
     assert(['click','fill','scroll'].includes(args.action));
     if(args.action==='click')assert.equal(args.element.name,'Arm report');
     if(args.action==='fill'){assert.equal(index,0,'The second provider must retain the earlier message.');assert.equal(args.element.name,'Report message');assert.equal(args.text,cfg.phrase);}
    }
    if(tool.name==='browser_select'){assert.equal(args.element.name,'Report region');assert.deepEqual(args.labels,[index===0?'East':'West']);}
    if(tool.name==='browser_press'){assert.equal(args.element.name,'Report message');assert.equal(args.key,'Enter');assert(!args.shift);}
    if(tool.name==='browser_upload'){
     assert.equal(args.element.name,'Frame report');assert.equal(args.files.length,1);assert.equal(args.files[0].name,cfg.filename);assert.equal(args.files[0].sha256,(index===0?cfg.first:cfg.second).sha256);
     assert.equal((await server('status')).uploads.length,index);
    }
    const signature=tool.name+':'+(args.action??'');assert(!state.reviews.some(review=>review.requestId===id&&review.signature===signature),'Never repeat a reviewed input automatically.');
   }
   const panels=page.locator('.tool-awaiting_approval').filter({hasText:'Agentopia browser'}),panel=tool.name==='browser_upload'?panels.filter({has:page.locator('.browser-upload-review')}):['browser_select','browser_press'].includes(tool.name)?panels.filter({has:page.locator('.browser-input-review')}):panels.filter({hasText:tool.approval.tool});
   await expect(panel).toHaveCount(1);await expect(panel).toBeVisible();
   state.pendingReview={requestId:id,toolId:tool.id,name:tool.name,signature:tool.name+':'+(args.action??''),arguments:args};await save();
   if(args.frame_url){await expect(panel).toContainText('Embedded document');await expect(panel).toContainText(info.frameUrl);}
   if(tool.name==='browser_upload')await page.screenshot({path:path.join(out,index===0?'chatgpt-frame-upload-review.png':'openrouter-frame-upload-review.png'),animations:'disabled'});
   await panel.getByRole('button',{name:'Approve tool call',exact:true}).click();approved.add(tool.id);state.reviews.push(state.pendingReview);delete state.pendingReview;await save();
  }
  assert(!message?.metadata.native?.approvals.some(approval=>approval.status==='pending'),'Unexpected native command or file approval.');
  if(message&&message.metadata.status!=='running'){assert.equal(message.metadata.status,'completed',message.metadata.error??message.content.text);return message;}
  await new Promise(resolve=>setTimeout(resolve,600));
 }
 throw new Error('Observation expired. Inspect saved request and site receipts; never replay the request.');
}
async function validate(message,index){
 assert.equal(message.metadata.native?.version,'0.163.0');assert(message.content.text.includes(cfg.receipts[index]));assert(message.content.text.includes(cfg.fileReceipts[index]));
 assert(message.metadata.tools.every(tool=>allowed.includes(tool.name)));assert(!message.metadata.native.items.some(entry=>['commandExecution','collabAgentToolCall'].includes(entry.item.type)));
 if(index)assert(!message.metadata.tools.some(tool=>tool.name==='browser_open'));
 for(const name of ['browser_upload','browser_select','browser_press']){const selected=name==='browser_select'&&index===0&&recovering?await reply(state.initialRequestId):message,completed=selected.metadata.tools.filter(tool=>tool.name===name&&tool.status==='completed');assert.equal(completed.length,1,name);assert.equal(completed[0].result.tab_id,tab);assert.equal(completed[0].result.frame_url,info.frameUrl);}
 for(const tool of message.metadata.tools.filter(tool=>tool.status==='completed'&&tool.result?.tab_id))assert.equal(tool.result.tab_id,tab);
 await expect.poll(async()=>(await server('status')).acks.length,{timeout:15000}).toBe(index+1);
 const received=await server('status');for(const kind of ['uploads','sends','acks']){assert.equal(received[kind].length,index+1);assert(received[kind].every(row=>row.valid));}assert.equal(received.violations.length,0);assert.equal(received.documents.length,1,'Both providers must continue the same embedded document.');assert(received.acks.every(row=>row.cookieMatched));assert(received.uploads.every(row=>row.inputValue==='C:\\fakepath\\'+cfg.filename));assert(received.sends.every(row=>row.value===cfg.phrase&&row.session===received.documents[0]));state.server=received;if(index)state.providerContinuity=received;await save();
}
try{
 browser=await chromium.connectOverCDP(process.env.AGENTOPIA_CDP_URL??'http://127.0.0.1:9237');page=browser.contexts().flatMap(context=>context.pages()).find(page=>page.url().startsWith('agentopia://app'));assert(page);page.setDefaultTimeout(30000);
 await expect(page.getByRole('button',{name:'Account menu',exact:true})).toBeVisible({timeout:240000});owner=(await call('auth.state')).identity.id;assert.equal((await call('native.active')).length,0);
 if(recovering){assert.equal(owner,state.restoration.owner);({navigation,composer,preferences,originalReferences}=state.restoration);reference=state.referenceId;conversation=state.conversationId;tab=state.tabId;assert.equal(page.url(),'agentopia://app/conversations/'+conversation,'Recovery must retain the open chat and live embedded document.');const initial=await reply(state.initialRequestId);assert.equal(initial.metadata.status,'cancelled');assert.equal((await call('messages.list',{conversationId:conversation})).length,2);const received=await server('status');assert.equal(received.documents.length,1);for(const kind of ['uploads','sends','acks','violations'])assert.equal(received[kind].length,0);for(const name of ['browser_select','browser_action'])assert(initial.metadata.tools.some(tool=>tool.name===name&&tool.status==='completed'));assert(!initial.metadata.tools.some(tool=>tool.name==='browser_upload'&&tool.status==='completed'));}else{const fresh=await server('status');for(const kind of ['documents','uploads','sends','acks','violations'])assert.equal(fresh[kind].length,0);navigation=await call('navigation.state',{owner});composer=await call('composer.get');preferences=await call('preferences.get');originalReferences=await call('files.list');state.restoration={owner,navigation,composer,preferences,originalReferences};}await save();
 const providers=await call('providers.status');assert(providers.chatgpt?.authorized);if(secondProvider==='openrouter')assert(providers.openrouter);const agent=(await call('agents.list')).find(agent=>agent.name==='Native Codex Assistant');assert(agent);state.agentId=agent.id;
 assert.equal(createHash('sha256').update(await readFile(cfg.file)).digest('hex'),cfg.first.sha256);
 if(!recovering){state.phase='native-file-picker-pending';await save();const picked=await call('files.pick',{kind:'file'});assert.equal(picked.selected.length,1);reference=picked.selected[0];const selected=(await call('files.list')).find(file=>file.id===reference);assert.equal(path.normalize(selected.path),path.normalize(cfg.file));assert.equal(selected.name,cfg.filename);state.referenceId=reference;state.nativeFilePickerCompleted=true;await save();}
 const firstId=randomUUID();request=firstId;state.firstRequestId=firstId;state.phase='first-dispatch-pending';await save();
 const text=recovering?'Continue embedded form verification '+cfg.nonce+' in the same existing tab and embedded document. The verifier stopped BEFORE approving your upload; independent server records prove zero uploads and zero submissions. The completed setup already filled Report message, selected East, and clicked Arm report once. Preserve that state: DO NOT fill, select, arm, reload or open a tab. Use only Agentopia browser_list/browser_snapshot/browser_frames/browser_frame_snapshot/browser_upload/browser_press through agentopia_host MCP. Take a fresh frame snapshot, upload the selected '+cfg.filename+' exactly once to Frame report, wait for its FILE receipt in a fresh frame snapshot, then send Enter exactly once to Report message. Report exact FILE and FORM receipts. Leave the tab/document open; no scripts/commands/other file tools/screenshots/subagents or uncertain retries.':'Embedded form verification '+cfg.nonce+'. Use only the Agentopia browser tools through agentopia_host MCP. Open exactly one tab at '+info.url+'. Inspect its frame catalog and use browser_frame_snapshot to enter the embedded document named Embedded report form. Read its confirmation phrase. In that embedded document, fill Report message with that phrase, select East in Report region, click Arm report exactly once, then attach the selected '+cfg.filename+' exactly once to Frame report using browser_upload (selection sends the file immediately). Take fresh frame snapshots after each action. Wait until the file receipt is visible, then send Enter exactly once to Report message. Read and report the exact FILE and FORM receipts, leaving this tab and embedded document open. Use browser_snapshot only to obtain frame refs and browser_frame_snapshot for all embedded controls. Do not use scripts, commands, other file tools, screenshots or subagents. Never retry an uncertain upload or submission.';
 state.firstUserText=text;await save();const started=await call('chat.start',{requestId:firstId,agentId:agent.id,...(recovering?{conversationId:conversation}:{}),text,options:{harness:'codex',provider:'openai-oauth',model:'gpt-6.1-sol',thinking:'high',permission:'ask',mode:'chat',files:[reference],tools:[]}});
 conversation=started.conversation_id;state.conversationId=conversation;state.phase='first-running';await save();if(!recovering)await page.goto('agentopia://app/conversations/'+conversation);await expect(page.locator('.chat-stage .messages')).toBeVisible();
 const first=await wait(firstId,0);await validate(first,0);state.runs.push({provider:'openai-oauth',requestId:firstId,threadId:first.metadata.native.threadId,reply:first.content.text});state.phase='first-completed';await save();
 await server('hide');await expect.poll(async()=>(await server('status')).receiptHidden,{timeout:30000}).toBe(true);await writeFile(cfg.file,Buffer.from(cfg.secondBytes,'base64'));assert.equal(createHash('sha256').update(await readFile(cfg.file)).digest('hex'),cfg.second.sha256);state.editedFile=true;await save();
 await openModelCatalog(page);await page.getByRole('button',{name:secondProvider==='openrouter'?'OpenRouter':'ChatGPT',exact:true}).click();await page.getByRole('textbox',{name:'Search models',exact:true}).fill('gpt-6.1-sol');await page.locator('[data-model-id="'+secondModel+'"]').click();
 await page.getByRole('button',{name:'Add to chat',exact:true}).click();await page.getByRole('menuitem',{name:'Files and folders',exact:true}).click();const filesDialog=page.getByRole('dialog',{name:'Files and folders',exact:true}),row=filesDialog.locator('.file-reference-row').filter({has:page.getByText(cfg.filename,{exact:true})});await expect(row).toHaveCount(1);for(const other of await filesDialog.locator('.file-reference-row').all()){if(await other.getByRole('checkbox').isChecked()&&!await other.getByText(cfg.filename,{exact:true}).count())await other.getByRole('checkbox').uncheck();}await row.getByRole('checkbox').check();assert.equal(await filesDialog.locator('input:checked').count(),1);await filesDialog.getByRole('button',{name:'Done',exact:true}).click();
 await expect(page.locator('.composer [aria-label="Message attachments"]')).toContainText(cfg.filename);await expect.poll(async()=>(await call('drafts.get',{owner,scope:'conversation:'+conversation}))?.options.files).toEqual([reference]);const choices=await call('composer.get');assert.equal(choices.provider,secondProvider);assert.equal(choices.model,secondModel);assert.equal(choices.thinking,'high');assert.equal(choices.harness,'codex');
 const secondText='Continue embedded form verification '+cfg.nonce+' in the same existing Agentopia browser tab and the SAME embedded document named Embedded report form. The attached '+cfg.filename+' has changed. Use only browser_list, browser_snapshot, browser_frames, browser_frame_snapshot, browser_action, browser_select, browser_press and browser_upload through agentopia_host MCP. Use a fresh frame snapshot before every input. Keep the existing Report message unchanged, select West, click Arm report exactly once, attach the edited selected file to Frame report exactly once, wait for the new file receipt, then send Enter exactly once to Report message. Report the new FILE and FORM receipts and both earlier receipts from ChatGPT. Do not open/reload a tab or frame, fill the message again, use screenshots/scripts/commands/other file tools/subagents, or repeat an uncertain submission.';
 await page.getByRole('textbox',{name:'Message',exact:true}).fill(secondText);state.phase='second-ui-dispatch-pending';state.secondUserText=secondText;await save();await page.getByRole('button',{name:'Send',exact:true}).click();
 let second;await expect.poll(async()=>{second=(await call('messages.list',{conversationId:conversation})).filter(message=>message.role==='assistant'&&![firstId,state.initialRequestId].includes(message.metadata.timing?.requestId)).at(-1);return !!second?.metadata.timing?.requestId;},{timeout:45000}).toBe(true);request=second.metadata.timing.requestId;state.secondRequestId=request;state.phase='second-running';await save();second=await wait(request,1);await validate(second,1);assert(second.content.text.includes(cfg.receipts[0]));assert(second.content.text.includes(cfg.fileReceipts[0]));state.runs.push({provider:secondProvider,requestId:request,threadId:second.metadata.native.threadId,reply:second.content.text});
 const saved=await call('messages.list',{conversationId:conversation}),submitted=saved.filter(message=>message.role==='user').at(-1);assert.equal(submitted.metadata.options.provider,secondProvider);assert.deepEqual(submitted.metadata.options.files,[reference]);assert.equal(submitted.metadata.options.model,secondModel);assert.equal(submitted.metadata.options.thinking,'high');assert.equal(submitted.metadata.options.harness,'codex');await page.screenshot({path:path.join(out,'provider-continuity.png'),animations:'disabled'});await page.reload();await expect(page.locator('.message.assistant').last()).toContainText(cfg.receipts[1]);assert.deepEqual(await call('messages.list',{conversationId:conversation}),saved);
 state.savedMessagesUnchanged=true;state.sameTabAndDocumentAndCookie=true;state.editedBytesVerified=true;state.priorReceiptsRecalled=true;state.embeddedReviewsVerified=true;state.phase='completed';state.success=true;await save();console.log('PASS actual installed Codex ChatGPT OAuth continuation'+(secondProvider==='openrouter'?' through OpenRouter':'')+': native picker, embedded form, original/edited bytes, same document/tab/cookie, trusted click and Enter, recalled receipts and saved history.');
}catch(error){state.error=error.message.slice(0,1800);if(page)await page.screenshot({path:path.join(out,'failure.png'),animations:'disabled'}).catch(()=>{});throw error;}
finally{
 let cleanupFailure;try{
  if(page){
   if(request&&conversation){const current=await reply(request).catch(()=>null);if(current?.metadata.status==='running')await call('chat.cancel',{requestId:request}).catch(error=>{state.cancelError=error.message;});}
   if(state.success){
    if(tab){await call('browser.open',{id:tab,url:info.url+'forget',navigate:true}).catch(error=>{state.cookieCleanupError=error.message;});await call('browser.close',{id:tab}).catch(error=>{state.tabCleanupError=error.message;});}
    if(reference)await call('files.remove',{id:reference}).catch(error=>{state.referenceCleanupError=error.message;});assert.deepEqual(await call('files.list'),originalReferences);state.originalReferencesRestored=true;if(conversation)await call('conversations.manage',{conversationId:conversation,action:'archive'}).catch(error=>{state.archiveError=error.message;});
   }
   if(navigation&&state.success){await call('navigation.save',{owner,state:navigation});if(composer)await call('composer.save',{userId:owner,options:composer});if(preferences)await call('preferences.save',{userId:owner,preferences});await page.goto('agentopia://app/login');await expect(page.getByRole('button',{name:'Account menu',exact:true})).toBeVisible({timeout:60000});state.originalUiRestored=true;}
  }
  if(state.success){state.server=await server('status');assert(state.server.forgotten);await server('stop');state.fixtureStopRequested=true;}else state.recovery='Keep owned fixture/tab/reference for inspection. Never replay saved submissions.';
 }catch(error){cleanupFailure=error;state.cleanupError=error.message;state.success=false;}
 await save();await browser?.close();await writeFile(path.join(out,recovering?'recovered-evidence.json':'evidence.json'),JSON.stringify(state,null,2),{flag:'wx'});if(cleanupFailure)throw cleanupFailure;
}
