import {editorRetirement} from './editor-journal-retirement';
import {draftPreviewId} from "./agent-draft-preview-contracts";
import {editorDraftScope} from "./agent-editor-draft-contracts";
import {decodeEditorJournal,editorJournalIdentity} from "./editor-journal-codec";
import {recoverEditorPayload} from "./editor-draft-recovery";
export const journalRecoveryPrefixes=(owner:string)=>['agentopia.editor-draft.'+owner+':','agentopia.preview.'+owner+':'];
export type JournalRecoverySummary={id:number;key:string;scope:string|null;kind:'journal'|'legacy';characters:number;retired?:boolean};
export type JournalRecoveryPage={rows:JournalRecoverySummary[];total:number;nextBefore:number|null};
export type JournalRecoveryCopy=JournalRecoverySummary&{raw:string};
export function journalRecoveryScope(key:string,owner:string):{scope:string|null;kind:'journal'|'legacy'}{draftPreviewId(owner);const prefixes=journalRecoveryPrefixes(owner),kind=key.startsWith(prefixes[0])?'journal':key.startsWith(prefixes[1])?'legacy':null;if(kind===null)throw Error('This recovery copy belongs to another account.');const suffix=key.slice(prefixes[kind==='journal'?0:1].length);let scope:string|null=null;try{scope=editorDraftScope((kind==='legacy'?'preview:':'')+suffix);}catch{}return {scope,kind};}
function rejectForeign(payload:unknown,owner:string){if(typeof payload!=='string')return;let value:any;try{value=JSON.parse(payload);}catch{return;}if(value&&(typeof value.owner==='string'&&value.owner!==owner||typeof value.form?.profile?.user_id==='string'&&value.form.profile.user_id!==owner))throw Error('This retained copy declares a different account and cannot be opened or exported.');}
/** Scope comes from the captured original storage key. A readable declaration
 * of another owner, including a nested payload, always refuses exposure. */
export function ownJournalCopy(raw:string,owner:string,scope:string|null,kind:'journal'|'legacy'){
 if(kind==='legacy'){rejectForeign(raw,owner);return;}
 const identity=editorJournalIdentity(raw);if(identity&&identity.owner!==owner)throw Error('This retained copy declares a different account and cannot be opened or exported.');if(!scope)return;
 let journal;try{journal=decodeEditorJournal(raw,owner,scope);}catch{return;}for(const payload of [journal.value,journal.rejected,journal.base?.payload,journal.pending?.payload])rejectForeign(payload,owner);
}
export function journalCopyPayload(copy:JournalRecoveryCopy,owner:string){if(editorRetirement(copy.raw,owner,copy.key))throw Error('This location is retired. Choose an earlier retained version to recover its text.');const {scope,kind}=journalRecoveryScope(copy.key,owner);if(scope!==copy.scope||kind!==copy.kind||scope===null)throw Error('This recovery location cannot be reopened. Export its retained copy for inspection.');ownJournalCopy(copy.raw,owner,scope,kind);const row=kind==='legacy'?null:decodeEditorJournal(copy.raw,owner,scope),payload=row?(Object.hasOwn(row,'rejected')?row.rejected!:row.value):copy.raw;return recoverEditorPayload(payload,owner,scope);}

