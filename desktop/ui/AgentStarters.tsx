import React from 'react';
import {defaultAgentStarters,type AgentStarter} from '../src/agent-presentation-contracts';

export function AgentStarters({starters,select,disabled=false}:{starters:AgentStarter[]|null|undefined;select:(prompt:string)=>void;disabled?:boolean}){
 return <div className="agent-home-starters">{(starters??defaultAgentStarters).map(starter=><button type="button" key={starter.id} disabled={disabled} onClick={()=>select(starter.prompt)}><span aria-hidden="true">{starter.id==='draft'?'✎':starter.id==='plan'?'▦':'✦'}</span><strong>{starter.title}</strong><small>{starter.prompt}</small></button>)}</div>;
}
