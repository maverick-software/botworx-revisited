import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile,writeFile,lstat} from 'node:fs/promises';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('prepare the qualified chart-format release source and version metadata');
const root=path.resolve(import.meta.dirname,'../..'),scripts=path.join(root,'scripts/desktop');
let code=await readFile(path.join(scripts,'prepare-parent-report-release58.mjs'),'utf8');
code=code.replaceAll('0.44.58','0.44.62').replaceAll('desktop-agent-report-release57','desktop-image-attachment-release61').replaceAll('0.44.57','0.44.61').replaceAll('desktop-parent-report-release58','desktop-chart-format-release62').replace('visible automatic replies and routed source citations release','native chart text, currency and horizontal-bar layout release').replace("assert.deepEqual(uiChanges,['NativeTurn.tsx']);","assert.deepEqual(uiChanges,[]);");
assert(code.includes("assert.deepEqual(uiChanges,[]);"));
code=code.replace("'presentation-renderer-patch.mjs','forge.config.cjs'","'presentation-renderer-patch.mjs','presentation-renderer-modifications.md','forge.config.cjs'");
code=code.replace("if(name.startsWith('ui/')||name==='version.json')continue;","if(name.startsWith('ui/')||name==='version.json'||name==='licenses/pptx-renderer-modifications.md')continue;");
code=code.replace("await build({configFile:","await cp(path.join(source,'presentation-renderer-modifications.md'),path.join(assets,'licenses/pptx-renderer-modifications.md'));\nawait build({configFile:");
const target=path.join(scripts,'prepare-chart-format-release62.mjs');try{await lstat(target);throw Error('Release tools already exist; inspect them before replacing.');}catch(error){if(error.code!=='ENOENT')throw error;}
await writeFile(target,code,{flag:'wx'});
for(const name of ['package.json','package-lock.json']){const file=path.join(root,name),data=JSON.parse(await readFile(file,'utf8'));assert.equal(data.version,'0.44.61');data.version='0.44.62';if(data.packages){assert.equal(data.packages[''].version,'0.44.61');data.packages[''].version='0.44.62';}await writeFile(file,JSON.stringify(data,null,2)+'\n');}
console.log(JSON.stringify({success:true,version:'0.44.62',sourceOnly:true,installed:false,target}));
