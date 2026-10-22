import {spawn} from 'node:child_process';
import {StringDecoder} from 'node:string_decoder';
import path from 'node:path';
export {commandEnvironment} from './execution-environment';
import {commandScriptEnvironment,prepareCommandRuntimes,commandShellForScript} from './script-runtimes';
const credentials=/(?:(?:sk-(?:or-v1-|proj-)?)[A-Za-z0-9_-]{20,}|sb_secret_[A-Za-z0-9_-]{16,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[ps]_[A-Za-z0-9]{30,})/g;
export function redactCredentialText(text:string){return text.replace(credentials,'[credential redacted]');}
export function redactCommandOutput(text:string){return redactCredentialText(text).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g,'');}
export function validateCommand(value:unknown,timeout:unknown){if(typeof value!=='string'||!value.trim()||value.length>16000||value.includes('\0'))throw new Error('Enter a PowerShell command with up to 16,000 characters.');credentials.lastIndex=0;if(credentials.test(value))throw new Error('Do not put credentials directly in commands. Use a separately authorized credential connection.');if(!Number.isInteger(timeout)||Number(timeout)<1000||Number(timeout)>300000)throw new Error('Choose a command time limit from 1 to 300 seconds.');return {command:value,timeoutMs:Number(timeout)};}
const clip=(text:string,limit:number)=>text.slice(0,limit).replace(/[\uD800-\uDBFF]$/,'');
export type CommandResult={stdout:string;stderr:string;exitCode:number|null;status:'completed'|'failed'|'cancelled'|'timed_out';truncated:boolean};
export async function runCommand(script:string,command:string,cwd:string,timeoutMs:number,signal:AbortSignal,progress:(value:CommandResult)=>void=()=>{},started?:(pid:number)=>void):Promise<CommandResult>{
 signal.throwIfAborted();validateCommand(command,timeoutMs);await prepareCommandRuntimes(script,signal);signal.throwIfAborted();
 const executable=path.join(process.env.SystemRoot??'C:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
 return new Promise((resolve,reject)=>{
  const child=spawn(executable,['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script],{windowsHide:true,stdio:['pipe','pipe','pipe'],env:commandScriptEnvironment(script),cwd});
  let line='',stdout='',stderr='',exitCode:number|null=null,reported=false,truncated=false,timedOut=false,failed=false,closed=false,totalOutput=0;
  const out=new StringDecoder('utf8'),err=new StringDecoder('utf8');
  const snapshot=():CommandResult=>({stdout:redactCommandOutput(stdout),stderr:redactCommandOutput(stderr),exitCode,status:signal.aborted?'cancelled':timedOut?'timed_out':failed||!reported||exitCode!==0?'failed':'completed',truncated});
  const append=(kind:string,value:string)=>{totalOutput+=value.length;if(totalOutput>1000000&&!failed){failed=true;truncated=true;stderr+='\nCommand stopped after exceeding its output limit.';child.kill();}const cap=kind==='O'?100000:50000,old=kind==='O'?stdout:stderr,next=old+value;if(next.length>cap)truncated=true;if(kind==='O')stdout=clip(next,cap);else stderr=clip(next,cap);progress(snapshot());};
  const abort=()=>{if(!closed)child.kill();};signal.addEventListener('abort',abort,{once:true});
  const deadline=setTimeout(()=>{timedOut=true;abort();},timeoutMs+10000);
  child.stdout.on('data',chunk=>{line+=chunk.toString('ascii');let newline;while((newline=line.indexOf('\n'))>=0){const event=line.slice(0,newline).trim();line=line.slice(newline+1);const kind=event[0],bytes=Buffer.from(event.slice(2),'base64');if(kind==='O'||kind==='E')append(kind,(kind==='O'?out:err).write(bytes));else if(kind==='S')started?.(Number(bytes.toString()));else if(kind==='R'){exitCode=Number(bytes.toString());reported=true;}else if(kind==='T')timedOut=true;else if(kind==='F'){failed=true;append('E',bytes.toString('utf8'));}}if(line.length>30000){failed=true;abort();}});
  child.stderr.on('data',chunk=>append('E',err.write(chunk)));
  child.on('error',error=>{failed=true;append('E',error.message);});
  child.on('close',()=>{closed=true;clearTimeout(deadline);signal.removeEventListener('abort',abort);stdout=clip(stdout+out.end(),100000);stderr=clip(stderr+err.end(),50000);resolve(snapshot());});
  // This pipe is a lease: keep it open until the supervisor has exited.
  child.stdin.on('error',()=>{});child.stdin.write(JSON.stringify({command,cwd,timeoutMs,executable:commandShellForScript(script)})+'\n');if(signal.aborted)abort();
 });
}
