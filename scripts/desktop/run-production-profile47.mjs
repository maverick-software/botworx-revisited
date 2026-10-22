import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {desktopOperation} from './operation-lock.mjs';
import {run,closed} from './phased-backup-control.mjs';
const mode=process.argv[2];assert(['prepare-plan','stage','seal','check','publish','verify-source'].includes(mode));desktopOperation('production47 profile '+mode);await closed();
const root=path.resolve(import.meta.dirname,'../..'),pointer=JSON.parse(await readFile(path.join(root,'.supabase/desktop-profile-location/production47-current.json'),'utf8')),cfg=JSON.parse(await readFile(pointer.intent,'utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');assert.equal(sha(await readFile(pointer.intent)),pointer.intentSha256);
for(const [name,digest]of Object.entries(cfg.scripts))assert.equal(sha(await readFile(path.join(root,'scripts/desktop',name))),digest);
const result=await run(['-d',cfg.distribution,'-u','agentopia','--exec','python3','/mnt/d/Users/charl/software/Agentopia/scripts/desktop/production_profile47_control.py',mode],600000);
await writeFile(path.join(cfg.out,'controller-'+mode+'.log'),result,{flag:'wx'});
if(mode==='stage'){
 // All copied private files must retain the same user-only protection as the
 // operator recovery, before the storage/native readers open the target.
 const exec=promisify(execFile),sid=(await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command','[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],{windowsHide:true,encoding:'utf8'})).stdout.trim();assert(/^S-1-5-[0-9-]+$/.test(sid));
 await exec('icacls.exe',[cfg.target,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F','/T','/Q'],{windowsHide:true,timeout:120000,maxBuffer:2*1024*1024});
 // Inheritance flags grant the directories; regular files also need bare F.
 await exec('icacls.exe',[cfg.target,'/grant','*'+sid+':F','*S-1-5-18:F','/T','/Q'],{windowsHide:true,timeout:120000,maxBuffer:2*1024*1024});
}
console.log(result);
