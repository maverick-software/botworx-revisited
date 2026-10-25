import type {AgentDraftBehavior} from './agent-draft-preview-contracts';
import {draftPreviewId} from './agent-draft-preview-contracts';

/** Passive editing state accepts unfinished fields; execution and Save use the
 * stricter shared behavior validator. Never trim or repair retained text. */
export function agentBehaviorDraft(value:unknown):AgentDraftBehavior{
 const object=(v:unknown,allowed:string[])=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(key=>!allowed.includes(key)))throw Error('The behavior draft has unsupported fields.');return v as Record<string,any>;};
 const text=(v:unknown,max:number)=>{if(typeof v!=='string'||v.length>max||v.includes('\0'))throw Error('The behavior draft has an invalid text field.');};
 const v=object(value,['handle','role','sops','guardrails','skills','policy']);for(const[key,max]of Object.entries({handle:64,role:1000,sops:50000,guardrails:20000}))text(v[key],max);
 if(!Array.isArray(v.skills)||v.skills.length>30)throw Error('The behavior draft has too many skills.');const ids=new Set();for(const raw of v.skills){const row=object(raw,['id','name','description','content']);draftPreviewId(row.id);if(ids.has(row.id))throw Error('The behavior draft has duplicate skills.');ids.add(row.id);for(const[key,max]of Object.entries({name:100,description:1000,content:50000}))text(row[key],max);}
 const p=object(v.policy,['tools','delegation','delegateAgents','memory','memoryWrite','maxDepth','maxTurns']);for(const key of ['tools','delegateAgents'])if(p[key]!==null){if(!Array.isArray(p[key])||p[key].length>1000)throw Error('The behavior draft has too many policy selections.');for(const row of p[key]){text(row,200);if(key==='delegateAgents')draftPreviewId(row);}}
 for(const key of ['delegation','memory','memoryWrite'])if(typeof p[key]!=='boolean')throw Error('The behavior draft has an invalid switch.');for(const key of ['maxDepth','maxTurns'])if(!Number.isSafeInteger(p[key]))throw Error('The behavior draft has an invalid limit.');
 return structuredClone(value) as AgentDraftBehavior;
}
