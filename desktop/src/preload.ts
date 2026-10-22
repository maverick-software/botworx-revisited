import {contextBridge,ipcRenderer,webUtils} from 'electron';
import type {ChatEvent,RuntimeStatus,AttachmentInput} from './contracts';
contextBridge.exposeInMainWorld('agentopia',{
 attach:async(files:File[],owner:string)=>{
  if(!Array.isArray(files)||!files.length||files.length>20)throw new Error('Attach up to 20 files or folders at a time.');
  // Sandboxed preloads cannot require local modules. These mirror image-limits.
  const maxImageBytes=20*1024*1024,maxImageBatchBytes=40*1024*1024;
  const items:AttachmentInput[]=[];let images=0,imageBytes=0;
  for(const file of files){const filePath=webUtils.getPathForFile(file);if(filePath){items.push({path:filePath});continue;}
   if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>maxImageBytes||++images>4)throw new Error('Paste up to four PNG, JPEG, or WebP images of 20 MB or smaller.');
   if((imageBytes+=file.size)>maxImageBatchBytes)throw new Error('Pasted images exceed 40 MB in one batch.');
   items.push({name:file.name,image:Buffer.from(await file.arrayBuffer()).toString('base64')});
  }
  return ipcRenderer.invoke('agentopia:attach',{owner,items});
 },
 call:(action:string,args?:Record<string,unknown>)=>ipcRenderer.invoke('agentopia:call',action,args),
 onNotification:(listener:(target:{owner:string;conversationId:string;child?:{requestId:string;threadId:string}})=>void)=>{const receive=(_event:unknown,target:{owner:string;conversationId:string;child?:{requestId:string;threadId:string}})=>listener(target);ipcRenderer.on('agentopia:notification',receive);return()=>ipcRenderer.removeListener('agentopia:notification',receive);},
 onCommand:(listener:(command:string)=>void)=>{const receive=(_event:unknown,command:string)=>listener(command);ipcRenderer.on('agentopia:command',receive);return()=>ipcRenderer.removeListener('agentopia:command',receive);},
 onBeforeClose:(listener:()=>Promise<void>)=>{
  const receive=async(_event:unknown,token:string)=>{try{await listener();ipcRenderer.send('agentopia:close-ready',{token});}catch{ipcRenderer.send('agentopia:close-ready',{token,error:true});}};
  ipcRenderer.on('agentopia:before-close',receive);return ()=>ipcRenderer.removeListener('agentopia:before-close',receive);
 },
 onChat:(listener:(event:ChatEvent)=>void)=>{
  const receive=(_event:unknown,data:ChatEvent)=>listener(data);ipcRenderer.on('agentopia:chat',receive);
  return ()=>ipcRenderer.removeListener('agentopia:chat',receive);
 },
 onRuntime:(listener:(event:RuntimeStatus)=>void)=>{
  const receive=(_event:unknown,data:RuntimeStatus)=>listener(data);ipcRenderer.on('agentopia:runtime',receive);
  return ()=>ipcRenderer.removeListener('agentopia:runtime',receive);
 },
});
