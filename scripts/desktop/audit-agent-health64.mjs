import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {desktopOperation} from './operation-lock.mjs';
import {linux} from './phased-backup-control.mjs';
desktopOperation('read-only current installed agent identity, memory and assignment audit');
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'.supabase/desktop-agent-health64',String(Date.now())),exec=promisify(execFile);await mkdir(out,{recursive:true});
const sid=(await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command','[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],{windowsHide:true,encoding:'utf8'})).stdout.trim();assert(/^S-1-5-[0-9-]+$/.test(sid));await exec('icacls.exe',[out,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F','/Q'],{windowsHide:true});
await writeFile(path.join(out,'intent.json'),JSON.stringify({out,readOnly:true,providerRequests:0},null,2));console.log('Read-only agent audit: '+out);
try{const result=await exec('wsl.exe',['-d','AgentopiaRuntime-a91a4800-e08f-4440-a4ec-588762d01bfd','-u','agentopia','--exec','python3',linux(path.join(root,'scripts/desktop/audit-agent-health64.py')),linux(out)],{windowsHide:true,encoding:'utf8',timeout:120000,maxBuffer:1024*1024});console.log(result.stdout);}catch(error){await writeFile(path.join(out,'private-controller-error.json'),JSON.stringify({message:error.message,stderr:error.stderr},null,2));console.error('Read-only audit needs inspection: '+out);process.exitCode=1;}
