import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
const root=path.resolve(import.meta.dirname,'../..');
let text=await readFile(path.join(root,'scripts/desktop/test-parent-report-packaged58.mjs'),'utf8');
text=text.replaceAll('desktop-parent-report-release58','desktop-report-copy-release59').replaceAll('0.44.58','0.44.59').replaceAll('exact58','exact59').replaceAll('Exact58','Exact59').replaceAll('PRESERVED-58-','PRESERVED-59-').replaceAll("label:'first58'","label:'first59'").replaceAll("label:'cold58'","label:'cold59'");
const original="base=await json(proof.acceptedBase),live=await json(path.join(base.out,'live-report-1792616428861/evidence.json'))";assert(text.includes(original));
text=text.replace(original,"base=await json(proof.acceptedBase),liveBase=await json(base.acceptedBase),live=await json(path.join(liveBase.out,'live-report-1792616428861/evidence.json'))").replace("path.join(base.out,'live-named-report-accepted.json')","path.join(liveBase.out,'live-named-report-accepted.json')");
const marker=" const input=page.getByRole('textbox',{name:'Message',exact:true});";assert(text.includes(marker));
text=text.replace(marker,String.raw`
 await page.evaluate(()=>{window.copiedReportText=null;Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedReportText=text;}}});});
 const answer=page.locator('.message.assistant').filter({has:response});assert.equal(await answer.count(),1);await answer.hover();await answer.locator('.copy-message').click();
 const copied=await page.evaluate(()=>window.copiedReportText);assert(copied.startsWith('DELEGATED '+live.marker));assert(copied.includes(live.expectedFact)&&copied.includes(live.result.childRole)&&copied.includes(live.result.citation));
 await check((cold?'Cold':'Initial')+' Copy response includes the original acknowledgement, real saved specialist report and exact source citation; the OS clipboard is preserved through a controlled boundary.');
`+marker);
text=text.replace('actualLiveResultReused:true,liveResultVisible:true','copiedAutomaticReply:true,clipboardBoundaryControlled:true,actualLiveResultReused:true,liveResultVisible:true');
await writeFile(path.join(root,'scripts/desktop/test-report-copy-packaged59.mjs'),text,{flag:'wx'});
console.log('Prepared exact59 saved-data and complete-answer copying checks.');
