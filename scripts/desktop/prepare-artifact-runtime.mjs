import assert from 'node:assert/strict';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,rename,lstat,realpath,readdir} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {unzipSync} from 'fflate';
import {desktopOperation} from './operation-lock.mjs';
const root=path.resolve(import.meta.dirname,'../..'),cache=path.join(root,'.supabase/desktop-artifact-authoring'),pinsFile=path.join(root,'desktop/artifact-runtime-pins.json'),pinBytes=await readFile(pinsFile),pins=JSON.parse(pinBytes),hash=b=>createHash('sha256').update(b).digest('hex'),exec=promisify(execFile);
assert(pins.format===1&&pins.python==='3.14'&&pins.platform==='win_amd64'&&/^artifact-python(?:-[a-z0-9]+)?$/.test(pins.directory));
const pythonRuntime=JSON.parse(await readFile(path.join(root,'desktop/src/script-runtime-manifest.json'),'utf8')).python;assert(pythonRuntime.version.startsWith(pins.python+'.'),'Repin authoring wheels for the selected bundled Python version before building.');
const stageOnly=process.argv.includes('--stage-only'),publish=process.argv.indexOf('--publish');
if(!stageOnly)desktopOperation('prepare pinned artifact authoring libraries');
await mkdir(path.join(cache,'wheels'),{recursive:true});
async function verify(directory,manifest,fromWheels=true){
 assert.equal(manifest.pinsSha256,hash(pinBytes));assert.equal(manifest.directory,pins.directory);assert.deepEqual(manifest.modules,pins.modules);
 // Reconstruct expected bytes from the pinned archives. An editable stage's
 // own manifest cannot authorize a changed file or a substituted dependency.
 const expected={};if(fromWheels)for(const wheel of pins.wheels){const bytes=await readFile(path.join(cache,'wheels',wheel.file));assert.equal(hash(bytes),wheel.sha256);for(const [name,content] of Object.entries(unzipSync(bytes)))if(!name.endsWith('/')){assert(!(name in expected));expected[name]=hash(content);}}
 expected['bootstrap/sitecustomize.py']=hash(await readFile(path.join(root,'desktop/runtime/artifact-sitecustomize.py')));
 assert.equal(manifest.files['bootstrap/sitecustomize.py'],expected['bootstrap/sitecustomize.py']);if(fromWheels)assert.deepEqual(manifest.files,Object.fromEntries(Object.entries(expected).sort(([a],[b])=>a.localeCompare(b,'en'))));
 const actual=await realpath(directory),files=await readdir(directory,{recursive:true,withFileTypes:true});assert.equal(files.filter(e=>e.isFile()).length,Object.keys(manifest.files).length);
 for(const entry of files)assert(!entry.isSymbolicLink());
 for(const [name,digest] of Object.entries(manifest.files)){const file=path.resolve(directory,name),info=await lstat(file);assert(file.startsWith(directory+path.sep)&&info.isFile()&&!info.isSymbolicLink());assert((await realpath(file)).startsWith(actual+path.sep));assert.equal(hash(await readFile(file)),digest,name);}
}
if(process.argv.includes('--verify')){const manifest=JSON.parse(await readFile(path.join(root,'desktop/src/artifact-runtime-manifest.json'),'utf8'));await verify(path.join(root,'desktop/resources',pins.directory),manifest,false);console.log('Verified '+manifest.wheels.length+' authoring packages and '+Object.keys(manifest.files).length+' pinned files, including license notices and the project-preserving Python bootstrap.');process.exit(0);}
let stage;
if(publish>=0){assert(process.argv[publish+1]);stage=path.resolve(process.argv[publish+1]);assert(path.dirname(stage)===cache&&/^prepared-\d{13}$/.test(path.basename(stage)));}
else{
 for(const wheel of pins.wheels){assert(path.basename(wheel.file)===wheel.file&&wheel.file.endsWith('.whl')&&new URL(wheel.url).origin==='https://files.pythonhosted.org');const target=path.join(cache,'wheels',wheel.file);let bytes;try{bytes=await readFile(target);}catch(error){if(error.code!=='ENOENT')throw error;const response=await fetch(wheel.url,{redirect:'error',signal:AbortSignal.timeout(120000)});assert(response.ok);bytes=Buffer.from(await response.arrayBuffer());assert(bytes.length<30*1024*1024);assert.equal(hash(bytes),wheel.sha256);await writeFile(target,bytes,{flag:'wx'});}assert.equal(hash(bytes),wheel.sha256,wheel.file);}
 stage=path.join(cache,'prepared-'+Date.now());await mkdir(stage);
 const python=JSON.parse(await readFile(path.join(root,'desktop/src/script-runtime-manifest.json'),'utf8')).python;
 const result=await exec(path.join(root,'desktop/resources/script-runtimes',python.directory,python.entry),['-I',path.join(root,'scripts/desktop/unpack-artifact-wheels.py'),pinsFile,path.join(cache,'wheels'),path.join(stage,pins.directory),path.join(root,'desktop/runtime/artifact-sitecustomize.py')],{windowsHide:true,timeout:60000,encoding:'utf8'});console.log(result.stdout.trim());
}
const manifest=JSON.parse(await readFile(path.join(stage,'manifest.json'),'utf8'));await verify(path.join(stage,pins.directory),manifest);
if(!stageOnly){
 const target=path.join(root,'desktop/resources',pins.directory);try{await lstat(target);await verify(target,manifest);}catch(error){if(error.code!=='ENOENT')throw error;await rename(path.join(stage,pins.directory),target);}
 await writeFile(path.join(root,'desktop/src/artifact-runtime-manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log('Published pinned authoring resources and manifest; frozen release images remain unchanged.');
}else console.log('Stage verified without modifying bundled resources: '+stage);
