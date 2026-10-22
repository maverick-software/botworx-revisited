import {execFileSync,spawn} from 'node:child_process';
import {mkdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';

desktopOperation('scheduled tasks native PostgreSQL restore and concurrency checks');
const root=path.resolve(import.meta.dirname,'../..'),distribution='AgentopiaRuntime-a91a4800-e08f-4440-a4ec-588762d01bfd';
const parent=path.join(root,'.supabase/desktop-scheduler');await mkdir(parent,{recursive:true});
const sid=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],{encoding:'utf8',windowsHide:true}).trim();assert(/^S-1-5-[0-9-]+$/.test(sid));
execFileSync('icacls.exe',[parent,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F','/Q'],{windowsHide:true,stdio:'ignore'});
const out=path.join(parent,'native-'+Date.now()),linux=value=>'/mnt/'+value[0].toLowerCase()+value.slice(2).replaceAll('\\','/');
const code=await new Promise((resolve,reject)=>{const child=spawn('wsl.exe',['-d',distribution,'-u','agentopia','--exec','python3',linux(path.join(root,'scripts/desktop/test-scheduler-native.py')),linux(out)],{cwd:root,windowsHide:true,stdio:'inherit'});child.once('error',reject);child.once('exit',resolve);});
const evidence=JSON.parse(await readFile(path.join(out,'evidence.json'),'utf8'));assert.equal(code,0);assert(evidence.success);console.log('Native scheduler evidence: '+out);
