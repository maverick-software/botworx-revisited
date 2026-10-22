import {spawnSync} from 'node:child_process';
import {readFile,writeFile,readdir,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import {listPackage,extractFile} from '@electron/asar';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('package private persistent-agent candidate');
const root=path.resolve(import.meta.dirname,'../..'),work=path.join(root,'.supabase/desktop-workspace-agents'),candidate=path.join(work,'candidate-0440'),stage=path.join(candidate,'staging');
const json=async file=>JSON.parse(await readFile(file,'utf8')),hash=bytes=>createHash('sha256').update(bytes).digest('hex'),prepared=await json(path.join(candidate,'preparation.json'));
assert.equal(prepared.phase,'prepared');assert.equal((await json(path.join(stage,'package.json'))).version,'0.44.0');assert.equal((await json(path.join(candidate,'resources/version.json'))).schema,54);
assert.equal((await realpath(stage)).toLowerCase(),stage.toLowerCase());try{assert((await realpath(path.join(stage,'out'))).toLowerCase().startsWith(candidate.toLowerCase()+path.sep));}catch(error){if(error.code!=='ENOENT')throw error;}
const forge=await json(path.join(root,'node_modules/@electron-forge/cli/package.json'));
const result=spawnSync(process.execPath,[path.join(root,'node_modules/@electron-forge/cli',forge.bin['electron-forge']),'package',stage],{cwd:root,env:process.env,stdio:'inherit',windowsHide:true});assert.equal(result.status,0,'Private candidate packaging did not complete. Inspect output before repeating.');
const image=path.join(stage,'out/Agentopia-win32-x64/resources/app.asar'),delivered=path.join(stage,'out/Agentopia-win32-x64/resources/resources');assert.equal(JSON.parse(extractFile(image,'package.json')).version,'0.44.0');
const modules=listPackage(image).map(name=>name.replaceAll('\\','/').replace(/^\//,'')).filter(name=>name.startsWith('build/')&&/\.(js|json)$/.test(name));assert.equal(modules.length,1009);
for(const file of modules)assert(extractFile(image,path.normalize(file)).equals(await readFile(path.join(stage,file))),'Packaged module mismatch: '+file);
const migrations=(await readdir(path.join(delivered,'database'))).filter(name=>name.endsWith('.sql'));assert.equal(migrations.length,54);
for(const name of migrations)assert.equal(hash(await readFile(path.join(delivered,'database',name))),hash(await readFile(path.join(root,'desktop/database',name))),'Packaged migration mismatch: '+name);
let resourceFiles=0;for(const relative of await readdir(path.join(candidate,'resources'),{recursive:true})){const source=path.join(candidate,'resources',relative);let bytes;try{bytes=await readFile(source);}catch(error){if(error.code==='EISDIR'||error.code==='EPERM')continue;throw error;}assert.equal(hash(await readFile(path.join(delivered,relative))),hash(bytes),'Packaged resource mismatch: '+relative);resourceFiles++;}
const proof={success:true,at:new Date().toISOString(),version:'0.44.0',image,imageSha256:hash(await readFile(image)),compiledModules:modules.length,migrations:migrations.length,resourceFiles,sourceOAuthProofVerified:prepared.sourceOAuthProofVerified,installed:false,installerCreated:false,productionMigrated:false,liveAcceptancePending:true};await writeFile(path.join(candidate,'package-proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof,null,2));
