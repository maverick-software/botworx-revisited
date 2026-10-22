import {useEffect,useRef,useState} from 'react';
import {call} from './ui';
import {collectDisplaySnapshot} from '../src/display-state';
import type {PortableBackupResult,PortableBackupStatus} from '../src/contracts';

export function usePortableBackup(owner:string|undefined,flush:()=>Promise<void>,completed:(result:PortableBackupResult)=>void,failed:(message:string)=>void){
 const callbacks=useRef({owner,flush,completed,failed});callbacks.current={owner,flush,completed,failed};
 const pending=useRef(false),[status,setStatus]=useState<PortableBackupStatus>({phase:'idle',message:''});
 const mounted=useRef(true);useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 async function start(){
  if(pending.current||!owner)return;pending.current=true;const expected=owner;
  const current=()=>mounted.current&&callbacks.current.owner===expected;
  let timer:ReturnType<typeof setTimeout>|undefined,finished=false;
  const poll=async()=>{try{const next=await call<PortableBackupStatus>('runtime.backup.status');if(!finished&&current()&&next.phase!=='idle')setStatus(next);}catch{/* The request itself reports any backup failure. */}if(!finished)timer=setTimeout(()=>void poll(),500);};
  setStatus({phase:'running',message:'Saving your latest edits and drafts…'});
  try{
   await callbacks.current.flush();if(!current())throw Error('Your account changed before the backup started.');
   setStatus({phase:'choosing',message:'Choose a private folder for your backup.'});
   const result=call<PortableBackupResult|undefined>('runtime.backup',{display:collectDisplaySnapshot(localStorage)});void poll();
   const saved=await result;if(saved&&current())callbacks.current.completed(saved);
  }catch(error){if(current())callbacks.current.failed((error as Error).message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/,''));}
  finally{finished=true;clearTimeout(timer);pending.current=false;if(current())setStatus({phase:'idle',message:''});}
 }
 return {start,busy:status.phase!=='idle',message:status.message};
}
