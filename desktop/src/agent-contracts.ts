export type AgentSkill={id:string;name:string;description:string;content:string;sha256:string};
export type AgentPolicy={tools:string[]|null;delegation:boolean;delegateAgents:string[]|null;memory:boolean;memoryWrite:boolean;maxDepth:number;maxTurns:number};
export const defaultAgentPolicy:AgentPolicy={tools:null,delegation:true,delegateAgents:null,memory:true,memoryWrite:true,maxDepth:2,maxTurns:10};
export type AgentProfile={agent_id:string;user_id:string;handle:string;role:string;sops:string;guardrails:string;skills:AgentSkill[];policy:AgentPolicy;revision:number;memory_revision?:number;definition:Record<string,unknown>;updated_at:string};
export type AgentAttribution={id:string;name:string;handle:string;role:string;revision:number;instanceId:string};
export type AgentInstanceStatus='ready'|'queued'|'running'|'awaiting_approval'|'completed'|'failed'|'cancelled'|'interrupted';
export type AgentInstance={id:string;user_id:string;agent_id:string;agent_revision:number;conversation_id:string;project_id:string|null;parent_instance_id:string|null;assignment:string;status:AgentInstanceStatus;checkpoint:string;request_id:string|null;depth:number;created_at:string;updated_at:string;policy_ceiling?:AgentPolicy|null;authority_chain?:Array<{agent_id:string;revision:number;instance_id:string;project_id:string|null;goal_id?:string|null}>;agent_name?:string;project_name?:string;result?:string;error?:string|null};
export type AgentMemory={id:string;agent_id:string;project_id:string|null;instance_id:string|null;title:string;content:string;revision:number;source_message_id:string|null;source_conversation_id:string|null;authored_by:'user'|'agent';created_at:string;updated_at:string;citation?:string};
export const agentToolNames=['list_agents','invoke_agent','list_agent_instances','read_agent_instance','search_agent_memory','read_agent_memory','save_agent_memory'];

function object(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Enter an agent configuration object.');return value as Record<string,unknown>;}
export function agentId(value:unknown):string{if(typeof value!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value))throw new Error('Invalid agent record identifier.');return value;}
export function agentText(value:unknown,max:number,empty=true):string{if(typeof value!=='string'||value.length>max||!empty&&!value.trim())throw new Error(`Enter ${empty?'up to':'between 1 and'} ${max.toLocaleString('en-US')} characters.`);return value.trim();}
function boolean(value:unknown){if(typeof value!=='boolean')throw new Error('Choose whether this agent capability is enabled.');return value;}
function bound(value:unknown,min:number,max:number){if(!Number.isSafeInteger(value)||(value as number)<min||(value as number)>max)throw new Error(`Choose a whole number between ${min} and ${max}.`);return value as number;}
export function agentPolicy(value:unknown):AgentPolicy{
 const input=object(value),tools=input.tools,delegates=input.delegateAgents;
 if(tools!==null&&(!Array.isArray(tools)||tools.length>200||tools.some(v=>typeof v!=='string'||!/^(?:[a-z][a-z0-9_]*\.)?[a-z][a-z0-9_]*$/.test(v))))throw new Error('Allowed tools must be exact tool names, or null for all currently available tools.');
 if(delegates!==null&&(!Array.isArray(delegates)||delegates.length>200))throw new Error('Choose permitted agents, or all owned agents.');
 return {tools:tools===null?null:[...new Set(tools as string[])],delegation:boolean(input.delegation),delegateAgents:delegates===null?null:[...new Set((delegates as unknown[]).map(agentId))],memory:boolean(input.memory),memoryWrite:boolean(input.memoryWrite),maxDepth:bound(input.maxDepth,0,4),maxTurns:bound(input.maxTurns,1,50)};
}
export function profileInput(value:unknown){
 const input=object(value),handle=agentText(input.handle,64,false).toLowerCase();if(!/^[a-z][a-z0-9_-]{1,63}$/.test(handle))throw new Error('Use a handle of 2–64 lowercase letters, numbers, hyphens or underscores, starting with a letter.');
 if(!Array.isArray(input.skills)||input.skills.length>30)throw new Error('Assign up to 30 persistent skills.');
 const skills=input.skills.map(value=>{const skill=object(value);return {id:agentId(skill.id),name:agentText(skill.name,100,false),description:agentText(skill.description,1000),content:agentText(skill.content,50000,false)};});
 if(new Set(skills.map(skill=>skill.id)).size!==skills.length||skills.reduce((sum,skill)=>sum+skill.content.length,0)>200000)throw new Error('Skills need distinct identifiers and up to 200,000 characters combined.');
 return {handle,role:agentText(input.role,1000),sops:agentText(input.sops,50000),guardrails:agentText(input.guardrails,20000),skills,policy:agentPolicy(input.policy),revision:bound(input.revision,1,Number.MAX_SAFE_INTEGER)};
}
