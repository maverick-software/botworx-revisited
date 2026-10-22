import {cp,mkdir,readFile,writeFile,readdir,access,realpath,lstat} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import {build} from 'vite';
import react from '@vitejs/plugin-react';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('prepare isolated browser follow-up candidate');
const root=path.resolve(import.meta.dirname,'../..'),version='0.44.1',base=path.join(root,'.supabase/desktop-workspace-agents/candidate-0440'),work=path.join(root,'.supabase/desktop-browser-followup/candidate-0441');
const json=async file=>JSON.parse(await readFile(file,'utf8')),hash=b=>createHash('sha256').update(b).digest('hex');
const packaged=await json(path.join(base,'package-proof.json')),installer=await json(path.join(base,'installer-proof.json'));
assert(packaged.success&&installer.success);assert.equal(packaged.imageSha256,installer.imageSha256);assert.equal(packaged.version,'0.44.0');assert.equal(packaged.migrations,54);
const directory=await json(path.join(root,'.supabase/desktop-directory-upload/qualification.json')),display=await json(path.join(root,'.supabase/desktop-browser-results/qualification.json'));
assert.equal(directory.directory.checks,19);assert.equal(directory.component.checks,13);assert.equal(directory.frames.checks,33);assert.equal(display.checks,10);
const expected=new Map(directory.source.map(row=>['desktop/'+row.file,row.afterSha256]));for(const row of display.source)if(row.file.startsWith('desktop/'))expected.set(row.file,row.afterSha256);
for(const [file,digest]of expected)assert.equal(hash(await readFile(path.join(root,file))),digest,'Qualified source changed: '+file);
for(const [file,digest]of Object.entries((await json(path.join(root,'.supabase/desktop-oauth-recovery/source-proof.json'))).sources))assert.equal(hash(await readFile(path.join(root,file))),digest,'Frozen OAuth source changed: '+file);
const source=path.join(work,'source/desktop'),stage=path.join(work,'staging'),resources=path.join(work,'resources'),compiled=path.join(source,'build');
const resume=process.argv.includes('--resume-copied');
if(resume){assert.equal((await json(path.join(work,'preparation.json'))).phase,'copied');assert.equal((await json(path.join(stage,'package.json'))).version,'0.44.0');}
else{
try{await access(work);throw Error('This candidate already exists. Inspect its phase instead of replacing it.');}catch(error){if(error.code!=='ENOENT')throw error;}
await mkdir(work,{recursive:true});await writeFile(path.join(work,'preparation.json'),JSON.stringify({phase:'copying',version,installed:false,productionMigrated:false},null,2),{flag:'wx'});
await mkdir(source,{recursive:true});for(const directory of ['src','ui'])await cp(path.join(root,'desktop',directory),path.join(source,directory),{recursive:true});for(const file of ['tsconfig.json'])await cp(path.join(root,'desktop',file),path.join(source,file));
const run=args=>{const p=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit',windowsHide:true});assert.equal(p.status,0,'Candidate compilation failed; inspect saved phase.');};
run(['node_modules/typescript/bin/tsc','-p',path.join(source,'tsconfig.json'),'--noEmitOnError']);run(['node_modules/typescript/bin/tsc','-p',path.join(source,'ui/tsconfig.json')]);await writeFile(path.join(source,'package.json'),'{"type":"commonjs"}');
await cp(path.join(base,'staging'),stage,{recursive:true,filter:file=>file!==path.join(base,'staging/out')});await cp(path.join(base,'resources'),resources,{recursive:true});
await writeFile(path.join(work,'preparation.json'),JSON.stringify({phase:'copied',version,installed:false,productionMigrated:false},null,2));
}
const moduleFiles=(await readdir(compiled,{recursive:true})).filter(file=>/\.(js|json)$/.test(file)),beforeFiles=(await readdir(path.join(base,'staging/build'),{recursive:true})).filter(file=>/\.(js|json)$/.test(file));assert.equal(moduleFiles.length,1009);assert.deepEqual([...moduleFiles].sort(),[...beforeFiles].sort());
const changed=[];for(const file of moduleFiles){const before=await readFile(path.join(base,'staging/build',file)),after=await readFile(path.join(compiled,file));if(!before.equals(after))changed.push(file.replaceAll('\\','/'));}
assert.deepEqual(changed.sort(),['agent-browser.js','browser-input.js','browser-uploads.js','tool-service.js','workspace-browser.js','workspace-tools.js'].sort(),'Unexpected compiled changes outside browser scope');
await cp(compiled,path.join(stage,'build'),{recursive:true});const pkg=await json(path.join(stage,'package.json'));assert.equal(pkg.version,'0.44.0');pkg.version=version;await writeFile(path.join(stage,'package.json'),JSON.stringify(pkg,null,2));
const migrationFiles=(await readdir(path.join(resources,'database'))).filter(f=>f.endsWith('.sql'));assert.equal(migrationFiles.length,54);for(const file of migrationFiles)assert.equal(hash(await readFile(path.join(root,'desktop/database',file))),hash(await readFile(path.join(resources,'database',file))),'Migration changed: '+file);
const ui=path.resolve(resources,'ui');assert(ui.startsWith(work+path.sep)&&ui!==work);assert(!(await lstat(ui)).isSymbolicLink());assert.equal((await realpath(ui)).toLowerCase(),ui.toLowerCase());
await build({configFile:false,envDir:false,root:path.join(source,'ui'),plugins:[react()],base:'/',build:{outDir:ui,emptyOutDir:true,assetsInlineLimit:0}});
await writeFile(path.join(resources,'version.json'),JSON.stringify({...await json(path.join(resources,'version.json')),version}));
for(const [file,digest]of expected)assert.equal(hash(await readFile(path.join(source,file.slice('desktop/'.length)))),digest);
const proof={phase:'prepared',at:new Date().toISOString(),version,baseVersion:'0.44.0',baseImageSha256:packaged.imageSha256,source,stage,resources,compiledModules:moduleFiles.length,changedModules:changed,unchangedModules:moduleFiles.length-changed.length,migrations:54,rootVersionUnchanged:(await json(path.join(root,'package.json'))).version,installed:false,productionMigrated:false,liveAcceptancePending:true};
await writeFile(path.join(work,'preparation.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify({phase:proof.phase,version,compiledModules:proof.compiledModules,changedModules:proof.changedModules,installed:false}));
