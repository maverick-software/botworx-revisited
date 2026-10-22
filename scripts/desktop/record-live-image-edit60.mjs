import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('record accepted live image edit60');
const root=path.resolve(import.meta.dirname,'../..');
const out=path.join(root,'.supabase/desktop-live-image-edit60/1792620802834');
const accepted=JSON.parse(await fs.readFile(path.join(out,'live-edit-accepted.json'),'utf8'));
assert(accepted.success&&accepted.qaRuntimeStopped&&accepted.sourceCredentialBytesUnchanged&&accepted.ordinaryProductionProcessUnchanged);
assert.equal(accepted.modelRequests,4);assert.equal(accepted.imageRequests,1);
const report='docs/desktop/live-image-edit60.md';
const update=async(file,old,value)=>{const location=path.join(root,file),text=await fs.readFile(location,'utf8');assert(text.includes(old),file+' expected checkpoint missing');await fs.writeFile(location,text.replace(old,value));};
await update('docs/desktop/parity-requirements57.md',
'One actual image request through the retained engine cost $0.0184 and survived reopening without replay; its text-model orchestration was controlled.',
'The original real image request used controlled text orchestration. A subsequent [live ChatGPT image edit](live-image-edit60.md) used four unchanged model responses and one real $0.0184 image request, with both images retained after normal reopening and no replay.');
await update('docs/desktop/capability-acceptance-snapshot.md',
'Real Composio authentication, live unscripted image orchestration/editing, fresh ordinary/reference screenshots and longer unattended/reboot acceptance remain open.',
'A [live ChatGPT image edit](live-image-edit60.md) subsequently passed through the exact59 engine: four real model requests, one real image request and cold reopening without replay. Real Composio authentication, broader image capabilities, fresh ordinary/reference screenshots and longer unattended/reboot acceptance remain open.');
await update('docs/desktop/parity-status.md',
'# Agentopia parity status — October 21, 2026',
'# Agentopia parity status — October 21, 2026\n\nAdditional live checkpoint on installed 0.44.59: a real ChatGPT agent selected and completed an image edit using the existing generated reference. Four actual ChatGPT responses and one $0.0184 image request passed; manual review confirms the requested orange triangle with the red square and blue circle retained. Normal reopening preserved both images and operations without replay. Temporary test connections were removed, and the original production process and protected-store bytes stayed unchanged. [Evidence and limits](live-image-edit60.md).');
const ledger=path.join(root,'.supabase/desktop-recovery-bootstrap/next-acceptance.json');
const value=JSON.parse(await fs.readFile(ledger,'utf8'));
Object.assign(value.currentLiveImageEdit60,{phase:'accepted; live edit and normal cold reopening passed without replay',success:true,acceptance:path.join(out,'live-edit-accepted.json'),report,modelRequests:4,imageRequests:1,costUSD:accepted.asset.costUSD,operationId:accepted.asset.id,normalColdReopening:true,sourceCredentialBytesUnchanged:true,qaRuntimeStopped:true,fullGoalComplete:false});
delete value.currentLiveImageEdit60.session;
if(Array.isArray(value.next))value.next=value.next.map(item=>typeof item==='string'?item.replace('Investigate unscripted live text-model orchestration and a distinct image edit as separate scoped checks.','The subsequent live ChatGPT edit is accepted; preserve request8932b6c9-0ef8-4fdb-a009-68b301b1cccb and operation5b346e5a-6e5a-4c5b-af09-d61569789b98 without replay.'):item);
await fs.writeFile(ledger,JSON.stringify(value,null,2)+'\n');
console.log(JSON.stringify({success:true,report,phase:value.currentLiveImageEdit60.phase}));
