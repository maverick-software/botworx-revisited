import {createHash,randomUUID} from 'node:crypto';
import {ComposioClient,ComposioUnavailableError} from './composio-client';
import {composioIdentifier,composioSlug,composioScheme,composioState,composioTerminalStatuses,type ComposioState,type ComposioCatalog,type ComposioAccount,type ComposioTool,type ComposioConnection,type ComposioStatus} from './composio-contracts';
import {validateToolDescriptor} from './plugin-validation';
import type {ToolSource} from './tool-contracts';
import {AjvJsonSchemaValidator} from '@modelcontextprotocol/client/validators/ajv';

export type {ComposioConnection} from './composio-contracts';
export type {ComposioState} from './composio-contracts';
/** The store must encrypt credentials. Connections must be captured by recovery before release. */
export type ComposioStore={get<T>(key:string):T|undefined;setMany(entries:readonly (readonly [string,unknown])[]):Promise<unknown>};
const uuid=(value:string)=>{if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value))throw Error('Choose a valid Sylvana account or agent.');return value;};
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const agentAuthority=(stamp:string,connection:ComposioConnection,agent:string)=>{const {agents,...binding}=connection;return digest([stamp,binding,agent,agents===null||agents.includes(agent)]);};
/** null means all account workers; otherwise only agents affected by the change. */
export function composioInvalidatedAgents(action:string,before:ComposioStatus,after:ComposioStatus,agentId?:string):string[]|null{
 if(action==='composio.configure'||action==='composio.project.remove'||before.configured!==after.configured)return null;
 if(action==='composio.agent.assign')return agentId?[uuid(agentId)]:null;
 const previous=new Map(before.connections.map(row=>[row.id,row])),current=new Map(after.connections.map(row=>[row.id,row])),affected=new Set<string>();
 for(const id of new Set([...previous.keys(),...current.keys()])){const old=previous.get(id),next=current.get(id);if(JSON.stringify(old)===JSON.stringify(next))continue;for(const row of [old,next])if(row){if(row.agents===null)return null;for(const agent of row.agents)affected.add(agent);}}
 return [...affected];
}

