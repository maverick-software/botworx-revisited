import {spawn,type ChildProcessWithoutNullStreams} from 'node:child_process';
import {createInterface} from 'node:readline';
import {maxNativeRequestBytes} from './image-limits';
import type {ClientRequest} from './codex-protocol/ClientRequest';
import type {ServerRequest} from './codex-protocol/ServerRequest';

export const CODEX_VERSION='0.163.0';
type Method=ClientRequest['method'];
type Params<M extends Method>=Extract<ClientRequest,{method:M}>['params'];
/** Private, bidirectional app-server transport. Never expose arbitrary RPC to the renderer. */
export class CodexClient {
 private child:ChildProcessWithoutNullStreams;
 private exited:Promise<void>;private finishExit!:()=>void;
 private sequence=0;private stopped=false;
 private pending=new Map<number,{resolve:(value:any)=>void;reject:(error:Error)=>void;timer:NodeJS.Timeout}>();
 onEvent:(method:string,params:any)=>void=()=>{};
 onRequest:(request:ServerRequest)=>Promise<unknown>=async()=>{throw new Error('This native request is unsupported.');};
 onExit:(error:Error)=>void=()=>{};
 constructor(executable:string,args:string[],env:NodeJS.ProcessEnv,cwd:string){
  this.exited=new Promise(resolve=>{this.finishExit=resolve;});
  this.child=spawn(executable,['app-server','--listen','stdio://',...args],{env,cwd,windowsHide:true,stdio:['pipe','pipe','pipe']});
  this.child.stdin.on('error',()=>{}); // A runtime exit is reported through onExit and pending RPC failures.
  const lines=createInterface({input:this.child.stdout,crlfDelay:Infinity});
  lines.on('line',line=>{if(Buffer.byteLength(line)>maxNativeRequestBytes){this.close();return;}let value:any;try{value=JSON.parse(line);}catch{return;}
   if(value.method&&value.id!==undefined){void this.onRequest(value).then(result=>this.write({id:value.id,result}),()=>this.write({id:value.id,error:{code:-32000,message:'Sylvana could not authorize this request.'}}));}
   else if(value.method){this.onEvent(value.method,value.params);}
   else {const request=this.pending.get(value.id);if(!request)return;this.pending.delete(value.id);clearTimeout(request.timer);if(value.error)request.reject(new Error(String(value.error.message??'Codex request failed.').slice(0,1500)));else request.resolve(value.result);}
  });
  // Runtime diagnostics can contain private prompts and paths. Do not log stderr.
  this.child.stderr.resume();
  let terminated=false;const ended=()=>{if(terminated)return;terminated=true;this.finishExit();const error=new Error('The Codex runtime stopped. Your saved conversation can be resumed.');for(const item of this.pending.values()){clearTimeout(item.timer);item.reject(error);}this.pending.clear();if(!this.stopped)this.onExit(error);};
  this.child.once('error',ended);this.child.once('exit',ended);
 }
 private write(value:unknown){if(!this.stopped&&!this.child.stdin.destroyed)this.child.stdin.write(JSON.stringify(value)+'\n');}
 request<M extends Method>(method:M,params:Params<M>,timeout=60000):Promise<any>{if(this.stopped)return Promise.reject(new Error('The Codex runtime is closed.'));const id=++this.sequence;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error(`Codex ${method} timed out.`));},timeout);this.pending.set(id,{resolve,reject,timer});this.write({id,method,params});});}
 async initialize(){const result=await this.request('initialize',{clientInfo:{name:'sylvana',title:'Sylvana',version:'0.31.0'},capabilities:{experimentalApi:true,requestAttestation:false}});this.write({method:'initialized'});return result;}
 async close(){if(this.stopped)return this.exited;this.stopped=true;this.child.stdin.end();for(const item of this.pending.values()){clearTimeout(item.timer);item.reject(new Error('The Codex runtime closed.'));}this.pending.clear();const timer=setTimeout(()=>this.child.kill(),3000);timer.unref();try{await this.exited;}finally{clearTimeout(timer);}}
}
