import type {Secrets} from './secrets';
import {editorDraftScope,editorDraftWrite,editorDraftPayload,editorDraftRecord,editorDraftRecords,type EditorDraftRecord} from './agent-editor-draft-contracts';

/** One serialized encrypted-store transaction; no agent definition or execution
 * record is created by saving a draft. Tombstones prevent stale resurrection. */
export class AgentEditorDrafts{
 private tail:Promise<unknown>=Promise.resolve();private operations=0;
 constructor(private secrets:Pick<Secrets,'get'|'set'>){}
 get busy(){return this.operations>0;}
 async read(owner:string,scope:unknown){await this.tail;return editorDraftRecords(this.secrets.get('agent-editor-drafts:'+owner)??{},owner)[editorDraftScope(scope)]??null;}
 async list(owner:string){await this.tail;return editorDraftRecords(this.secrets.get('agent-editor-drafts:'+owner)??{},owner);}
 write(owner:string,value:unknown,guard:()=>Promise<void>){const input=editorDraftWrite(value);editorDraftPayload(owner,input.scope,input.payload);this.operations++;
  const task=this.tail.catch(()=>{}).then(async()=>{await guard();const key='agent-editor-drafts:'+owner,rows=editorDraftRecords(this.secrets.get(key)??{},owner),old=rows[input.scope];
   if(old?.writeId===input.writeId){if(old.revision!==input.expectedRevision+1||old.payload!==input.payload)throw Error('The saved draft write identity was reused with different content.');return editorDraftRecord(old,owner,input.scope);}
   if((old?.revision??0)!==input.expectedRevision)throw Error('This draft changed while it was being saved. Reopen its saved state before replacing it.');
   const next:EditorDraftRecord={version:1,owner,scope:input.scope,revision:input.expectedRevision+1,writeId:input.writeId,payload:input.payload,updatedAt:new Date().toISOString()};rows[input.scope]=next;editorDraftRecords(rows,owner);await guard();await this.secrets.set(key,rows);return structuredClone(next);
  });this.tail=task.catch(()=>{});void task.finally(()=>{this.operations--;}).catch(()=>{});return task;
 }
 flush(){return this.tail;}
}
