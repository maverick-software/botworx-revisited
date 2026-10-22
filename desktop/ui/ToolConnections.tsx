import {pluginName} from './plugin-presentation';
import React,{useEffect,useState} from 'react';
import {Bot,Settings,Plug,Globe} from 'lucide-react';
import type {Agent} from '../src/contracts';
import type {ToolSource} from '../src/tool-contracts';
import {call} from './ui';
export function ToolConnections({agents,edit}:{agents:Agent[];edit:(agent:Agent)=>void}){
 const [sources,setSources]=useState<Record<string,ToolSource[]>>({}),[errors,setErrors]=useState<Record<string,string>>({});
 useEffect(()=>{let live=true;void Promise.allSettled(agents.map(async agent=>({id:agent.id,rows:await call<ToolSource[]>('tools.catalog',{agentId:agent.id})}))).then(results=>{if(!live)return;const next:Record<string,ToolSource[]>={},failures:Record<string,string>={};results.forEach((result,i)=>{if(result.status==='fulfilled')next[result.value.id]=result.value.rows;else failures[agents[i].id]='The tool configuration could not be loaded.';});setSources(next);setErrors(failures);});return()=>{live=false;};},[agents]);
 return <div className="tool-connections"><h2>Agent tools</h2><p>Connect MCP servers and enable web search in each agent’s settings. Choose which connections a chat can use from its Add menu.</p>{agents.map(agent=><article className="agent-tool-card" key={agent.id}><div><Bot size={19}/><strong>{agent.name}</strong><button className="secondary" onClick={()=>edit(agent)}><Settings size={15}/>Configure tools</button></div>{sources[agent.id]?.filter(s=>s.enabled).map(source=><p key={source.id}>{source.kind==='mcp'?<Plug size={14}/>:<Globe size={14}/>}<span>{pluginName(source.name)}</span><small>{source.ready?'Configured':'Setup required'}</small></p>)}{sources[agent.id]&&!sources[agent.id].some(s=>s.enabled)&&<p>No external tools are enabled.</p>}{errors[agent.id]&&<p role="alert" className="danger">{errors[agent.id]}</p>}</article>)}{!agents.length&&<p>Create an agent to configure its tools.</p>}</div>;
}
