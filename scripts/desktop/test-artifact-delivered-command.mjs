import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {desktopOperation} from './operation-lock.mjs';

desktopOperation('exact delivered artifact command verification');
const root=path.resolve(import.meta.dirname,'../..'),candidate=path.join(root,'.supabase/desktop-platform-release/candidate-04424'),run=path.join(root,'.supabase/desktop-artifact-authoring','delivered-'+Date.now());
await mkdir(run,{recursive:true});await copyFile(import.meta.filename,path.join(run,'verification.mjs'));
const json=async file=>JSON.parse(await readFile(file,'utf8')),hash=async file=>{const h=createHash('sha256');for await(const bytes of createReadStream(file))h.update(bytes);return h.digest('hex');};
const proof=await json(path.join(candidate,'package-proof.json')),require=createRequire(path.join(candidate,'staging/package.json')),resources=path.join(proof.portableDirectory,'resources/resources'),build=path.join(candidate,'staging/build');
assert.equal(proof.version,'0.44.24');assert.equal(await hash(path.join(proof.portableDirectory,'resources/app.asar')),proof.imageSha256);
const {CodexClient}=require('./build/codex-client.js'),{scriptEnvironment}=require('./build/script-runtimes.js'),runtime=await json(path.join(build,'script-runtime-manifest.json')),manifest=await json(path.join(build,'artifact-runtime-manifest.json'));
// Start with the Windows execution prerequisites only. Developer Python, node,
// user site-packages and user-provided PYTHONPATH cannot satisfy these imports.
const source=Object.fromEntries(Object.entries(process.env).filter(([key])=>/^(SystemRoot|windir|SystemDrive|ComSpec|PATHEXT|USERPROFILE|USERNAME|USERDOMAIN|HOMEDRIVE|HOMEPATH|TEMP|TMP|ProgramFiles|ProgramFiles\(x86\)|ProgramW6432|ProgramData|OS|NUMBER_OF_PROCESSORS|PROCESSOR_ARCHITECTURE)$/i.test(key)));
source.PATH=path.join(process.env.SystemRoot,'System32');
const env=scriptEnvironment(resources,source),libraries=path.join(resources,manifest.directory),outputs=path.join(run,'outputs'),fixture=path.join(root,'scripts/desktop/artifact-authoring-fixture.py'),marker='DELIVERED-04424-'+path.basename(run);
env.CODEX_HOME=path.join(run,'home');await mkdir(env.CODEX_HOME);env.USERPROFILE=run;env.APPDATA=path.join(run,'appdata');env.LOCALAPPDATA=path.join(run,'local');
const config={model_provider:'agentopia','model_providers.agentopia.name':'Offline delivered artifact verification','model_providers.agentopia.base_url':'http://127.0.0.1:1/v1','model_providers.agentopia.wire_api':'responses','model_providers.agentopia.requires_openai_auth':false,chatgpt_base_url:'http://127.0.0.1:1/','shell_environment_policy.inherit':'none',...Object.fromEntries(Object.entries(env).map(([key,value])=>['shell_environment_policy.set.'+key,value]))};
const binary=path.join(resources,'codex/x86_64-pc-windows-msvc/bin/codex.exe'),client=new CodexClient(binary,Object.entries(config).flatMap(([key,value])=>['-c',key+'='+JSON.stringify(value)]),env,run),evidence={at:new Date().toISOString(),version:proof.version,imageSha256:proof.imageSha256,resources,outputs,providerRequests:0,developerDependenciesExcluded:true,scope:'Exact delivered 0.44.24 Codex command executor, Python, authoring bootstrap and independent JavaScript readers. This invokes command/exec directly; chat-driven authorship and Office visual fidelity remain separate acceptance requirements.'};
try{
 for(const name of ['codex-client.js','script-runtimes.js','execution-environment.js','script-runtime-manifest.json','code-tool-manifest.json','artifact-runtime-manifest.json']){const file=path.join(build,name);(evidence.executorFiles??=[]).push({name,sha256:await hash(file)});}
 evidence.codexSha256=await hash(binary);evidence.fixtureSha256=await hash(fixture);
 await client.initialize();
 const modules=[...new Set([...manifest.modules,'xlsxwriter'])],code='import sys,os,runpy,importlib,json; expected=os.path.normcase(os.path.realpath('+JSON.stringify(libraries)+')); modules='+JSON.stringify(modules)+'; imports={m:os.path.realpath(importlib.import_module(m).__file__) for m in modules}; assert all(os.path.normcase(f).startswith(expected+os.sep) for f in imports.values()),imports; print(json.dumps({"bundledImports":imports})); sys.argv='+JSON.stringify([fixture,libraries,outputs,marker])+'; runpy.run_path(sys.argv[0],run_name="__main__")';
 const result=await client.request('command/exec',{command:[path.join(resources,'script-runtimes',runtime.python.directory,runtime.python.entry),'-c',code],cwd:run,sandboxPolicy:{type:'dangerFullAccess'},timeoutMs:60000},90000);
 evidence.command=result;assert.equal(result.exitCode,0,result.stderr);const creation=await json(path.join(outputs,'creation-evidence.json'));assert.equal(creation.marker,marker);assert.equal(creation.files.length,5);evidence.creation=creation;
 const reader=spawnSync(process.execPath,[path.join(root,'scripts/desktop/test-artifact-reader.mjs'),outputs,path.join(build,'document-worker.js')],{cwd:root,windowsHide:true,encoding:'utf8',timeout:150000});
 assert.equal(reader.status,0,reader.stderr||reader.stdout);evidence.reader=await json(path.join(outputs,'reader-evidence.json'));evidence.success=true;
}catch(error){evidence.success=false;evidence.error=error.message;process.exitCode=1;}
finally{await client.close();await writeFile(path.join(run,'evidence.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify({success:evidence.success,run,outputs,providerRequests:0,error:evidence.error},null,2));}
