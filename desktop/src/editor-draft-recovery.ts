import {agentCreationDraft,type AgentCreationDraft} from './agent-creation-draft';
import {agentSavedEditorDraft,type AgentSavedEditorDraft} from './agent-saved-editor-draft';
import {editorDraftPayload,editorDraftScope} from './agent-editor-draft-contracts';

/** Recovery checks types and ownership using a bounded validation shadow.
 * Only editable text is shortened in that shadow. The returned data is the
 * original, unmodified draft; normal storage and Save validation stay strict. */
function shadow(value:unknown){const original=structuredClone(value),copy=structuredClone(value) as any;
 const field=(parent:any,key:string,max:number)=>{if(parent&&typeof parent[key]==='string'){if(parent[key].length>8000000)throw Error('This recovery text exceeds the editing limit. Copy it before replacing it.');parent[key]=parent[key].replace(/\0/g,'\ufffd').slice(0,max);}};
 const appearance=(value:any)=>{if(Array.isArray(value?.starters))for(const row of value.starters){field(row,'title',80);field(row,'prompt',2000);}};
 if(copy?.format==='agent-creation-1'){for(const[key,max]of Object.entries({name:100,description:4000,instructions:100000,model:1000}))field(copy,key,max);appearance(copy.appearance);
  for(const[key,max]of Object.entries({handle:64,role:1000,sops:50000,guardrails:20000}))field(copy.behavior,key,max);
  if(Array.isArray(copy.behavior?.skills))for(const row of copy.behavior.skills)for(const[key,max]of Object.entries({name:100,description:1000,content:50000}))field(row,key,max);
  if(Array.isArray(copy.behavior?.policy?.tools))copy.behavior.policy.tools=copy.behavior.policy.tools.map((value:unknown)=>typeof value==='string'?value.replace(/\0/g,'\ufffd').slice(0,200):value);
 }
 if(copy?.format==='agent-editor-1'){
  for(const[key,max]of Object.entries({name:100,description:4000,instructions:100000,model:1000}))field(copy.basic,key,max);
  for(const[key,max]of Object.entries({personality:8000,mbtiType:10,purpose:4000}))field(copy.identity,key,max);
  for(const[key,max]of Object.entries({handle:64,role:1000,sops:50000,guardrails:20000}))field(copy.profile,key,max);
  if(Array.isArray(copy.profile?.skills))for(const row of copy.profile.skills)for(const[key,max]of Object.entries({name:100,description:1000,content:50000}))field(row,key,max);
  if(Array.isArray(copy.profile?.policy?.tools))copy.profile.policy.tools=copy.profile.policy.tools.map((value:unknown)=>typeof value==='string'?value.replace(/\0/g,'\ufffd').slice(0,200):value);
  appearance(copy.presentation?.draft);field(copy.memory,'query',500);field(copy.memory?.editing,'title',200);field(copy.memory?.editing,'content',12000);
  for(const[key,max]of Object.entries({name:200,instructions:50000,cron:200,timezone:100}))field(copy.task,key,max);
 }
 return {original,copy};
}
export function recoverCreationDraft(value:unknown):AgentCreationDraft{const {original,copy}=shadow(value);agentCreationDraft(copy);return original as AgentCreationDraft;}
export function recoverSavedEditorDraft(value:unknown,owner?:string,source?:string):AgentSavedEditorDraft{const {original,copy}=shadow(value);agentSavedEditorDraft(copy,owner,source);return original as AgentSavedEditorDraft;}
export function editorRecoveryForm(raw:string,owner:string,source:string|null):unknown{if(raw.length>8000000)throw Error('The recovered draft exceeds its inspection limit.');const row=JSON.parse(raw);if(!row||row.version!==1||row.owner!==owner||row.source!==source||Object.keys(row).some(key=>!['version','owner','source','form'].includes(key))||!row.form||typeof row.form!=='object'||Array.isArray(row.form))throw Error('The retained copy belongs to another account or editor, or is unreadable.');return row.form;}
export function ownEditorRecoveryText(raw:string|null,owner:string,source:string|null){if(raw===null)return null;try{editorRecoveryForm(raw,owner,source);return raw;}catch{return null;}}

/** A selected recovery copy may exceed editable text limits. Validate a
 * shadow while returning the exact payload, never an execution request. */
export function recoverEditorPayload(raw:string|null,owner:string,scope:string){scope=editorDraftScope(scope);if(raw===null)return null;if(raw.length>8000000)throw Error('The recovered draft exceeds its editing limit. Export it before replacing it.');const [kind,id]=scope.split(':'),source=id==='new'?null:id;
 if(kind==='editor'){const form=editorRecoveryForm(raw,owner,source);if(source===null)recoverCreationDraft(form);else recoverSavedEditorDraft(form,owner,source);}
 else{const value=JSON.parse(raw);if(typeof value.prompt!=='string'||value.prompt.length>8000000)throw Error('The recovered preview has an invalid prompt.');editorDraftPayload(owner,scope,JSON.stringify({...value,prompt:value.prompt.slice(0,100000)}));}
 return raw;
}
