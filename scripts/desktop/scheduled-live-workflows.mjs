import assert from 'node:assert/strict';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {expect} from '@playwright/test';

export async function runLiveSchedule({application,page,runtime,out,evidence,save,check}){
 const call=(action,args)=>page.evaluate(({action,args})=>window.agentopia.call(action,args),{action,args});
 const marker='SCHEDULED-LIVE-'+randomUUID().slice(0,12),name='Live one-time check '+randomUUID().slice(0,8);
 await page.getByRole('button',{name:'Scheduled tasks',exact:true}).click();await page.getByRole('button',{name:'New task',exact:true}).click();
 const dialog=page.getByRole('dialog');await dialog.getByLabel('Task name',{exact:true}).fill(name);await dialog.getByLabel('Instructions',{exact:true}).fill('Reply with exactly '+marker+'. Use no tools.');
 await dialog.getByRole('combobox',{name:'Repeat',exact:true}).selectOption('once');
 const due=new Date(Math.ceil((Date.now()+15000)/60000)*60000),local=new Date(due.getTime()-due.getTimezoneOffset()*60000).toISOString().slice(0,16);
 await dialog.getByLabel('Local date and time',{exact:true}).fill(local);await dialog.getByText('Advanced',{exact:true}).click();await dialog.getByLabel('Notifications',{exact:true}).selectOption('off');
 await dialog.getByText('Model, access and context',{exact:true}).click();await dialog.getByLabel('Permissions').selectOption('chat');
 await expect(dialog.getByRole('button',{name:'Model and thinking',exact:true})).toHaveAttribute('title',/^ChatGPT/);
 evidence.liveSchedule={name,marker,due:due.toISOString(),phase:'submit-once'};await save();
 await dialog.getByRole('button',{name:'Create task',exact:true}).click();await expect(dialog).toHaveCount(0);
 const task=(await call('tasks.list')).tasks.find(row=>row.snapshot.name===name);assert(task);assert.equal(task.snapshot.options.provider,'openai-oauth');assert.equal(task.snapshot.conversationId,null);assert.equal(task.snapshot.options.permission,'chat');assert.equal(task.status,'active');evidence.liveSchedule.taskId=task.id;evidence.liveSchedule.phase='scheduled';await save();
 await check('The real Scheduled modal saves one enabled one-time task using ChatGPT and Chat only, with no existing chat or attached context.');
 let run;const deadline=Date.now()+180000;
 while(Date.now()<deadline){
  const current=await call('tasks.list');run=current.runs.find(row=>row.taskId===task.id);
  if(run){Object.assign(evidence.liveSchedule,{runId:run.id,requestId:run.requestId,conversationId:run.conversationId,phase:run.status});await save();if(['completed','failed','held','cancelled'].includes(run.status))break;}
  await new Promise(resolve=>setTimeout(resolve,500));
 }
 assert(run&&run.status==='completed',run?.error??'Inspect the saved schedule before any further submission');
 const rows=await call('messages.list',{conversationId:run.conversationId}),answer=rows.find(row=>row.role==='assistant'&&row.content.text.includes(marker));assert(answer);
 const native=await application.evaluate(async(_,id)=>{const broker=globalThis.__liveBroker,result=await broker.admin.from('desktop_codex_turns').select('request_id,thread_id,runtime_version,context').eq('request_id',id).single();if(result.error)throw Error(result.error.message);return {request:result.data.request_id,thread:result.data.thread_id,version:result.data.runtime_version,options:result.data.context.options};},run.requestId);
 assert.equal(native.options.provider,'openai-oauth');assert.equal(native.options.harness,'codex');assert.equal(native.version,'0.163.0');assert.equal((await call('tasks.list')).runs.filter(row=>row.taskId===task.id).length,1);
 evidence.liveSchedule.native={thread:native.thread,version:native.version,provider:native.options.provider,harness:native.options.harness};evidence.liveSchedule.reply=answer.content.text;evidence.liveSchedule.phase='completed';await save();
 await page.locator('.scheduled-nav-task').filter({hasText:name}).click();await expect(page.getByText(answer.content.text,{exact:true})).toBeVisible({timeout:15000});await page.screenshot({path:path.join(out,'scheduled-live-result.png')});
 await check('The clock dispatches the task once through actual Codex and live ChatGPT, saves the requested marker in a new chat, and exposes the result in Scheduled.');
}

export async function verifyLiveScheduleReopen({application,page,evidence,check,out}){
 const saved=evidence.liveSchedule,state=await page.evaluate(()=>window.agentopia.call('tasks.list'));
 assert(state.tasks.some(row=>row.id===saved.taskId&&row.status==='completed'));const runs=state.runs.filter(row=>row.taskId===saved.taskId);assert.equal(runs.length,1);assert.equal(runs[0].id,saved.runId);assert.equal(runs[0].status,'completed');
 await page.getByRole('button',{name:'Scheduled tasks',exact:true}).click();await page.locator('.scheduled-nav-task').filter({hasText:saved.name}).click();await expect(page.getByText(saved.reply,{exact:true})).toBeVisible({timeout:15000});
 const network=await application.evaluate(()=>globalThis.__startupNetwork);assert.equal(network.inference.length,0);assert.deepEqual(network.blocked,[]);await page.screenshot({path:path.join(out,'scheduled-live-reopened.png')});
 await check('A cold reopen retains the single completed live scheduled result and signed-in account without sending another inference request.');
}