/** Owner-bound service: no model input chooses the Composio user or project key. */
export class ComposioConnections{
 private writes=new Map<string,Promise<unknown>>();
 private catalogCache=new Map<string,ComposioCatalog>();
 private validator=new AjvJsonSchemaValidator();
 constructor(private store:ComposioStore,private identity:()=>Promise<string>,private ownedAgent:(owner:string,agent:string)=>Promise<void>,private open:(url:string)=>Promise<void>,private client:(key:string)=>ComposioClient=key=>new ComposioClient(key)){}
 private stateKey(owner:string){return 'composio-state:'+uuid(owner);}
 private keyName(owner:string){return 'composio-key:'+uuid(owner);}
 private read(owner:string){const value=this.store.get<ComposioState>(this.stateKey(owner));return value?composioState(value):undefined;}
 private key(owner:string){const value=this.store.get<string>(this.keyName(owner));if(!value)throw Error('Connect a Composio project in Plugins first.');return value;}
 private async owner(owner:string){uuid(owner);if(await this.identity()!==owner)throw Error('Your Sylvana account changed.');}
 private async exclusive<T>(owner:string,task:()=>Promise<T>):Promise<T>{const prior=this.writes.get(owner)??Promise.resolve(),running=prior.catch(()=>{}).then(async()=>{await this.owner(owner);return task();});this.writes.set(owner,running);try{return await running;}finally{if(this.writes.get(owner)===running)this.writes.delete(owner);}}
 private async context(owner:string){await this.owner(owner);const key=this.key(owner),state=this.read(owner);if(!state)throw Error('Configure this Composio project again.');const stamp=digest([key,state.namespace]);return {client:this.client(key),state,stamp,user:composioIdentifier('sylvana_'+digest([owner,state.namespace]),'user'),guard:async()=>{await this.owner(owner);if(digest([this.key(owner),this.read(owner)?.namespace])!==stamp)throw Error('The Composio project changed. Start a new operation.');}};}
 async status(owner:string){await this.owner(owner);return {configured:!!this.store.get<string>(this.keyName(owner)),connections:this.read(owner)?.connections??[]};}
 async ownsConnection(owner:string,id:string){await this.owner(owner);return this.read(owner)?.connections.some(row=>row.id===id)??false;}
 async sources(owner:string,agent:string):Promise<ToolSource[]>{
  await this.owner(owner);await this.ownedAgent(owner,uuid(agent));await this.owner(owner);const ready=!!this.store.get<string>(this.keyName(owner));
  return (this.read(owner)?.connections??[]).map(row=>({id:'mcp:'+row.id,name:row.name+' · Composio',kind:'mcp' as const,plugin:'composio',validation:'Schema validated',enabled:row.enabled&&row.status==='ACTIVE'&&(row.agents===null||row.agents.includes(agent)),ready:ready&&row.status==='ACTIVE',detail:'Use the connected '+row.toolkit+' account through Composio. Default permissions review external calls; Full access runs them automatically.'}));
 }
 async configure(owner:string,key:unknown){return this.exclusive(owner,async()=>{
  if(typeof key!=='string')throw Error('Enter a Composio project API key.');const api=this.client(key);await api.catalog();await this.owner(owner);
  const current=this.read(owner)??{namespace:randomUUID(),connections:[],configurations:{}};
  if(this.store.get<string>(this.keyName(owner))!==key.trim()){current.connections=current.connections.map(connection=>({...connection,status:(composioTerminalStatuses as readonly string[]).includes(connection.status)?connection.status:'NEEDS_VERIFICATION',enabled:false}));current.configurations={};}
  await this.store.setMany([[this.keyName(owner),key.trim()],[this.stateKey(owner),composioState(current)]]);this.catalogCache.clear();return this.status(owner);
 });}
 async removeProject(owner:string){return this.exclusive(owner,async()=>{const state=this.read(owner);if(state)state.connections=state.connections.map(row=>({...row,enabled:false,status:(composioTerminalStatuses as readonly string[]).includes(row.status)?row.status:'PROJECT_DISCONNECTED'}));await this.store.setMany([[this.keyName(owner),undefined],...(state?[[this.stateKey(owner),composioState(state)] as const]:[])]);this.catalogCache.clear();return this.status(owner);});}
 async catalog(owner:string,query:{search?:string;category?:string;cursor?:string}={},signal?:AbortSignal){
  const context=await this.context(owner),cacheKey=digest([owner,context.stamp,query]);try{const value=await context.client.catalog({...query,user:context.user,signal});await context.guard();this.catalogCache.set(cacheKey,structuredClone(value));if(this.catalogCache.size>32)this.catalogCache.delete(this.catalogCache.keys().next().value!);return value;}catch(error){await context.guard();signal?.throwIfAborted();const cached=this.catalogCache.get(cacheKey);if(error instanceof ComposioUnavailableError&&cached)return {...structuredClone(cached),cached:true};throw error;}
 }
 async toolkit(owner:string,slug:string,signal?:AbortSignal){const context=await this.context(owner),value=await context.client.toolkit(slug,signal);await context.guard();return value;}
 async categories(owner:string,signal?:AbortSignal){const context=await this.context(owner),value=await context.client.categories(signal);await context.guard();return value;}
 async connect(owner:string,input:{toolkit:string;scheme:string;name?:string;authConfigId?:string;reconnectId?:string;agentId?:string},signal?:AbortSignal){return this.exclusive(owner,async()=>{
  const agent=input.agentId===undefined?undefined:uuid(input.agentId),guardAgent=async()=>{if(agent)await this.ownedAgent(owner,agent);await this.owner(owner);};await guardAgent();
  const context=await this.context(owner),slug=composioSlug(input.toolkit),scheme=composioScheme(input.scheme),toolkit=await context.client.toolkit(slug,signal);await context.guard();await guardAgent();
  const replacing=input.reconnectId?this.connection(context.state,uuid(input.reconnectId)):undefined;if(replacing&&(replacing.toolkit!==slug||replacing.scheme!==scheme||replacing.enabled))throw Error('Reconnect the same disabled connector and authentication method.');
  if(agent&&replacing?.agents&&!replacing.agents.includes(agent))throw Error('Reconnect this account from Plugins or an agent already assigned to it.');
  if(!toolkit.authSchemes.includes(scheme))throw Error('This connector does not support the selected authentication method.');
  const method=toolkit.authMethods.find(row=>row.scheme===scheme),managed=toolkit.managedAuthSchemes.includes(scheme),configurationKey=slug+':'+scheme;
  let configId=input.authConfigId?composioIdentifier(input.authConfigId,'authentication configuration'):context.state.configurations[configurationKey];
  if(!configId){if(!managed&&(scheme.includes('OAUTH')||method?.configuration.some(field=>field.required)))throw Error('This connector needs a custom authentication configuration. Create it in your Composio project, then enter its configuration ID here.');const created=await context.client.createConfiguration(slug,scheme,managed,signal);await context.guard();if(created.toolkit!==slug||created.scheme!==scheme||created.disabled)throw Error('Composio created a different authentication configuration. Review it in your project.');configId=created.id;context.state.configurations[configurationKey]=configId;await this.store.setMany([[this.stateKey(owner),composioState(context.state)]]);}
  const config=await context.client.configuration(configId,signal);await context.guard();if(config.toolkit!==slug||config.scheme!==scheme||config.disabled)throw Error('Choose an enabled authentication configuration for this connector and method.');
  let defaultName=toolkit.name.slice(0,90);for(let index=2;context.state.connections.some(row=>row.name===defaultName);index++)defaultName=toolkit.name.slice(0,90)+' '+index;
  const name=(input.name??defaultName).trim();if(!name||name.length>100||/[\x00-\x1f]/.test(name))throw Error('Choose a connection name of up to 100 characters.');
  await guardAgent();const direct=scheme==='NO_AUTH'&&!method?.connection.some(field=>field.required),link=direct?{accountId:await context.client.connectWithoutAuth(context.user,config.id,name,signal),expiresAt:undefined,url:undefined}:await context.client.connect(context.user,config.id,name,signal);await context.guard();await guardAgent();
  const connection:ComposioConnection={id:replacing?.id??randomUUID(),toolkit:slug,name,scheme,authConfigId:config.id,accountId:link.accountId,status:direct?'INITIALIZING':'INITIATED',enabled:false,agents:replacing?structuredClone(replacing.agents):agent?[agent]:null,...(link.expiresAt?{expiresAt:link.expiresAt}:{})};
  const state=this.read(owner)!;if(state.connections.some(row=>row.accountId===link.accountId))throw Error('Composio returned an account already used by another connection attempt.');if(!replacing&&state.connections.length>=500)throw Error('Remove an unused Composio connection before adding another.');if(replacing)state.connections=state.connections.map(row=>row.id===replacing.id?connection:row);else state.connections.push(connection);await this.store.setMany([[this.stateKey(owner),composioState(state)]]);await context.guard();signal?.throwIfAborted();
  if(link.url){await guardAgent();await this.open(link.url);await context.guard();}else{const account=await context.client.account(connection.accountId,signal);await context.guard();await guardAgent();this.verify(account,connection,context.user);connection.status=account.status;connection.enabled=account.status==='ACTIVE'&&!account.disabled;await this.store.setMany([[this.stateKey(owner),composioState(state)]]);}return connection;
 });}
 private connection(state:ComposioState,id:string){uuid(id);const record=state.connections.find(row=>row.id===id);if(!record)throw Error('This Composio connection is unavailable for this account.');return record;}
 private verify(account:ComposioAccount,connection:ComposioConnection,user:string){if(account.id!==connection.accountId||account.userId!==user||account.toolkit!==connection.toolkit||account.authConfigId!==connection.authConfigId||account.scheme!==connection.scheme)throw Error('The Composio account does not match this connection and owner.');}
 async refresh(owner:string,id:string,signal?:AbortSignal){return this.exclusive(owner,async()=>{
  const context=await this.context(owner),connection=this.connection(context.state,id);if(['CANCELLED','DISCONNECTED','DISCONNECTING','PROJECT_DISCONNECTED'].includes(connection.status))throw Error('Start a new connection before using this disconnected account.');
  const account=await context.client.account(connection.accountId,signal);await context.guard();this.verify(account,connection,context.user);
  const state=this.read(owner)!,current=this.connection(state,id);current.status=account.status;current.enabled=account.status==='ACTIVE'&&!account.disabled;await this.store.setMany([[this.stateKey(owner),composioState(state)]]);return structuredClone(current);
 });}
 async cancel(owner:string,id:string){return this.exclusive(owner,async()=>{const state=this.read(owner);if(!state)throw Error('This Composio connection is unavailable.');const current=this.connection(state,id);if(current.status==='ACTIVE')throw Error('Disconnect an active Composio account through its connection controls.');current.status='CANCELLED';current.enabled=false;await this.store.setMany([[this.stateKey(owner),composioState(state)]]);return structuredClone(current);});}
 async disconnect(owner:string,id:string,signal?:AbortSignal){return this.exclusive(owner,async()=>{
  const context=await this.context(owner),state=this.read(owner)!,connection=this.connection(state,id);connection.enabled=false;connection.status='DISCONNECTING';await this.store.setMany([[this.stateKey(owner),composioState(state)]]);
  const account=await context.client.account(connection.accountId,signal);await context.guard();this.verify(account,connection,context.user);await context.client.revoke(account.id,signal);await context.guard();connection.status='DISCONNECTED';await this.store.setMany([[this.stateKey(owner),composioState(state)]]);return structuredClone(connection);
 });}
 async assign(owner:string,id:string,agents:string[]|null){return this.exclusive(owner,async()=>{
  if(agents!==null&&(!Array.isArray(agents)||agents.length>500||agents.some(agent=>typeof agent!=='string')))throw Error('Choose the agents that may use this connection.');
  const selected=agents===null?null:[...new Set(agents.map(uuid))];for(const agent of selected??[])await this.ownedAgent(owner,agent);await this.owner(owner);const state=this.read(owner);if(!state)throw Error('This Composio connection is unavailable.');this.connection(state,id).agents=selected;await this.store.setMany([[this.stateKey(owner),composioState(state)]]);return this.status(owner);
 });}
 async assignAgent(owner:string,id:string,agent:string,enabled:unknown){return this.exclusive(owner,async()=>{
  if(typeof enabled!=='boolean')throw Error('Choose whether this agent may use the connection.');uuid(agent);await this.ownedAgent(owner,agent);await this.owner(owner);const state=this.read(owner);if(!state)throw Error('This Composio connection is unavailable.');const connection=this.connection(state,id);
  if(connection.agents===null){if(!enabled)throw Error('This connection is shared with all agents. Change its shared access in Plugins first.');return this.status(owner);}
  const agents=new Set(connection.agents);if(enabled)agents.add(agent);else agents.delete(agent);connection.agents=[...agents];await this.store.setMany([[this.stateKey(owner),composioState(state)]]);return this.status(owner);
 });}
 async authorized(owner:string,agent:string,id:string,signal?:AbortSignal){
  const context=await this.context(owner);await this.ownedAgent(owner,uuid(agent));await context.guard();const connection=this.connection(context.state,id);if(!connection.enabled||connection.status!=='ACTIVE'||connection.agents!==null&&!connection.agents.includes(agent))throw Error('This Composio connection is disabled or unassigned for this agent.');
  const account=await context.client.account(connection.accountId,signal);await context.guard();this.verify(account,connection,context.user);if(account.status!=='ACTIVE'||account.disabled)throw Error('Reconnect this Composio account before using its tools.');return {client:context.client,connection,user:context.user,signature:agentAuthority(context.stamp,connection,agent),redactions:[this.key(owner)],guard:async()=>{await context.guard();await this.ownedAgent(owner,agent);const current=this.connection(this.read(owner)!,id);if(agentAuthority(context.stamp,current,agent)!==agentAuthority(context.stamp,connection,agent))throw Error('The Composio connection or agent assignment changed.');}};
 }
 /** Trusted user interface only. Agent calls must continue through authorized(). */
 async userConnection(owner:string,id:string,toolkit:string,signal?:AbortSignal){
  const context=await this.context(owner),connection=this.connection(context.state,uuid(id));
  if(connection.toolkit!==toolkit||!connection.enabled||connection.status!=='ACTIVE')throw Error('Choose an active '+toolkit+' account in Composio.');
  const account=await context.client.account(connection.accountId,signal);await context.guard();this.verify(account,connection,context.user);if(account.status!=='ACTIVE'||account.disabled)throw Error('Reconnect this Composio account before using it.');
  const signature=digest(connection);return {client:context.client,connection,user:context.user,binding:digest([context.state.namespace,connection.id,connection.accountId,connection.toolkit]),guard:async()=>{await context.guard();if(digest(this.connection(this.read(owner)!,id))!==signature)throw Error('The Composio connection changed. Check its current settings before continuing.');}};
 }
 private descriptor(tool:ComposioTool){return validateToolDescriptor({name:tool.name,description:tool.description,inputSchema:tool.inputSchema,...(tool.outputSchema?{outputSchema:tool.outputSchema}:{}),annotations:tool.annotations,_meta:{composio:{version:tool.version,toolkit:tool.toolkit}}});}
 async inventory(owner:string,agent:string,id:string,signal:AbortSignal,lookup?:{query?:string;tool?:string}){
  const authority=await this.authorized(owner,agent,id,signal);
  if(lookup?.tool){const tool=await authority.client.tool(lookup.tool,'latest',signal);await authority.guard();if(tool.toolkit!==authority.connection.toolkit||tool.name!==lookup.tool)throw Error('This Composio action does not belong to the selected connector.');return [this.descriptor(tool)];}
  const tools:any[]=[],seen=new Set<string>();let cursor:string|undefined,bytes=0;
  do{signal.throwIfAborted();const page=await authority.client.tools(authority.connection.toolkit,cursor,lookup?.query,signal);await authority.guard();for(const tool of page.items){const descriptor=this.descriptor(tool);if(tools.some(row=>row.name===tool.name))throw Error('Composio returned duplicate actions.');bytes+=JSON.stringify(descriptor).length;if(tools.length>=10000||bytes>16*1024*1024)throw Error('This connector has too many tool schemas. Narrow the tool search.');tools.push(descriptor);}cursor=page.nextCursor??undefined;if(cursor&&seen.has(cursor))throw Error('Composio returned a repeated tool page.');if(cursor)seen.add(cursor);}while(cursor);
  return tools;
 }
 async execute(owner:string,agent:string,id:string,descriptor:any,args:Record<string,unknown>,signal:AbortSignal){
  const authority=await this.authorized(owner,agent,id,signal),version=composioIdentifier(descriptor?._meta?.composio?.version,'tool version');
  if(descriptor?._meta?.composio?.toolkit!==authority.connection.toolkit)throw Error('This Composio action belongs to a different connector.');
  const current=this.descriptor(await authority.client.tool(descriptor.name,version,signal));await authority.guard();if(digest(current)!==digest(descriptor))throw Error('This Composio tool schema changed. Discover and review the action again.');
  if(!this.validator.getValidator(current.inputSchema)(args).valid)throw Error('The Composio tool arguments do not match its schema.');
  await authority.guard();signal.throwIfAborted();const result=await authority.client.execute(authority.connection.accountId,authority.user,descriptor.name,version,args,signal);
  const logId=typeof result.log_id==='string'&&/^[a-zA-Z0-9_-]{1,200}$/.test(result.log_id)?result.log_id:undefined;
  return {content:[{type:'text',text:JSON.stringify({data:result.data,...(result.successful!==true?{error:'Composio reported that this action failed. Inspect its activity before retrying.'}:{}),...(logId?{logId}:{})})}],structuredContent:result.data,isError:result.successful!==true};
 }
}
