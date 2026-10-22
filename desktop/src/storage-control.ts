// Closing waits for admitted Storage work, including its browser refresh, before
// asking the renderer to save drafts. Cleanup temporarily blocks those writes.
export class StorageControl {
 private pending=new Set<Promise<unknown>>();
 private closing=false;
 run<T>(work:()=>Promise<T>):Promise<T>{
  if(this.closing)throw Error('Agentopia is closing. Reopen it before changing Storage.');
  const operation=Promise.resolve().then(work);this.pending.add(operation);
  void operation.finally(()=>this.pending.delete(operation)).catch(()=>{});
  return operation;
 }
 async beforeClose(){this.closing=true;await Promise.allSettled([...this.pending]);}
 keepOpen(){this.closing=false;}
}
