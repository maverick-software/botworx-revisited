import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,cp,copyFile,readFile,writeFile,readdir,symlink,link} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {extractAll,createPackageWithOptions} from '@electron/asar';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash} from './phased-backup-control.mjs';
desktopOperation('qualify Explorer inspection, full-monitor indicator and physical Escape stop');
const root=path.resolve(import.meta.dirname,'../..'),records=path.join(root,'.supabase/desktop-control91'),installed=await json(path.join(root,'.supabase/desktop-computer-repair76/installed-current.json')),base=await json(installed.proof),program='C:/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.85',out=path.join(records,String(Date.now())),sourceRoot=path.join(out,'source'),source=path.join(sourceRoot,'desktop'),assets=path.join(out,'resources'),exec=promisify(execFile);
assert(installed.success&&base.success&&base.version==='0.44.85');assert.equal(await hash(path.join(program,'resources/app.asar')),base.imageSha256);await mkdir(source,{recursive:true});await mkdir(assets);
for(const dir of ['src','ui','tests'])await cp(path.join(base.source,dir),path.join(source,dir),{recursive:true});
for(const name of ['tsconfig.json','vite.config.mjs','presentation-renderer-patch.mjs'])await copyFile(path.join(base.source,name),path.join(source,name));
for(const name of ['package.json','package-lock.json'])await copyFile(path.join(base.sourceRoot,name),path.join(sourceRoot,name));await symlink(path.join(root,'node_modules'),path.join(sourceRoot,'node_modules'),'junction');
const changedSource=['src/computer-client.ts','src/computer-indicator.ts','src/main.ts','src/computer-runtime-manifest.json','ui/ComputerSettings.tsx'];
for(const name of changedSource)await copyFile(path.join(root,'desktop',name),path.join(source,name));
for(const name of ['computer-indicator','computer-emergency'])await copyFile(path.join(root,'desktop/tests',name+'.test.cjs'),path.join(source,'tests',name+'.test.cjs'));
const run=async(name,args)=>{try{const r=await exec(process.execPath,args,{cwd:sourceRoot,windowsHide:true,encoding:'utf8',timeout:240000,maxBuffer:4000000,env:{...process.env,NODE_PATH:path.join(root,'node_modules')}});await writeFile(path.join(out,name+'.log'),r.stdout+r.stderr);return r.stdout;}catch(error){await writeFile(path.join(out,name+'.log'),(error.stdout??'')+(error.stderr??''));throw error;}};
await run('backend-types',[path.join(root,'node_modules/typescript/bin/tsc'),'-p',path.join(source,'tsconfig.json')]);await run('interface-types',[path.join(root,'node_modules/typescript/bin/tsc'),'-p',path.join(source,'ui/tsconfig.json')]);
await run('renderer',[path.join(root,'node_modules/vite/bin/vite.js'),'build','--config',path.join(source,'vite.config.mjs')]);
const stage=path.join(out,'archive');extractAll(base.image,stage);const compiled={...base.compiled},changedCompiled=[];
for(const name of ['computer-client.js','computer-indicator.js','main.js','computer-runtime-manifest.json']){const from=path.join(source,'build',name);compiled[name]=await hash(from);if(compiled[name]!==base.compiled[name])changedCompiled.push(name);await copyFile(from,path.join(stage,'build',name));}
assert.equal(changedCompiled.length,4);for(const name of Object.keys(base.compiled))assert.equal(await hash(path.join(stage,'build',name)),compiled[name]);
const image=path.join(out,'app.asar');await createPackageWithOptions(stage,image,{unpack:'**/*.{node,dll,exe}'});
const archived=path.join(out,'archived');extractAll(image,archived);await cp(path.join(archived,'build'),path.join(source,'build'),{recursive:true});
const checks=await run('computer-regressions',['--test','--test-concurrency=1',...['computer-indicator','computer-emergency','computer-service','computer-capture','computer-input-timeout'].map(n=>path.join(source,'tests',n+'.test.cjs'))]);assert.match(checks,/(?:#|ℹ) fail 0/);
await cp(path.join(source,'resources/ui'),path.join(assets,'ui'),{recursive:true});await cp(path.join(root,'desktop/resources/computer-helper'),path.join(assets,'computer-helper'),{recursive:true});
const helperManifest=await json(path.join(source,'src/computer-runtime-manifest.json'));assert.equal(helperManifest.version,'1.0.5');for(const[name,digest]of Object.entries(helperManifest.files))assert.equal(await hash(path.join(assets,'computer-helper',name)),digest);
async function inventory(folder){const values={};for(const e of await readdir(folder,{recursive:true,withFileTypes:true}))if(e.isFile()){const file=path.join(e.parentPath,e.name);values[path.relative(folder,file).replaceAll('\\','/')]=await hash(file);}return values;}
const uiFiles=await inventory(path.join(assets,'ui')),resourceFiles={...base.resourceFiles};for(const name of Object.keys(resourceFiles))if(name.startsWith('ui/')||name.startsWith('computer-helper/'))delete resourceFiles[name];for(const[name,digest]of Object.entries(uiFiles))resourceFiles['ui/'+name]=digest;for(const[name,digest]of Object.entries(helperManifest.files))resourceFiles['computer-helper/'+name]=digest;
const proof={...base,success:true,kind:'desktop-control91',out,sourceRoot,source,baseProof:installed.proof,baseImageSha256:base.imageSha256,image,imageSha256:await hash(image),assets,compiled,changedCompiled,changedSource,helperManifest,uiFiles,resourceFiles,providerRequests:0,installed:false,schema:90};
const candidateProgram=path.join(out,'program');proof.program=candidateProgram;proof.exe=path.join(candidateProgram,'Agentopia.exe');proof.programFiles={...base.programFiles,'resources/app.asar':proof.imageSha256};
for(const[name,digest]of Object.entries(base.programFiles)){const target=path.join(candidateProgram,name);await mkdir(path.dirname(target),{recursive:true});if(name==='resources/app.asar')await link(image,target);else{assert.equal(await hash(path.join(base.program,name)),digest);await link(path.join(base.program,name),target);}}
for(const[name,digest]of Object.entries(resourceFiles)){const target=path.join(candidateProgram,'resources/resources',name),from=name.startsWith('ui/')||name.startsWith('computer-helper/')?path.join(assets,name):path.join(base.assets,name);assert.equal(await hash(from),digest);await mkdir(path.dirname(target),{recursive:true});await link(from,target);}proof.assets=path.join(candidateProgram,'resources/resources');
proof.nativeSources={};for(const dir of ['computer','computer-tests']){await mkdir(path.join(source,'native',dir),{recursive:true});for(const name of(await readdir(path.join(root,'desktop/native',dir))).filter(n=>/\.(?:cs|csproj)$/.test(n))){const target=path.join(source,'native',dir,name);await copyFile(path.join(root,'desktop/native',dir,name),target);proof.nativeSources[dir+'/'+name]=await hash(target);}}
await writeFile(path.join(out,'proof.json'),JSON.stringify(proof,null,2));await writeFile(path.join(records,'current.json'),JSON.stringify({proof:path.join(out,'proof.json')},null,2));console.log(JSON.stringify({success:true,out,imageSha256:proof.imageSha256,changedCompiled,helper:helperManifest.version}));
