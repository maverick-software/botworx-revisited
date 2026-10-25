import {creationRetireInput,creationRetirement,type CreationRetirement} from './creation-retirement';
import type {SupabaseClient} from '@supabase/supabase-js';
import {creationToolScope,creationToolWrite,type CreationToolScope} from './creation-tool-scope';
import {draftPreviewId} from './agent-draft-preview-contracts';
import {Plugins} from './plugins';
import type {CreationPluginGrant} from './creation-tool-scope';
const data=(result:any)=>{if(result.error)throw Error(result.error.message);return result.data;};
/** The principal is a creation, never a placeholder saved agent. Payloads contain
 * reviewed plugin identities only; credentials and transport grants are separate. */
export class CreationToolResources{
 constructor(private db:SupabaseClient){}
 async retirement(owner:string,creationId:string):Promise<CreationRetirement|null>{owner=draftPreviewId(owner);creationId=draftPreviewId(creationId);const row=data(await this.db.rpc('desktop_creation_retirement',{p_user:owner,p_creation:creationId}));return row===null?null:creationRetirement(row,owner,creationId);}
 async active(owner:string,creationId:string){if(await this.retirement(owner,creationId))throw Error('This creation was discarded. Recover its fields into a new creation to continue.');}
 async retire(owner:string,value:unknown){owner=draftPreviewId(owner);const input=creationRetireInput(value),row=data(await this.db.rpc('desktop_retire_creation',{p_user:owner,p_creation:input.creationId,p_revision:input.expectedRevision,p_write:input.writeId}));return creationRetirement(row,owner,input.creationId);}
 async validate(owner:string,grants:CreationPluginGrant[]){for(const grant of grants){const row=await new Plugins(this.db).reviewed(owner,grant.name);if(!row.enabled||row.digest!==grant.digest||row.source==='legacy')throw Error('An app was disabled, removed or changed. Refresh its reviewed selection.');}}
 async read(owner:string,creationId:string):Promise<CreationToolScope|null>{owner=draftPreviewId(owner);creationId=draftPreviewId(creationId);const row=data(await this.db.rpc('desktop_creation_tool_scope',{p_user:owner,p_creation:creationId}));return row===null?null:creationToolScope(row,owner,creationId);}
 async write(owner:string,value:unknown){owner=draftPreviewId(owner);const input=creationToolWrite(value);await this.active(owner,input.creationId);const old=await this.read(owner,input.creationId);if(old?.writeId!==input.writeId)await this.validate(owner,input.grants);const row=data(await this.db.rpc('desktop_write_creation_tool_scope',{p_user:owner,p_creation:input.creationId,p_revision:input.expectedRevision,p_write:input.writeId,p_grants:input.grants}));return creationToolScope(row,owner,input.creationId);}
}
