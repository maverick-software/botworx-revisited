import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
const root=path.resolve(import.meta.dirname,'../..');
let text=await readFile(path.join(root,'scripts/desktop/test-chrome-context-packaged60.mjs'),'utf8');
text=text.replace("import {verifyChromeContext60} from './chrome-context-packaged60-workflow.mjs';",'').replace("import {verifyChromeReceipts60} from './chrome-receipts-current60-workflow.mjs';",'');
const old="out=path.join(proof.out,'packaged-'+Date.now()),program=path.join(out,'private-program');assert(!(await list(true)).includes(prior.distribution));await mkdir(program,{recursive:true});";assert(text.includes(old));
text=text.replace(old,"failedFile=path.join(proof.out,'packaged-1792622717059/evidence.json'),failed=await json(failedFile),out=path.join(proof.out,'accepted-readonly-'+Date.now()),program=path.join(path.dirname(failedFile),'private-program');assert(!failed.success&&failed.checks.length===4&&failed.chromeReceipts.success&&failed.chromeReceipts.originalReceiptAssertionsRetained);assert(!(await list(true)).includes(prior.distribution));await mkdir(out);assert.equal(await hash(path.join(program,'resources/app.asar')),proof.imageSha256);");
const start=text.indexOf('for(const name of await readdir(proof.program'),end=text.indexOf("const cfg={...prior",start);assert(start>=0&&end>start);text=text.slice(0,start)+text.slice(end);
text=text.replace('checks:[]},save=',"checks:[failed.checks[0]],chromeReceipts:failed.chromeReceipts,priorFailedEvidence:failedFile,readOnlyAcceptance:true},save=");
text=text.replace(",draft='PRESERVED-60-'+Date.now();await save();",';let draft;await save();');
text=text.replace(' if(!cold)e.chromeReceipts=await verifyChromeReceipts60({application,cfg,proof,out,check});','');
const marker=" const input=page.getByRole('textbox',{name:'Message',exact:true});";assert(text.includes(marker));
text=text.replace(marker," if(!cold){const stored=await h.call('drafts.get',{owner:cfg.owner,scope:'conversation:'+live.requests[0].conversationId});assert(stored?.text?.startsWith('PRESERVED-60-'));draft=stored.text;}"+marker);
text=text.replace('await verifyChromeContext60({application,page,call:h.call,cfg,out,cold,check,evidence:e,save});','await acceptSavedChrome(application,page,h.call,cold);');
const insert="async function verifySaved({application,page},cold=false){";assert(text.includes(insert));
text=text.replace(insert,`async function acceptSavedChrome(application,page,call,cold){
 const conversation=live.requests[0].conversationId,stored=await call('drafts.get',{owner:cfg.owner,scope:'conversation:'+conversation}),source=stored?.options?.sources?.find(row=>row.title==='Packaged Chrome source');
 assert(source&&source.owner===cfg.owner&&source.kind==='browser'&&/^http:\\/\\/127\\.0\\.0\\.1:\\d+\\/reference$/.test(source.url));assert(source.text.includes('PACKAGED-CHROME-CONTEXT-60')&&!source.text.includes('PRIVATE-PACKAGED'));assert.match(source.notice,/Chrome main-page text snapshot/);
 if(e.chromeSource)assert.deepEqual(source,e.chromeSource);else e.chromeSource=source;e.chromeConversation=conversation;
 await expect(page.getByRole('button',{name:'Remove source Packaged Chrome source',exact:true})).toBeVisible();assert.equal((await call('chrome.status')).phase,'disconnected');assert.deepEqual(await call('chrome.context.list'),{tabs:[]});assert.equal(await application.evaluate(()=>globalThis.__coordination.calls.length),0);
 await page.screenshot({path:path.join(out,cold?'cold-chrome-source.png':'accepted-chrome-source.png')});await check((cold?'Second normal cold reopening':'Read-only acceptance of the completed real Chrome selection')+' preserves the exact owned source snapshot and typed draft with Chrome disconnected, no new model calls and no repeated receipt/tool actions.');
}
`+insert);
text=text.replace('chromeContext:true,chromeSnapshotColdPersistence:true,chromeReceipts:true,','chromeContext:true,chromeSnapshotColdPersistence:true,chromeReceipts:true,readOnlyAcceptance:true,priorFailedEvidence:failedFile,originalInteractionEvidence:path.join(path.dirname(failedFile),\'first60/evidence.json\'),');
await writeFile(path.join(root,'scripts/desktop/accept-chrome-context-packaged60.mjs'),text,{flag:'wx'});console.log('Prepared read-only completion of the saved real Chrome selection; no repeated tool actions.');
