export type AgentJob={id:string;owner:string;agentId:string;instanceId?:string;authorityInstances?:string[];authorityAgents?:string[];goalIds?:string[];run:()=>Promise<void>;interrupted:(reason:string)=>Promise<void>};
/** Scheduling only: inference and tools remain owned by the existing native runtime. */
export class AgentQueue{
 private pending=new Map<string,AgentJob>();private active=new Map<string,{job:AgentJob;done:Promise<void>}>();private pumping=false;private timer?:NodeJS.Timeout;private closed=false;private failures=new Map<string,{owner:string;message:string}>();
 constructor(private available:()=>boolean,private parallel=6){}
 get size(){return this.pending.size+this.active.size;}
 get busy(){return this.active.size>0||this.pumping;}
 has(id:string){return this.pending.has(id)||this.active.has(id);}
 failure(owner:string){return [...this.failures.values()].filter(value=>value.owner===owner).at(-1)?.message;}
 enqueue(job:AgentJob){if(this.closed)throw new Error('The named-agent queue is closed.');if(this.has(job.id))return;this.pending.set(job.id,job);this.notify();}
 notify(){if(!this.closed)queueMicrotask(()=>this.pump());}
 private pump(){
  if(this.pumping||this.closed)return;this.pumping=true;
  try{for(const [id,job] of this.pending){if(this.active.size>=this.parallel||!this.available())break;this.pending.delete(id);
   let execution:Promise<void>;try{execution=job.run();}catch(error){execution=Promise.reject(error);}
   const done=execution.catch(error=>job.interrupted((error as Error).message)).catch(error=>{this.failures.set(id,{owner:job.owner,message:(error as Error).message});if(this.failures.size>100)this.failures.delete(this.failures.keys().next().value!);}).finally(()=>{this.active.delete(id);this.notify();});this.active.set(id,{job,done});
  }}finally{this.pumping=false;}
  if(this.pending.size&&!this.timer){this.timer=setTimeout(()=>{this.timer=undefined;this.notify();},1000);this.timer.unref();}
 }
 async cancelQueued(id:string,reason='Cancelled by you.'){const job=this.pending.get(id);if(!job)return false;this.pending.delete(id);await job.interrupted(reason);return true;}
 async interruptWhere(predicate:(job:AgentJob)=>boolean,reason:string){let count=0;for(const [id,job] of [...this.pending])if(predicate(job)){this.pending.delete(id);count++;await job.interrupted(reason);}return count;}
 async close(){this.closed=true;if(this.timer)clearTimeout(this.timer);await this.interruptWhere(()=>true,'Agentopia closed before this assignment started. Resume explicitly after reviewing its saved state.');}
 async settled(){await Promise.all([...this.active.values()].map(value=>value.done));}
}
