import {useEffect,useState} from 'react';
import {call} from './ui';

/** Keep the active preview informed even when folder navigation is closed. */
export function usePreviewMonitor(owner:string,scope:string,referenceId:string|undefined,path:string|undefined,enabled:boolean,revision:number){
 const [notice,setNotice]=useState({changed:false,warning:''});
 useEffect(()=>{
  let live=true;setNotice({changed:false,warning:''});if(!enabled||!referenceId)return;
  const id=crypto.randomUUID(),off=window.sylvana.onChat(event=>{
   if(!live||event.kind!=='workspace'||event.ownerId!==owner||event.workspace?.id!==id)return;
   setNotice({changed:true,warning:event.workspace.error??''});
  });
  void call<{warning?:string}>('workspace.watch',{owner,id,referenceId,path:path??'',kind:'file'}).then(result=>{
   if(live&&result?.warning)setNotice(old=>({...old,warning:result.warning!}));
  }).catch(error=>{if(live)setNotice(old=>({...old,warning:error.message}));});
  return()=>{live=false;off();void call('workspace.unwatch',{owner,id}).catch(()=>{});};
 },[owner,scope,referenceId,path,enabled,revision]);
 return {...notice,dismiss:()=>setNotice({changed:false,warning:''})};
}
