import {spawnSync} from 'node:child_process';
import {readFile,writeFile,readdir,realpath,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import {listPackage,extractFile} from '@electron/asar';
import {desktopOperation} from './operation-lock.mjs';

desktopOperation('package isolated plugin and folder receipt candidate');
const root=path.resolve(import.meta.dirname,'../..'),work=path.join(root,'.supabase/desktop-plugin-import/candidate-0442'),stage=path.join(work,'staging'),json=async file=>JSON.parse(await readFile(file,'utf8')),hash=b=>createHash('sha256').update(b).digest('hex'),prepared=await json(path.join(work,'preparation.json'));
assert.equal(prepared.phase,'prepared');assert.equal(prepared.version,'0.44.2');assert.equal((await json(path.join(stage,'package.json'))).version,'0.44.2');assert.equal((await realpath(stage)).toLowerCase(),stage.toLowerCase());
try{await lstat(path.join(stage,'out'));throw Error('Package output already exists. Inspect the existing operation before repeating it.');}catch(error){if(error.code!=='ENOENT')throw error;}
const forge=await json(path.join(root,'node_modules/@electron-forge/cli/package.json')),result=spawnSync(process.execPath,[path.join(root,'node_modules/@electron-forge/cli',forge.bin['electron-forge']),'package',stage],{cwd:root,env:process.env,stdio:'inherit',windowsHide:true});assert.equal(result.status,0,'Packaging failed. Inspect its existing output before another operation.');
const image=path.join(stage,'out/Agentopia-win32-x64/resources/app.asar'),delivered=path.join(stage,'out/Agentopia-win32-x64/resources/resources'),modules=listPackage(image).map(file=>file.replaceAll('\\','/').replace(/^\//,'')).filter(file=>file.startsWith('build/')&&/\.(js|json)$/.test(file));
assert.equal(JSON.parse(extractFile(image,'package.json')).version,'0.44.2');assert.equal(modules.length,1011);for(const file of modules)assert(extractFile(image,path.normalize(file)).equals(await readFile(path.join(stage,file))),'Packaged module differs: '+file);
let resourceFiles=0;for(const relative of await readdir(path.join(work,'resources'),{recursive:true})){const file=path.join(work,'resources',relative);if(!(await lstat(file)).isFile())continue;assert.equal(hash(await readFile(path.join(delivered,relative))),hash(await readFile(file)),'Packaged resource differs: '+relative);resourceFiles++;}
const migrations=(await readdir(path.join(delivered,'database'))).filter(file=>file.endsWith('.sql'));assert.equal(migrations.length,55);assert.equal((await json(path.join(delivered,'version.json'))).schema,55);assert.equal(hash(await readFile(path.join(delivered,'database/0055-browser-folder-receipts.sql'))),prepared.folderReceiptMigrationSha256);
const proof={success:true,at:new Date().toISOString(),version:'0.44.2',image,imageSha256:hash(await readFile(image)),compiledModules:modules.length,resourceFiles,migrations:55,portableDirectory:path.dirname(path.dirname(image)),source:prepared.source,baseImageSha256:prepared.baseImageSha256,changedModules:prepared.changedModules,addedModules:prepared.addedModules,folderReceiptMigrationSha256:prepared.folderReceiptMigrationSha256,installed:false,installerCreated:false,productionMigrated:false,liveAcceptancePending:true};await writeFile(path.join(work,'package-proof.json'),JSON.stringify(proof,null,2),{flag:'wx'});console.log(JSON.stringify(proof,null,2));
