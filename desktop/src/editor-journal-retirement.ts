import {draftPreviewId} from './agent-draft-preview-contracts';
import {editorDraftScope} from './agent-editor-draft-contracts';

export const editorRetirementKind='agentopia-editor-draft-retirement';
export type EditorRetirementTombstone={revision:number;writeId:string};
export type EditorRetirement={version:1;kind:typeof editorRetirementKind;owner:string;key:string;scope:string|null;operationId:string;archiveId:number;keys:string[];inputs:number[];discarded:{id:number;sha256:string}[];tombstone:EditorRetirementTombstone|null};
export type EditorRetirementInput={owner:string;key:string;operationId:string;copies:number[];expectedRevision:number|null;main?:{key:string;raw:string}};
const positive=(value:unknown):value is number=>Number.isSafeInteger(value)&&(value as number)>0;
const canonicalId=(value:unknown)=>typeof value==='string'&&draftPreviewId(value)===value;
export function editorRetirementLocation(key:string,owner:string):{scope:string|null;kind:'journal'|'legacy'}{
 if(!canonicalId(owner)||typeof key!=='string'||key.length>512||key.includes('\0'))throw Error('Choose an owned draft recovery location.');
 const prefixes=['agentopia.editor-draft.'+owner+':','agentopia.preview.'+owner+':'],index=prefixes.findIndex(prefix=>key.startsWith(prefix));if(index<0)throw Error('This recovery copy belongs to another account.');
 let scope:string|null=null;try{scope=editorDraftScope((index?'preview:':'')+key.slice(prefixes[index].length));}catch{}return {scope,kind:index?'legacy':'journal'};
}
export function editorRetirementKeys(owner:string,key:string){const {scope}=editorRetirementLocation(key,owner);return [...new Set([key,...(scope?['agentopia.editor-draft.'+owner+':'+scope,...(scope.startsWith('preview:')?['agentopia.preview.'+owner+':'+scope.slice(8)]:[])]:[])])].sort();}
/** Invalid retirement-looking text stays opaque; it never suppresses recovery.
 * The inventory separately verifies every receipt against its sealed originals. */
export function editorRetirement(raw:string,owner?:string,key?:string):EditorRetirement|null{
 try{if(raw.length>16000000)return null;const row=JSON.parse(raw);if(!row||Object.keys(row).sort().join(',')!=='archiveId,discarded,inputs,key,keys,kind,operationId,owner,scope,tombstone,version'||row.version!==1||row.kind!==editorRetirementKind||!canonicalId(row.owner)||!canonicalId(row.operationId)||owner!==undefined&&row.owner!==owner||key!==undefined&&row.key!==key||!positive(row.archiveId))return null;
  const binding=editorRetirementLocation(row.key,row.owner);if(binding.scope!==row.scope||!Array.isArray(row.keys)||!row.keys.length||row.keys.length>10000||!row.keys.includes(row.key)||new Set(row.keys).size!==row.keys.length||JSON.stringify([...row.keys].sort())!==JSON.stringify(row.keys))return null;
  for(const location of row.keys){const next=editorRetirementLocation(location,row.owner);if(next.scope!==row.scope||row.scope===null&&location!==row.key)return null;}
  if(!Array.isArray(row.inputs)||!row.inputs.length||row.inputs.length>10000||row.inputs.some((id:unknown)=>!positive(id)||id>=row.archiveId)||new Set(row.inputs).size!==row.inputs.length||JSON.stringify([...row.inputs].sort((a:number,b:number)=>a-b))!==JSON.stringify(row.inputs))return null;
  if(!Array.isArray(row.discarded)||row.discarded.length>10000)return null;const ids=new Set<number>();for(const copy of row.discarded){if(!copy||Object.keys(copy).sort().join(',')!=='id,sha256'||!positive(copy.id)||!row.inputs.includes(copy.id)||ids.has(copy.id)||typeof copy.sha256!=='string'||!/^[a-f0-9]{64}$/.test(copy.sha256))return null;ids.add(copy.id);}
  if(row.scope===null){if(row.tombstone!==null)return null;}else{const tombstone=row.tombstone;if(!tombstone||Object.keys(tombstone).sort().join(',')!=='revision,writeId'||!positive(tombstone.revision)||tombstone.writeId!==row.operationId)return null;}
  return row as EditorRetirement;
 }catch{return null;}
}
export async function verifyEditorRetirement(raw:string,owner:string,key:string,read:(id:number)=>Promise<{id:number;key:string;raw:string}>){const marker=editorRetirement(raw,owner,key);if(!marker)return null;const copy=await read(marker.archiveId);if(copy.id!==marker.archiveId||copy.key!==key||copy.raw!==raw)throw Error('The draft retirement receipt could not be verified. Keep the local copy for recovery.');return marker;}
export function checkEditorRetirementMain(marker:EditorRetirement,current:{revision:number;writeId:string;payload:string|null}|null){const expected=marker.tombstone;if(!expected||!current||current.revision<expected.revision||current.revision===expected.revision&&(current.writeId!==expected.writeId||current.payload!==null))throw Error('The retired location does not match the saved draft revision. Preserve both copies before recovery.');}
