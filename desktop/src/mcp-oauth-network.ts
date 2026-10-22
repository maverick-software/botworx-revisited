import {lookup} from 'node:dns/promises';
import {BlockList,isIP} from 'node:net';
import {request as httpRequest} from 'node:http';
import {request as httpsRequest} from 'node:https';
import {mcpAddress} from './mcp-client';

const blocked4=new BlockList(),blocked6=new BlockList();
for(const [address,prefix] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]] as const)blocked4.addSubnet(address,prefix,'ipv4');
for(const [address,prefix] of [['::',96],['::ffff:0:0',96],['2001::',32],['2001:db8::',32],['2002::',16],['fc00::',7],['fe80::',10],['ff00::',8]] as const)blocked6.addSubnet(address,prefix,'ipv6');
blocked6.addAddress('::1','ipv6');
export function publicOAuthAddress(address:string){const family=isIP(address);return family===4?!blocked4.check(address,'ipv4'):family===6&&/^[23]/i.test(address)&&!blocked6.check(address,'ipv6');}
const loopback=(url:URL)=>['localhost','127.0.0.1','[::1]'].includes(url.hostname);
/** OAuth discovery can cross origins. Resolve and pin the checked address for
 * this request; redirects, cookies, ambient credentials and private destinations
 * are never followed. A configured loopback MCP may use loopback auth fixtures. */
export function oauthNetwork(resource:string,signal:AbortSignal){
 const base=mcpAddress(resource);
 return async(input:Parameters<typeof fetch>[0],init:RequestInit={},headersOnly=false):Promise<Response>=>{
  const url=mcpAddress(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  const local=loopback(base)&&loopback(url);if(!local&&url.protocol!=='https:')throw Error('OAuth endpoints must use HTTPS.');
  const hostname=url.hostname.replace(/^\[|\]$/g,'');
  const addresses=isIP(hostname)?[{address:hostname,family:isIP(hostname)}]:await lookup(hostname,{all:true});
  if(!addresses.length||addresses.some(value=>local?!['127.0.0.1','::1'].includes(value.address):!publicOAuthAddress(value.address)))throw Error('OAuth discovery cannot access private network addresses.');
  const selected=addresses[0],deadline=AbortSignal.any([signal,AbortSignal.timeout(30000),...(init.signal?[init.signal]:[])]);deadline.throwIfAborted();
  const headers=new Headers(init.headers);headers.delete('cookie');headers.delete('proxy-authorization');headers.delete('host');const outgoing:Record<string,string>={};headers.forEach((value,name)=>{outgoing[name]=value;});
  const body=init.body===undefined||init.body===null?undefined:typeof init.body==='string'?init.body:init.body instanceof URLSearchParams?init.body.toString():undefined;
  if(init.body!=null&&body===undefined)throw Error('Unsupported OAuth request body.');
  return new Promise<Response>((resolve,reject)=>{
   const req=(url.protocol==='https:'?httpsRequest:httpRequest)(url,{method:init.method??'GET',headers:outgoing,signal:deadline,lookup:((_host:any,_options:any,callback:any)=>callback(null,selected.address,selected.family)) as any},res=>{
    const responseHeaders=new Headers();for(const [key,value]of Object.entries(res.headers))if(value!==undefined)responseHeaders.set(key,Array.isArray(value)?value.join(', '):value);
    if(headersOnly){resolve(new Response(null,{status:res.statusCode??500,headers:responseHeaders}));res.destroy();return;}
    const chunks:Buffer[]=[];let bytes=0;res.on('data',(chunk:Buffer)=>{bytes+=chunk.length;if(bytes>1024*1024)res.destroy(Error('OAuth response exceeds 1 MB.'));else chunks.push(chunk);});
    res.on('error',reject);res.on('end',()=>resolve(new Response([204,205,304].includes(res.statusCode??500)?null:Buffer.concat(chunks),{status:res.statusCode??500,headers:responseHeaders})));
   });req.on('error',reject);req.end(body);
  });
 };
}
