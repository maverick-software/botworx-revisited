const test=require('node:test'),assert=require('node:assert/strict');
const {Terminal}=require('../build/terminal.js'),{streamTurn}=require('../build/providers.js');
test('Windows command tools use the proven workspace namespace instead of ChatGPT reserved computer namespace',async()=>{
 const tools=Terminal.prototype.definitions.call({permissions:()=>({enabled:true}),sessions:{definitions:()=>[]},workspace:{references:()=>[{kind:'folder'}]}},{id:'fixture',admin:true},{mode:'chat',permission:'ask',files:['selected']});
 assert.equal(tools.length,1);assert.equal(tools[0].name,'run_command');assert.equal(tools[0].namespace,'workspace');
 await streamTurn('openai-oauth','fixture','model','',[],new AbortController().signal,async()=>{},async(url,args)=>{const body=JSON.parse(args.body);assert.deepEqual(body.tools.map(t=>t.name),['workspace']);assert.equal(body.tools[0].tools[0].name,'run_command');return new Response('data: {"type":"response.completed"}\n\n');},'high',tools);
});
