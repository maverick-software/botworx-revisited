const test=require('node:test'),assert=require('node:assert/strict');
const {generateImage,rasterImageType}=require('../build/image-generation-transport.js');
const {imageConnection,imageGenerationArguments,imageGenerationTool}=require('../build/image-generation-contracts.js');
const {CodexMcp}=require('../build/codex-mcp.js');
const {validateToolDescriptor}=require('../build/plugin-validation.js');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7FkAAAAASUVORK5CYII=','base64');
const input=()=>({prompt:'Generated qualification image',transparentBackground:false,references:[]}),connection={enabled:true,provider:'openrouter',model:'openai/gpt-image-2'};
const context=(fetch,extra={})=>({signal:new AbortController().signal,credential:async()=> 'CONTROLLED-NOT-A-LIVE-KEY',validate:async()=>{},dispatched:async()=>{},fetch,...extra});
const response=()=>new Response(JSON.stringify({data:[{b64_json:png.toString('base64'),media_type:'image/png'}],usage:{cost:0.01}}),{headers:{'content-type':'application/json','x-request-id':'controlled-image-request'}});

test('image schema requires explicit provider/model and contains no credential or arbitrary endpoint',()=>{
 assert.deepEqual(imageConnection(connection),connection);assert.throws(()=>imageConnection({...connection,provider:'openai-oauth'}));assert.throws(()=>imageConnection({...connection,endpoint:'https://example.com'}));assert.throws(()=>imageConnection({...connection,model:''}));assert.throws(()=>imageConnection({...connection,model:'https://example.com'}));assert.throws(()=>imageConnection({...connection,model:'x/../key'}));
 assert.equal(imageGenerationTool.name,'generate_image');assert.equal(imageGenerationTool.parameters.properties.references.maxItems,5);assert(!JSON.stringify(imageGenerationTool.parameters).includes('credential'));
});
test('agent arguments accept selected reference identities and reject URLs, keys and model overrides',()=>{
 const args={prompt:'Edit the selected image',transparent_background:false,references:[{kind:'attachment',id:'11111111-1111-4111-8111-111111111111'}]};assert.deepEqual(imageGenerationArguments(args),args);
 for(const patch of [{model:'another/expensive-model'},{credential:'hidden'},{references:[{kind:'attachment',id:'https://example.com/private.png'}]},{references:[{kind:'attachment',id:args.references[0].id,url:'https://example.com'}]},{references:[...args.references,...args.references]}])assert.throws(()=>imageGenerationArguments({...args,...patch}));
});
test('the private native MCP catalog carries the validated schema and non-idempotent image annotations',async()=>{
 const descriptor={name:imageGenerationTool.name,description:imageGenerationTool.description,inputSchema:imageGenerationTool.parameters,annotations:imageGenerationTool.annotations};assert.equal(validateToolDescriptor(descriptor),descriptor);
 let executions=0;const server=await new CodexMcp([imageGenerationTool],async()=>{executions++;return {};}).start();try{const headers={Authorization:'Bearer '+server.bearer,'Content-Type':'application/json'},init=await fetch(server.url,{method:'POST',headers,body:JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18'}})}),session=init.headers.get('mcp-session-id');assert(session);await init.json();const listed=await fetch(server.url,{method:'POST',headers:{...headers,'Mcp-Session-Id':session},body:JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/list'})});const value=await listed.json();assert.deepEqual(value.result.tools,[descriptor]);assert.equal(value.result.tools[0].annotations.idempotentHint,false);assert.equal(executions,0);}finally{server.close();}
});
test('OpenRouter uses one explicit image request with no connection/provider fallback or URL downloads',async()=>{
 let calls=0,dispatches=0,validations=0;const result=await generateImage(connection,input(),context(async(url,init)=>{calls++;assert.equal(url,'https://openrouter.ai/api/v1/images');assert.equal(init.redirect,'error');const body=JSON.parse(init.body);assert.equal(body.model,connection.model);assert.equal(body.n,1);assert.equal(body.output_format,'png');assert.equal(body.provider.allow_fallbacks,false);assert(!body.models);return response();},{validate:async()=>{validations++;},dispatched:async()=>{dispatches++;}}));
 assert.equal(calls,1);assert.equal(dispatches,1);assert.equal(validations,3);assert.equal(result.costUSD,0.01);assert(result.bytes.equals(png));assert.equal(result.mediaType,'image/png');assert.equal(result.providerRequestId,'controlled-image-request');
});
test('reference edits transmit authorized bytes as data URLs and preserve requested transparency',async()=>{
 await generateImage(connection,{...input(),transparentBackground:true,references:[{bytes:png,mediaType:'image/png'}]},context(async(_url,init)=>{const body=JSON.parse(init.body);assert.equal(body.background,'transparent');assert.equal(body.input_references[0].image_url.url,'data:image/png;base64,'+png.toString('base64'));return response();}));
});
test('separate OpenAI API generation and multipart editing use their documented endpoints',async()=>{
 const api={...connection,provider:'openai-api',model:'gpt-image-2.5-sunburst'};
 await generateImage(api,input(),context(async(url,init)=>{assert.equal(url,'https://api.openai.com/v1/images/generations');assert.equal(JSON.parse(init.body).model,api.model);return response();}));
 await generateImage(api,{...input(),references:[{bytes:png,mediaType:'image/png'}]},context(async(url,init)=>{assert.equal(url,'https://api.openai.com/v1/images/edits');assert(init.body instanceof FormData);assert.equal(init.body.get('model'),api.model);assert.equal(init.body.getAll('image[]').length,1);assert(!init.headers['Content-Type']);return response();}));
});
test('authorization loss, invalid references and failed durable receipt prevent network dispatch',async()=>{
 for(const extra of [{validate:async()=>{throw Error('revoked');}},{credential:async()=>''},{dispatched:async()=>{throw Error('storage unavailable');}}]){let calls=0;await assert.rejects(generateImage(connection,input(),context(async()=>{calls++;return response();},extra)),e=>e.outcome==='before-dispatch');assert.equal(calls,0);}
 let calls=0;await assert.rejects(generateImage(connection,{...input(),references:[{bytes:png,mediaType:'image/jpeg'}]},context(async()=>{calls++;return response();})),e=>e.outcome==='before-dispatch');assert.equal(calls,0);
});
test('definite HTTP rejection and uncertain transport/server outcomes are distinct and never retried',async()=>{
 for(const [status,outcome]of [[400,'rejected'],[401,'rejected'],[402,'rejected'],[403,'rejected'],[429,'rejected'],[408,'uncertain'],[500,'uncertain'],[502,'uncertain']]){let calls=0;await assert.rejects(generateImage(connection,input(),context(async()=>{calls++;return new Response(JSON.stringify({error:{code:'controlled_rejection'}}),{status});})),e=>e.outcome===outcome&&e.httpStatus===status&&e.providerCode==='controlled_rejection');assert.equal(calls,1);}
 let calls=0;await assert.rejects(generateImage(connection,input(),context(async()=>{calls++;throw Error('CONTROLLED-NOT-A-LIVE-KEY should never be echoed');})),e=>e.outcome==='uncertain'&&!e.message.includes('CONTROLLED'));assert.equal(calls,1);
});
test('cancellation before dispatch sends nothing; cancellation or revocation after dispatch never publishes',async()=>{
 const before=new AbortController();before.abort();let calls=0;await assert.rejects(generateImage(connection,input(),context(async()=>{calls++;return response();},{signal:before.signal})),e=>e.outcome==='before-dispatch');assert.equal(calls,0);
 const after=new AbortController();await assert.rejects(generateImage(connection,input(),context(async()=>{after.abort();return response();},{signal:after.signal})),e=>e.outcome==='uncertain');
 let checks=0;await assert.rejects(generateImage(connection,input(),context(async()=>response(),{validate:async()=>{if(++checks===3)throw Error('revoked');}})),e=>e.outcome==='uncertain');
});
test('untrusted output URLs, malformed encoding and MIME conflicts are discarded without further requests',async()=>{
 for(const data of [[{url:'https://example.com/private.png'}],[{b64_json:'not base64'}],[{b64_json:png.toString('base64'),media_type:'image/svg+xml'}],[{b64_json:Buffer.from('<svg>unsafe</svg>').toString('base64')}],[]]){let calls=0;await assert.rejects(generateImage(connection,input(),context(async()=>{calls++;return new Response(JSON.stringify({data}));})),e=>e.outcome==='uncertain');assert.equal(calls,1);}
 assert.equal(rasterImageType(png),'image/png');assert.throws(()=>rasterImageType(Buffer.from('<svg>unsafe</svg>')));
});
