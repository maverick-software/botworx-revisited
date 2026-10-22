import {spawn} from 'node:child_process';import assert from 'node:assert/strict';
import {run} from './phased-backup-control.mjs';
export function linuxColdImageReader(distribution,file){
 assert(distribution==='Ubuntu'&&/^\/mnt\/c\/Users\/[^/]+\/(?:AppData\/Roaming\/Agentopia|\.agentopia\/desktop\/profile)\/wsl\/ext4\.vhdx$/.test(file),'The reader is limited to the registered owned runtime disk');
 const inspect=async()=>JSON.parse(await run(['-d',distribution,'--exec','python3','-c',"import json,os,stat,sys;from pathlib import Path;p=Path(sys.argv[1]);s=p.lstat();assert stat.S_ISREG(s.st_mode) and s.st_nlink==1 and p.resolve()==p;print(json.dumps({'path':str(p),'dev':s.st_dev,'ino':s.st_ino,'size':s.st_size,'mtimeNs':s.st_mtime_ns,'ctimeNs':s.st_ctime_ns}))",file]));
 const read=async()=>{const child=spawn('wsl.exe',['-d',distribution,'--exec','/bin/cat',file],{windowsHide:true,stdio:['ignore','pipe','pipe']});let error='';child.stderr.on('data',chunk=>{error=(error+chunk.toString()).slice(0,2000);});const completed=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Error('The physical cold-image reader failed: '+error)));});completed.catch(()=>{});child.stdout.once('close',()=>{if(child.exitCode===null)child.kill();});return {stream:child.stdout,completed};};return {inspect,read};
}
