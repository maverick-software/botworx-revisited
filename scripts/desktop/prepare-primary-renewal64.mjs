import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const folder=import.meta.dirname,read=name=>readFile(path.join(folder,name),'utf8');
const controller=await read('renew-primary-chatgpt63.mjs'),test=await read('test-primary-renewal63.mjs'),normal=await read('normal-maintenance64-process.mjs');assert(controller.includes('desktop-pdf-pages-release63')&&test.includes('normal-maintenance63-process.mjs'));
const map={'renew-primary-chatgpt63.mjs':'renew-primary-chatgpt64.mjs','test-primary-renewal63.mjs':'test-primary-renewal64.mjs','normal-current63-process.mjs':'normal-current64-process.mjs','normal-maintenance63-process.mjs':'normal-maintenance64-process.mjs','desktop-pdf-pages-release63':'desktop-google-editor-release64','desktop-live-readiness63':'desktop-live-readiness64','desktop-primary-renewal63':'desktop-primary-renewal64','app-0.44.62/Agentopia.exe':'app-0.44.63/Agentopia.exe','app-0.44.63/Agentopia.exe':'app-0.44.64/Agentopia.exe'};
const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),pattern=new RegExp(Object.keys(map).sort((a,b)=>b.length-a.length).map(escape).join('|'),'g'),advance=text=>text.replace(pattern,value=>map[value]);
await writeFile(path.join(folder,'renew-primary-chatgpt64.mjs'),advance(controller),{flag:'wx'});await writeFile(path.join(folder,'test-primary-renewal64.mjs'),advance(test),{flag:'wx'});await writeFile(path.join(folder,'normal-current64-process.mjs'),normal.replaceAll('app-0.44.63/Agentopia.exe','app-0.44.64/Agentopia.exe'),{flag:'wx'});
console.log(JSON.stringify({prepared64:true,sharedRenewalLogicUnchanged:true,productionWrites:0}));
