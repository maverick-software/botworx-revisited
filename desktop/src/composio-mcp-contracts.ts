import type {McpOAuthDeclaration} from './mcp-oauth-declaration';
export const composioMcpPluginName='composio-connect';
export const composioMcpConnectionId='fa0cfe26-d488-4893-9184-0444c412559a';
export const composioMcpUrl='https://connect.composio.dev/mcp';
export const composioMcpAuth:McpOAuthDeclaration={type:'oauth',client:{mode:'dcr'},baseScopes:['offline_access']};
export type ComposioMcpStatus={connected:boolean;enabled:boolean;assignments:string[]};
export function isComposioServicePluginName(value:unknown):value is string{return typeof value==='string'&&/^composio-service-[a-f0-9]{32}$/.test(value);}
/** Account/agent capabilities are independent of optional per-chat connector chips. */
export function automaticComposioSource(source:{plugin?:string}){return source.plugin==='composio'||isComposioServicePluginName(source.plugin);}
