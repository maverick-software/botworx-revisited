import {Client,StreamableHTTPClientTransport,SSEClientTransport} from '@modelcontextprotocol/client';

export function mcpAddress(value:unknown){
 if(typeof value!=='string'||value.length>8192)throw new Error('Enter a complete MCP server address.');
 let url:URL;try{url=new URL(value);}catch{throw new Error('Enter a complete MCP server address.');}
 if(url.username||url.password||url.hash||url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw new Error('Use HTTPS, or HTTP for a local MCP server, without a username or password in the address.');return url;
}
export type McpCredential=string|undefined|((signal:AbortSignal)=>Promise<string|undefined>);
export async function withMcp<T>(address:string,token:McpCredential,signal:AbortSignal,operation:(client:Client)=>Promise<T>):Promise<T>{
 const url=mcpAddress(address),deadline=AbortSignal.any([signal,AbortSignal.timeout(90000)]);
 const guardedFetch:typeof fetch=async(input,init)=>{
  const target=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(target.origin!==url.origin)throw new Error('MCP requests must remain on the configured server.');
  deadline.throwIfAborted();const headers=new Headers(init?.headers??(input instanceof Request?input.headers:undefined));if(typeof token==='function'){const current=await token(deadline);if(current)headers.set('Authorization','Bearer '+current);else headers.delete('Authorization');}deadline.throwIfAborted();
  const response=await fetch(input,{...init,headers,redirect:'error',credentials:'omit',signal:AbortSignal.any([deadline,...(init?.signal?[init.signal]:[])])});
  if(!response.body)return response;const reader=response.body.getReader();let size=0;
  return new Response(new ReadableStream({async pull(controller){try{const value=await reader.read();if(value.done){controller.close();return;}size+=value.value.byteLength;if(size>4*1024*1024){await reader.cancel();controller.error(new Error('The MCP response exceeds the local size limit.'));return;}controller.enqueue(value.value);}catch(e){controller.error(e);}},cancel:reason=>reader.cancel(reason)}),{status:response.status,statusText:response.statusText,headers:response.headers});
 };
 const options={fetch:guardedFetch,requestInit:{headers:new Headers(typeof token==='string'&&token?{Authorization:'Bearer '+token}:undefined)}};let client:Client|undefined;
 try{
  client=new Client({name:'Sylvana',version:'0.8.0'},{versionNegotiation:{mode:'auto'}});
  try{await client.connect(new StreamableHTTPClientTransport(url,options),{signal:deadline,timeout:15000});}
  catch(error){await client.close().catch(()=>{});deadline.throwIfAborted();const code=(error as any)?.code??(error as any)?.status;if(code===401||code===403)throw error;
   client=new Client({name:'Sylvana',version:'0.8.0'},{versionNegotiation:{mode:'auto'}});await client.connect(new SSEClientTransport(url,options),{signal:deadline,timeout:15000});
  }
  return await operation(client);
 }finally{await client?.close().catch(()=>{});}
}
