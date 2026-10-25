import {randomUUID} from 'node:crypto';
import {draftPreviewId} from './agent-draft-preview-contracts';
import {creationOAuthScope,mcpOAuthScopeKey,type McpOAuthScope} from './mcp-oauth-scope';
type Identity={owner:string;creationId:string;revision:number;connectionId:string;operationId:string};
type Choice={mode:'connect'|'resume';clientId?:string;clientMetadataUrl?:string};
type Entry={scope:McpOAuthScope;choice:Choice;controller:AbortController;state:'reserved'|'running'|'completed'|'cancelled'|'failed';work?:Promise<{connected:boolean}>};
/** A browser action can start only from an issued owned reservation. Cancelling a
 * reservation before Start arrives prevents a delayed IPC call opening a browser. */
export class CreationSetupOperations{
 private entries=new Map<string,Entry>();
 reserve(scope:McpOAuthScope,choice:Choice){if(!creationOAuthScope(scope))throw Error('Choose an owned creation connection.');mcpOAuthScopeKey(scope);if(this.entries.size>=256)for(const[id,entry]of this.entries){if(entry.state!=='running'){this.entries.delete(id);break;}}if(this.entries.size>=256)throw Error('Finish a pending connection setup before starting another.');const operationId=randomUUID();this.entries.set(operationId,{scope:structuredClone(scope),choice:structuredClone(choice),controller:new AbortController(),state:'reserved'});return {operationId};}
 private entry(id:Identity){if(draftPreviewId(id.operationId)!==id.operationId)throw Error('Choose the current connection setup.');const entry=this.entries.get(id.operationId);if(!entry||!creationOAuthScope(entry.scope)||entry.scope.owner!==id.owner||entry.scope.creation.creationId!==id.creationId||entry.scope.creation.revision!==id.revision||entry.scope.connection!==id.connectionId)throw Error('This connection setup expired or belongs to another creation. Choose Connect again.');return entry;}
 async start(id:Identity,work:(scope:McpOAuthScope,choice:Choice,signal:AbortSignal)=>Promise<{connected:boolean}>){const entry=this.entry(id);if(entry.work)return entry.work;if(entry.state!=='reserved'||entry.controller.signal.aborted)throw Error('MCP sign-in cancelled. Choose Connect to start again.');entry.state='running';const promise=Promise.resolve().then(()=>{entry.controller.signal.throwIfAborted();return work(structuredClone(entry.scope),structuredClone(entry.choice),entry.controller.signal);});entry.work=promise;try{const result=await promise;entry.state='completed';return result;}catch(error){entry.state=entry.controller.signal.aborted?'cancelled':'failed';throw error;}}
 async cancel(id:Identity){const entry=this.entry(id);entry.controller.abort(Error('MCP sign-in cancelled.'));if(entry.state==='reserved')entry.state='cancelled';await entry.work?.catch(()=>{});return {state:entry.state};}
}
