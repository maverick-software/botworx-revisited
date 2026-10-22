import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('prepare frozen Chrome context60 release helpers');
const root=path.resolve(import.meta.dirname,'../..'),folder=path.join(root,'scripts/desktop');
let source=await readFile(path.join(folder,'prepare-report-copy-release59.mjs'),'utf8');
const advance=text=>text.replaceAll('desktop-parent-report-release58','@@BASE@@').replaceAll('desktop-report-copy-release59','desktop-chrome-context-release60').replaceAll('@@BASE@@','desktop-report-copy-release59').replaceAll('0.44.58','@@OLD@@').replaceAll('0.44.59','0.44.60').replaceAll('@@OLD@@','0.44.59');
source=advance(source).replace('complete automatic-response copying release','connected Chrome page context release').replace("backendChanges,['transcript-presentation.ts']","backendChanges,['chrome-context.ts','chrome-runtime.ts','main.ts']").replace("uiChanges,['NativeTurn.tsx']","uiChanges,['ComposerContextMenu.tsx']").replace("compiledChanges,['transcript-presentation.js']","compiledChanges,['chrome-context.js','chrome-runtime.js','main.js']");
assert(source.includes("backendChanges,['chrome-context.ts','chrome-runtime.ts','main.ts']")&&source.includes("compiledChanges,['chrome-context.js','chrome-runtime.js','main.js']"));
await writeFile(path.join(folder,'prepare-chrome-context-release60.mjs'),source,{flag:'wx'});
let controls=await readFile(path.join(folder,'qualify-agent-controls-04459.mjs'),'utf8');
controls=controls.replaceAll('desktop-report-copy-release59','desktop-chrome-context-release60').replaceAll('0.44.59','0.44.60').replaceAll('desktop-agent-controls59','desktop-agent-controls60').replaceAll('controls59-','controls60-').replace("names=['transcript-presentation'","names=['chrome-context','browser-context','chrome-content','chrome-receipts','chrome-backup','transcript-presentation'").replace('assert(evidence.passed>=923)','assert(evidence.passed>=943)');
controls=controls.replace("names.splice(names.indexOf('provider-switch'),1);","names.splice(names.indexOf('provider-switch'),1);\n// Chrome receipts require the owned real database and run in packaged acceptance.\nnames.splice(names.indexOf('chrome-receipts'),1);");
await writeFile(path.join(folder,'qualify-agent-controls-04460.mjs'),controls,{flag:'wx'});
for(const name of ['package.json','package-lock.json']){const file=path.join(root,name),value=JSON.parse(await readFile(file,'utf8'));assert.equal(value.version,'0.44.59');value.version='0.44.60';if(value.packages){assert.equal(value.packages[''].version,'0.44.59');value.packages[''].version='0.44.60';}await writeFile(file,JSON.stringify(value,null,2)+'\n');}
console.log('Prepared complete60 freeze and archive qualification; production remains59.');
