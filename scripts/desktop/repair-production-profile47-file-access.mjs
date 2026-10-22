import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile,access} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';
import {closed} from './phased-backup-control.mjs';
desktopOperation('repair copied47 regular-file permissions');await closed();
const root=path.resolve(import.meta.dirname,'../..'),pointer=JSON.parse(await readFile(path.join(root,'.supabase/desktop-profile-location/production47-current.json'),'utf8')),cfg=JSON.parse(await readFile(pointer.intent,'utf8')),exec=promisify(execFile);
assert.equal(cfg.target,'C:\\Users\\charl\\.agentopia\\desktop\\profile');const stage=JSON.parse(await readFile(path.join(cfg.out,'stage/stage-evidence.json'),'utf8'));assert(stage.success&&stage.target===cfg.target&&stage.activated===false);
await assert.rejects(access(path.join(path.dirname(cfg.target),'profile-location.json')),e=>e.code==='ENOENT');
const sid=(await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command','[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],{encoding:'utf8',windowsHide:true})).stdout.trim();assert(/^S-1-5-[0-9-]+$/.test(sid));
// Add ordinary file rights, preserving the existing directory inheritance ACEs.
const result=await exec('icacls.exe',[cfg.target,'/grant','*'+sid+':F','*S-1-5-18:F','/T','/Q'],{windowsHide:true,timeout:120000,maxBuffer:2*1024*1024});
await readFile(path.join(cfg.target,'credentials.bin'));await readFile(path.join(cfg.target,'Local State'));await closed();
const receipt={success:true,profile:cfg.target,scope:'Add full file access for the same Windows user and SYSTEM in the inactive copied profile; preserve protected directory inheritance rules.',sourceChanged:false,providerRequests:0,result:result.stdout};await writeFile(path.join(cfg.out,'copied-file-access-repair.json'),JSON.stringify(receipt,null,2),{flag:'wx'});console.log(JSON.stringify(receipt));
