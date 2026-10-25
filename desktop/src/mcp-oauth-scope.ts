import {creationResourcePrincipal,type CreationResourcePrincipal} from './creation-resource-principal';
import {draftPreviewId} from './agent-draft-preview-contracts';

export type SavedMcpOAuthScope={owner:string;agent:string;connection:string;creation?:never};
export type CreationMcpOAuthScope={owner:string;creation:CreationResourcePrincipal;connection:string;agent?:never};
export type AccountMcpOAuthScope={owner:string;accountConnector:'composio';agent?:never;connection?:never;creation?:never};
export type McpOAuthScope=SavedMcpOAuthScope|CreationMcpOAuthScope|AccountMcpOAuthScope;
export function accountOAuthScope(scope:McpOAuthScope):scope is AccountMcpOAuthScope{return 'accountConnector' in scope;}
export function creationOAuthScope(scope:McpOAuthScope):scope is CreationMcpOAuthScope{return scope.creation!==undefined;}
/** The namespaces stay separate even if all caller-supplied UUIDs coincide.
 * A selection revision is validated by the target resolver; a retained app's
 * credentials remain bound to the same owner, principal and declared server. */
export function mcpOAuthScopeKey(scope:McpOAuthScope){
 if(accountOAuthScope(scope)){if(scope.accountConnector!=='composio'||Object.keys(scope).some(key=>!['owner','accountConnector'].includes(key)))throw Error('Choose one owned account connection.');const owner=draftPreviewId(scope.owner);if(owner!==scope.owner)throw Error('Refresh the canonical account connection owner.');return 'mcp-oauth-account:'+owner+':composio';}
 if(creationOAuthScope(scope)){
  if(Object.keys(scope).some(key=>!['owner','creation','connection'].includes(key)))throw Error('Choose one owned creation sign-in scope.');
  const principal=creationResourcePrincipal(scope.creation),owner=draftPreviewId(scope.owner),connection=draftPreviewId(scope.connection);
  if(owner!==scope.owner||connection!==scope.connection)throw Error('Refresh the canonical creation sign-in scope.');
  return 'mcp-oauth-creation:'+owner+':'+principal.id+':'+connection;
 }
 if(Object.hasOwn(scope,'creation'))throw Error('Choose one owned MCP sign-in scope.');
 return 'mcp-oauth:'+scope.owner+':'+scope.agent+':'+scope.connection;
}
