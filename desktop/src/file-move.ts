import {spawn} from 'node:child_process';
import path from 'node:path';
import {commandEnvironment} from './terminal-runner';

/** A prepared, single-operation helper. Paths travel as JSON data, never PowerShell code. */
export async function prepareFileMove(script:string,signal:AbortSignal){
 signal.throwIfAborted();
 const child=spawn(path.join(process.env.SystemRoot??'C:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script],{windowsHide:true,cwd:path.dirname(script),env:commandEnvironment(),stdio:['pipe','pipe','pipe']});
 let line='',errors='',code:number|undefined,closed=false,ready=false,committed=false;
 let resolveReady:()=>void,rejectReady:(e:Error)=>void;
 const started=new Promise<void>((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});void started.catch(()=>{});
 const abort=()=>{if(!closed)child.kill();};signal.addEventListener('abort',abort,{once:true});
 const timeout=setTimeout(abort,20000);
 const finished=new Promise<number>((resolve,reject)=>{
  child.stdout.on('data',bytes=>{line+=bytes.toString('utf8');let end;while((end=line.indexOf('\n'))>=0){const value=line.slice(0,end).trim();line=line.slice(end+1);if(value==='READY'){ready=true;resolveReady();}else if(/^RESULT:\d+$/.test(value))code=Number(value.slice(7));else if(value.startsWith('ERROR:'))errors+=Buffer.from(value.slice(6),'base64').toString('utf8');}if(line.length>20000)abort();});
  child.stderr.on('data',bytes=>{errors=(errors+bytes.toString('utf8')).slice(0,4000);});
  child.stdin.on('error',()=>{});child.on('error',e=>{errors=e.message;});
  child.on('close',()=>{closed=true;clearTimeout(timeout);signal.removeEventListener('abort',abort);if(!ready)rejectReady(new Error(errors||'The Windows file helper could not start.'));if(code!==undefined)resolve(code);else if(!committed)resolve(-1);else reject(new Error('The Windows move result is unconfirmed. Inspect the saved operation before retrying.'));});
 });void finished.catch(()=>{});
 try{await started;signal.throwIfAborted();}catch(error){abort();await finished.catch(()=>{});throw error;}
 return {close:async()=>{child.stdin.end();await finished.catch(()=>{});},commit:async(source:string,destination:string)=>{signal.throwIfAborted();if(committed)throw new Error('This file helper already received an operation.');committed=true;child.stdin.end(JSON.stringify({source:path.toNamespacedPath(source),destination:path.toNamespacedPath(destination)})+'\n');const result=await finished;if(result!==0)throw new Error(result===80||result===183?'The destination already exists. Nothing was replaced.':result===5?'Windows denied the move. Close programs using this item and retry.':`Windows could not move this item (error ${result}).`);}};
}
