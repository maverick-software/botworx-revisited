/** Coordinates a goal's temporary yield without taking ownership of user work.
 * Accepted messages remain in ChatQueue; this class only waits for their saved
 * outcomes. Restart recovery still requires an explicit user resume.
 */
export class GoalQueue {
 private waiting=new Map<string,string>();
 private listeners=new Map<string,Set<()=>void>>();
 private settling=new Map<string,number>();
 private failures=new Map<string,string>();
 private cancelled=new Set<string>();
 private yields=new Map<string,Promise<void>>();
 private key(owner:string,conversation:string){return owner+':'+conversation;}
 isWaiting(goal:string){return this.waiting.has(goal);}
 isSettling(owner:string,conversation:string){return !!this.settling.get(this.key(owner,conversation));}
 reset(goal:string){this.cancelled.delete(goal);}
 cancel(goal:string){this.cancelled.add(goal);this.changed();}
 changed(owner?:string,conversation?:string){for(const [key,callbacks] of this.listeners)if(!owner||(conversation?key===this.key(owner,conversation):key.startsWith(owner+':')))for(const callback of [...callbacks])callback();}
 async yieldOnce(request:string,work:()=>Promise<void>){const previous=this.yields.get(request);if(previous)return previous;const next=Promise.resolve().then(work);this.yields.set(request,next);try{await next;}finally{if(this.yields.get(request)===next)this.yields.delete(request);}}
 beginSettlement(owner:string,conversation:string){const key=this.key(owner,conversation);this.settling.set(key,(this.settling.get(key)??0)+1);}
 finishSettlement(owner:string,conversation:string,error?:string){const key=this.key(owner,conversation),remaining=(this.settling.get(key)??1)-1;if(remaining>0)this.settling.set(key,remaining);else this.settling.delete(key);if(error&&[...this.waiting.values()].includes(key))this.failures.set(key,error);this.changed(owner,conversation);}
 async drain(owner:string,conversation:string,goal:string,valid:()=>boolean|Promise<boolean>,idle:()=>boolean,pump:()=>void):Promise<boolean>{
  const key=this.key(owner,conversation);this.waiting.set(goal,key);this.failures.delete(key);
  try{return await new Promise<boolean>((resolve,reject)=>{
   const callbacks=this.listeners.get(key)??new Set();this.listeners.set(key,callbacks);
   let checking=false,again=false,finished=false;
   const finish=(result:boolean,error?:string)=>{if(finished)return;finished=true;callbacks.delete(check);if(!callbacks.size)this.listeners.delete(key);if(error)reject(new Error(error));else resolve(result);};
   const check=()=>{if(finished)return;if(checking){again=true;return;}checking=true;void(async()=>{do{again=false;const allowed=!this.cancelled.has(goal)&&await valid();if(finished)return;if(this.cancelled.has(goal)||!allowed)finish(false);else if(this.failures.has(key))finish(false,this.failures.get(key));else if(!this.isSettling(owner,conversation)&&idle())finish(true);}while(again&&!finished);})().catch(error=>finish(false,(error as Error).message)).finally(()=>{checking=false;if(again&&!finished)check();});};
   callbacks.add(check);check();try{pump();}catch(error){finish(false,(error as Error).message);}
  });}finally{this.waiting.delete(goal);this.failures.delete(key);}
 }
}
