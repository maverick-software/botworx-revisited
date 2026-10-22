export type McpOAuthDeclaration={type:'none'|'oauth'|'mixed';client?:{mode:'provided'|'dcr'|'cimd';clientId?:string;tokenEndpointAuthMethod?:'none'};baseScopes?:string[];defaultScopes?:string[]};
const object=(value:unknown):value is Record<string,any>=>!!value&&typeof value==='object'&&!Array.isArray(value);
/** Public OpenAI server extension. Keep the pinned portable schema intact and
 * validate this supported extension separately before canonical schema checking. */
export function mcpOAuthDeclaration(extensions:unknown):McpOAuthDeclaration|undefined{
 if(extensions===undefined)return undefined;
 if(!object(extensions)||Object.keys(extensions).some(k=>k!=='com.openai')||!object(extensions['com.openai'])||Object.keys(extensions['com.openai']).some(k=>k!=='auth'))throw Error('Unsupported MCP server extension.');
 const auth=extensions['com.openai'].auth;
 if(!object(auth)||!['none','oauth','mixed'].includes(auth.type)||Object.keys(auth).some(k=>!['type','client','baseScopes','defaultScopes'].includes(k)))throw Error('This host supports discovered OAuth endpoints, public client registration and explicit scopes. Endpoint overrides and confidential client credentials need additional host support.');
 if(auth.type==='none'&&Object.keys(auth).some(k=>k!=='type'))throw Error('An unauthenticated server cannot declare OAuth settings.');
 if(auth.client!==undefined){const c=auth.client;
  if(!object(c)||!['provided','dcr','cimd'].includes(c.mode)||Object.keys(c).some(k=>!['mode','clientId','tokenEndpointAuthMethod'].includes(k)))throw Error('Invalid OAuth client registration declaration.');
  if(c.mode==='provided'){if(typeof c.clientId!=='string'||!c.clientId.trim()||c.clientId.length>2048||/[\r\n]/.test(c.clientId)||c.tokenEndpointAuthMethod!==undefined&&c.tokenEndpointAuthMethod!=='none')throw Error('Provided MCP clients must use a public client ID and tokenEndpointAuthMethod none.');}
  else if(Object.keys(c).some(k=>k!=='mode'))throw Error('Automatic OAuth registration cannot contain provided client credentials.');
 }
 for(const key of ['baseScopes','defaultScopes'])if(auth[key]!==undefined&&(!Array.isArray(auth[key])||auth[key].length>100||auth[key].some((s:unknown)=>typeof s!=='string'||!s.trim()||s.length>200||/[\s\x00-\x1f\x7f]/.test(s))))throw Error('OAuth scopes must be individual nonempty scope strings.');
 return structuredClone(auth) as McpOAuthDeclaration;
}
