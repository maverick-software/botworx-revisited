import {execFileSync,spawnSync} from 'node:child_process';
import {readFile,writeFile,mkdir,copyFile,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('Windows action review installation and verification');
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'.supabase/desktop-computer-review/release'),version=JSON.parse(await readFile(path.join(root,'package.json'),'utf8')).version;
assert.equal(version,'0.42.1');await mkdir(out,{recursive:true});const json=async file=>JSON.parse((await readFile(file,'utf8')).replace(/^\uFEFF/,''));
const backend=await json(path.join(out,'backend-unchanged.json'));assert(backend.success&&backend.modules===994&&backend.version===version);assert.equal(Object.keys((await json(path.join(out,'data-before.json'))).migrations).length,45);
for(const file of ['.supabase/desktop-computer-review/ui/evidence.json','.supabase/desktop-browser-pointer/ui/evidence.json','.supabase/desktop-computer-ui/evidence.json'])assert((await json(path.join(root,file))).success,file);
const regression=await readFile(path.join(root,'.supabase/desktop-computer-review/regression.log'),'utf8');assert(/tests 17/.test(regression)&&/pass 17/.test(regression)&&/fail 0/.test(regression));
assert.equal(execFileSync('powershell.exe',['-NoProfile','-Command',"@(Get-Process -Name Agentopia -ErrorAction SilentlyContinue).Count"],{encoding:'utf8',windowsHide:true}).trim(),'0','Close Agentopia normally before installing.');
const setup=path.join(root,'desktop/staging/out/make/squirrel.windows/x64/AgentopiaSetup.exe'),digest=createHash('sha256');for await(const chunk of createReadStream(setup))digest.update(chunk);const sha256=digest.digest('hex');
let installed;try{installed=await json(path.join(out,'installer.json'));}catch(error){if(error.code!=='ENOENT')throw error;}
if(installed){assert.equal(installed.version,version);assert.equal(installed.sha256,sha256);assert.equal(installed.installationExitCode,0);console.log('Retaining the successful installer checkpoint.');}
else{
 const previous=path.join(process.env.LOCALAPPDATA,'AgentopiaDesktop/app-0.42.0/resources/app.asar'),prior=path.join(out,'previous-0.42.0');await mkdir(prior,{recursive:true});await copyFile(previous,path.join(prior,'app.asar'));
 const result=spawnSync(setup,['--silent'],{windowsHide:true,encoding:'utf8',timeout:300000});assert.equal(result.status,0,result.error?.message??'Installer failed.');installed={at:new Date().toISOString(),version,path:setup,sha256,bytes:(await stat(setup)).size,installationExitCode:result.status};await writeFile(path.join(out,'installer.json'),JSON.stringify(installed,null,2));console.log('Installed '+version+'.');
}
const exe=path.join(process.env.LOCALAPPDATA,'AgentopiaDesktop','app-'+version,'Agentopia.exe'),env={...process.env,AGENTOPIA_LIVE_EXE:exe,AGENTOPIA_NAVIGATION_OUTPUT:'.supabase/desktop-computer-review/navigation',AGENTOPIA_BROWSER_RELEASE_OUTPUT:'.supabase/desktop-computer-review/release',AGENTOPIA_AFTER_SCHEMA:'45'};
for(const [name,args] of [['installed',['scripts/desktop/test-computer-review-installed.mjs']],['navigation',['scripts/desktop/test-compact-navigation-installed.mjs']],['resources',['scripts/desktop/audit-browser-data-resources.mjs']],['data',['scripts/desktop/audit-browser-data.mjs','--after']]]){
 const result=spawnSync(process.execPath,args,{cwd:root,env,encoding:'utf8',windowsHide:true,timeout:600000,maxBuffer:4*1024*1024});await writeFile(path.join(out,name+'.log'),(result.stdout??'')+(result.stderr??''));assert.equal(result.status,0,result.error?.message??'Inspect '+name+'.log');console.log(name+' verification passed.');
}
const data=await json(path.join(out,'data-after.json')),resources=await json(path.join(out,'installed-resources.json')),history=await json(path.join(root,'.supabase/desktop-computer-review/installed/evidence.json'));assert(data.success&&resources.success&&history.success);
await writeFile(path.join(out,'release-summary.json'),JSON.stringify({at:new Date().toISOString(),version,schema:45,reviewControls:true,focusedBackendChecks:17,unchangedBackendModules:backend.modules,retainedRealProviderActions:8,noRepeatedInference:true,preservedConversations:data.preservedConversations,preservedMessages:data.preservedMessages,resources,installer:installed,success:true,goalComplete:false,remaining:['Independent Windows shortcut launch and clean-machine/reboot qualification','Broader Windows applications, displays, interruption and permission behavior','Additional browser, voice and desktop interaction parity']},null,2));
console.log('PASS '+version+': readable installed real-provider reviews, exact text, history/restart/navigation, original data and resources retained. Full desktop parity remains active.');
