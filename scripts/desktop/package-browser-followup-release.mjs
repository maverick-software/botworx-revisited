import {spawnSync} from 'node:child_process';
import {readFile,writeFile,readdir,realpath,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import {listPackage,extractFile} from '@electron/asar';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('package isolated browser follow-up candidate');
const root=path.resolve(import.meta.dirname,'../..'),candidate=path.join(root,'.supabase/desktop-browser-followup/candidate-0441'),stage=path.join(candidate,'staging'),json=async f=>JSON.parse(await readFile(f,'utf8')),hash=b=>createHash('sha256').update(b).digest('hex'),prepared=await json(path.join(candidate,'preparation.json'));
assert.equal(prepared.phase,'prepared');assert.equal(prepared.version,'0.44.1');assert.equal((await json(path.join(stage,'package.json'))).version,'0.44.1');assert.equal((await realpath(stage)).toLowerCase(),stage.toLowerCase());
try{const output=await lstat(path.join(stage,'out'));throw Error('Package output already exists. Inspect the previous operation before repeating.');}catch(error){if(error.code!=='ENOENT')throw error;}
const forge=await json(path.join(root,'node_modules/@electron-forge/cli/package.json')),p=spawnSync(process.execPath,[path.join(root,'node_modules/@electron-forge/cli',forge.bin['electron-forge']),'package',stage],{cwd:root,env:process.env,stdio:'inherit',windowsHide:true});assert.equal(p.status,0,'Packaging failed. Inspect its output before repeating.');
const image=path.join(stage,'out/Agentopia-win32-x64/resources/app.asar'),delivered=path.join(stage,'out/Agentopia-win32-x64/resources/resources'),modules=listPackage(image).map(f=>f.replaceAll('\\','/').replace(/^\//,'')).filter(f=>f.startsWith('build/')&&/\.(js|json)$/.test(f));
assert.equal(JSON.parse(extractFile(image,'package.json')).version,'0.44.1');assert.equal(modules.length,1009);for(const file of modules)assert(extractFile(image,path.normalize(file)).equals(await readFile(path.join(stage,file))),'Packaged module differs: '+file);
let resourceFiles=0;for(const relative of await readdir(path.join(candidate,'resources'),{recursive:true})){const file=path.join(candidate,'resources',relative);if(!(await lstat(file)).isFile())continue;assert.equal(hash(await readFile(path.join(delivered,relative))),hash(await readFile(file)),'Packaged resource differs: '+relative);resourceFiles++;}
const migrations=(await readdir(path.join(delivered,'database'))).filter(f=>f.endsWith('.sql'));assert.equal(migrations.length,54);
const proof={success:true,at:new Date().toISOString(),version:'0.44.1',image,imageSha256:hash(await readFile(image)),compiledModules:modules.length,resourceFiles,migrations:54,portableDirectory:path.dirname(path.dirname(image)),source:prepared.source,baseImageSha256:prepared.baseImageSha256,changedModules:prepared.changedModules,installed:false,installerCreated:false,productionMigrated:false,liveAcceptancePending:true};await writeFile(path.join(candidate,'package-proof.json'),JSON.stringify(proof,null,2),{flag:'wx'});console.log(JSON.stringify({success:true,version:proof.version,compiledModules:modules.length,resourceFiles,imageSha256:proof.imageSha256,installed:false}));
