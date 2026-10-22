import {expandWorkHistory} from './turn-ui-helpers.mjs';
import {expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import os from 'node:os';import path from 'node:path';

export async function verifyWorkspaceToolsUI(app,page,artifacts){
 const root=mkdtempSync(path.join(os.tmpdir(),'agentopia-workspace-ui-')),file=path.join(root,'notes.md');writeFileSync(file,'Original project note.\n');let reference;const conversations=[];
 await app.evaluate(({dialog},root)=>{
  const fetcher=globalThis.fetch,open=dialog.showOpenDialog,approve=dialog.showMessageBox;globalThis.__workspaceUIRestore=()=>{globalThis.fetch=fetcher;dialog.showOpenDialog=open;dialog.showMessageBox=approve;};
  dialog.showOpenDialog=async()=>({canceled:false,filePaths:[root]});dialog.showMessageBox=async()=>({response:1,checkboxChecked:false});globalThis.__workspaceUI=[];
  globalThis.fetch=async(input,options)=>{
   if(String(input)!=='https://openrouter.ai/api/v1/chat/completions')return fetcher(input,options);
   const body=JSON.parse(options.body),prompt=body.messages.filter(m=>m.role==='user').at(-1)?.content;if(typeof prompt!=='string'||!prompt.startsWith('Workspace file workflow'))return fetcher(input,options);
   globalThis.__workspaceUI.push(body);const last=body.messages.at(-1),read=body.messages.find(m=>m.role==='tool'&&JSON.parse(m.content).sha256),result=last.role==='tool'?JSON.parse(last.content):null;
   const text=value=>new Response('data: '+JSON.stringify({choices:[{delta:{content:value}}]})+'\n\ndata: {"choices":[{"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n');
   const tool=(name,args)=>new Response('data: '+JSON.stringify({choices:[{delta:{tool_calls:[{index:0,id:'workspace-call-'+globalThis.__workspaceUI.length,type:'function',function:{name,arguments:JSON.stringify(args)}}]},finish_reason:'tool_calls'}]})+'\n\ndata: [DONE]\n\n');
   const ref=globalThis.__workspaceUIReference;
   if(prompt.startsWith('Workspace file workflow multi')){
    const outputs=body.messages.filter(m=>m.role==='tool');
    if(!outputs.length)return tool('read_file',{reference_id:ref,path:'notes.md'});
    if(outputs.length===1)return tool('write_file',{reference_id:ref,path:'notes.md',expected_hash:JSON.parse(outputs[0].content).sha256,content:'Multi-file project note.\n',reason:'Update the first reviewed file.'});
    if(outputs.length<6)return tool('write_file',{reference_id:ref,path:'added-'+(outputs.length-1)+'.md',expected_hash:null,content:'New reviewed file '+(outputs.length-1)+'.\n',reason:'Create a reviewed text file.'});
    return text('Five reviewed changes are saved. Open the [project note](agentopia-file://'+ref+'/notes.md).');
   }
   if(last.role==='user')return tool('read_file',{reference_id:ref,path:'notes.md'});
   if(result?.denied)return text('The proposed change was declined.');
   if(!body.tools?.some(tool=>tool.function.name==='write_file'))return text('Workspace plan is ready; no files changed.');
   if(read&&body.messages.filter(m=>m.role==='tool').length===1)return tool('write_file',{reference_id:ref,path:'notes.md',expected_hash:JSON.parse(read.content).sha256,content:'Updated project note.\n',reason:'Clarify the project note.'});
   return text(result?.denied?'The proposed change was declined.':result?.error?'The file was left unchanged because it changed during review.':'The reviewed file change is saved.');
  };
 },root);
 const newTurn=async(kind)=>{
  await page.keyboard.press('Control+Shift+o');await page.getByRole('button',{name:'Permissions',exact:true}).click();await page.getByRole('menuitem',{name:/^Default permissions/}).click();
  await page.getByRole('button',{name:'Add to chat',exact:true}).click();await page.getByRole('menuitem',{name:'Files and folders',exact:true}).click();await page.getByRole('button',{name:'Add folder',exact:true}).click();await page.getByRole('button',{name:'Done',exact:true}).click();
  const refs=await page.evaluate(()=>window.agentopia.call('files.list'));reference=refs.find(ref=>ref.path===root).id;await app.evaluate((_electron,id)=>{globalThis.__workspaceUIReference=id;},reference);
  await page.getByLabel('Message',{exact:true}).fill('Workspace file workflow '+kind);await page.getByRole('button',{name:'Send',exact:true}).click();
 };
 const edited=()=>page.locator('.tool-activity').filter({hasText:'Edit file: notes.md'});
 const remember=async()=>{const chats=await page.evaluate(()=>window.agentopia.call('conversations.list'));for(const chat of chats.filter(c=>c.title.startsWith('Workspace file workflow')))if(!conversations.includes(chat.conversation_id))conversations.push(chat.conversation_id);};
 try{
  await page.getByRole('button',{name:'Start chat',exact:true}).click();await newTurn('approve');await expect(page.getByRole('button',{name:'Approve and apply',exact:true})).toBeVisible({timeout:20000});assert.equal(readFileSync(file,'utf8'),'Original project note.\n');await expect(page.getByLabel('Proposed file diff')).toContainText('Updated project note.');
  await page.screenshot({path:path.join(artifacts,'workspace-file-approval.png')});await page.getByRole('button',{name:'Approve and apply',exact:true}).click();await expect(page.getByText('The reviewed file change is saved.',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Stop response',exact:true})).toHaveCount(0);assert.equal(readFileSync(file,'utf8'),'Updated project note.\n');await remember();
  await expandWorkHistory(page);await edited().locator('summary').click();await edited().getByRole('button',{name:'Undo change',exact:true}).click();await expect(edited()).toContainText('Undone');assert.equal(readFileSync(file,'utf8'),'Original project note.\n');
  await newTurn('multi');
  for(let index=0;index<5;index++){const pending=page.locator('.turn-pending-approvals .tool-activity').filter({hasText:'Edit file: '+(index?'added-'+index+'.md':'notes.md')});await expect(pending.getByRole('button',{name:'Approve and apply',exact:true})).toBeVisible({timeout:20000});await expect(page.getByRole('button',{name:/^Waiting for approval/})).toBeVisible();await pending.getByRole('button',{name:'Approve and apply',exact:true}).click();await expect(pending).toHaveCount(0);}
  await expect(page.getByText('Five reviewed changes are saved.',{exact:false})).toBeVisible();await expect(page.getByRole('button',{name:'Stop response',exact:true})).toHaveCount(0);await remember();
  const card=page.getByRole('region',{name:'Files changed in this response'});await expect(card).toContainText('Edited 5 files');await expect(card.locator('.changed-file-row')).toHaveCount(3);await card.getByRole('button',{name:'Show 2 more files',exact:true}).click();await expect(card.locator('.changed-file-row')).toHaveCount(5);await card.getByRole('button',{name:'Show fewer files',exact:true}).click();
  const work=page.locator('.message.assistant .turn-work-toggle').last();await expect(work).toHaveAttribute('aria-expanded','false');await expect(work).toHaveText(/Worked for/);const elapsed=await work.innerText();await work.focus();await page.keyboard.press('Enter');await expect(work).toHaveAttribute('aria-expanded','true');await work.click();await expect(work).toHaveAttribute('aria-expanded','false');
  await card.getByRole('button',{name:'View changes',exact:true}).click();const pane=page.getByRole('complementary',{name:'Files, canvas and browser'}),review=page.getByLabel('Response file changes',{exact:true});await expect(review).toBeVisible();await expect(pane.getByRole('combobox',{name:'Workspace root folder',exact:true})).toHaveValue(reference);await expect(review.locator('.review-file')).toHaveCount(5);await expect(review.getByLabel('Proposed file diff').first()).toContainText('Multi-file project note.');await expect(pane.getByRole('tab',{name:'Changes',exact:true})).toBeVisible();
  await page.screenshot({path:path.join(artifacts,'turn-changes-review.png')});
  const multiChat=(await page.evaluate(()=>window.agentopia.call('conversations.list'))).find(c=>c.title==='Workspace file workflow multi');
  // Wait for the actual debounced layout flush before testing reload recovery.
  await expect.poll(async()=>{const state=await page.evaluate(id=>window.agentopia.call('workspace.state',{scope:id}),multiChat.conversation_id);return state.tabs.some(tab=>tab.kind==='changes'&&tab.id===state.active);}).toBe(true);
  await page.reload();await expect(page.getByRole('button',{name:'Account menu',exact:true})).toBeVisible({timeout:20000});await expect(review).toBeVisible();await expect(review.locator('.review-file')).toHaveCount(5);await expect(page.locator('.turn-work-toggle').last()).toHaveText(elapsed);await page.getByRole('link',{name:'project note',exact:true}).click();await expect(pane.getByRole('tab',{name:'notes.md',exact:true})).toBeVisible();await pane.getByRole('tab',{name:'Changes',exact:true}).click();
  // Undo must preserve a newer human edit and report partial progress without retrying it.
  writeFileSync(file,'Human edit after the multi-file response.\n');await review.getByRole('button',{name:'Undo edits…',exact:true}).click();await page.getByRole('dialog',{name:'Undo this response’s edits?',exact:true}).getByRole('button',{name:'Undo edits',exact:true}).click();await expect(review.getByRole('alert')).toContainText('Undo stopped after 4 of 5 edits.');assert.equal(readFileSync(file,'utf8'),'Human edit after the multi-file response.\n');for(let index=1;index<=4;index++)assert.equal(existsSync(path.join(root,'added-'+index+'.md')),false);await expect(card).toContainText('Edited 1 file');
  console.log('PASS: Real five-file edits produced a collapsed timed activity row, keyboard disclosure, expandable file card, right-pane diffs, owned persisted review tab, local document link, and conflict-safe partial undo. Provider responses were controlled fixtures.');
  writeFileSync(file,'Original project note.\n');
  await newTurn('deny');await expect(page.getByRole('button',{name:'Deny change',exact:true})).toBeVisible();await page.getByRole('button',{name:'Deny change',exact:true}).click();await expect(page.getByText('The proposed change was declined.',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Stop response',exact:true})).toHaveCount(0);assert.equal(readFileSync(file,'utf8'),'Original project note.\n');await remember();
  await newTurn('conflict');await expect(page.getByRole('button',{name:'Approve and apply',exact:true})).toBeVisible();writeFileSync(file,'A newer human edit.\n');await page.getByRole('button',{name:'Approve and apply',exact:true}).click();await expect(page.getByText('The file was left unchanged because it changed during review.',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Stop response',exact:true})).toHaveCount(0);assert.equal(readFileSync(file,'utf8'),'A newer human edit.\n');await remember();
  await newTurn('cancel');await expect(page.getByRole('button',{name:'Approve and apply',exact:true})).toBeVisible();await page.getByRole('button',{name:'Stop response',exact:true}).click();await expect(page.getByRole('button',{name:'Approve and apply',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Stop response',exact:true})).toHaveCount(0);assert.equal(readFileSync(file,'utf8'),'A newer human edit.\n');await remember();
  const wire=await app.evaluate(()=>globalThis.__workspaceUI);assert(wire.some(body=>body.messages.some(m=>m.role==='tool'&&JSON.parse(m.content).denied)));assert(wire.every(body=>body.tools?.length));
  await page.reload();await expect(page.getByRole('button',{name:'Account menu',exact:true})).toBeVisible({timeout:20000});const chat=(await page.evaluate(()=>window.agentopia.call('conversations.list'))).find(c=>c.title==='Workspace file workflow approve');await page.getByRole('region',{name:'Chat history'}).getByRole('button',{name:chat.title,exact:true}).click();await expect(page.getByText('The reviewed file change is saved.',{exact:true})).toBeVisible();await expandWorkHistory(page);await expect(edited()).toContainText('Undone');await page.screenshot({path:path.join(artifacts,'workspace-file-history.png')});
  console.log('PASS: Installed workspace UI performed a real read, held a real file unchanged until diff approval, applied and undid the edit, respected denial, preserved a newer human edit, cancelled an approval, and restored its saved activity. AI tool calls were controlled fixtures.');
 }catch(error){const state=await page.evaluate(()=>({bodyInline:document.body.style.pointerEvents,bodyComputed:getComputedStyle(document.body).pointerEvents,htmlComputed:getComputedStyle(document.documentElement).pointerEvents,dialogs:document.querySelectorAll('[role=dialog]').length,menus:document.querySelectorAll('[role=menu]').length}));console.error('Workspace input-lock state:',JSON.stringify(state));await page.screenshot({path:path.join(artifacts,'workspace-input-lock.png')});throw error;}finally{
  for(const conversationId of conversations)await page.evaluate(id=>window.agentopia.call('conversations.manage',{conversationId:id,action:'delete'}),conversationId).catch(()=>{});
  if(reference)await page.evaluate(id=>window.agentopia.call('files.remove',{id}),reference).catch(()=>{});
  await app.evaluate(()=>globalThis.__workspaceUIRestore?.());assert(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep));rmSync(root,{recursive:true,force:true});
  await page.reload();await expect(page.getByRole('button',{name:'Account menu',exact:true})).toBeVisible({timeout:20000});await page.getByRole('button',{name:'Agents',exact:true}).click();
 }
}
