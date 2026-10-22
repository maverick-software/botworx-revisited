import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import {request} from 'node:https';
import {publicOAuthAddress} from './mcp-oauth-network';

export const maxComposioUploadBytes=20*1024*1024;
export type ComposioUploadNetwork=(url:URL,bytes:Uint8Array,mimetype:string,signal:AbortSignal)=>Promise<number>;
export function composioUploadUrl(value:unknown):URL{
 if(typeof value!=='string'||value.length>16384)throw Error('Composio returned an invalid upload destination.');let url:URL;try{url=new URL(value);}catch{throw Error('Composio returned an invalid upload destination.');}
 if(url.protocol!=='https:'||url.username||url.password||url.hash||url.port&&url.port!=='443'||!url.hostname.includes('.')||isIP(url.hostname.replace(/^\[|\]$/g,''))||/(?:^|\.)(?:localhost|local|internal|test|invalid|example)$/.test(url.hostname))throw Error('Composio returned an invalid upload destination.');return url;
}
/** Only the authenticated Composio presign response supplies this URL. Resolve
 * and pin a public address; send file bytes without API keys, cookies or redirects. */
export function createComposioUploadNetwork(dependencies:{lookup?:typeof lookup;request?:typeof request}={}):ComposioUploadNetwork{return async(url,bytes,mimetype,signal)=>{
 signal.throwIfAborted();const checked=composioUploadUrl(url.href),addresses=await (dependencies.lookup??lookup)(checked.hostname,{all:true});signal.throwIfAborted();if(!addresses.length||addresses.some(row=>!publicOAuthAddress(row.address)))throw Error('Composio returned a private upload destination.');
 const selected=addresses[0],active=AbortSignal.any([signal,AbortSignal.timeout(120000)]);active.throwIfAborted();return new Promise<number>((resolve,reject)=>{
  const req=(dependencies.request??request)(checked,{method:'PUT',agent:false,headers:{'Content-Type':mimetype},signal:active,lookup:((_host:any,options:any,callback:any)=>options?.all?callback(null,[selected]):callback(null,selected.address,selected.family)) as any},res=>{const status=res.statusCode??500;let count=0;res.on('data',(chunk:Buffer)=>{count+=chunk.length;if(count>8192)res.destroy(Error('Unexpected upload response.'));});res.on('error',()=>reject(Error('The file transfer was not confirmed.')));res.on('end',()=>resolve(status));});req.on('error',()=>reject(Error('The file transfer was not confirmed.')));req.end(bytes);
 });
};}
export const composioUploadNetwork=createComposioUploadNetwork();
