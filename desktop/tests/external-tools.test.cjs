const test=require('node:test'),assert=require('node:assert/strict'),{createServer}=require('node:http');
const {withMcp,mcpAddress}=require('../build/mcp-client.js'),{redactToolData}=require('../build/remote-tools.js');
test('the pinned MCP client negotiates a real HTTP connection, discovers schemas, authenticates calls, and closes its session',async()=>{
 const traffic=[];let writes=0;const server=createServer(async(req,res)=>{
  if(req.method!=='POST'){res.writeHead(405);res.end();return;}let text='';for await(const chunk of req)text+=chunk;const body=JSON.parse(text);traffic.push({body,authorization:req.headers.authorization});res.setHeader('Content-Type','application/json');
  if(!body.id&&body.id!==0){res.writeHead(202);res.end();return;}
  let result;if(body.method==='initialize')result={protocolVersion:'2025-06-18',capabilities:{tools:{}},serverInfo:{name:'Sylvana fixture',version:'1.0.0'}};
  else if(body.method==='tools/list')result={tools:[{name:'record_note',description:'Store a fixture note.',inputSchema:{type:'object',properties:{note:{type:'string'}},required:['note'],additionalProperties:false}}]};
  else if(body.method==='tools/call'){writes++;result={content:[{type:'text',text:'Stored '+body.params.arguments.note}],isError:false};}
  else{res.end(JSON.stringify({jsonrpc:'2.0',id:body.id,error:{code:-32601,message:'Method not found'}}));return;}
  res.end(JSON.stringify({jsonrpc:'2.0',id:body.id,result}));
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{await withMcp('http://127.0.0.1:'+server.address().port+'/mcp','fixture-secret',AbortSignal.timeout(10000),async client=>{const tools=await client.listTools();assert.equal(tools.tools[0].name,'record_note');const result=await client.callTool({name:'record_note',arguments:{note:'A real HTTP exchange'}});assert.equal(result.content[0].text,'Stored A real HTTP exchange');});assert.equal(writes,1);assert(traffic.some(t=>t.body.method==='initialize'));assert(traffic.filter(t=>t.body.method==='tools/call').every(t=>t.authorization==='Bearer fixture-secret'));}
 finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('tool output masks credential fields and protected addresses; MCP addresses exclude privileged schemes',()=>{
 const redacted=redactToolData({password:'secret',nested:[{text:'https://server/mcp?token=EXAMPLE-KEY body EXAMPLE-KEY',api_key:'EXAMPLE-KEY'}]},['EXAMPLE-KEY']);assert(!JSON.stringify(redacted).includes('EXAMPLE-KEY'));assert.equal(redacted.password,'[Protected credential]');assert.throws(()=>mcpAddress('file:///C:/Windows/system.ini'));assert.throws(()=>mcpAddress('http://remote.example/mcp'));assert.throws(()=>mcpAddress('https://user:secret@server/mcp'));assert.equal(mcpAddress('http://localhost:5000/mcp').hostname,'localhost');
});
test('saved tool context retains the newest confirmed result, review arguments and configured history window across providers',()=>{
 const {providerHistory}=require('../build/composer.js');const rows=[{role:'assistant',content:{text:'Older context'},metadata:{tools:[{name:'mcp_call',status:'completed',result:{content:'OLDER '.repeat(40000)}}]}},{role:'assistant',content:{text:'Latest result'},metadata:{tools:[{name:'mcp_call',status:'completed',approval:{source:'Fixture',tool:'record_note',arguments:{note:'LATEST-APPROVED-ARGUMENT'}},result:{content:'LATEST-CONFIRMED-RESULT'}}]}},{role:'user',content:{text:'Continue from the last result.'},metadata:{}}];
 for(const provider of ['openrouter','openai-oauth']){const all=JSON.stringify(providerHistory(rows,provider,true));assert(all.includes('LATEST-CONFIRMED-RESULT'));assert(all.includes('LATEST-APPROVED-ARGUMENT'));const limited=JSON.stringify(providerHistory(rows,provider,true,2));assert(!limited.includes('Older context'));assert(limited.includes('LATEST-CONFIRMED-RESULT'));assert(!limited.includes('truncated'));assert(!JSON.stringify(providerHistory(rows,provider,false)).includes('LATEST-CONFIRMED-RESULT'));}
});
test('legacy HTTP/SSE servers receive authenticated discovery and execution through the fallback transport',async()=>{
 let channel;const authorization=[];const server=createServer(async(req,res)=>{
  authorization.push(req.headers.authorization);
  if(req.method==='GET'&&req.url==='/sse'){channel=res;res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache',Connection:'keep-alive'});res.write('event: endpoint\ndata: /messages\n\n');return;}
  if(req.method!=='POST'||req.url!=='/messages'){res.writeHead(405);res.end();return;}
  let text='';for await(const chunk of req)text+=chunk;const body=JSON.parse(text);res.writeHead(202);res.end();if(body.id===undefined)return;let result;
  if(body.method==='initialize')result={protocolVersion:'2025-06-18',serverInfo:{name:'Legacy fixture',version:'1'},capabilities:{tools:{}}};else if(body.method==='tools/list')result={tools:[{name:'legacy_lookup',inputSchema:{type:'object',properties:{},additionalProperties:false}}]};else if(body.method==='tools/call')result={content:[{type:'text',text:'Legacy server reply'}]};
  channel.write('event: message\ndata: '+JSON.stringify(result?{jsonrpc:'2.0',id:body.id,result}:{jsonrpc:'2.0',id:body.id,error:{code:-32601,message:'Method not found'}})+'\n\n');
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{await withMcp('http://127.0.0.1:'+server.address().port+'/sse','legacy-fixture-token',AbortSignal.timeout(10000),async client=>{assert.equal((await client.listTools()).tools[0].name,'legacy_lookup');assert.equal((await client.callTool({name:'legacy_lookup',arguments:{}})).content[0].text,'Legacy server reply');});assert(authorization.length>2);assert(authorization.every(value=>value==='Bearer legacy-fixture-token'));}
 finally{channel?.end();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
