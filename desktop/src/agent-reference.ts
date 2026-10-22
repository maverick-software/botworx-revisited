import {redactCredentialText} from './terminal-runner';
/** Sanitize saved references before paging; preserve long text so later pages exist. */
export function agentReference(value:unknown,depth=0):any{
 if(depth>20)return '[Further nested reference data omitted]';
 if(typeof value==='string')return redactCredentialText(value).replace(/([?&](?:token|key|secret|password|api_key|authorization)=)[^\s&#"<>]+/gi,'$1[Protected credential]');
 if(Array.isArray(value))return value.map(item=>agentReference(item,depth+1));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!['__proto__','constructor','prototype'].includes(key)).map(([key,item])=>[key,/(?:password|authorization|api.?key|access.?token|refresh.?token|client.?secret|bearer)/i.test(key)?'[Protected credential]':agentReference(item,depth+1)]));
 return value;
}
