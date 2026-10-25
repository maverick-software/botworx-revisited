import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const once=(text,from,to)=>{assert.equal(text.split(from).length,2,'Expected one edit: '+from.slice(0,100));return text.replace(from,to);};
let editor=await readFile('desktop/ui/AgentDefinitionEditor.tsx','utf8');
const start=editor.indexOf('  <label>Mention handle'),end=editor.indexOf('  {notice&&',start);assert(start>0&&end>start);
const fields=editor.slice(start,end).replaceAll('profile.','value.').replaceAll(",sha256:''",'');
await writeFile('desktop/ui/AgentBehaviorFields.tsx',`import React from 'react';
import {Plus,Trash2} from 'lucide-react';
import type {Agent} from '../src/contracts';
import type {AgentPolicy} from '../src/agent-contracts';
import type {AgentDraftBehavior} from '../src/agent-draft-preview-contracts';
export function AgentBehaviorFields({value,change,peers=[]}:{value:AgentDraftBehavior;change:(next:Partial<AgentDraftBehavior>)=>void;peers?:Pick<Agent,'id'|'name'|'description'>[]}){
 const policy=(next:Partial<AgentPolicy>)=>change({policy:{...value.policy,...next}}),skill=(id:string,next:Partial<AgentDraftBehavior['skills'][number]>)=>change({skills:value.skills.map(row=>row.id===id?{...row,...next}:row)});
 return <>
${fields}
 </>;
}
`,{flag:'wx'});
editor=editor.slice(0,start)+`  <AgentBehaviorFields value={profile} peers={peers} change={value=>change({...value,...(value.skills?{skills:value.skills.map(row=>({...row,sha256:''}))}:{})})}/>
`+editor.slice(end);
editor="import {AgentBehaviorFields} from './AgentBehaviorFields';\r\n"+editor;
editor=once(editor,"import {Plus,Trash2} from 'lucide-react';\r\n",'');
editor=once(editor," const policy=(value:Partial<AgentPolicy>)=>profile&&change({policy:{...profile.policy,...value}});\r\n",'');
editor=once(editor," const skill=(id:string,value:Partial<AgentSkill>)=>profile&&change({skills:profile.skills.map(row=>row.id===id?{...row,...value}:row)});\r\n",'');
await writeFile('desktop/ui/AgentDefinitionEditor.tsx',editor);
let ui=await readFile('desktop/ui/AgentSettings.tsx','utf8');
ui="import {AgentBehaviorFields} from './AgentBehaviorFields';\r\nimport {agentDraftBehavior} from '../src/agent-draft-preview-contracts';\r\n"+ui;
ui=once(ui," const [behaviorDraft,setBehaviorDraft]=useState<AgentDraftBehavior|null>(agent?null:{handle:'draft-agent',role:'',sops:'',guardrails:'',skills:[],policy:structuredClone(defaultAgentPolicy)});",` const creationId=useRef(creationDraft?.creationId??crypto.randomUUID());
 const [creationBehavior,setCreationBehavior]=useState<AgentDraftBehavior>(creationDraft?.behavior??{handle:'agent-'+creationId.current.replaceAll('-',''),role:'',sops:'',guardrails:'',skills:[],policy:structuredClone(defaultAgentPolicy)}),[creationPeers,setCreationPeers]=useState<Agent[]>([]);
 const latestCreationBehavior=useRef(creationBehavior);latestCreationBehavior.current=creationBehavior;
 const [behaviorDraft,setBehaviorDraft]=useState<AgentDraftBehavior|null>(null);let previewBehavior=behaviorDraft,creationBehaviorError='';if(!agent)try{previewBehavior=agentDraftBehavior(creationBehavior);}catch(error){previewBehavior=null;creationBehaviorError=(error as Error).message;}
 useEffect(()=>{if(agent||!owner)return;let current=true;void call<Agent[]>('agents.list').then(rows=>{if(current)setCreationPeers(rows.filter(row=>row.active!==false));}).catch(()=>{});return()=>{current=false;};},[agent,owner]);`);
ui=once(ui,"const creationId=useRef(creationDraft?.creationId??crypto.randomUUID()),savingBasic=useRef(false)","const savingBasic=useRef(false)");
ui=once(ui,'image:creationImage,dirty:dirty.size>0,...(created?{created}:{})','image:creationImage,behavior:creationBehavior,dirty:dirty.size>0,...(created?{created}:{})');
ui=once(ui,'creationAppearance,creationImage,dirty,created]);','creationAppearance,creationImage,creationBehavior,dirty,created]);');
ui=once(ui,'image:creationImage,dirty:dirty.size>0,created:receipt','image:creationImage,behavior:latestCreationBehavior.current,dirty:dirty.size>0,created:receipt');
ui=once(ui,'if(!agent)presentation={value:agentAppearance(creationAppearance),image:creationImage};','if(!agent){presentation={value:agentAppearance(creationAppearance),image:creationImage};agentDraftBehavior(creationBehavior);}');
ui=once(ui,'creationId:creationId.current,presentation}:{}','creationId:creationId.current,presentation,behavior:agentDraftBehavior(creationBehavior)}:{}');
const anchor='<div className="two-columns"><label>AI provider';
ui=once(ui,anchor,'{!agent&&<fieldset aria-label="New agent behavior"><legend>Role, procedures and skills</legend><p>Save creates the agent and this behavior together. Preview uses these current edits; chat permissions still control its actions.</p><AgentBehaviorFields value={creationBehavior} peers={creationPeers} change={value=>{setCreationBehavior(current=>({...current,...value}));setDirty(current=>new Set(current).add(\'general\'));setNotice(\'\');}}/>{creationBehaviorError&&<p role="status" className="danger">{creationBehaviorError}</p>}</fieldset>}'+anchor);
ui=once(ui,'behavior={behaviorDraft} definitionError={definitionError}','behavior={previewBehavior} definitionError={agent?definitionError:creationBehaviorError}');
await writeFile('desktop/ui/AgentSettings.tsx',ui);
let recovery=await readFile('desktop/src/editor-draft-recovery.ts','utf8');
recovery=once(recovery,'appearance(copy.appearance);}',`appearance(copy.appearance);
  for(const[key,max]of Object.entries({handle:64,role:1000,sops:50000,guardrails:20000}))field(copy.behavior,key,max);
  if(Array.isArray(copy.behavior?.skills))for(const row of copy.behavior.skills)for(const[key,max]of Object.entries({name:100,description:1000,content:50000}))field(row,key,max);
  if(Array.isArray(copy.behavior?.policy?.tools))copy.behavior.policy.tools=copy.behavior.policy.tools.map((value:unknown)=>typeof value==='string'?value.replace(/\\0/g,'\\ufffd').slice(0,200):value);
 }`);
await writeFile('desktop/src/editor-draft-recovery.ts',recovery);
let fixture=await readFile('scripts/desktop/agent-creation75-fixture.tsx','utf8');fixture=once(fixture,"if(action==='tools.catalog')return [];","if(action==='tools.catalog'||action==='agents.list')return [];");await writeFile('scripts/desktop/agent-creation75-fixture.tsx',fixture);
