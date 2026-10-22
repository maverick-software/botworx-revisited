import assert from 'node:assert/strict';import path from 'node:path';import {readFile,writeFile} from 'node:fs/promises';
const root=path.resolve(import.meta.dirname,'../..');async function edit(name,replacements){let source=await readFile(path.join(root,name),'utf8');for(const [before,after]of replacements){assert(source.includes(before),'Missing edit anchor in '+name+': '+before.slice(0,100));source=source.replace(before,after);}await writeFile(path.join(root,name),source);}
await edit('desktop/ui/PluginManager.tsx',[
 ["useCallback,useEffect,useState","useCallback,useEffect,useRef,useState"],
 ['changed}:{agents:Agent[]','changed,targetAgent,working}:{targetAgent?:Agent;working?:(busy:boolean)=>void;agents:Agent[]'],
 [' const [showImportedJson',' const operation=useRef(false);const [composioBusy,setComposioBusy]=useState(false);useEffect(()=>{working?.(busy||composioBusy);return()=>working?.(false);},[busy,composioBusy,working]);\n const [showImportedJson'],
 // Move the effect after the state declaration so busy is initialized.
 ['useEffect(()=>{working?.(busy||composioBusy);return()=>working?.(false);},[busy,composioBusy,working]);',''],
 [' const selected=',' useEffect(()=>{working?.(busy||composioBusy);return()=>working?.(false);},[busy,composioBusy,working]);\n const selected='],
 ["const operate=async(task:()=>Promise<unknown>,message='')=>{setBusy(true)","const operate=async(task:()=>Promise<unknown>,message='')=>{if(operation.current)return;operation.current=true;setBusy(true)"],
 ['finally{setBusy(false);}};','finally{operation.current=false;setBusy(false);}};'],
 ['const enable=(plugin:PluginRecord,value:boolean)=>{setRows','const enable=(plugin:PluginRecord,value:boolean)=>{if(operation.current)return;setRows'],
 ['const assign=(plugin:PluginRecord,agentId:string,value:boolean)=>{setRows','const assign=(plugin:PluginRecord,agentId:string,value:boolean)=>{if(operation.current||targetAgent&&targetAgent.id!==agentId)return;setRows'],
 ['<h1>Plugins</h1><p>Connect plugins to let your agents work across your apps</p>','<h1>{targetAgent?\'Apps\':\'Plugins\'}</h1><p>{targetAgent?\'Choose apps for \'+targetAgent.name:\'Connect plugins to let your agents work across your apps\'}</p>'],
 ["{(settings||tab==='composio')&&", "{!targetAgent&&(settings||tab==='composio')&&"],
 ['<ComposioPage agents={agents}', '<ComposioPage targetAgent={targetAgent} changed={changed} working={setComposioBusy} agents={agents}'],
 ['<small>{row.description}</small></button><button className="icon-button" aria-label={\'Manage plugin \'+title(row)}','<small>{row.description}</small>{targetAgent&&<small>{row.assignments.some(grant=>grant.agent_id===targetAgent.id&&grant.enabled)?\'Assigned to \'+targetAgent.name:\'Not assigned\'}</small>}</button><button className="icon-button" aria-label={\'Manage plugin \'+title(row)}'],
 ['<label className="checkbox"><input type="checkbox" aria-label={\'Enable plugin \'+title(plugin)}','{targetAgent?<span>{plugin.enabled?\'Enabled for this account\':\'Disabled for this account. Enable it in Plugins to use it.\'}</span>:<label className="checkbox"><input type="checkbox" aria-label={\'Enable plugin \'+title(plugin)}'],
 ['/>Enabled for this account</label></div>','/>Enabled for this account</label>}</div>'],
 ['{plugin.name===chromePluginName&&<ChromeConnection','{!targetAgent&&plugin.name===chromePluginName&&<ChromeConnection'],
 ["{plugin.kind==='images'&&<ImageConnection","{!targetAgent&&plugin.kind==='images'&&<ImageConnection"],
 ["{plugin.kind==='search'&&<section", "{!targetAgent&&plugin.kind==='search'&&<section"],
 ['{agents.map(agent=>{const grant=plugin.assignments','{(targetAgent?[targetAgent]:agents).map(agent=>{const grant=plugin.assignments'],
 ['disabled={busy||agent.active===false&&grant?.enabled!==true||legacy&&!grant}','disabled={busy||!!targetAgent&&!plugin.enabled||agent.active===false&&grant?.enabled!==true||legacy&&!grant}'],
 ['{plugin.updatable&&<button','{!targetAgent&&plugin.updatable&&<button'],
 ['{!plugin.bundled&&<button className="secondary danger"','{!targetAgent&&!plugin.bundled&&<button className="secondary danger"'],
]);
await edit('desktop/ui/ComposioPage.tsx',[
 ['settingsVersion=0}:{agents:Agent[]','settingsVersion=0,targetAgent,changed,working}:{targetAgent?:Agent;changed?:()=>void;working?:(busy:boolean)=>void;agents:Agent[]'],
 [' const pageArea=',' useEffect(()=>{working?.(busy);return()=>working?.(false);},[busy,working]);\n const pageArea='],
 ['await read();setNotice(typeof message','await read();changed?.();setNotice(typeof message'],
 [" const activeAgents=agents.filter(agent=>agent.active!==false),", " const activeAgents=(targetAgent?[targetAgent]:agents).filter(agent=>agent.active!==false),"],
 [" const ended=(connection:ComposioConnection)"," const assigned=(connection:ComposioConnection)=>!targetAgent||connection.agents===null||connection.agents.includes(targetAgent.id);\n const connectionState=(connection:ComposioConnection)=>targetAgent&&connection.enabled&&connection.status==='ACTIVE'&&!assigned(connection)?'Not assigned to '+targetAgent.name:stateName(connection);\n const exclusivelyAssigned=(connection:ComposioConnection)=>!targetAgent||connection.agents?.length===1&&connection.agents[0]===targetAgent.id;\n const ended=(connection:ComposioConnection)"],
 ['{configured&&<button className="secondary" disabled={busy} onClick={()=>void operate(()=>call(\'composio.project.remove\')','{configured&&!targetAgent&&<button className="secondary" disabled={busy} onClick={()=>void operate(()=>call(\'composio.project.remove\')'],
 ["{stateName(connection)}</span>","{connectionState(connection)}</span>"],
 ["{['INITIATED','INITIALIZING','FAILED'].includes(connection.status)?", "{exclusivelyAssigned(connection)&&(['INITIATED','INITIALIZING','FAILED'].includes(connection.status)?"],
 ['<Unplug size={14}/>Disconnect account</button>}', '<Unplug size={14}/>Disconnect account</button>)}'],
 ['<button className="secondary" disabled={busy} onClick={()=>{choose(connection.toolkit,connection);}}>Reconnect', '<button className="secondary" disabled={busy||!!targetAgent&&!assigned(connection)} onClick={()=>{choose(connection.toolkit,connection);}}>Reconnect'],
 ['<details><summary>Agent access</summary><label className="composio-agent">','{targetAgent?<div className="composio-agent-access"><label className="composio-agent"><input type="checkbox" aria-label={\'Use \'+connection.name+\' with \'+targetAgent.name} checked={assigned(connection)} disabled={busy||connection.agents===null||!connection.enabled} onChange={event=>void operate(()=>call(\'composio.agent.assign\',{id:connection.id,agentId:targetAgent.id,enabled:event.target.checked}))}/>Use with {targetAgent.name}</label>{connection.agents===null&&<p className="hint">Shared with all agents. Manage shared access in Plugins.</p>}</div>:<details><summary>Agent access</summary><label className="composio-agent">'],
 ['</label>)}</details></article>)}</section>}', '</label>)}</details>}</article>)}</section>}'],
 ["connected=connections.some(connection=>connection.enabled&&connection.status==='ACTIVE')", "connected=connections.some(connection=>connection.enabled&&connection.status==='ACTIVE'&&assigned(connection))"],
 ['connections.map(stateName)', 'connections.map(connectionState)'],
 ["{toolkit:detail.slug,scheme,name,...(reconnectId?", "{toolkit:detail.slug,scheme,name,...(targetAgent?{agentId:targetAgent.id}:{}),...(reconnectId?"],
 ["'Connector connected. Its tools are available to the assigned agents.'", "targetAgent?'Connector connected for '+targetAgent.name+'.':'Connector connected. Its tools are available to the assigned agents.'"],
]);
await edit('desktop/ui/AgentSettings.tsx',[
 ["import {AgentEditorResources} from './AgentEditorResources';","import {AgentEditorResources} from './AgentEditorResources';\nimport PluginManager from './PluginManager';"],
 ["['mcp','MCP',Plug]", "['mcp','Apps',Plug]"],
 [' const [resourceRevision,',' const [connectionSettings,setConnectionSettings]=useState(initialSection===\'mcp\');\n const [resourceRevision,'],
 ["apps={()=>setSection('mcp')}", "apps={()=>{setConnectionSettings(false);setSection('mcp');}}"],
 ["{section==='mcp'&&<McpSettings agentId={agent!.id} connections={snapshot.mcp} refresh={async()=>{await refresh();setResourceRevision(n=>n+1);}} busy={busy} operate={operate}/>}","{section==='mcp'&&<div className=\"agent-app-catalog\" data-independent-agent-settings>{connectionSettings?<><button type=\"button\" className=\"subtle-link\" onClick={()=>setConnectionSettings(false)}>Back to apps</button><McpSettings agentId={agent!.id} connections={snapshot.mcp} refresh={async()=>{await refresh();setResourceRevision(n=>n+1);}} busy={busy} operate={operate}/></>:<><button type=\"button\" className=\"subtle-link\" onClick={()=>setConnectionSettings(true)}>Connection settings</button><PluginManager agents={[agent]} targetAgent={agent} admin={administrator} edit={()=>setConnectionSettings(true)} changed={()=>setResourceRevision(n=>n+1)} working={setBusy}/></>}</div>}"],
]);
console.log('Agent-scoped Public, Personal and Composio catalog source updated.');
