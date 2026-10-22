import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {StringDecoder} from 'node:string_decoder';
import path from 'node:path';
import {commandScriptEnvironment,prepareCommandRuntimes,commandShellForScript} from './script-runtimes';
import {redactCredentialText,validateCommand} from './terminal-runner';
export type InteractiveResult={output:string;status:'running'|'completed'|'failed'|'cancelled';exitCode:number|null;truncated:boolean;pid:number|null;revision:number};
export function terminalSize(columns:unknown,rows:unknown){if(!Number.isInteger(columns)||Number(columns)<20||Number(columns)>300||!Number.isInteger(rows)||Number(rows)<5||Number(rows)>120)throw new Error('Terminal size must be 20–300 columns and 5–120 rows.');return {columns:Number(columns),rows:Number(rows)};}
export function terminalInput(value:unknown){if(typeof value!=='string'||!value.length||value.length>15990)throw new Error('Terminal input must contain 1–15,990 characters.');validateCommand('x; '+value,1000);return value;}
function spawnInteractive(script:string,cwd:string,columns:number,rows:number,signal:AbortSignal,changed:(result:InteractiveResult)=>void=()=>{}){
 signal.throwIfAborted();terminalSize(columns,rows);
 const child=spawn(path.join(process.env.SystemRoot??'C:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script],{cwd,windowsHide:true,stdio:['pipe','pipe','pipe'],env:commandScriptEnvironment(script)});
 const readyMarker='AGP-'+randomBytes(5).toString('hex');let initialOutput='',markerSeen=false;
 let output='',line='',closed=false,ready=false,total=0,failed=false,exitCode:number|null=null,pid:number|null=null,truncated=false,revision=0;
 const decoder=new StringDecoder('utf8'),errors=new StringDecoder('utf8');
 const snapshot=():InteractiveResult=>({output:redactCredentialText(output).replaceAll(readyMarker,'').replace(/\x1b\][\s\S]*?(?:\x07|\x1b\\)/g,''),status:closed?(signal.aborted?'cancelled':failed||exitCode!==0?'failed':'completed'):'running',exitCode,pid,truncated,revision});
 const append=(value:string)=>{total+=value.length;output+=value;if(output.length>200000){truncated=true;output=output.slice(-200000).replace(/^[\uDC00-\uDFFF]/,'');}revision++;changed(snapshot());if(total>4000000){failed=true;child.kill();}};
 let resolveReady:()=>void,rejectReady:(error:Error)=>void;const started=new Promise<void>((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});void started.catch(()=>{});
 const abort=()=>{if(!closed)child.kill();};signal.addEventListener('abort',abort,{once:true});
 const maybeReady=()=>{if(pid&&markerSeen&&!ready){ready=true;clearTimeout(timeout);resolveReady();changed(snapshot());}};
 const receive=(value:string)=>{if(ready||markerSeen){append(value);return;}initialOutput+=value;const index=initialOutput.indexOf(readyMarker);if(index>=0){markerSeen=true;const rest=initialOutput.slice(index+readyMarker.length).replace(/^\r?\n/,'');initialOutput='';maybeReady();if(rest)append(rest);}else if(initialOutput.length>200000){failed=true;abort();}};
 const timeout=setTimeout(()=>{if(!ready){failed=true;append('\r\nInteractive terminal startup timed out.');abort();}},15000);
 const finished=new Promise<InteractiveResult>(resolve=>{
  child.stdout.on('data',chunk=>{line+=chunk.toString('ascii');let end;while((end=line.indexOf('\n'))>=0){const event=line.slice(0,end).trim();line=line.slice(end+1);const kind=event[0],bytes=Buffer.from(event.slice(2),'base64');if(kind==='O')receive(decoder.write(bytes));else if(kind==='S'){pid=Number(bytes.toString());maybeReady();}else if(kind==='R')exitCode=Number(bytes.toString())|0;else if(kind==='F'){failed=true;append('\r\n'+bytes.toString('utf8'));}}if(line.length>30000){failed=true;abort();}});
  child.stderr.on('data',bytes=>{failed=true;append(errors.write(bytes));});child.on('error',error=>{failed=true;append(error.message);});
  child.on('close',()=>{closed=true;clearTimeout(timeout);signal.removeEventListener('abort',abort);if(!ready&&initialOutput)output=initialOutput.slice(-4000);append(decoder.end()+errors.end());if(!ready)rejectReady(new Error(snapshot().output||'Interactive terminal failed to start.'));resolve(snapshot());});
 });
 child.stdin.on('error',()=>{});child.stdin.write(JSON.stringify({cwd,columns,rows,ready:readyMarker,executable:commandShellForScript(script)})+'\n');if(signal.aborted)abort();
 const send=(line:string)=>new Promise<void>((resolve,reject)=>{if(closed||signal.aborted)return reject(new Error('This terminal session is no longer running.'));child.stdin.write(line+'\n',error=>error?reject(error):resolve());});
 return {started,finished,snapshot,supervisorPid:child.pid,input:async(value:unknown)=>{const text=terminalInput(value);await started;await send('I:'+Buffer.from(text).toString('base64'));},resize:async(columns:number,rows:number)=>{terminalSize(columns,rows);await started;await send('R:'+columns+','+rows);},stop:abort};
}

// Register the session immediately while verification yields to the UI thread.
// Its existing controller can cancel it before any supervisor is launched.
export function startInteractive(script:string,cwd:string,columns:number,rows:number,signal:AbortSignal,changed:(result:InteractiveResult)=>void=()=>{}){
 signal.throwIfAborted();terminalSize(columns,rows);const local=new AbortController(),combined=AbortSignal.any([signal,local.signal]);let live:ReturnType<typeof spawnInteractive>|undefined;
 let pending:InteractiveResult={output:'',status:'running',exitCode:null,truncated:false,pid:null,revision:0};
 const started=(async()=>{await prepareCommandRuntimes(script,combined);combined.throwIfAborted();live=spawnInteractive(script,cwd,columns,rows,combined,changed);await live.started;})();
 const finished=(async()=>{try{await started;return await live!.finished;}catch(error){if(live)return await live.finished;pending={...pending,status:combined.aborted?'cancelled':'failed',output:combined.aborted?'':redactCredentialText((error as Error).message),revision:1};changed(pending);return pending;}})();
 return {started,finished,snapshot:()=>live?.snapshot()??pending,get supervisorPid(){return live?.supervisorPid;},input:async(value:unknown)=>{const text=terminalInput(value);await started;await live!.input(text);},resize:async(columns:number,rows:number)=>{terminalSize(columns,rows);await started;await live!.resize(columns,rows);},stop:()=>local.abort()};
}
