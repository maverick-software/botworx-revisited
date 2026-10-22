import {openModelCatalog,thinkingSlider} from './model-controls.mjs';
import {expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import os from 'node:os';import path from 'node:path';
export async function verifyComposerUI(app,page,service,agentId,artifacts){
 const root=mkdtempSync(path.join(os.tmpdir(),'agentopia-composer-ui-')),file=path.join(root,'project-notes.md');writeFileSync(file,'UI_FILE_CONTEXT_819: This project grows orchids.');
 let conversation,goalId,reference;
 const menu=async name=>{await page.getByRole('button',{name:'Add to chat',exact:true}).click();await page.getByRole('menuitem',{name,exact:true}).click();};
 const check=r=>{if(r.error)throw new Error(r.error.message);return r.data;};
 try{
  await app.evaluate(({dialog},file)=>{globalThis.__composerOriginalOpen=dialog.showOpenDialog;globalThis.__composerOriginalApproval=dialog.showMessageBox;globalThis.__composerApprovals=0;dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});dialog.showMessageBox=async()=>{globalThis.__composerApprovals++;return {response:1,checkboxChecked:false};};},file);
  await page.keyboard.press('Control+Shift+o');
  await openModelCatalog(page);
  await expect(page.locator('.model-list').getByRole('button',{name:/Verification model/})).toBeVisible();
  await (await thinkingSlider(page)).press('End');await expect(page.locator('.model-trigger b')).toHaveText('High');
  await page.screenshot({path:path.join(artifacts,'model-thinking.png')});await page.keyboard.press('Escape');
  await menu('Plan mode');await expect(page.getByRole('button',{name:'Turn plan mode off',exact:true})).toBeVisible();
  await menu('Files and folders');await page.getByRole('button',{name:'Add files',exact:true}).click();await expect(page.locator('.file-reference-list').getByText('project-notes.md',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Done',exact:true}).click();await page.getByLabel('Message',{exact:true}).fill('Plan how to improve these project notes.');await page.getByRole('button',{name:'Send',exact:true}).click();
  await expect(page.getByText('Saved verification answer',{exact:true})).toBeVisible({timeout:30000});await expect(page.getByRole('button',{name:'Stop response',exact:true})).toHaveCount(0);
  const clipboardPermission=await page.evaluate(async()=> (await navigator.permissions.query({name:'clipboard-write'})).state);assert.equal(clipboardPermission,'granted','Microphone restrictions blocked response copying');
  const sent=await app.evaluate(()=>globalThis.__composerLastRequest);assert.equal(sent.reasoning.effort,'high');assert(sent.messages[0].content.includes('PLAN MODE'));assert(JSON.stringify(sent.messages).includes('UI_FILE_CONTEXT_819'));assert.equal(await app.evaluate(()=>globalThis.__composerApprovals),1);
  const chats=await page.evaluate(()=>window.agentopia.call('conversations.list'));conversation=chats.find(c=>c.title==='Plan how to improve these project notes.').conversation_id;
  const messages=await page.evaluate(id=>window.agentopia.call('messages.list',{conversationId:id}),conversation);reference=messages[0].metadata.options.files[0];assert.equal(messages[0].metadata.options.thinking,'high');assert.equal(messages[0].content.files[0].name,'project-notes.md');
  await page.getByRole('button',{name:'Remove project-notes.md',exact:true}).click();await page.getByRole('button',{name:'Permissions',exact:true}).click();await page.getByRole('menuitem',{name:/^Chat only/}).click();
  await menu('Files and folders');await page.getByRole('button',{name:'Add files',exact:true}).click();await expect(page.locator('.file-reference-list input[type=checkbox]')).toBeChecked();await page.getByRole('button',{name:'Done',exact:true}).click();await page.getByRole('button',{name:'Remove project-notes.md',exact:true}).click();
  await page.getByRole('button',{name:'Turn plan mode off',exact:true}).click();await page.getByLabel('Message',{exact:true}).fill('Continue without file sharing.');await page.getByRole('button',{name:'Send',exact:true}).click();await expect(page.getByText('Saved verification answer',{exact:true})).toHaveCount(2);await expect(page.getByRole('button',{name:'Stop response',exact:true})).toHaveCount(0);
  assert(!JSON.stringify(await app.evaluate(()=>globalThis.__composerLastRequest)).includes('UI_FILE_CONTEXT_819'));
  await menu(/Goal/);await page.getByLabel('Goal objective',{exact:true}).fill('Produce a one-step checklist.');await page.getByLabel('Goal turn limit',{exact:true}).fill('1');await page.getByRole('button',{name:'Start goal',exact:true}).click();
  await expect(page.locator('.goal-strip')).toContainText('paused',{timeout:30000});await expect(page.locator('.goal-strip')).toContainText('1/1 turns');
  const goals=await page.evaluate(()=>window.agentopia.call('goals.list'));const goal=goals.find(g=>g.objective==='Produce a one-step checklist.');goalId=goal.id;assert.equal(goal.status,'paused');assert.equal(goal.turns_used,1);
  await page.getByRole('button',{name:'Mark goal complete',exact:true}).click();await expect(page.locator('.goal-strip')).toContainText('completed');
  await page.screenshot({path:path.join(artifacts,'composer-goal.png')});await page.reload();await expect(page.getByRole('button',{name:'Account menu',exact:true})).toBeVisible({timeout:20000});await menu(/Goal/);await page.locator('.saved-goal-row').filter({hasText:'Produce a one-step checklist.'}).click();await expect(page.locator('.goal-strip')).toContainText('completed');await page.keyboard.press('Control+Shift+o');
  await page.getByRole('button',{name:'Dictate message',exact:true}).click();await expect(page.getByRole('button',{name:'Stop dictation',exact:true})).toBeVisible({timeout:90000});await page.waitForTimeout(7500);await page.getByRole('button',{name:'Stop dictation',exact:true}).click();
  await expect.poll(()=>page.getByLabel('Message',{exact:true}).inputValue(),{timeout:150000}).toMatch(/american|country/i);
  const dictated=await page.getByLabel('Message',{exact:true}).inputValue();console.log('Actual local Whisper dictation:',dictated);assert(!dictated.includes('Saved verification answer'));
  await page.screenshot({path:path.join(artifacts,'local-whisper-dictation.png')});await page.getByLabel('Message',{exact:true}).fill('');
  await page.getByRole('button',{name:'Voice mode',exact:true}).click();await expect(page.getByRole('dialog',{name:'Voice mode',exact:true})).toBeVisible();await expect(page.getByLabel('Read replies aloud',{exact:true})).toBeChecked();await page.screenshot({path:path.join(artifacts,'voice-mode.png')});await page.getByRole('button',{name:'Close dialog',exact:true}).click();
  const voice=await page.evaluate(()=>window.agentopia.call('voice.status'));assert.equal(voice.ready,true);assert.equal(voice.engine,'Whisper base.en');
  await page.evaluate(id=>window.agentopia.call('conversations.manage',{conversationId:id,action:'delete'}),conversation);conversation=undefined;
  check(await service.from('desktop_goals').delete().eq('id',goalId));goalId=undefined;
  await menu('Files and folders');await page.getByRole('button',{name:'Forget project-notes.md',exact:true}).click();await expect(page.locator('.file-reference-list').getByText('project-notes.md',{exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Done',exact:true}).click();reference=undefined;
  await page.reload();await expect(page.getByRole('button',{name:'Account menu',exact:true})).toBeVisible({timeout:20000});await page.keyboard.press('Control+Shift+o');await page.getByRole('button',{name:'Agents',exact:true}).click();
  console.log('PASS: Composer model/effort, real sharing approval, plan mode, text attachments, chat-only privacy, goal budget/completion controls, actual local Whisper dictation from test audio, and voice-mode controls.');
 }finally{
  await app.evaluate(({dialog})=>{if(globalThis.__composerOriginalOpen)dialog.showOpenDialog=globalThis.__composerOriginalOpen;if(globalThis.__composerOriginalApproval)dialog.showMessageBox=globalThis.__composerOriginalApproval;}).catch(()=>{});
  if(conversation)await service.from('conversation_sessions').delete().eq('conversation_id',conversation);
  if(goalId)await service.from('desktop_goals').delete().eq('id',goalId);
  if(reference)await page.evaluate(id=>window.agentopia.call('files.remove',{id}),reference).catch(()=>{});
  const resolved=path.resolve(root);assert(resolved.startsWith(path.resolve(os.tmpdir())+path.sep));rmSync(resolved,{recursive:true,force:true});
 }
}
