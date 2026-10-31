/** Preserve the original failure when cleanup subsequently aborts the transport. */
export class NativeExecutionFailure extends Error {
 constructor(error:unknown){super(error instanceof Error?error.message:String(error),{cause:error});this.name='NativeExecutionFailure';}
}
export function preserveNativeFailure(error:unknown,signal:AbortSignal):unknown{
 return signal.aborted||error instanceof Error&&error.name==='AbortError'?error:new NativeExecutionFailure(error);
}
export function nativeExecutionCancelled(error:unknown,signal:AbortSignal):boolean{
 return !(error instanceof NativeExecutionFailure)&&(signal.aborted||error instanceof Error&&error.name==='AbortError');
}
