import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const file='scripts/desktop/test-google-documents64-ui.mjs';let source=await readFile(file,'utf8');
const edits=[
 ['show:false,width:1360','show:true,title:\'Agentopia isolated interface verification\',width:1360'],
 ["assert.deepEqual(await page.evaluate(()=>window.opened),['https://docs.google.com/document/d/generated/edit']);","await expect.poll(()=>page.evaluate(()=>window.opened)).toEqual(['https://docs.google.com/document/d/generated/edit']);"],
 ["await page.evaluate(()=>window.mode='missing');await menu().click();","await page.evaluate(()=>{window.mode='missing';window.chooseDoc('docx');});await menu().click();"],
 ['if(page)await page.screenshot({path:path.join(out,\'failure.png\')});',"if(page)await page.screenshot({path:path.join(out,'failure.png'),timeout:5000}).catch(()=>{});"],
];
for(const [before,after]of edits){assert(source.includes(before),before);source=source.replace(before,after);}await writeFile(file,source);
