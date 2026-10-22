import {cp,mkdir,readFile,writeFile,readdir,access,lstat,realpath} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import {build} from 'vite';
import react from '@vitejs/plugin-react';
import {desktopOperation} from './operation-lock.mjs';

desktopOperation('prepare isolated plugin and folder receipt candidate');
const root=path.resolve(import.meta.dirname,'../..'),version='0.44.2',base=path.join(root,'.supabase/desktop-browser-followup/candidate-0441'),work=path.join(root,'.supabase/desktop-plugin-import/candidate-0442');
const json=async file=>JSON.parse(await readFile(file,'utf8')),hash=b=>createHash('sha256').update(b).digest('hex');
const qualified=await json(path.join(root,'.supabase/desktop-plugin-import/qualification.json')),previous=await json(path.join(base,'package-proof.json'));
assert(qualified.success&&previous.success);assert.equal(previous.version,'0.44.1');assert.equal(previous.migrations,54);
assert.equal(hash(await readFile(previous.image)),previous.imageSha256);
for(const [file,digest]of Object.entries(qualified.source))assert.equal(hash(await readFile(path.join(root,file))),digest,'Qualified source changed: '+file);
const source=path.join(work,'source/desktop'),stage=path.join(work,'staging'),resources=path.join(work,'resources'),compiled=path.join(source,'build');
const resume=process.argv.includes('--resume-copied');
if(resume){assert.equal((await json(path.join(work,'preparation.json'))).phase,'copied');assert.equal((await json(path.join(stage,'package.json'))).version,'0.44.1');}
else{
 try{await access(work);throw Error('Candidate already exists. Inspect its recorded phase before continuing.');}catch(error){if(error.code!=='ENOENT')throw error;}
 await mkdir(work,{recursive:true});await writeFile(path.join(work,'preparation.json'),JSON.stringify({phase:'copying',version,installed:false,productionMigrated:false},null,2),{flag:'wx'});
 await mkdir(source,{recursive:true});for(const directory of ['src','ui','database'])await cp(path.join(root,'desktop',directory),path.join(source,directory),{recursive:true});await cp(path.join(root,'desktop/tsconfig.json'),path.join(source,'tsconfig.json'));
 const run=args=>{const result=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit',windowsHide:true});assert.equal(result.status,0,'Compilation failed. Inspect this candidate before resuming.');};
 run(['node_modules/typescript/bin/tsc','-p',path.join(source,'tsconfig.json'),'--noEmitOnError']);run(['node_modules/typescript/bin/tsc','-p',path.join(source,'ui/tsconfig.json')]);await writeFile(path.join(source,'package.json'),'{"type":"commonjs"}');
 await cp(path.join(base,'staging'),stage,{recursive:true,filter:file=>file!==path.join(base,'staging/out')});await cp(path.join(base,'resources'),resources,{recursive:true});
 await writeFile(path.join(work,'preparation.json'),JSON.stringify({phase:'copied',version,installed:false,productionMigrated:false},null,2));
}
const moduleFiles=(await readdir(compiled,{recursive:true})).filter(file=>/\.(js|json)$/.test(file)),beforeFiles=(await readdir(path.join(base,'staging/build'),{recursive:true})).filter(file=>/\.(js|json)$/.test(file));
assert.equal(beforeFiles.length,1009);assert.equal(moduleFiles.length,1011);const added=moduleFiles.filter(file=>!beforeFiles.includes(file)).sort();assert.deepEqual(added,['plugin-import.js','plugin-picker.js']);
const changed=[];for(const file of beforeFiles){assert(moduleFiles.includes(file),'Missing existing module: '+file);if(!(await readFile(path.join(base,'staging/build',file))).equals(await readFile(path.join(compiled,file))))changed.push(file.replaceAll('\\','/'));}assert.deepEqual(changed,['broker.js']);
await cp(compiled,path.join(stage,'build'),{recursive:true});const pkg=await json(path.join(stage,'package.json'));assert.equal(pkg.version,'0.44.1');pkg.version=version;await writeFile(path.join(stage,'package.json'),JSON.stringify(pkg,null,2));
const originalMigrations=(await readdir(path.join(resources,'database'))).filter(file=>file.endsWith('.sql'));assert.equal(originalMigrations.length,54);for(const file of originalMigrations)assert.equal(hash(await readFile(path.join(source,'database',file))),hash(await readFile(path.join(resources,'database',file))),'Earlier migration changed: '+file);
const migration='0055-browser-folder-receipts.sql';assert.equal(hash(await readFile(path.join(source,'database',migration))),qualified.source['desktop/database/'+migration]);await cp(path.join(source,'database',migration),path.join(resources,'database',migration));assert.equal((await readdir(path.join(resources,'database'))).filter(file=>file.endsWith('.sql')).length,55);
const ui=path.join(resources,'ui');assert(ui.startsWith(work+path.sep));assert(!(await lstat(ui)).isSymbolicLink());assert.equal((await realpath(ui)).toLowerCase(),ui.toLowerCase());
await build({configFile:false,envDir:false,root:path.join(source,'ui'),plugins:[react()],base:'/',build:{outDir:ui,emptyOutDir:true,assetsInlineLimit:0}});await writeFile(path.join(resources,'version.json'),JSON.stringify({...await json(path.join(resources,'version.json')),version,schema:55}));
for(const [file,digest]of Object.entries(qualified.source).filter(([file])=>/^desktop\/(src|ui|database)\//.test(file)))assert.equal(hash(await readFile(path.join(source,file.slice('desktop/'.length)))),digest,'Copied source mismatch: '+file);
const proof={phase:'prepared',at:new Date().toISOString(),version,baseVersion:previous.version,baseImageSha256:previous.imageSha256,source,stage,resources,compiledModules:moduleFiles.length,changedModules:changed,addedModules:added,unchangedModules:beforeFiles.length-changed.length,migrations:55,folderReceiptMigrationSha256:qualified.source['desktop/database/'+migration],rootVersionUnchanged:(await json(path.join(root,'package.json'))).version,installed:false,productionMigrated:false,liveAcceptancePending:true};await writeFile(path.join(work,'preparation.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof,null,2));
