import {mkdir,readFile,writeFile,readdir,cp,rename,realpath} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('apply verified continuous history interface');
const root=path.resolve(import.meta.dirname,'../..'),work=path.join(root,'.supabase/desktop-continuous-history'),prepared=JSON.parse(await readFile(path.join(work,'maintenance/preparation.json'),'utf8')),checks=JSON.parse(await readFile(path.join(work,'maintenance-checks/evidence.json'),'utf8'));
assert(prepared.success&&prepared.baselineReproduced&&checks.success&&checks.streamingPreservesReadingPosition&&checks.boundedOverviewRetainsAllMessages);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function inventory(dir){const values={};for(const file of await readdir(dir,{recursive:true,withFileTypes:true}))if(file.isFile()){const full=path.join(file.parentPath,file.name);values[path.relative(dir,full).replaceAll('\\','/')]=hash(await readFile(full));}return Object.fromEntries(Object.entries(values).sort(([a],[b])=>a.localeCompare(b)));}
const exe=prepared.installedExecutable;assert.equal(exe,'C:\\Users\\charl\\AppData\\Local\\AgentopiaDesktop\\app-0.43.7\\Agentopia.exe');
const archive=path.join(path.dirname(exe),'resources/app.asar'),resources=prepared.installedResources,target=path.join(resources,'ui');assert.equal(await realpath(resources),resources);assert.equal(path.dirname(resources),path.join(path.dirname(exe),'resources'));
const running=(await promisify(execFile)('powershell.exe',['-NoProfile','-NonInteractive','-Command',"@(Get-CimInstance Win32_Process -Filter \"name='Agentopia.exe'\").Count"],{windowsHide:true,encoding:'utf8'})).stdout.trim();assert.equal(running,'0','Close Agentopia normally before applying this interface update.');
assert.deepEqual(await inventory(target),prepared.before);assert.deepEqual(await inventory(prepared.ui),prepared.after);
const out=path.join(work,'deployment');await mkdir(out);const suffix=randomUUID(),retained=path.join(resources,'ui-before-continuous-'+suffix),next=path.join(resources,'ui-next-continuous-'+suffix);
for(const file of [target,next,retained])assert.equal(path.dirname(path.resolve(file)),resources);
const evidence={at:new Date().toISOString(),phase:'prepared',installedVersion:'0.43.7',interface:'continuous-history-1',exe,target,retained,next,before:prepared.before,after:prepared.after,backendBefore:hash(await readFile(archive)),checks:path.join(work,'maintenance-checks/evidence.json'),inferenceRequests:0,databaseChanged:false};await writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2),{flag:'wx'});
await cp(target,path.join(out,'ui-before'),{recursive:true});assert.deepEqual(await inventory(path.join(out,'ui-before')),prepared.before);await cp(prepared.ui,next,{recursive:true});assert.deepEqual(await inventory(next),prepared.after);
await rename(target,retained);try{await rename(next,target);assert.deepEqual(await inventory(target),prepared.after);}catch(error){try{await rename(target,next+'-failed');}catch{}await rename(retained,target);throw error;}
evidence.backendAfter=hash(await readFile(archive));assert.equal(evidence.backendAfter,evidence.backendBefore);evidence.phase='applied';evidence.success=true;await writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify({success:true,interface:evidence.interface,retained,backendUnchanged:true,databaseChanged:false,inferenceRequests:0},null,2));
