/** Structural port implemented by the account-owned Connect service adapter. */
export type ComposioServiceDescriptor={name:string;description?:string;inputSchema:Record<string,unknown>;outputSchema?:Record<string,unknown>;annotations?:Record<string,unknown>};
export interface ComposioServiceRuntime{
 status(owner:string,slugs:string[],signal:AbortSignal):Promise<Array<{slug:string;name:string;status:string;connected:boolean}>>;
 inventory(owner:string,slug:string,lookup:{query?:string;tool?:string},signal:AbortSignal):Promise<ComposioServiceDescriptor[]>;
 execute(owner:string,slug:string,descriptor:ComposioServiceDescriptor,args:Record<string,unknown>,signal:AbortSignal,validate?:()=>Promise<void>):Promise<any>;
 fingerprint(owner:string,slug:string,signal:AbortSignal):Promise<string>;
}
