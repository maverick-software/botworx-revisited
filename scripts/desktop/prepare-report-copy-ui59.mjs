import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..');
let text=await readFile(path.join(root,'scripts/desktop/test-parent-report-presentation58.mjs'),'utf8');
text=text.replaceAll('desktop-parent-report-presentation58','desktop-report-copy59').replace("'desktop/ui/WorkspaceViews.tsx']","'desktop/ui/WorkspaceViews.tsx','desktop/src/transcript-presentation.ts']");
text=text.replace('appFixture=true;window.reportCalls=[];',`appFixture=true;window.reportCalls=[];window.copyWrites=[];Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copyWrites.push(text);}}});`);
const mark='window.reportResumeFailure=null;';assert(text.includes(mark));
text=text.replace(mark,String.raw`window.copyScenario=kind=>{
 window.reportScenario(kind==='streaming'?'running':'delivered',true,kind==='streaming'?'running':'completed');
 const make=(thread,text,phase='final_answer')=>({threadId:thread,turnId:'generated-report-turn',completed:true,item:{id:text,type:'agentMessage',phase,text}});
 rootState.items=kind==='only'?[]:[make(rootState.threadId,'The original parent response is saved.'),make(rootState.threadId,'Hidden original progress.','commentary')];
 const report=rootState.reports[0];report.state.items.push(make('nested-child','Nested child transport text'),make(rootState.threadId,'Report work in progress.','commentary'));
 if(kind==='all')rootState.reports.push({id:'77777777-7777-4777-8777-777777777788',status:'completed',children:[],state:{...emptyState(),items:[make(rootState.threadId,'Second automatic report.')]}});
 if(kind==='stopped')report.status='cancelled';
 for(const listener of chatListeners)listener({ownerId:appOwner,kind:'native-background',requestId:parentRequest,conversationId:chatId,native:structuredClone(rootState)});
};`+mark);
const first=" await check('A completed automatic report is visible once without expanding its activity'";assert(text.includes(first));
text=text.replace(first,String.raw`
 await check('Copy response includes the displayed parent and multiple reports with source citations while excluding nested child output',async()=>{
  await page.evaluate(()=>window.copyScenario('all'));await expect(page.getByText('Second automatic report.',{exact:true})).toBeVisible();await expect(page.getByText('Nested child transport text',{exact:true})).toHaveCount(0);
  await page.locator('.message.assistant').last().hover();await page.locator('.message.assistant .copy-message').last().click();const copied=await page.evaluate(()=>window.copyWrites.at(-1));
  assert(copied.startsWith('The original parent response is saved.\n\nSaved automatic parent report.\n\n[Saved report source](agentopia-chat://'));
  assert(copied.endsWith('\n\nSecond automatic report.'));assert(!copied.includes('Hidden original progress.')&&!copied.includes('Report work in progress.')&&!copied.includes('Nested child transport text'));
  await capture('copy-complete-answer.png');await page.reload();
 });
 await check('A report-only reply is copyable and changing report status updates the copied text without losing the draft',async()=>{
  await page.evaluate(()=>window.copyScenario('only'));await expect(page.getByText('Saved automatic parent report.',{exact:true})).toBeVisible();await page.locator('.message.assistant').last().hover();await page.locator('.message.assistant .copy-message').last().click();
  const only=await page.evaluate(()=>window.copyWrites.at(-1));assert(only.startsWith('Saved automatic parent report.\n\n[Saved report source]'));
  await page.evaluate(()=>window.copyScenario('streaming'));await expect(page.getByText('Report work in progress.',{exact:true})).toBeVisible();await page.locator('.message.assistant').last().hover();await page.locator('.message.assistant .copy-message').last().click();assert((await page.evaluate(()=>window.copyWrites.at(-1))).includes('Report work in progress.'));
  await page.evaluate(()=>window.copyScenario('stopped'));await page.locator('.message.assistant').last().hover();await page.locator('.message.assistant .copy-message').last().click();assert(!(await page.evaluate(()=>window.copyWrites.at(-1))).includes('Report work in progress.'));await expect(draft).toHaveValue('Keep this unsent draft');await page.reload();
 });
`+first);
await writeFile(path.join(root,'scripts/desktop/test-report-copy-ui59.mjs'),text,{flag:'wx'});
console.log('Prepared report copying and existing report controls UI checks.');
