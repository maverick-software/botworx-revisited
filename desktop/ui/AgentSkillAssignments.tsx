import React,{useEffect,useRef,useState} from 'react';
import type {Agent} from '../src/contracts';
import type {SkillCatalog} from '../src/skill-contracts';
import {call} from './ui';
import {AgentResourceChips,AgentResourceRow,type AgentResourceOption} from './AgentResourcePicker';
import {SavedAgentResourcePicker,skillResourceOption} from './SavedAgentResourcePicker';

export function AgentSkillAssignments({agent,disabled=false,changed}:{agent:Agent;disabled?:boolean;changed?:()=>void}){
 const [rows,setRows]=useState<AgentResourceOption[]>([]),[picker,setPicker]=useState<string|null>(null),[error,setError]=useState(''),[revision,setRevision]=useState(0),generation=useRef(0);
 useEffect(()=>{const token=++generation.current;setRows([]);void call<SkillCatalog>('skills.list').then(catalog=>{if(token===generation.current){setRows(catalog.skills.filter(row=>row.scope==='account').map(row=>skillResourceOption(row,agent)));setError('');}}).catch(reason=>{if(token===generation.current)setError(reason.message);});return()=>{generation.current++;};},[agent.id,revision]);
 return <section data-independent-agent-settings aria-label={'Account skills for '+agent.name}><AgentResourceRow kind="skills" description="Reusable instructions from your Skills library." disabled={disabled} add={()=>setPicker('')}><AgentResourceChips rows={rows.filter(row=>row.assigned)} open={row=>setPicker(row?.id??'')}/></AgentResourceRow>{error&&<p role="alert">{error}</p>}{picker!==null&&<SavedAgentResourcePicker kind="skills" agent={agent} initialSelection={picker} disabled={disabled} close={()=>setPicker(null)} changed={()=>{setRevision(n=>n+1);changed?.();}}/>}</section>;
}
