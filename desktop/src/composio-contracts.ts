export type ComposioAuthField={name:string;label:string;description:string;required:boolean;secret:boolean;defaultValue?:string};
export type ComposioAuthMethod={scheme:string;managed:boolean;configuration:ComposioAuthField[];connection:ComposioAuthField[]};
export type ComposioToolkit={slug:string;name:string;description:string;logo?:string;categories:string[];authSchemes:string[];managedAuthSchemes:string[];noAuth:boolean;toolCount:number;version?:string;authMethods:ComposioAuthMethod[]};
export type ComposioCatalog={items:ComposioToolkit[];nextCursor:string|null;total:number|null;fetchedAt:string;cached?:boolean};
export type ComposioAccount={id:string;toolkit:string;userId:string;authConfigId:string;scheme:string;status:string;disabled:boolean;alias?:string};
export type ComposioConnectLink={accountId:string;url:string;expiresAt:string};
export type ComposioTool={name:string;description:string;toolkit:string;version:string;inputSchema:Record<string,unknown>;outputSchema?:Record<string,unknown>;annotations?:{readOnlyHint?:boolean;destructiveHint?:boolean}};
export type ComposioAuthConfig={id:string;toolkit:string;scheme:string;managed:boolean;disabled:boolean};
export type ComposioConnection={id:string;toolkit:string;name:string;scheme:string;authConfigId:string;accountId:string;status:string;enabled:boolean;agents:string[]|null;expiresAt?:string};
export type ComposioStatus={configured:boolean;connections:ComposioConnection[]};
export type ComposioState={namespace:string;connections:ComposioConnection[];configurations:Record<string,string>};
export const composioTerminalStatuses=['CANCELLED','DISCONNECTED','DISCONNECTING'] as const;

