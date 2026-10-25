import type {McpOAuthDeclaration} from './mcp-oauth-declaration';
export const composioMcpPluginName='composio-connect';
export const composioMcpConnectionId='fa0cfe26-d488-4893-9184-0444c412559a';
export const composioMcpUrl='https://connect.composio.dev/mcp';
export const composioMcpAuth:McpOAuthDeclaration={type:'oauth',client:{mode:'dcr'},baseScopes:['offline_access']};
export type ComposioMcpStatus={connected:boolean;enabled:boolean;assignments:string[]};
