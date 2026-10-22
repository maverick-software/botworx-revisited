import assert from 'node:assert/strict';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {expect} from '@playwright/test';

// Real packaged IPC, authentication, PostgreSQL and native Codex. Only the
// external model response is supplied by the enclosing controlled guard.
export async function runScheduledPackaged({application,page,runtime,out,evidence,save,check}){
 const call=(action,args)=>page.evaluate(({action,args})=>window.agentopia.call(action,args),{action,args});
 const name='Packaged follow-up '+randomUUID().slice(0,8),marker='SCHEDULE-'+randomUUID();
 await page.getByRole('button',{name:'Scheduled tasks',exact:true}).click();
 await page.getByRole('button',{name:'New task',exact:true}).click();
 const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
 await dialog.getByLabel('Task name',{exact:true}).fill(name);await dialog.getByLabel('Instructions',{exact:true}).fill('Report this generated verification marker: '+marker);
 await dialog.getByRole('combobox',{name:'Repeat',exact:true}).selectOption('interval');await dialog.getByLabel('Every (minutes)',{exact:true}).fill('60');
 await dialog.getByText('Advanced',{exact:true}).click();await dialog.getByLabel('Notifications',{exact:true}).selectOption('off');
 await dialog.getByRole('switch',{name:'Start each run in new chat',exact:true}).uncheck();await dialog.getByRole('combobox',{name:'Runs in',exact:true}).selectOption(evidence.targetConversation);
 await dialog.getByText('Model, access and context',{exact:true}).click();await dialog.getByLabel('Schedule status').selectOption('paused');
 await dialog.getByRole('button',{name:'Create task',exact:true}).click();await expect(dialog).toHaveCount(0);
 const snapshot=await call('tasks.list'),task=snapshot.tasks.find(row=>row.snapshot.name===name);assert(task);assert.equal(task.snapshot.options.provider,'openai-oauth');assert.equal(task.snapshot.conversationId,evidence.targetConversation);assert.equal(task.snapshot.notifications,'off');assert.equal(task.status,'paused');
 evidence.scheduled={taskId:task.id,name,marker,conversation:evidence.targetConversation};await save();
 await check('The packaged Scheduled modal saves a real paused PostgreSQL task with ChatGPT, its selected existing chat, interval and notification setting.');
 await page.locator('.scheduled-nav-task').filter({hasText:name}).click();await expect(page.getByRole('complementary',{name:'Scheduled chat details'})).toBeVisible();
 await application.evaluate((_,{conversation,marker})=>{globalThis.__coordination.conversations[conversation]={steps:[{text:'CONTROLLED-SCHEDULE-CANCELLED',hold:'schedule-held',requireInput:marker},{text:'SCHEDULED-RESULT-'+marker,requireInput:marker}]};},{conversation:task.snapshot.conversationId,marker});
 const runNow=async()=>{await page.getByRole('button',{name:'Task options',exact:true}).click();await page.getByRole('menuitem',{name:'Run now',exact:true}).click();};
 await runNow();await expect.poll(()=>application.evaluate(()=>globalThis.__coordination.streams.has('schedule-held')),{timeout:30000}).toBe(true);
 const first=(await call('tasks.list')).runs.find(run=>run.taskId===task.id);assert(first&&first.requestCreatedAt);evidence.scheduled.cancelledRun=first.id;evidence.scheduled.cancelledRequest=first.requestId;await save();
 await page.getByRole('button',{name:'Stop run',exact:true}).click();await expect.poll(async()=>{const row=(await call('tasks.list')).runs.find(run=>run.id===first.id);return row.status;},{timeout:30000}).toBe('cancelled');
 await expect.poll(()=>application.evaluate(()=>globalThis.__coordination.streams.get('schedule-held')?.aborted),{timeout:30000}).toBe(true);
 await check('A manual scheduled run activates its real native request, appears in its chat context, and Stop run cancels that owned request without replay.');
 await runNow();await expect.poll(async()=>{const row=(await call('tasks.list')).runs.find(run=>run.taskId===task.id&&run.id!==first.id);if(row&&['failed','held'].includes(row.status))throw Error(row.error);return row?.status;},{timeout:45000}).toBe('completed');
 const completed=(await call('tasks.list')).runs.find(run=>run.taskId===task.id&&run.id!==first.id);assert(completed.requestId!==first.requestId);assert.equal(completed.conversationId,evidence.targetConversation);evidence.scheduled.completedRun=completed.id;evidence.scheduled.completedRequest=completed.requestId;
 await save();const completedResult=page.getByRole('region',{name:'Scheduled results'}).locator('.scheduled-result').filter({hasText:'· completed'});await expect(completedResult).toHaveCount(1);await completedResult.getByRole('button',{name:'Open chat',exact:true}).click();await expect(page.getByText('SCHEDULED-RESULT-'+marker,{exact:true})).toBeVisible({timeout:15000});
 await expect.poll(async()=>(await call('tasks.list')).runs.find(run=>run.id===completed.id)?.unread,{timeout:15000}).toBe(false);await page.screenshot({path:path.join(out,'scheduled-real-result.png')});await save();
 await check('A separately requested run completes through actual Codex, saves its scheduled response, opens the correct chat and records that the result was read.');
}

export async function verifyScheduledPackagedReopen({application,page,evidence,check,out}){
 const call=(action,args)=>page.evaluate(({action,args})=>window.agentopia.call(action,args),{action,args});
 const before=await application.evaluate(()=>globalThis.__coordination.calls.length),state=await call('tasks.list'),saved=evidence.scheduled,task=state.tasks.find(row=>row.id===saved.taskId);
 assert(task&&task.status==='paused'&&task.snapshot.notifications==='off');assert.equal(state.runs.find(row=>row.id===saved.cancelledRun).status,'cancelled');assert.equal(state.runs.find(row=>row.id===saved.completedRun).status,'completed');
 await page.getByRole('button',{name:'Scheduled tasks',exact:true}).click();await page.locator('.scheduled-nav-task').filter({hasText:saved.name}).click();await expect(page.getByText('SCHEDULED-RESULT-'+saved.marker,{exact:true})).toBeVisible({timeout:15000});
 assert.equal(await application.evaluate(()=>globalThis.__coordination.calls.length),before);await page.screenshot({path:path.join(out,'scheduled-cold-reopen.png')});
 await check('Cold reopening retains the task, cancelled/completed run identities and saved chat result without another inference request.');
}