export const composioRecord=(value:unknown):value is Record<string,any>=>!!value&&typeof value==='object'&&!Array.isArray(value);
export function composioIdentifier(value:unknown,label='identifier'):string{if(typeof value!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,199}$/.test(value))throw Error('Invalid Composio '+label+'.');return value;}
export function composioSlug(value:unknown):string{return composioIdentifier(value,'connector');}
export function composioScheme(value:unknown):string{const scheme=String(value??'').toUpperCase();if(!/^[A-Z][A-Z0-9_]{0,59}$/.test(scheme))throw Error('Invalid Composio authentication method.');return scheme;}
const metadataUuid=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
const metadataFields=(value:unknown,keys:readonly string[])=>composioRecord(value)&&Object.keys(value).every(key=>keys.includes(key));
/** Only public connection metadata is portable. Tokens and arbitrary fields are refused. */
export function composioState(value:unknown,portable=false):ComposioState{
 if(!metadataFields(value,['namespace','connections','configurations'])||!composioRecord(value)||!metadataUuid(value.namespace)||!Array.isArray(value.connections)||value.connections.length>500||!composioRecord(value.configurations)||Object.keys(value.configurations).length>1000||JSON.stringify(value).length>2000000)throw Error('Invalid Composio connection metadata.');
 const ids=new Set<string>(),accounts=new Set<string>();
 for(const row of value.connections){
  if(!metadataFields(row,['id','toolkit','name','scheme','authConfigId','accountId','status','enabled','agents','expiresAt'])||!composioRecord(row)||!metadataUuid(row.id)||ids.has(row.id.toLowerCase())||typeof row.name!=='string'||!row.name.trim()||row.name.length>100||/[\x00-\x1f\x7f]/.test(row.name)||typeof row.enabled!=='boolean'||typeof row.status!=='string'||! /^[A-Z][A-Z0-9_]{0,59}$/.test(row.status)||row.enabled&&row.status!=='ACTIVE')throw Error('Invalid Composio connection metadata.');
  ids.add(row.id.toLowerCase());composioSlug(row.toolkit);if(composioScheme(row.scheme)!==row.scheme)throw Error('Invalid Composio authentication metadata.');composioIdentifier(row.authConfigId,'authentication configuration');composioIdentifier(row.accountId,'connection');if(row.accountId==='instant_account'||accounts.has(row.accountId))throw Error('Invalid or duplicate Composio account metadata.');accounts.add(row.accountId);
  if(row.agents!==null&&(!Array.isArray(row.agents)||row.agents.length>500||row.agents.some((agent:unknown)=>!metadataUuid(agent))||new Set(row.agents.map((agent:string)=>agent.toLowerCase())).size!==row.agents.length))throw Error('Invalid Composio agent assignments.');
  if(row.expiresAt!==undefined&&(typeof row.expiresAt!=='string'||row.expiresAt.length>100||!Number.isFinite(Date.parse(row.expiresAt))))throw Error('Invalid Composio connection expiry.');
  if(portable&&(row.enabled||![...composioTerminalStatuses,'NEEDS_VERIFICATION'].includes(row.status)))throw Error('Portable Composio connections must require verification.');
 }
 for(const [key,id]of Object.entries(value.configurations)){const pair=key.split(':');if(pair.length!==2)throw Error('Invalid Composio authentication metadata.');composioSlug(pair[0]);if(composioScheme(pair[1])!==pair[1])throw Error('Invalid Composio authentication metadata.');composioIdentifier(id,'authentication configuration');}
 return structuredClone(value) as ComposioState;
}
export function portableComposioState(value:unknown):ComposioState{const state=composioState(value);state.connections=state.connections.map(row=>({...row,enabled:false,status:(composioTerminalStatuses as readonly string[]).includes(row.status)?row.status:'NEEDS_VERIFICATION'}));return composioState(state,true);}
const text=(value:unknown,max=4000)=>typeof value==='string'?value.slice(0,max):'';
export function composioHttps(value:unknown,hosts?:readonly string[]):string|undefined{try{if(typeof value!=='string'||value.length>8192)return;const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||hosts&&!hosts.includes(url.hostname))return;return url.href;}catch{return;}}
const fields=(value:unknown):ComposioAuthField[]=>{
 if(!composioRecord(value))return [];
 const result:ComposioAuthField[]=[];
 for(const [key,required]of [['required',true],['optional',false]] as const){if(!Array.isArray(value[key]))continue;for(const item of value[key].slice(0,80)){if(!composioRecord(item)||item.user_visible===false||typeof item.name!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(item.name))continue;const secret=item.is_secret===true;result.push({name:item.name,label:text(item.displayName,200)||item.name,description:text(item.description,2000),required,secret,...(!secret&&typeof item.default==='string'?{defaultValue:item.default.slice(0,1000)}:{})});}}
 return result;
};
export function composioToolkit(value:unknown):ComposioToolkit{
 if(!composioRecord(value))throw Error('Composio returned an invalid connector.');
 const meta=composioRecord(value.meta)?value.meta:{},slug=composioSlug(value.slug),schemes=(Array.isArray(value.auth_schemes)?value.auth_schemes:[]).map(composioScheme),managed=(Array.isArray(value.composio_managed_auth_schemes)?value.composio_managed_auth_schemes:[]).map(composioScheme);
 const authMethods:ComposioAuthMethod[]=(Array.isArray(value.auth_config_details)?value.auth_config_details:[]).slice(0,40).map((method:any)=>{const scheme=composioScheme(method.mode);return {scheme,managed:managed.includes(scheme),configuration:fields(method.fields?.auth_config_creation),connection:fields(method.fields?.connected_account_initiation)};});
 for(const method of authMethods)if(!schemes.includes(method.scheme))schemes.push(method.scheme);
 const noAuth=value.no_auth===true||schemes.includes('NO_AUTH');if(noAuth&&!schemes.length)schemes.push('NO_AUTH');
 return {slug,name:text(value.name,200)||slug,description:text(meta.description),logo:composioHttps(meta.logo),categories:(Array.isArray(meta.categories)?meta.categories:[]).slice(0,50).map((category:any)=>text(category?.name,100)).filter(Boolean),authSchemes:[...new Set(schemes)],managedAuthSchemes:[...new Set(managed)],noAuth,toolCount:Number.isSafeInteger(meta.tools_count)&&meta.tools_count>=0?meta.tools_count:0,version:typeof meta.version==='string'?composioIdentifier(meta.version,'version'):undefined,authMethods};
}
export function composioAccount(value:unknown):ComposioAccount{
 if(!composioRecord(value)||!composioRecord(value.toolkit)||!composioRecord(value.auth_config))throw Error('Composio returned an invalid connection.');
 return {id:composioIdentifier(value.id,'connection'),toolkit:composioSlug(value.toolkit.slug),userId:composioIdentifier(value.user_id,'user'),authConfigId:composioIdentifier(value.auth_config.id,'authentication configuration'),scheme:composioScheme(value.authScheme??value.auth_config.auth_scheme),status:composioScheme(value.status),disabled:value.is_disabled===true||value.auth_config.is_disabled===true,alias:text(value.alias,200)||undefined};
}
function parameters(value:unknown,input:boolean):Record<string,unknown>|undefined{
 if(!composioRecord(value))return;
 if(typeof value.type==='string'){if(input&&value.type!=='object')return;return structuredClone(value);}
 const entries=Object.entries(value);if(!input&&!entries.length)return;
 if(entries.some(([name,field])=>['__proto__','constructor','prototype'].includes(name)||!composioRecord(field)||typeof field.type!=='string'&&!Array.isArray(field.anyOf)&&!Array.isArray(field.oneOf)&&!Array.isArray(field.enum)))return;
 const required=entries.filter(([,field])=>field.required===true).map(([name])=>name);
 return {type:'object',properties:Object.fromEntries(entries.map(([name,field])=>{const {required:fieldRequired,...schema}=field;return [name,typeof fieldRequired==='boolean'?schema:field];})),...(required.length?{required}:{}),additionalProperties:false};
}
export function composioTool(value:unknown):ComposioTool{
 if(!composioRecord(value)||!composioRecord(value.toolkit))throw Error('Composio returned an unsupported tool schema.');const inputSchema=parameters(value.input_parameters,true),outputSchema=parameters(value.output_parameters,false);if(!inputSchema)throw Error('Composio returned an unsupported tool schema.');
 const name=composioIdentifier(value.slug,'tool');if(!/^[A-Z][A-Z0-9_]{0,127}$/.test(name))throw Error('Composio returned an invalid tool name.');
 return {name,description:text(value.description,12000),toolkit:composioSlug(value.toolkit.slug),version:composioIdentifier(value.version,'tool version'),inputSchema,...(outputSchema?{outputSchema}:{}),annotations:{readOnlyHint:Array.isArray(value.tags)&&value.tags.includes('readOnlyHint'),destructiveHint:Array.isArray(value.tags)&&value.tags.includes('destructiveHint')}};
}
