import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const folder=import.meta.dirname;
const mapping={'inspect-live-readiness62.mjs':'inspect-live-readiness63.mjs','renew-primary-chatgpt62.mjs':'renew-primary-chatgpt63.mjs','normal-current62-process.mjs':'normal-current63-process.mjs','normal-maintenance62-process.mjs':'normal-maintenance63-process.mjs','test-primary-renewal62.mjs':'test-primary-renewal63.mjs','desktop-chart-format-release62':'desktop-pdf-pages-release63','desktop-live-readiness62':'desktop-live-readiness63','desktop-primary-renewal62':'desktop-primary-renewal63','0.44.61':'0.44.62','0.44.62':'0.44.63'};
const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),pattern=new RegExp(Object.keys(mapping).sort((a,b)=>b.length-a.length).map(escape).join('|'),'g');
for(const name of ['inspect-live-readiness62.mjs','renew-primary-chatgpt62.mjs','test-primary-renewal62.mjs'])await writeFile(path.join(folder,mapping[name]),(await readFile(path.join(folder,name),'utf8')).replace(pattern,value=>mapping[value]),{flag:'wx'});
await writeFile(path.join(folder,'normal-current63-process.mjs'),(await readFile(path.join(folder,'normal-maintenance63-process.mjs'),'utf8')).replaceAll('app-0.44.62/Agentopia.exe','app-0.44.63/Agentopia.exe'),{flag:'wx'});
