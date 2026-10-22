import {readFile,writeFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import assert from 'node:assert/strict';

// Record the completed chat work without replacing the failed environment result.
const root=path.resolve(import.meta.dirname,'../..'),out=path.resolve(process.argv[2]??'');
assert.equal(path.dirname(out),path.resolve('C:/Users/charl/AgentopiaQA/plugin-compatibility'));
assert(/^\d{13}$/.test(path.basename(out)));
const candidate=path.join(root,'.supabase/desktop-platform-release/candidate-04440');
const json=async p=>JSON.parse(await readFile(p,'utf8'));
const hash=async p=>{const h=createHash('sha256');for await(const bytes of createReadStream(p))h.update(bytes);return h.digest('hex');};
const e=await json(path.join(out,'evidence.json')),p=await json(path.join(candidate,'package-proof.json'));
assert.equal(e.version,'0.44.40');assert.equal(e.schema,69);assert.equal(e.success,false);
assert.equal(e.registered,false);assert.equal(e.checks.length,13);
assert.equal(e.imageSha256,p.imageSha256);
assert.equal(await hash(path.join(out,'program/resources/app.asar')),p.imageSha256);
assert.equal(await hash(p.image),p.imageSha256);
assert.equal(e.parallel.network.calls.length,4);
assert.equal(new Set(e.parallel.network.calls.map(c=>c.requestId)).size,3);
assert.equal(new Set(e.parallel.network.calls.map(c=>c.threadId)).size,2);
assert.deepEqual(e.parallel.network.blocked,[]);assert.deepEqual(e.parallel.network.errors,[]);
assert.deepEqual(e.parallel.pinStateAtContinuation,{a:false,b:false});
assert(e.parallel.unpinnedAfterReopen);
for(const launch of [e.secondLaunch,e.thirdLaunch]){
 assert.equal(launch.info.version,'0.44.40');assert.deepEqual(launch.network.calls,[]);
 assert.deepEqual(launch.network.blocked,[]);assert.deepEqual(launch.rendererErrors,[]);
}
assert.equal(e.shutdownChecks.length,3);
for(const shutdown of e.shutdownChecks)assert(shutdown.exit.exitCode===0&&shutdown.exit.hasExited&&shutdown.privateRuntimeStopped);
for(const audit of [e.firstAudit,e.secondAudit]){
 assert(audit.success&&audit.schema===69&&audit.encryptionRootPreserved);
 assert.equal(audit.existingTablesCompared,153);assert.equal(audit.existingRowsCompared,20433);assert.equal(audit.readableVaultRows,191);
}
const exec=promisify(execFile);
const list=async running=>{
 const {stdout}=await exec('wsl.exe',['--list',...(running?['--running']:[]),'--quiet'],{encoding:'buffer',windowsHide:true});
 return stdout.toString(stdout.includes(0)?'utf16le':'utf8').replace(/^\uFEFF/,'').trim().split(/\r?\n/).map(x=>x.trim()).filter(Boolean).sort();
};
const registered=await list(false),running=await list(true);
assert.deepEqual(registered,[...e.before.registered].sort());assert(!registered.includes(e.distribution));
const stopped=e.before.running.filter(x=>!running.includes(x)),started=running.filter(x=>!e.before.running.includes(x));
assert.deepEqual(stopped,['Ubuntu']);assert.deepEqual(started,[]);
assert(running.includes('AgentopiaRuntime-a91a4800-e08f-4440-a4ec-588762d01bfd'));
let configuration=await readFile(path.join(p.resources,'runtime/config.toml'),'utf8');
for(let n=0;n<6;n++)configuration=configuration.replaceAll(String(57320+n),String(e.ports.shadow+n));
let resources=0;
for(const [name,digest] of Object.entries(p.resourceFiles)){
 assert.equal(await hash(path.join(out,'program/resources/resources',name)),name==='runtime/config.toml'?createHash('sha256').update(configuration).digest('hex'):digest);resources++;
}
assert.equal(await hash(path.join(e.sharedTestProgram.source,'resources/resources/runtime/config.toml')),e.sharedTestProgram.defaultConfigSha256);
assert.equal(await hash('C:/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.31/resources/app.asar'),'69964ce0bf472ae74646ae111d8f9234ec968e46ea85558ac305f01d89933434');
const screenshots={};for(const name of ['parallel-two-native-turns.png','parallel-steering-one-chat.png','parallel-pinned-history.png','parallel-cold-recovered.png','third-launch.png'])screenshots[name]=await hash(path.join(out,name));
const result={at:new Date().toISOString(),version:e.version,imageSha256:e.imageSha256,workflowAcceptancePassed:true,fullControllerSuccess:false,evidence:path.join(out,'evidence.json'),evidenceSha256:await hash(path.join(out,'evidence.json')),completedGroups:e.checks,controlledResponses:4,actualRequestRecords:3,nativeThreads:2,realProviderRequests:0,coldReopensWithoutInference:2,normalExits:e.shutdownChecks,firstAudit:e.firstAudit,secondAudit:e.secondAudit,resourceFilesCompared:resources,screenshots,environment:{registeredInventoryPreserved:true,ownedRuntimeRemoved:true,ordinaryRuntimeStillRunning:true,stopped,started,unexpectedStateChangeCause:'Unresolved; the final running-state assertion failed. Original failure is retained; no claim that all unrelated running states were preserved.'},ordinaryNativeWindowObserved:true,ordinaryInstalledVersion:'0.44.31',installed:false,limits:['Actual immutable40 executable, native Codex, SQL and chat controls use controlled responses; live service concurrency is not newly tested.','The final unrelated Ubuntu running-state assertion failed after all chat workflows and normal closes completed. No completed request was replayed.','Ordinary40 installation remains pending its specific human response.']};
await writeFile(path.join(candidate,'parallel-chat-acceptance.json'),JSON.stringify(result,null,2),{flag:'wx'});
console.log(JSON.stringify({workflowAcceptancePassed:true,fullControllerSuccess:false,completedGroups:e.checks.length,resources,controlledResponses:4,realProviderRequests:0,ownedRuntimeRemoved:true,environmentLimitation:'Ubuntu stopped; cause unresolved',installed:false}));
