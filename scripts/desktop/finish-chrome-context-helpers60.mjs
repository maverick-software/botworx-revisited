import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import {json} from './phased-backup-control.mjs';
const root=path.resolve(import.meta.dirname,'../..'),proof=await json((await json(path.join(root,'.supabase/desktop-chrome-context-release60/current.json'))).proof);
async function replace(name,old,value){const file=path.join(root,'scripts/desktop',name),text=await readFile(file,'utf8');assert(text.includes(old),name+' expected source missing');await writeFile(file,text.replace(old,value));}
await replace('test-chrome-context-packaged60.mjs','chromeContext:true,chromeSnapshotColdPersistence:true,','chromeContext:true,chromeSnapshotColdPersistence:true,chromeReceipts:true,');
await replace('audit-agent-health60.py','17d3d6591b651f49ec4a287b3f39e9c6b2cda106263d6c4aa6616a0befbde001',proof.imageSha256);
await replace('qualify-chrome-context-release60.mjs','uiChecks:28,packagedChecks:8,actualChromeChecks:6','uiChecks:28,packagedChecks:9,actualChromeChecks:6');
console.log(JSON.stringify({success:true,finalImage:proof.imageSha256,packagedChecks:9}));
