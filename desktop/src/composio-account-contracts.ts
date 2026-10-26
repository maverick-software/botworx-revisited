export type ComposioServiceStatus='connected'|'not_connected'|'unknown'|'needs_sign_in'|'needs_account'|'unavailable';
export type ComposioServiceAccount={id:string;alias?:string;status:string};
export type ComposioService={slug:string;name:string;toolCount:number;triggerCount:number;assignable:boolean;connected:boolean;hasActiveAccounts?:boolean;requiresAccountSelection?:boolean;status:ComposioServiceStatus;accounts:ComposioServiceAccount[];selectedAccountId?:string;checkedAt?:string;error?:string};
export type ComposioServiceCatalog={items:ComposioService[];total:number;nextCursor?:string;provenance:{source:string;updatedAt:string;count:number};connected:boolean;scan:{checked:number;total:number;complete:boolean};cached?:boolean};
export type ComposioConnectedInventory={services:ComposioService[];complete:boolean;checked:number;total:number;catalogRevision:string};
export type ComposioServiceAuthorization={token:string;grant:string;stamp:string};
export type ComposioServiceDescriptor={name:string;description?:string;inputSchema:Record<string,unknown>;outputSchema?:Record<string,unknown>;annotations?:Record<string,unknown>};
export const composioReservedToolkits=new Set(['composio','tool_router','composio_tool_router','meta_tools','managed_auth','manage_auth']);
export function composioServiceSlug(value:unknown){if(typeof value!=='string'||!/^_?[a-z0-9][a-z0-9_]{0,99}$/.test(value))throw Error('Choose a published Composio service.');return value;}
export function composioServiceAssignable(slug:string,toolCount:number){return toolCount>0&&!composioReservedToolkits.has(slug);}
