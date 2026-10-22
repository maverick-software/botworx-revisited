import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomBytes,randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {desktopOperation} from './operation-lock.mjs';
import {hash} from './phased-backup-control.mjs';
desktopOperation('probe ordinary Explorer Windows Roaming filesystem context');
const root=path.resolve(import.meta.dirname,'../..'),job=path.join(root,'.supabase/desktop-roaming-context55',String(Date.now())),exec=promisify(execFile),json=async p=>JSON.parse(await readFile(p,'utf8'));await mkdir(job,{recursive:true});
const run=async(exe,args)=>(await exec(exe,args,{cwd:root,windowsHide:true,encoding:'utf8',timeout:30000,maxBuffer:1024*1024})).stdout.trim();
const sid=await run('powershell.exe',['-NoProfile','NonInteractive','-Command','[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'].map(x=>x==='NonInteractive'?'-NonInteractive':x));assert(/^S-1-5-[0-9-]+$/.test(sid));await run('icacls.exe',[job,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F','/Q']);
const intent={job,name:'.agentopia-context-'+randomUUID().replaceAll('-','')+'.tmp',token:randomBytes(32).toString('hex')};await writeFile(path.join(job,'intent.json'),JSON.stringify(intent));
const shell=path.join(root,'.supabase/desktop-plugin-release55/1792598853555/program/resources/resources/code-tools/powershell-7.6.7/pwsh.exe'),script=path.join(root,'scripts/desktop/probe-normal-roaming55.ps1'),shortcut=path.join(job,'probe.lnk');assert.equal(await hash(shell),'fa2c8bb1e35cdd62ad15cd06a1d8f2c5961e9725a9bfa1e7cfd2c322f49e9619');
const ps="$s=(New-Object -ComObject WScript.Shell).CreateShortcut('"+shortcut+"');$s.TargetPath='"+shell+"';$s.Arguments='-NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -File \""+script+"\" -Job \""+job+"\"';$s.WorkingDirectory='F:\\Agentopia';$s.WindowStyle=7;$s.Save()";await run('powershell.exe',['-NoProfile','-NonInteractive','-Command',ps]);
try{await run('explorer.exe',[shortcut]);}catch(error){if(error.code!==1)throw error;}
let ready;for(let n=0;n<60;n++){try{ready=await json(path.join(job,'ready.json'));break;}catch(error){if(error.code!=='ENOENT')throw error;}await new Promise(resolve=>setTimeout(resolve,500));}assert(ready?.success,'The ordinary hidden helper did not start');
const code='from pathlib import Path;import json;name='+JSON.stringify(intent.name)+';token='+JSON.stringify(intent.token)+';roots={"ordinary":Path("/mnt/c/Users/charl/AppData/Roaming/Agentopia"),"store":Path("/mnt/c/Users/charl/AppData/Local/Packages/OpenAI.Codex_2p2nqsd0c76g0/LocalCache/Roaming/Agentopia")};print(json.dumps({k:(p/name).is_file() and (p/name).read_text()==token for k,p in roots.items()}))';
const physical=JSON.parse(await run('wsl.exe',['-d','AgentopiaRuntime-a91a4800-e08f-4440-a4ec-588762d01bfd','-u','agentopia','--exec','python3','-c',code]));await writeFile(path.join(job,'release'),'release');
for(let n=0;n<60;n++){try{await readFile(path.join(job,'done.json'));break;}catch(error){if(error.code!=='ENOENT')throw error;}await new Promise(resolve=>setTimeout(resolve,500));}
const e={success:physical.ordinary===true&&physical.store===false,job,physical,ready,onlyDisposableMarkerWritten:true,productionDataWrites:0};await writeFile(path.join(job,'evidence.json'),JSON.stringify(e,null,2));await writeFile(path.join(root,'.supabase/desktop-roaming-context55/current.json'),JSON.stringify({job,evidence:path.join(job,'evidence.json')}));console.log(JSON.stringify(e));
