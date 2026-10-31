import {nativeMcpResult} from './mcp-content';
import {createServer,type Server} from 'node:http';
import {randomBytes,timingSafeEqual,randomUUID} from 'node:crypto';
import type {ToolDefinition} from './tool-contracts';

/** Private native MCP transport for the existing Sylvana executor. Native V1
 * children inherit MCP configuration, but not app-server dynamic client tools. */
export class CodexMcp {
 readonly bearer=randomBytes(32).toString('base64url');url='';
 private server:Server;private sessions=new Set<string>();private calls=new Map<string,AbortController>();
 constructor(private definitions:ToolDefinition[],private execute:(threadId:string,name:string,args:unknown,callId:string,signal:AbortSignal)=>Promise<unknown>){
  this.server=createServer((req,res)=>{void(async()=>{
   const auth=Buffer.from(req.headers.authorization??''),expected=Buffer.from('Bearer '+this.bearer);
   if(auth.length!==expected.length||!timingSafeEqual(auth,expected)){res.writeHead(401).end();return;}
   if(req.url!=='/mcp'){res.writeHead(404).end();return;}
   const session=String(req.headers['mcp-session-id']??'');
   if(req.method==='DELETE'){if(this.sessions.delete(session))for(const [key,c] of this.calls)if(key.startsWith(session+':'))c.abort();res.writeHead(204).end();return;}
   if(req.method!=='POST'){res.writeHead(405,{Allow:'POST, DELETE'}).end();return;}
   let size=0;const chunks:Buffer[]=[];for await(const chunk of req){size+=chunk.length;if(size>2*1024*1024){res.writeHead(413).end();return;}chunks.push(chunk);}
   let rpc:any;try{rpc=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!rpc||Array.isArray(rpc)||typeof rpc.method!=='string')throw new Error();}catch{res.writeHead(400).end();return;}
   const reply=(result:unknown,extra:Record<string,string>={})=>{if(!res.destroyed)res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store',...extra}).end(JSON.stringify({jsonrpc:'2.0',id:rpc.id,result}));};
   const error=(message:string)=>{if(!res.destroyed)res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({jsonrpc:'2.0',id:rpc.id,error:{code:-32602,message}}));};
   if(rpc.method==='initialize'){if(this.sessions.size>=16){error('The private MCP connection limit was reached.');return;}const id=randomUUID();this.sessions.add(id);reply({protocolVersion:rpc.params?.protocolVersion??'2025-06-18',capabilities:{tools:{}},serverInfo:{name:'sylvana-host',version:'0.31.0'}},{'Mcp-Session-Id':id});return;}
   if(!this.sessions.has(session)){res.writeHead(404).end();return;}
   if(rpc.method==='notifications/cancelled'){this.calls.get(session+':'+String(rpc.params?.requestId))?.abort();res.writeHead(202).end();return;}
   if(rpc.id===undefined){res.writeHead(202).end();return;}
   if(rpc.method==='ping'){reply({});return;}
   if(rpc.method==='tools/list'){reply({tools:this.definitions.map(d=>({name:d.name,description:d.description,inputSchema:d.parameters,...(d.annotations?{annotations:d.annotations}:{})}))});return;}
   if(rpc.method!=='tools/call'){error('This private MCP method is unavailable.');return;}
   const p=rpc.params,threadId=p?._meta?.threadId,callId=p?._meta?.callId;
   if(typeof threadId!=='string'||typeof callId!=='string'||!callId||callId.length>256||!this.definitions.some(d=>d.name===p?.name)||!p.arguments||typeof p.arguments!=='object'||Array.isArray(p.arguments)){error('This call needs an owned native thread and a declared tool.');return;}
   const key=session+':'+String(rpc.id);if(this.calls.has(key)){error('This MCP request is already executing.');return;}
   const controller=new AbortController();this.calls.set(key,controller);res.once('close',()=>{if(!res.writableFinished)controller.abort();});
   try{const result=await this.execute(threadId,p.name,p.arguments,callId,controller.signal);reply(nativeMcpResult(result));}
   catch{error(controller.signal.aborted?'This tool call was cancelled.':'Sylvana could not authorize or execute this native tool call.');}
   finally{this.calls.delete(key);}
  })().catch(()=>{if(!res.headersSent)res.writeHead(400);res.end();});});
 }
 async start(){await new Promise<void>((resolve,reject)=>{this.server.once('error',reject);this.server.listen(0,'127.0.0.1',resolve);});const address=this.server.address();if(!address||typeof address==='string')throw new Error('The private native tool connection could not start.');this.url=`http://127.0.0.1:${address.port}/mcp`;return this;}
 close(){for(const c of this.calls.values())c.abort();this.calls.clear();this.sessions.clear();this.server.closeAllConnections();this.server.close();}
}
