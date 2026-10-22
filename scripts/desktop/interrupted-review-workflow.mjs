import {expandWorkHistory} from './turn-ui-helpers.mjs';
import {expect} from '@playwright/test';import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';import {createHash,randomUUID} from 'node:crypto';import os from 'node:os';import path from 'node:path';
export async function beginInterruptedReview(app,page,agentId){
 const root=mkdtempSync(path.join(os.tmpdir(),'agentopia-pending-review-')),file=path.join(root,'approval.md'),before='A change that has not been approved.\n';writeFileSync(file,before);
 await app.evaluate(({dialog},fixture)=>{
  dialog.showOpenDialog=async()=>({canceled:false,filePaths:[fixture.file]});dialog.showMessageBox=async()=>({response:1,checkboxChecked:false});const fetcher=globalThis.fetch;
  globalThis.fetch=async(input,options)=>{if(String(input)!=='https://openrouter.ai/api/v1/chat/completions')return fetcher(input,options);const body=JSON.parse(options.body),last=body.messages.at(-1);if(last.role!=='user'||!last.content.startsWith('Pending file approval verification'))return fetcher(input,options);const reference=globalThis.__pendingReviewReference;
   return new Response('data: '+JSON.stringify({choices:[{delta:{tool_calls:[{index:0,id:'pending_review_call',function:{name:'write_file',arguments:JSON.stringify({reference_id:reference,path:'',expected_hash:fixture.hash,content:'An unapproved replacement.\n',reason:'Verify interrupted review recovery.'})}}]},finish_reason:'tool_calls'}]})+'\n\ndata: [DONE]\n\n');};
 },{file,hash:createHash('sha256').update(before).digest('hex')});
 const picked=await page.evaluate(()=>window.agentopia.call('files.pick',{kind:'file'})),reference=picked.selected[0];await app.evaluate((_electron,id)=>{globalThis.__pendingReviewReference=id;},reference);
 const request=await page.evaluate(args=>window.agentopia.call('chat.start',args),{agentId,requestId:randomUUID(),text:'Pending file approval verification',options:{provider:'openrouter',model:'fixture/model',thinking:'default',mode:'chat',permission:'ask',files:[reference]}});
 let activity;await expect.poll(async()=>{const rows=await page.evaluate(id=>window.agentopia.call('messages.list',{conversationId:id}),request.conversation_id);activity=rows.at(-1)?.metadata.tools?.find(tool=>tool.status==='awaiting_approval');return !!activity;},{timeout:20000}).toBe(true);assert.equal(readFileSync(file,'utf8'),before);
 return {root,file,before,reference,conversationId:request.conversation_id,activityId:activity.id};
}
export async function verifyInterruptedReview(page,fixture,artifacts){
 const rows=await page.evaluate(id=>window.agentopia.call('messages.list',{conversationId:id}),fixture.conversationId),activity=rows.at(-1).metadata.tools.find(tool=>tool.id===fixture.activityId);assert.equal(activity.status,'interrupted');assert.equal(readFileSync(fixture.file,'utf8'),fixture.before);await assert.rejects(page.evaluate(id=>window.agentopia.call('tools.decide',{id,approved:true}),fixture.activityId),/no longer active/);
 await page.getByRole('region',{name:'Chat history'}).getByRole('button',{name:'Pending file approval verification',exact:true}).click();await expect(page.getByRole('button',{name:'Approve and apply',exact:true})).toHaveCount(0);await expandWorkHistory(page);await expect(page.locator('.tool-activity')).toContainText('Interrupted');await page.screenshot({path:path.join(artifacts,'interrupted-file-review.png')});
 await page.evaluate(id=>window.agentopia.call('conversations.manage',{conversationId:id,action:'delete'}),fixture.conversationId);await page.evaluate(id=>window.agentopia.call('files.remove',{id}),fixture.reference);cleanupInterruptedReview(fixture);console.log('PASS: Forced process termination interrupted a real pending file approval; restart exposed its saved diff, rejected stale approval, and retained the original file.');
}
export function cleanupInterruptedReview(fixture){if(fixture){assert(path.resolve(fixture.root).startsWith(path.resolve(os.tmpdir())+path.sep));rmSync(fixture.root,{recursive:true,force:true});}}
