import {readFile,writeFile,mkdir,readdir,lstat,realpath,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('verify completed47 generated packaging input is reproducible');
const root=path.resolve(import.meta.dirname,'../..'),candidate=path.join(root,'.supabase/desktop-platform-release/candidate-04447'),json=async file=>JSON.parse(await readFile(file,'utf8')),exec=promisify(execFile),hash=async file=>{const h=createHash('sha256');for await(const b of createReadStream(file))h.update(b);return h.digest('hex');};
const made=await json(path.join(candidate,'installer-proof.json')),verified=await json(path.join(candidate,'installer-verification/evidence.json')),packaged=await json(path.join(candidate,'package-proof.json')),installed=await json(path.join(candidate,'ordinary-installed.json'));
assert(made.success&&verified.success&&installed.success&&installed.installed&&made.version==='0.44.47');
const input=path.resolve('C:/Users/charl/AgentopiaQA/navigation-rollup-installer/1792452552365/input');assert.equal(input,made.stage);assert.equal(path.dirname(input),made.artifactRoot);assert.equal(await realpath(input),input);
for(let parent=input;path.dirname(parent)!==parent;parent=path.dirname(parent))assert(!(await lstat(parent)).isSymbolicLink());
assert.equal(await hash(made.installer),made.installerSha256);assert.equal(await hash(made.fullPackage),verified.fullPackageSha256);assert.equal(await hash(packaged.image),packaged.imageSha256);
const processes=await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command',"@(Get-CimInstance Win32_Process|Where-Object {$_.ExecutablePath -like 'C:\\Users\\charl\\AgentopiaQA\\navigation-rollup-installer\\1792452552365\\input\\*'}).Count"],{windowsHide:true,encoding:'utf8'});assert.equal(processes.stdout.trim(),'0');
const expected=new Set();let files=0,bytes=0;for(const entry of await readdir(packaged.portableDirectory,{recursive:true,withFileTypes:true})){assert(!entry.isSymbolicLink());if(entry.isDirectory())continue;assert(entry.isFile());const relative=path.relative(packaged.portableDirectory,path.join(entry.parentPath,entry.name)),copy=path.join(input,relative),info=await lstat(copy);assert(info.isFile()&&!info.isSymbolicLink()&&info.nlink===1);assert.equal(await hash(copy),await hash(path.join(packaged.portableDirectory,relative)));expected.add(relative);files++;bytes+=info.size;}
for(const entry of await readdir(input,{recursive:true,withFileTypes:true})){assert(!entry.isSymbolicLink());const file=path.join(entry.parentPath,entry.name),relative=path.relative(input,file);if(entry.isDirectory()){assert.equal(await realpath(file),file);continue;}if(expected.has(relative))continue;assert.equal(relative,'Squirrel.exe','An unexpected file prevents disposal');assert.equal(await hash(file),await hash(path.join(root,'node_modules/electron-winstaller/vendor/Squirrel.exe')));assert.equal((await lstat(file)).nlink,1);files++;bytes+=(await stat(file)).size;}
const out=path.join(root,'.supabase/desktop-maintenance/navigation47-input');await mkdir(out,{recursive:true});const result={success:true,at:new Date().toISOString(),input,files,bytes,ownedGeneratedInput:true,everyInputFileReproducible:true,finishedInstallerVerified:true,frozenPayloadVerified:true,noRunningExecutableFromInput:true,installer:made.installer,frozenPayload:packaged.portableDirectory,deleted:false};await writeFile(path.join(out,'inspection.json'),JSON.stringify(result,null,2),{flag:'wx'});console.log(JSON.stringify(result));
