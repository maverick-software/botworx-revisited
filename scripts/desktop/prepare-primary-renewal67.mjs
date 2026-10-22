import assert from 'node:assert/strict';import {readFile,writeFile} from 'node:fs/promises';import path from 'node:path';
const dir=import.meta.dirname;
for(const name of ['renew-primary-chatgpt66.mjs','test-primary-renewal66.mjs']){
 let text=await readFile(path.join(dir,name),'utf8');
 for(const [from,to]of [['renew-primary-chatgpt66.mjs','renew-primary-chatgpt67.mjs'],['normal-current66-process.mjs','normal-current67-process.mjs'],['test-primary-renewal66.mjs','test-primary-renewal67.mjs'],['desktop-workspace-paths-release66','desktop-scheduled-workspaces67-release'],['desktop-primary-renewal66','desktop-primary-renewal67'],['desktop-live-readiness66','desktop-live-readiness67'],['app-0.44.66/Agentopia.exe','app-0.44.67/Agentopia.exe']])text=text.replaceAll(from,to);
 if(name.startsWith('test-')){
  const first=text.indexOf("assert.equal(await readFile(path.join(import.meta.dirname,'normal-current67-process.mjs')"),last=text.indexOf('\nconst sourceHashes=',first);assert(first>=0&&last>first);
  text=text.slice(0,first)+"assert.equal(await readFile(path.join(import.meta.dirname,'normal-current67-process.mjs'),'utf8'),(await readFile(path.join(import.meta.dirname,'normal-current66-process.mjs'),'utf8')).replaceAll('66','67'));"+text.slice(last);
 }
 await writeFile(path.join(dir,name.replace('66','67')),text,{flag:'wx'});
}
await writeFile(path.join(dir,'normal-current67-process.mjs'),(await readFile(path.join(dir,'normal-current66-process.mjs'),'utf8')).replaceAll('66','67'),{flag:'wx'});
console.log('Prepared the original-store renewal guards for the installed67 application.');
