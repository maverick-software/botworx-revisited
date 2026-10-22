import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('prepare original image attachment release61 helpers');
const root=path.resolve(import.meta.dirname,'../..'),folder=path.join(root,'scripts/desktop');
const changes=['attachment-images.ts','clipboard-recovery.ts','codex-client.ts','codex-gateway.ts','image-file.ts','image-limits.ts','main.ts','mcp-content.ts','preload.ts','recovery-resource-manifest.json','restored-clipboard.ts','workspace-tools.ts','workspace.ts'];
let source=await readFile(path.join(folder,'prepare-chrome-context-release60.mjs'),'utf8');
source=source.replaceAll('desktop-report-copy-release59','@@BASE@@').replaceAll('desktop-chrome-context-release60','desktop-image-attachment-release61').replaceAll('@@BASE@@','desktop-chrome-context-release60').replaceAll('0.44.59','@@OLD@@').replaceAll('0.44.60','0.44.61').replaceAll('@@OLD@@','0.44.60').replace('connected Chrome page context release','original image attachment release');
source=source.replace("backendChanges,['chrome-context.ts','chrome-runtime.ts','main.ts']",'backendChanges,'+JSON.stringify(changes)).replace("uiChanges,['ComposerContextMenu.tsx']",'uiChanges,[]').replace("compiledChanges,['chrome-context.js','chrome-runtime.js','main.js']",'compiledChanges,'+JSON.stringify(changes.map(name=>name.replace(/\.ts$/,'.js'))));
source=source.replace("name==='version.json')continue;","name==='version.json'||name==='runtime/prepare-desktop-recovery.py')continue;");
const anchor="await build({configFile:path.join(source,'vite.config.mjs'),logLevel:'warn'});";assert(source.includes(anchor));
source=source.replace(anchor,"await cp(path.join(source,'runtime/prepare-desktop-recovery.py'),path.join(assets,'runtime/prepare-desktop-recovery.py'));\n"+anchor);
// The first full61 Vite build proved all 219 UI files equal to installed60.
// UI sources and configuration are unchanged; reuse those exact assets.
const uiStart=source.indexOf(anchor),uiEnd=source.indexOf('const runtimeVersion=',uiStart);assert(uiStart>=0&&uiEnd>uiStart);
source=source.slice(0,uiStart)+"assert.equal(sourceHashes['vite.config.mjs'],base.sourceHashes['vite.config.mjs']);await clone(path.join(base.assets,'ui'),path.join(assets,'ui'));const uiFiles=await inventory(path.join(assets,'ui'));assert.deepEqual(uiFiles,base.uiFiles);\n"+source.slice(uiEnd);
await writeFile(path.join(folder,'prepare-image-attachment-release61.mjs'),source);
let controls=await readFile(path.join(folder,'qualify-agent-controls-04460.mjs'),'utf8');
controls=controls.replaceAll('desktop-chrome-context-release60','desktop-image-attachment-release61').replaceAll('desktop-agent-controls60','desktop-agent-controls61').replaceAll('controls60-','controls61-').replaceAll('0.44.60','0.44.61');
controls=controls.replace("for(const name of ['agent-report-queue'","names.push('image-attachment-limits');\nfor(const name of ['agent-report-queue'");
await writeFile(path.join(folder,'qualify-agent-controls-04461.mjs'),controls);
for(const file of ['package.json','package-lock.json']){const target=path.join(root,file),value=JSON.parse(await readFile(target,'utf8'));assert(['0.44.60','0.44.61'].includes(value.version));value.version='0.44.61';if(file==='package-lock.json')value.packages[''].version='0.44.61';await writeFile(target,JSON.stringify(value,null,2)+'\n');}
console.log('Prepared complete release61 freezer and archive qualification; no installation performed.');
