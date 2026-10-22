// Actual sealed data/tools; only the fresh-home environment observation is injected.
import {readFile,writeFile,mkdir,link,lstat} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('qualify queued bootstrap with real protected restore data');
const root=path.resolve(import.meta.dirname,'../..'),json=async p=>JSON.parse(await readFile(p,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex'),require=createRequire(import.meta.url),execute=promisify(execFile);
const preparedJob='D:/Users/charl/AgentopiaQA/full-recovery/1792475995885',prepared=await json(path.join(preparedJob,'evidence.json'));assert(prepared.success&&prepared.isolatedDestination&&!prepared.databaseImported);
const job=path.resolve('C:/Users/charl/AgentopiaQA/recovery-bootstrap',String(Date.now())),resources=path.join(job,'resources');await mkdir(resources,{recursive:true});
const pins=await json(path.join(root,'desktop/src/script-runtime-manifest.json')),installed='C:/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.47/resources/resources',sourceHashes={};
for(const [name,digest]of Object.entries(pins.files).filter(([name])=>name.startsWith(pins.python.directory+'/'))){const from=path.join(installed,'script-runtimes',name),to=path.join(resources,'script-runtimes',name);assert.equal(sha(await readFile(from)),digest);await mkdir(path.dirname(to),{recursive:true});await link(from,to);sourceHashes[name]=digest;}
await mkdir(path.join(resources,'runtime'));for(const name of ['prepare-desktop-recovery.py','relocate-native-profile.py'])await writeFile(path.join(resources,'runtime',name),await readFile(path.join(root,'desktop/runtime',name)),{flag:'wx'});
const marker=path.join(prepared.home,'.agentopia/recovery-request.json'),request={format:2,kind:'agentopia-desktop-recovery-request',id:randomUUID(),home:prepared.home,appData:path.dirname(prepared.profile),profile:prepared.profile,bundle:prepared.bundle,descriptorSha256:sha(await readFile(path.join(prepared.bundle,'desktop-recovery.json')))};
await writeFile(marker,JSON.stringify(request,null,2),{flag:'wx'});
const wrapper=path.join(job,'resume.py');await writeFile(wrapper,`from pathlib import Path\nimport importlib.util,json\nspec=importlib.util.spec_from_file_location('preparer',${JSON.stringify(path.join(resources,'runtime/prepare-desktop-recovery.py'))});m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)\nr=m.prepare(Path(${JSON.stringify(prepared.bundle)}),Path(${JSON.stringify(prepared.home)}),Path(${JSON.stringify(path.dirname(prepared.profile))}),[],headroom=512*1024**2,compress=True)\nprint(json.dumps({'success':True,'status':r['status'],'databaseImported':False}))\n`,{flag:'wx'});
const {queuedRecovery,runQueuedRecovery}=require(path.join(root,'desktop/build/recovery-bootstrap.js')),queued=queuedRecovery(request.home,request.appData,request.profile);assert(queued);const progress=[];let executions=0;
const result=await runQueuedRecovery(queued,resources,message=>{if(progress.at(-1)!==message)progress.push(message);},{execute:async(program,args,options)=>{executions++;assert.equal(program,path.join(resources,'script-runtimes',pins.python.directory,pins.python.entry));assert(args.includes('--bootstrap-pid'));return execute(program,['-I','-B',wrapper],options);}});
assert(result.success&&result.relaunch&&executions===1);await assert.rejects(lstat(marker),{code:'ENOENT'});const state=await json(path.join(prepared.home,'.agentopia/recovery-state.json'));assert(state.status==='prepared'&&!state.databaseImported);
for(const [name,digest]of Object.entries(sourceHashes))assert.equal(sha(await readFile(path.join(installed,'script-runtimes',name))),digest);
const evidence={success:true,at:new Date().toISOString(),job,preparedJob,realBundledPythonVerified:true,pythonFilesVerified:Object.keys(sourceHashes).length,recoveryResourcesVerified:true,sealedBundleUsed:true,queuedRequestCommitted:true,relaunchRequested:true,databaseStarted:false,environmentObservationsInjectedForQA:true,parentProcessInspectionCoveredByUnitTestsOnly:true,productionChanged:false,providerRequests:0,progress,fullApplicationRestoreProven:false};
await writeFile(path.join(job,'evidence.json'),JSON.stringify(evidence,null,2),{flag:'wx'});await mkdir(path.join(root,'.supabase/desktop-recovery-bootstrap'),{recursive:true});await writeFile(path.join(root,'.supabase/desktop-recovery-bootstrap/real-current.json'),JSON.stringify({job,evidence:path.join(job,'evidence.json')},null,2));console.log(JSON.stringify({success:true,job,pythonFilesVerified:Object.keys(sourceHashes).length,queuedRequestCommitted:true,relaunchRequested:true,databaseStarted:false,providerRequests:0}));
