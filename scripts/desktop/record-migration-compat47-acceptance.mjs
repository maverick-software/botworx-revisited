// Independently audit the completed packaged47 recovery; never start another turn.
import {readFile,writeFile,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('audit exact47 completed private recovery without inference replay');
const root=path.resolve(import.meta.dirname,'../..'),base=path.resolve('C:/Users/charl/AgentopiaQA/migration-compat-packaged/1792452232660');
const json=async file=>JSON.parse(await readFile(file,'utf8')),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const originalFile=path.join(base,'acceptance-resume-1792452384654/evidence.json'),original=await json(originalFile),prior=await json(path.join(base,'evidence.json')),cfg=await json(path.join(base,'intent.json'));
const qualificationFile=path.join(root,'.supabase/desktop-platform-release/candidate-04447/qualification.json'),qualification=await json(qualificationFile),profile=path.join(cfg.home,'.agentopia/desktop/profile');
assert(original.success&&original.version==='0.44.47'&&original.imageSha256===cfg.imageSha256&&original.checks.length===5);
assert(qualification.success&&qualification.version==='0.44.47'&&qualification.imageSha256===cfg.imageSha256);
for(const file of [qualification.image,path.join(cfg.program,'resources/app.asar')])assert.equal(sha(await readFile(file)),cfg.imageSha256);
for(const key of ['first','second']){
 const probe=original[key];assert.deepEqual(await json(path.join(probe.out,'evidence.json')),probe);
 assert(probe.success&&probe.exactArchive&&probe.mainModuleVerified&&probe.fullBackendReady&&probe.normalExit===0&&probe.actual.userData===profile&&probe.externalRequestsAttempted===0);
 assert.deepEqual(probe.controlledNetwork,{calls:[],blocked:[],errors:[]});
}
assert(original.first.workflow.legacyLinkCompatible);
for(const field of ['signedIn','savedResult','draftPreserved','cookiePreserved','noInferenceReplay','legacyAbsentAndCopiedOutputBytesPreserved'])assert.equal(original.second.workflow[field],true);
for(const field of ['privateRuntimeRemoved','legacyAbsoluteLinksCompatible','closedPaneFailureVisible','coldRecovery'])assert.equal(original[field],true);
assert.equal(original.productionProfileChanged,false);assert.equal(original.providerRequests,0);
const exec=promisify(execFile),decode=b=>(b.includes(0)?b.toString('utf16le'):b.toString('utf8')).replace(/^\uFEFF/,'').trim();
const list=async running=>decode((await exec('wsl.exe',['--list',...(running?['--running']:[]),'--quiet'],{windowsHide:true,encoding:'buffer',timeout:60000})).stdout).split(/\r?\n/).map(s=>s.trim()).filter(Boolean).sort();
const ordinary=async()=>JSON.parse((await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command',"@(Get-Process Agentopia -ErrorAction SilentlyContinue|Where-Object {$_.Path -eq 'C:\\Users\\charl\\AppData\\Local\\AgentopiaDesktop\\app-0.44.46\\Agentopia.exe'}|Select-Object -ExpandProperty Id)|ConvertTo-Json -Compress"],{windowsHide:true,encoding:'utf8'})).stdout||'[]');
const after={registered:await list(false),running:await list(true),ordinaryProcesses:await ordinary()};assert.deepEqual(after,prior.before);assert(!after.registered.includes(cfg.binding.distribution));
assert.equal(sha(await readFile(original.saved.privateFile)),original.saved.sha256);await assert.rejects(access(original.saved.legacyFile));await assert.rejects(access(original.saved.aliasCode));
const final={at:new Date().toISOString(),success:true,version:'0.44.47',imageSha256:cfg.imageSha256,profile,generatedProfileOnly:true,productionProfileChanged:false,productionTransition:false,installed:false,installerCreated:false,realProviderRequests:0,inferenceReplayed:false,legacyAbsoluteLinksCompatible:true,closedPaneFailureVisible:true,coldRecovery:true,privateRuntimeRemoved:true,ordinaryProcessesUnchanged:true,otherRuntimesUnchanged:true,checks:original.checks,resumedAcceptance:{file:originalFile,sha256:sha(await readFile(originalFile))},qualification:{file:qualificationFile,sha256:sha(await readFile(qualificationFile)),backendChecks:qualification.backendChecks,uiChecks:qualification.uiChecks},probes:Object.fromEntries(await Promise.all(['first','second'].map(async key=>{const file=path.join(original[key].out,'evidence.json');return[key,{file,sha256:sha(await readFile(file)),normalExit:original[key].normalExit}]}))),before:prior.before,after,harnessCorrection:'The initial test expected Word text in the outer pane. The unchanged formatted viewer renders inside its isolated iframe; the resumed test checks its actual text and reused the single completed native turn without replay.'};
for(const file of [path.join(root,'.supabase/desktop-platform-release/candidate-04447/private-backend-acceptance.json'),path.join(root,'.supabase/desktop-profile-location/packaged47-generated.json')])await writeFile(file,JSON.stringify(final,null,2),{flag:'wx'});
console.log(JSON.stringify({success:true,version:final.version,groups:final.checks.length,productionProfileChanged:false,realProviderRequests:0,privateRuntimeRemoved:true}));
