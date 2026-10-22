import assert from 'node:assert/strict';import {readFile,writeFile} from 'node:fs/promises';import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..');
async function edit(file,replacements){let text=(await readFile(path.join(root,file),'utf8')).replaceAll('\r\n','\n');for(const [before,after]of replacements){assert.equal(text.split(before).length,2,'Expected one source match: '+file+' '+before.slice(0,80));text=text.replace(before,after);}await writeFile(path.join(root,file),text);}
await edit('desktop/ui/AgentAutomations.tsx',[
 ["import type {Agent,ChatOptions,ProviderStatus}","import type {Agent,ChatOptions,Model,ProviderStatus}"],
 ["import './agent-automations.css';","import './agent-automations.css';\nimport {agentAutomationOptions} from './agent-automation-options';"],
 ['type Props={owner:string;','type Props={dialog?:boolean;close?:()=>void;owner:string;'],
 [' if(advanced)return <div data-independent-agent-settings>',' const closeEditor=()=>{setEditor(undefined);void refresh();};\n if(editor!==undefined)return <AgentAutomationDialog key={props.owner+\':\'+props.agent.id+\':\'+(editor?.id??\'new\')} agent={props.agent} task={editor} close={closeEditor} saved={refresh}/>;\n const advancedContent=<div data-independent-agent-settings>'],
 ['</div>;\n return <section className="agent-automations"','</div>;\n if(advanced)return props.dialog?<Modal title="Automations" close={()=>props.close?.()} className="agent-home-automations agent-automations-advanced">{advancedContent}</Modal>:advancedContent;\n const content=<section className="agent-automations"'],
 ['{editor!==undefined&&<AgentAutomationDialog key={props.owner+\':\'+props.agent.id+\':\'+(editor?.id??\'new\')} agent={props.agent} task={editor} close={()=>{setEditor(undefined);void refresh();}} saved={refresh}/>}</section>;','</section>;\n return props.dialog?<Modal title="Automations" close={()=>props.close?.()} className="agent-home-automations">{content}</Modal>:content;'],
 [".then(value=>{if(alive.current)setOptions({...value,harness:'codex',files:[],goalId:undefined});})",".then(async value=>agentAutomationOptions(agent,value,await call<Model[]>('providers.models',{provider:agent.provider}))).then(value=>{if(alive.current)setOptions(value);})"]
]);
await edit('desktop/ui/AgentDirectory.tsx',[
 ["<small>{appConnectionAlias(source)}{source.ready?'Assigned connection':'Needs connection'}{source.detail?' · '+source.detail:''}</small>","<small>{appConnectionAlias(source)}{source.ready?'Connected':'Connection required'}</small>"],
 ['{automations&&<Modal title="Automations" close={()=>setAutomations(false)} className="agent-home-automations"><AgentAutomations owner={owner} agent={agent} connections={props.connections} administrator={props.administrator} configure={props.configure} openChat={props.openChat}/></Modal>}','{automations&&<AgentAutomations dialog close={()=>setAutomations(false)} owner={owner} agent={agent} connections={props.connections} administrator={props.administrator} configure={props.configure} openChat={props.openChat}/>}']
]);
await edit('desktop/ui/agent-directory.css',[
 ['.agent-home-automations{width:min(520px,calc(100vw - 32px));box-sizing:border-box}', '.modal.agent-home-automations{width:min(482px,calc(100vw - 32px));box-sizing:border-box}.modal.agent-home-automations.agent-automations-advanced{width:min(1000px,calc(100vw - 32px))}']
]);
console.log(JSON.stringify({success:true,changes:['single automation dialog','explicit agent model in new automations','compact connection labels']}));
