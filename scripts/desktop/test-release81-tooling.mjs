// Pure release routing and installed-updater argument checks. No app or installer runs.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {maintenanceUpdateCommand,installedUpdater} from './maintenance-update-command75.mjs';

const next={version:'0.44.81',releaseDirectory:'F:/Agentopia-Tmp/i81-1792984969940/o',temp:'F:/Agentopia-Tmp/update81-1792984969940',environment:{KEEP:'yes',NODE_OPTIONS:'--inspect',ELECTRON_RUN_AS_NODE:'1',AGENTOPIA_TEST_PROFILE:'wrong'}},command=maintenanceUpdateCommand(next);
assert.equal(command.exe,installedUpdater);assert.deepEqual(command.args,['--update',path.win32.normalize(next.releaseDirectory)]);assert.equal(command.env.TEMP,path.win32.normalize(next.temp));assert.equal(command.env.TMP,command.env.TEMP);assert.equal(command.env.SQUIRREL_TEMP,command.env.TEMP);assert.equal(command.env.KEEP,'yes');for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','AGENTOPIA_TEST_PROFILE'])assert(!Object.hasOwn(command.env,key));
for(const version of ['0.44.80','0.44.82'])assert.throws(()=>maintenanceUpdateCommand({...next,version}));
for(const releaseDirectory of ['C:/Agentopia-Tmp/i81-1792984969940/o','F:/Agentopia-Tmp/i80-1792984969940/o','F:/Agentopia-Tmp/i81-1792984969940/o/nested'])assert.throws(()=>maintenanceUpdateCommand({...next,releaseDirectory}));
for(const temp of ['C:/temp','F:/Agentopia-Tmp/update80-1792984969940','F:/Agentopia-Tmp/update81-1792984969940/nested'])assert.throws(()=>maintenanceUpdateCommand({...next,temp}));
// Evaluate the scripts' release selector before any pointer is read or operation begins.
for(const name of ['qualify-release77.mjs','install-release77.mjs','make-recovery-installer75.mjs','verify-recovery-installer75.mjs']){
 const source=await readFile(new URL(name,import.meta.url),'utf8'),selector=source.match(/(?:const root=|,release81=)[^\n]*?pointer=await json\(path.join\((?:records,'current.json'|root,[^\n]*?'\.supabase\/desktop-recovery75-release\/current.json')\)\)/)?.[0];assert(selector,name);
 const begin='const '+selector.slice(selector.indexOf('release81='));
 let requested;await vm.runInNewContext('(async()=>{'+begin+';})()', {root:'F:/Agentopia',process:{argv:['node',name,'--release81']},path,json:async file=>{requested=file;return {};}});assert.equal(path.normalize(requested),path.normalize('F:/Agentopia/.supabase/desktop-release81/current.json'),name);
}
const credentials=await readFile(new URL('audit-installed-credentials75.mjs',import.meta.url),'utf8');assert(credentials.includes("patchFlag==='--patch81'?'0.44.81'"));assert(credentials.includes("patchFlag==='--patch81'?'.supabase/desktop-release81/current.json'"));assert(!credentials.includes("release80:patchFlag==='--patch81'"));
const normal=await readFile(new URL('normal-clean-chat75-process.mjs',import.meta.url),'utf8');assert.equal((normal.match(/75\|76\|77\|78\|79\|80\|81/g)??[]).length,2);
for(const expression of normal.match(/\/\^C:.*?\$\/i/g)??[]){const allowed=vm.runInNewContext(expression);assert(allowed.test('C:\\Users\\charl\\AppData\\Local\\AgentopiaDesktop\\app-0.44.81\\Agentopia.exe'));assert(!allowed.test('C:\\Users\\charl\\AppData\\Local\\AgentopiaDesktop\\app-0.44.82\\Agentopia.exe'));assert(!allowed.test('F:\\Other\\app-0.44.81\\Agentopia.exe'));}
const worker=await readFile(new URL('make-recovery-installer75-worker.mjs',import.meta.url),'utf8'),guard=worker.slice(worker.indexOf("assert(['0.44.75'"),worker.indexOf('assert.equal(process.env.TEMP'));
const workerIntent={version:'0.44.81',out:path.join('F:/Agentopia','.supabase/desktop-release81/1792984969940')};vm.runInNewContext(guard,{assert,path,root:'F:/Agentopia',intent:workerIntent});
assert.throws(()=>vm.runInNewContext(guard,{assert,path,root:'F:/Agentopia',intent:{...workerIntent,out:path.join('F:/Agentopia','.supabase/desktop-release80/1792984969940')}}));
console.log(JSON.stringify({success:true,release81Routing:true,shortFDriveScratch:true,legacyVersionsRejectedFor81Paths:true,protectedComposioExceptionsDisabled:true,productionWrites:0}));
