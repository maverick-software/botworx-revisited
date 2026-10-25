import {draftPreviewId} from './agent-draft-preview-contracts';
import type {CreationToolScope} from './creation-tool-scope';

/** A revision-bound creation identity. It never names or impersonates an agent. */
export type CreationResourcePrincipal={kind:'creation';id:string;creationId:string;revision:number};
export type RemotePrincipal=string|CreationResourcePrincipal;
export function creationResourcePrincipal(value:unknown):CreationResourcePrincipal{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Choose an owned creation resource identity.');
 const v=value as Record<string,unknown>;
 if(Object.keys(v).some(key=>!['kind','id','creationId','revision'].includes(key))||v.kind!=='creation'||!Number.isSafeInteger(v.revision)||Number(v.revision)<1)throw Error('Choose an owned creation resource identity.');
 const id=draftPreviewId(v.id),creationId=draftPreviewId(v.creationId);
 if(id!==v.id||creationId!==v.creationId)throw Error('Refresh the canonical creation resource identity.');
 return {kind:'creation',id,creationId,revision:Number(v.revision)};
}
export function creationPrincipal(scope:CreationToolScope):CreationResourcePrincipal{
 if(scope.boundAgentId)throw Error('This creation already saved an agent. Open its saved settings.');
 return creationResourcePrincipal({kind:'creation',id:scope.id,creationId:scope.creationId,revision:scope.revision});
}
export function savedRemoteAgent(value:RemotePrincipal):string{
 if(typeof value!=='string')throw Error('This service requires an explicitly assigned saved-agent connection.');
 return value;
}
