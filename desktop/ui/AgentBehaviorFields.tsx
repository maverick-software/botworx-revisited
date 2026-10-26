import React from 'react';
import {Plus,Trash2} from 'lucide-react';
import type {Agent} from '../src/contracts';
import type {AgentPolicy} from '../src/agent-contracts';
import type {AgentDraftBehavior} from '../src/agent-draft-preview-contracts';
export function AgentBehaviorFields({value,change,peers=[],view='all'}:{view?:'all'|'behavior'|'permissions';value:AgentDraftBehavior;change:(next:Partial<AgentDraftBehavior>)=>void;peers?:Pick<Agent,'id'|'name'|'description'>[]}){
 const policy=(next:Partial<AgentPolicy>)=>change({policy:{...value.policy,...next}}),skill=(id:string,next:Partial<AgentDraftBehavior['skills'][number]>)=>change({skills:value.skills.map(row=>row.id===id?{...row,...next}:row)});
 return <>
  {view!=='permissions'&&<>
  <label>Mention handle<input aria-label="Mention handle" required pattern="[a-z][a-z0-9_-]{1,63}" maxLength={64} value={value.handle} onChange={e=>change({handle:e.target.value})}/></label>
  <label>Role<textarea aria-label="Agent role" maxLength={1000} rows={2} value={value.role} onChange={e=>change({role:e.target.value})}/></label>
  <label>Standard operating procedures<textarea aria-label="Standard operating procedures" maxLength={50000} rows={5} value={value.sops} onChange={e=>change({sops:e.target.value})}/></label>
  <label>Guardrails<textarea aria-label="Agent guardrails" maxLength={20000} rows={4} value={value.guardrails} onChange={e=>change({guardrails:e.target.value})}/></label>
  </>}
  {view!=='behavior'&&<>
  <p className="hint">Procedures and written guardrails guide the model. The controls below enforce which tools and delegation it can use.</p>
  <label className="checkbox"><input type="checkbox" checked={value.policy.tools===null} onChange={e=>policy({tools:e.target.checked?null:[]})}/>Allow all tools available under the chat’s permissions and this agent’s configured connections</label>
  {value.policy.tools!==null&&<label>Allowed tool names<textarea aria-label="Allowed agent tools" rows={4} value={value.policy.tools.join('\n')} onChange={e=>policy({tools:e.target.value.split(/\s+/).filter(Boolean)})}/><small>One exact tool name per line, such as read_file, search_agent_memory or tools.invoke_agent. An empty list disables tools.</small></label>}
  <label className="checkbox"><input type="checkbox" checked={value.policy.memory} onChange={e=>policy({memory:e.target.checked})}/>Read this agent’s persistent memory, saved chats and other assignments</label>
  <label className="checkbox"><input type="checkbox" checked={value.policy.memoryWrite} disabled={!value.policy.memory} onChange={e=>policy({memoryWrite:e.target.checked})}/>Save source-linked memories automatically</label>
  <label className="checkbox"><input type="checkbox" checked={value.policy.delegation} onChange={e=>policy({delegation:e.target.checked})}/>Allow delegation to named agents</label>
  {value.policy.delegation&&<><label className="checkbox"><input type="checkbox" checked={value.policy.delegateAgents===null} onChange={e=>policy({delegateAgents:e.target.checked?null:[]})}/>Allow all agents in my account</label>{value.policy.delegateAgents!==null&&peers.map(peer=><label key={peer.id} className="checkbox"><input type="checkbox" checked={value.policy.delegateAgents!.includes(peer.id)} onChange={e=>policy({delegateAgents:e.target.checked?[...value.policy.delegateAgents!,peer.id]:value.policy.delegateAgents!.filter(id=>id!==peer.id)})}/>{peer.name} · {peer.description}</label>)}<label>Maximum delegation depth<input type="number" min={0} max={4} aria-label="Maximum delegation depth" value={value.policy.maxDepth} onChange={e=>policy({maxDepth:Number(e.target.value)})}/></label><label>Maximum delegated turns per originating turn<input type="number" min={1} max={50} aria-label="Maximum delegated turns" value={value.policy.maxTurns} onChange={e=>policy({maxTurns:Number(e.target.value)})}/></label></>}
  </>}
  {view!=='permissions'&&<>
  <h3>Persistent skills</h3><p className="hint">These skill instructions are stored with the agent, so they remain available across projects. They cannot grant extra permissions.</p>
  {value.skills.map(row=><fieldset key={row.id} data-skill-id={row.id}><legend>{row.name||'New skill'}</legend><label>Skill name<input aria-label="Persistent skill name" required maxLength={100} value={row.name} onChange={e=>skill(row.id,{name:e.target.value})}/></label><label>Description<input maxLength={1000} value={row.description} onChange={e=>skill(row.id,{description:e.target.value})}/></label><label>Skill instructions<textarea aria-label="Persistent skill instructions" required rows={6} maxLength={50000} value={row.content} onChange={e=>skill(row.id,{content:e.target.value})}/></label><button type="button" className="danger secondary" onClick={()=>change({skills:value.skills.filter(s=>s.id!==row.id)})}><Trash2 size={15}/>Remove skill</button></fieldset>)}
  <button type="button" className="secondary" disabled={value.skills.length>=30} onClick={()=>change({skills:[...value.skills,{id:crypto.randomUUID(),name:'',description:'',content:''}]})}><Plus size={15}/>Add persistent skill</button>

 </>}
 </>;
}
