import {randomUUID} from 'node:crypto';
import type {SylvanaAccount} from './sylvana-account';
import type {VoicePreferences} from './voice-preferences';
import {validateRecording} from './voice';

export class ManagedVoice {
 private active?:AbortController;
 constructor(private account:()=>SylvanaAccount,private guard:(owner:string)=>Promise<void>){}
 async stop(){this.active?.abort();this.active=undefined;}
 async voices(owner:string,tier='standard'){
  if(!['standard','advanced'].includes(tier))throw Error('Choose Standard or Advanced for voice.');
  await this.guard(owner);const response=await this.account().providerRequest(owner,'/v1/audio/voices/'+tier);if(!response.ok)throw Error('Sylvana voices are unavailable. Check your connection.');
  const value=await response.json();if(!Array.isArray(value.voices))throw Error('Sylvana returned an invalid voice catalog.');await this.guard(owner);
  return value.voices.map((v:any)=>{if(typeof v.id!=='string'||!/^voice-[a-f0-9]{16}$/.test(v.id)||typeof v.name!=='string')throw Error('Sylvana returned an invalid voice.');return {name:v.id,label:v.name,culture:'Sylvana'};});
 }
 async status(owner:string,preferences:VoicePreferences){
  await this.guard(owner);const account=this.account();await account.verifySession(owner,true);const s=account.status(owner);
  return {ready:s.linked&&s.allowance?.status==='active'&&Number(s.allowance.remaining_units)>0,engine:'Sylvana '+(preferences.tier==='advanced'?'Advanced':'Standard'),language:'Automatic',speech:'Sylvana managed voice'};
 }
 async prepare(owner:string,preferences:VoicePreferences){const s=await this.status(owner,preferences);if(!s.ready)throw Error('An active Sylvana subscription, paid seat, and allowance are required for managed voice.');}
 private async perform<T>(owner:string,kind:string,body:unknown,read:(r:Response,signal:AbortSignal)=>Promise<T>):Promise<T|{cancelled:true}>{
  await this.stop();const controller=new AbortController();this.active=controller;const signal=controller.signal,id=randomUUID();
  try{
   await this.guard(owner);signal.throwIfAborted();
   const response=await this.account().providerRequest(owner,'/v1/'+kind,{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':id},body:JSON.stringify(body),signal:AbortSignal.any([signal,AbortSignal.timeout(180000)])});
   if(!response.ok){const e=await response.json().catch(()=>({}));throw Error(typeof e.error?.message==='string'?e.error.message:'The Sylvana voice request could not complete. Inspect usage before trying again.');}
   if(response.headers.get('x-sylvana-operation')!==id)throw Error('The Sylvana voice operation could not be verified.');
   const result=await read(response,signal);signal.throwIfAborted();await this.guard(owner);
   // Audio accounting can become available just after the stream ends. These
   // are status reads, never retries of the generation itself.
   try{for(let n=0;n<3&&!signal.aborted;n++){
    const r=await this.account().providerRequest(owner,'/v1/operations/'+id,{signal});if(!r.ok)break;
    if((await r.json()).status==='settled')break;await new Promise(resolve=>setTimeout(resolve,300));
   }
   await this.account().verifySession(owner,true);}catch{ /* Keep completed audio when the usage refresh is temporarily unavailable. */ }
   await this.guard(owner);signal.throwIfAborted();return result;
  }catch(error){if(signal.aborted)return {cancelled:true};throw error;}finally{if(this.active===controller)this.active=undefined;}
 }
 async transcribe(owner:string,encoded:unknown,preferences:VoicePreferences){
  validateRecording(encoded);
  const result=await this.perform(owner,'audio/transcriptions',{model:preferences.tier??'standard',input_audio:{data:encoded,format:'wav'},response_format:'json'},async r=>{const value=await r.json();if(typeof value.text!=='string')throw Error('Sylvana returned no transcript.');return {text:value.text,cancelled:false};});
  return 'text' in result?result:{text:'',cancelled:true};
 }
 async synthesize(owner:string,text:unknown,preferences:VoicePreferences){
  if(typeof text!=='string'||!text.trim()||Array.from(text).length>4000)throw Error('Choose a reply of up to 4,000 characters for Sylvana speech.');
  const result=await this.perform(owner,'audio/speech',{model:preferences.tier??'standard',input:text,response_format:'mp3',...(preferences.managedVoice?{voice:preferences.managedVoice}:{})},async(r,signal)=>{
   if(!r.headers.get('content-type')?.startsWith('audio/')||!r.body)throw Error('Sylvana returned no playable audio.');
   const chunks:Buffer[]=[];let size=0;for await(const chunk of r.body as any){signal.throwIfAborted();size+=chunk.length;if(size>24*1024*1024)throw Error('Sylvana speech exceeded the audio size limit.');chunks.push(Buffer.from(chunk));}
   if(!size)throw Error('Sylvana returned empty speech audio.');return {audio:Buffer.concat(chunks).toString('base64'),cancelled:false};
  });
  return 'audio' in result?result:{audio:'',cancelled:true};
 }
}
