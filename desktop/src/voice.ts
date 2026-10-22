import {spawn,type ChildProcess} from 'node:child_process';
import {mkdir,readFile,writeFile,unlink,readdir} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
import type {Runtime} from './runtime';
import type {VoicePreferences} from './voice-preferences';
export function validateRecording(data:unknown){
 if(typeof data!=='string'||data.length>5400000||!/^[A-Za-z0-9+/]*={0,2}$/.test(data))throw new Error('Invalid voice recording.');
 const bytes=Buffer.from(data,'base64');
 if(bytes.length<44||bytes.length>4000000||bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WAVE'||bytes.toString('ascii',12,16)!=='fmt '||bytes.readUInt32LE(16)!==16||bytes.readUInt16LE(20)!==1||bytes.readUInt16LE(22)!==1||bytes.readUInt32LE(24)!==16000||bytes.readUInt16LE(34)!==16||bytes.toString('ascii',36,40)!=='data'||bytes.readUInt32LE(40)!==bytes.length-44)throw new Error('Record mono, 16 kHz PCM WAV audio, up to two minutes.');
 return bytes;
}
export class LocalVoice {
 private preparing?:Promise<void>;private transcribing=false;private speaker?:ChildProcess;
 private recording?:{id:string;cancelled:boolean;cleaning:boolean;cancel?:Promise<string>;done:Promise<void>;finish:()=>void};
 private catalog?:{at:number;voices:{name:string;culture:string;gender:string}[]};private speechEpoch=0;
 constructor(private resources:string,private directory:string,private runtime:Runtime){}
 async recover(){await this.runtime.command(['python3','/opt/agentopia/voice.py','recover']);const folder=path.join(this.directory,'temporary-audio');for(const file of await readdir(folder).catch(()=>[]))if(/^[a-f0-9-]{36}\.wav$/.test(file))await unlink(path.join(folder,file)).catch(()=>{});}
 async status(){const checksum=(await readFile(path.join(this.resources,'voice.sha256'),'utf8')).trim();return {...JSON.parse(await this.runtime.command(['python3','/opt/agentopia/voice.py','status',checksum])),engine:'Whisper base.en',language:'English',speech:'Windows installed voice'};}
 async prepare(){
  if(this.preparing)return this.preparing;
  const work=(async()=>{if((await this.status()).ready)return;const expected=(await readFile(path.join(this.resources,'voice.sha256'),'utf8')).trim();const hash=createHash('sha256');for await(const block of createReadStream(path.join(this.resources,'voice.tar.gz')))hash.update(block);if(hash.digest('hex')!==expected)throw new Error('The bundled voice model checksum failed. Reinstall Agentopia.');await this.runtime.send([{name:'voice.tar.gz',file:path.join(this.resources,'voice.tar.gz')}],'/home/agentopia/.agentopia-voice');await this.runtime.command(['python3','/opt/agentopia/voice.py','install',expected]);})();
  this.preparing=work;try{await work;}finally{this.preparing=undefined;}
 }
 async transcribe(encoded:unknown){
  if(this.transcribing)throw new Error('A recording is already being transcribed.');const bytes=validateRecording(encoded);this.transcribing=true;const identifier=randomUUID();const folder=path.join(this.directory,'temporary-audio');const file=path.join(folder,identifier+'.wav');let finish!:()=>void;
  const state={id:identifier,cancelled:false,cleaning:false,done:new Promise<void>(resolve=>{finish=resolve;}),finish:()=>finish(),cancel:undefined as Promise<string>|undefined};this.recording=state;
  try{await this.prepare();if(state.cancelled)return {text:'',cancelled:true};await mkdir(folder,{recursive:true});await writeFile(file,bytes,{mode:0o600});await this.runtime.send([{name:identifier+'.wav',file}],'/home/agentopia/.agentopia-voice/tmp');if(state.cancelled)return {text:'',cancelled:true};const result=JSON.parse(await this.runtime.command(['python3','/opt/agentopia/voice.py','transcribe',identifier],210000));return state.cancelled?{text:'',cancelled:true}:result;}
  finally{state.cleaning=true;await state.cancel?.catch(()=>{});await this.runtime.command(['python3','/opt/agentopia/voice.py','cleanup',identifier],10000).catch(()=>{});await unlink(file).catch(()=>{});this.transcribing=false;if(this.recording===state)this.recording=undefined;state.finish();}
 }
 async stop(){this.speechEpoch++;this.speaker?.kill();this.speaker=undefined;const state=this.recording;if(state){state.cancelled=true;if(!state.cleaning)state.cancel??=this.runtime.command(['python3','/opt/agentopia/voice.py','cancel',state.id],10000);await state.cancel?.catch(()=>{});await state.done;}}
 private async windows(script:string,input='',limit=16*1024*1024,synthesis=false){
  const executable=path.join(process.env.SystemRoot??'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
  const child=spawn(executable,['-NoProfile','-NonInteractive','-WindowStyle','Hidden','-Command',"$ErrorActionPreference='Stop';[Console]::InputEncoding=[System.Text.UTF8Encoding]::new();[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new();Add-Type -AssemblyName System.Speech;"+script],{windowsHide:true,stdio:['pipe','pipe','pipe']});if(synthesis)this.speaker=child;const blocks:Buffer[]=[];let size=0,overflow=false;const timer=setTimeout(()=>child.kill(),synthesis?120000:15000);
  try{return await new Promise<string>((resolve,reject)=>{child.once('error',()=>reject(new Error('Windows speech could not start. Check installed speech voices.')));child.stdout.on('data',(data:Buffer)=>{size+=data.length;if(size>limit){overflow=true;child.kill();}else blocks.push(data);});child.stderr.resume();child.once('close',code=>overflow?reject(new Error('Speech audio exceeded the local size limit.')):child.killed?resolve(''):code===0?resolve(Buffer.concat(blocks).toString('utf8').replace(/^\uFEFF/,'')):reject(new Error('Windows speech failed. Select an available installed voice and try again.')));child.stdin.on('error',()=>{});child.stdin.end(input);});}finally{clearTimeout(timer);if(this.speaker===child)this.speaker=undefined;}
 }
 async voices(){if(this.catalog&&Date.now()-this.catalog.at<120000)return this.catalog.voices;const data=await this.windows("$s=New-Object System.Speech.Synthesis.SpeechSynthesizer;try{$items=@($s.GetInstalledVoices()|Where-Object {$_.Enabled}|ForEach-Object {@{name=$_.VoiceInfo.Name;culture=$_.VoiceInfo.Culture.Name;gender=$_.VoiceInfo.Gender.ToString()}});ConvertTo-Json -InputObject $items -Compress}finally{$s.Dispose()}");const voices=JSON.parse(data);if(!Array.isArray(voices))throw new Error('The installed voice list is unavailable.');this.catalog={at:Date.now(),voices};return voices as {name:string;culture:string;gender:string}[];}
 async synthesize(value:unknown,preferences:VoicePreferences){
  if(typeof value!=='string'||!value.trim()||value.length>20000)throw new Error('Choose a reply of up to 20,000 characters to read aloud.');const stopping=this.stop(),epoch=this.speechEpoch;await stopping;if(preferences.voice&&!(await this.voices()).some(v=>v.name===preferences.voice))throw new Error('This Windows voice is unavailable. Choose another voice in settings.');if(epoch!==this.speechEpoch)return {audio:'',cancelled:true};
  const data=await this.windows("$p=[Console]::In.ReadToEnd()|ConvertFrom-Json;$s=New-Object System.Speech.Synthesis.SpeechSynthesizer;$m=New-Object System.IO.MemoryStream;try{if($p.voice){$s.SelectVoice($p.voice)};$s.Rate=[int]$p.rate;$s.SetOutputToWaveStream($m);$s.Speak([string]$p.text);$s.SetOutputToNull();[Console]::Out.Write([Convert]::ToBase64String($m.ToArray()))}finally{$s.Dispose();$m.Dispose()}",JSON.stringify({text:value,voice:preferences.voice,rate:preferences.rate}),24*1024*1024,true);
  return {audio:data,cancelled:!data};
 }
 async speak(value:unknown){
  if(typeof value!=='string'||!value.trim()||value.length>20000)throw new Error('Choose a reply of up to 20,000 characters to read aloud.');await this.stop();
  const executable=path.join(process.env.SystemRoot??'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
  const child=spawn(executable,['-NoProfile','-NonInteractive','-WindowStyle','Hidden','-Command',"[Console]::InputEncoding=[System.Text.UTF8Encoding]::new(); Add-Type -AssemblyName System.Speech; $voiceSpeaker=New-Object System.Speech.Synthesis.SpeechSynthesizer; try { $voiceText=[Console]::In.ReadToEnd(); $voiceSpeaker.Speak($voiceText) } finally { $voiceSpeaker.Dispose() }"],{windowsHide:true,stdio:['pipe','ignore','pipe']});this.speaker=child;
  const timer=setTimeout(()=>child.kill(),180000);
  try{await new Promise<void>((resolve,reject)=>{child.once('error',()=>reject(new Error('Windows speech could not start. Check your installed speech voices.')));child.once('exit',code=>code===0||child.killed?resolve():reject(new Error('Windows speech failed. Check your installed speech voices.')));child.stdin.on('error',()=>{});child.stderr.resume();child.stdin.end(value);});}
  finally{clearTimeout(timer);if(this.speaker===child)this.speaker=undefined;}
 }
}
