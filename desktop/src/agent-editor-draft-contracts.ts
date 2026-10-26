import {agentSavedEditorDraft} from './agent-saved-editor-draft';
import {agentCreationDraft} from './agent-creation-draft';
import {selectedContextFiles} from './selected-context';
import {draftPreviewId,agentDraftPreviewInput,agentDraftExecution} from './agent-draft-preview-contracts';

export type EditorDraftRecord={version:1;owner:string;scope:string;revision:number;writeId:string;payload:string|null;updatedAt:string};
export type EditorDraftWrite={scope:string;expectedRevision:number;writeId:string;payload:string|null};
export type EditorDraftRecords=Record<string,EditorDraftRecord>;
const object=(value:unknown):Record<string,any>=>{if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid saved agent draft.');return value as Record<string,any>;};
const keys=(value:Record<string,any>,allowed:string[])=>{if(Object.keys(value).some(key=>!allowed.includes(key)))throw Error('Unsupported saved agent draft fields.');};
/** A receipt prevents automatic application of an already handled builder result. */
export function builderAppliedIds(value:unknown):string[]{
 if(!Array.isArray(value)||value.length>1000||new Set(value).size!==value.length)throw Error('The saved builder application receipts are invalid.');
 return value.map(id=>{if(draftPreviewId(id)!==id)throw Error('The saved builder application receipt is not canonical.');return id;});
}
export function editorDraftScope(value:unknown){const uuid='[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}';if(typeof value!=='string'||!new RegExp('^(?:(preview|builder|editor):(new|'+uuid+')|(?:preview|builder):new:'+uuid+')$','i').test(value))throw Error('Choose a valid agent draft location.');return value.toLowerCase();}
export function editorDraftLocation(value:unknown){const scope=editorDraftScope(value),[kind,id,creationId]=scope.split(':');return {scope,kind:kind as 'editor'|'preview'|'builder',source:id==='new'?null:id,creationId};}
export function previewEditorScope(source:string|null,creationId?:string,kind:'preview'|'builder'='preview'){if(source&&creationId)throw Error('A saved-agent preview cannot use a creation identity.');return editorDraftScope(kind+':'+(source??(creationId?'new:'+draftPreviewId(creationId):'new')));}
export function isEditorDraftTimestamp(value:unknown):value is string{if(typeof value!=='string'||!/^(?!0000)\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value))return false;const time=Date.parse(value);return Number.isFinite(time)&&new Date(time).toISOString()===value;}
/** Drafts are passive text. Incomplete form fields remain editable; execution
 * still uses the complete preview/agent validators at the normal Broker APIs. */
export function editorDraftPayload(owner:string,scope:string,value:unknown):string|null{
 draftPreviewId(owner);scope=editorDraftScope(scope);if(value===null)return null;
 if(typeof value!=='string'||value.length>4000000||value.includes('\0'))throw Error('The saved agent draft exceeds its text limit.');
 let parsed:Record<string,any>;try{parsed=object(JSON.parse(value));}catch{throw Error('The saved agent draft is not valid JSON.');}
 const {kind,source:expected,creationId}=editorDraftLocation(scope);if(parsed.version!==(creationId?2:1)||parsed.owner!==owner||parsed.source!==expected||parsed.creationId!==creationId)throw Error('The saved agent draft belongs to another account or editor.');
 if(kind==='preview'||kind==='builder'){
  keys(parsed,['version','owner','source','sessionId','prompt','thinking','execution','pending',...(kind==='builder'?['builderAppliedIds']:[]),...(creationId?['creationId']:[])]);draftPreviewId(parsed.sessionId);
  if(typeof parsed.prompt!=='string'||parsed.prompt.length>100000||!['default','none','minimal','low','medium','high','xhigh','max','ultra'].includes(parsed.thinking))throw Error('The saved preview composer is invalid.');
  if(parsed.builderAppliedIds!==undefined)builderAppliedIds(parsed.builderAppliedIds);
  const execution=agentDraftExecution(parsed.execution);selectedContextFiles(execution.sources,owner,'ask');
  if(parsed.pending){const input=agentDraftPreviewInput(parsed.pending);if(input.sessionId!==parsed.sessionId||input.sourceAgentId!==expected||input.creationId!==creationId)throw Error('The saved preview request changed scope.');}
 }else{keys(parsed,['version','owner','source','form']);const form=object(parsed.form);if(form.format==='agent-editor-1'){if(expected===null)throw Error('Choose a saved agent for this draft.');agentSavedEditorDraft(form,owner,expected);}else if(form.format!==undefined){if(expected!==null)throw Error('Choose a new-agent editor for this draft.');agentCreationDraft(form);}}
 return value;
}
export function editorDraftWrite(value:unknown):EditorDraftWrite{const v=object(value);keys(v,['scope','expectedRevision','writeId','payload']);if(!Number.isSafeInteger(v.expectedRevision)||v.expectedRevision<0)throw Error('Refresh the saved draft revision.');return {scope:editorDraftScope(v.scope),expectedRevision:v.expectedRevision,writeId:draftPreviewId(v.writeId),payload:v.payload};}
export function editorDraftRecord(value:unknown,owner?:string,scope?:string):EditorDraftRecord{const v=object(value);keys(v,['version','owner','scope','revision','writeId','payload','updatedAt']);const actualOwner=draftPreviewId(v.owner),actualScope=editorDraftScope(v.scope);if(v.version!==1||v.owner!==actualOwner||v.scope!==actualScope||owner!==undefined&&owner!==actualOwner||scope!==undefined&&scope!==actualScope||!Number.isSafeInteger(v.revision)||v.revision<1||!isEditorDraftTimestamp(v.updatedAt))throw Error('The saved agent draft has an invalid account, editor, revision or UTC timestamp.');editorDraftPayload(actualOwner,actualScope,v.payload);draftPreviewId(v.writeId);return structuredClone(v) as EditorDraftRecord;}
export function editorDraftRecords(value:unknown,owner?:string):EditorDraftRecords{const rows=object(value);if(JSON.stringify(rows).length>8000000)throw Error('Draft text or retained revision history has reached its storage limit. Export recovery copies before keeping more work.');let active=0;for(const[scope,row]of Object.entries(rows)){if(editorDraftScope(scope)!==scope)throw Error('A saved draft map key is not canonical. Preserve the existing copy before recovery.');editorDraftRecord(row,owner,scope);if(row.payload!==null&&++active>100)throw Error('Keep up to 100 active editor and preview drafts. Save or clear one before keeping another.');}return structuredClone(rows);}
