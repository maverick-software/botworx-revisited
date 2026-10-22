let pending:Promise<unknown>=Promise.resolve();
/** Folder operations and file writes share one order, including writes through other references. */
export function mutateWorkspace<T>(task:()=>Promise<T>):Promise<T>{const operation=pending.catch(()=>{}).then(task);pending=operation.catch(()=>{});return operation;}
