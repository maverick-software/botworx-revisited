import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';import path from 'node:path';
const lock=path.resolve(import.meta.dirname,'../../desktop/.operation-lock');
export function desktopOperation(kind){
 let existing;try{existing=JSON.parse(readFileSync(lock,'utf8'));}catch(error){if(error.code!=='ENOENT')throw new Error('The desktop operation lock is invalid. Inspect desktop/.operation-lock before continuing.');}
 if(existing){let live=true;try{process.kill(existing.pid,0);}catch(error){if(error.code==='ESRCH')live=false;else if(error.code!=='EPERM')throw error;}
  if(live){if(String(existing.pid)===process.env.SYLVANA_DESKTOP_OPERATION_PID)return;throw new Error(`Desktop ${existing.kind} is still running (process ${existing.pid}). Let it finish before ${kind}; the backend and application resources are shared.`);}unlinkSync(lock);
 }
 writeFileSync(lock,JSON.stringify({pid:process.pid,kind}),{flag:'wx'});process.env.SYLVANA_DESKTOP_OPERATION_PID=String(process.pid);
 process.on('exit',()=>{try{if(JSON.parse(readFileSync(lock,'utf8')).pid===process.pid)unlinkSync(lock);}catch{}});
}
