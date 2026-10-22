const test=require('node:test'),assert=require('node:assert/strict');
const {mkdtemp,writeFile,readFile,mkdir,rm,symlink,link}=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {WorkspaceFiles}=require('../build/workspace.js'),{WorkspaceTools,workspaceDefinitions,hashText}=require('../build/workspace-tools.js');
const {streamTurn}=require('../build/providers.js'),{providerHistory}=require('../build/composer.js');
class Secrets{data=new Map();get(k){return this.data.get(k);}async set(k,v){this.data.set(k,v);}}
test('workspace tools enforce selected roots, credential exclusions, read-only mode, hashes, conflicts, creation, and undo',async()=>{
 const base=await mkdtemp(path.join(os.tmpdir(),'agentopia-tools-')),root=path.join(base,'workspace'),outside=path.join(base,'outside');await mkdir(root);await mkdir(outside);
 const files=new WorkspaceFiles(new Secrets()),tools=new WorkspaceTools(files,[path.join(root,'private')]);
 try{
  await writeFile(path.join(root,'notes.md'),'Original\r\n');await writeFile(path.join(root,'.env'),'DO_NOT_READ');await writeFile(path.join(outside,'outside.md'),'OUTSIDE');await mkdir(path.join(root,'private'));await writeFile(path.join(root,'private','data.md'),'PROTECTED');
  const [reference]=await files.add('owner',[root]),options={permission:'ask',mode:'chat',thinking:'default',files:[reference.id]},args={reference_id:reference.id,path:'notes.md'};
  assert(workspaceDefinitions(options).some(tool=>tool.name==='manage_file'));for(const readonly of [{...options,mode:'plan'},{...options,permission:'files'}]){assert(!workspaceDefinitions(readonly).some(tool=>['write_file','manage_file'].includes(tool.name)));assert(workspaceDefinitions(readonly).some(tool=>tool.name==='inspect_path'));}assert.equal(workspaceDefinitions({...options,permission:'chat'}).length,0);
  const read=await tools.read('owner',options,args);assert.equal(read.content,'Original\r\n');assert.equal(read.sha256,hashText(read.content));
  for(const bad of ['../outside/outside.md','.env','private/data.md','C:\\Windows\\data.md','notes.md:stream'])await assert.rejects(tools.read('owner',options,{...args,path:bad}));
  await assert.rejects(tools.read('other',options,args),/unavailable/);await assert.rejects(tools.read('owner',{...options,files:[]},args),/not selected/);
  const listing=await tools.list('owner',options,{...args,path:''});assert(!listing.entries.some(e=>e.name==='.env'));
  await symlink(outside,path.join(root,'redirect'),'junction');await assert.rejects(tools.read('owner',options,{...args,path:'redirect/outside.md'}),/Linked/);
  await link(path.join(outside,'outside.md'),path.join(root,'linked.md'));await assert.rejects(tools.read('owner',options,{...args,path:'linked.md'}),/Linked/);
  const change={...args,expected_hash:read.sha256,content:'Updated\n',reason:'Update the note.'};
  await assert.rejects(tools.preview('owner',{...options,mode:'plan'},change),/Plan mode off/);await assert.rejects(tools.preview('owner',{...options,permission:'files'},change),/approval/);
  const preview=await tools.preview('owner',options,change);assert.equal(preview.after,'Updated\r\n');assert.equal(await readFile(path.join(root,'notes.md'),'utf8'),'Original\r\n','Preview must not change a file');
  await writeFile(path.join(root,'notes.md'),'External update\r\n');await assert.rejects(tools.apply('owner',options,preview,new AbortController().signal),/changed after review/);assert.equal(await readFile(path.join(root,'notes.md'),'utf8'),'External update\r\n');
  await writeFile(path.join(root,'notes.md'),'Original\r\n');await tools.apply('owner',options,preview,new AbortController().signal);assert.equal(await readFile(path.join(root,'notes.md'),'utf8'),'Updated\r\n');
  await writeFile(path.join(root,'notes.md'),'Newer work');await assert.rejects(tools.revert('owner',preview),/changed after review/);await writeFile(path.join(root,'notes.md'),'Updated\r\n');await tools.revert('owner',preview);assert.equal(await readFile(path.join(root,'notes.md'),'utf8'),'Original\r\n');
  const created=await tools.preview('owner',options,{...args,path:'new.md',expected_hash:null,content:'New file',reason:'Create a note.'});await tools.apply('owner',options,created,new AbortController().signal);assert.equal(await readFile(path.join(root,'new.md'),'utf8'),'New file');await tools.revert('owner',created);await assert.rejects(readFile(path.join(root,'new.md')),{code:'ENOENT'});
  const cancel=new AbortController();cancel.abort();await assert.rejects(tools.apply('owner',options,preview,cancel.signal),{name:'AbortError'});assert.equal(await readFile(path.join(root,'notes.md'),'utf8'),'Original\r\n');
  await files.remove('owner',reference.id);await assert.rejects(tools.apply('owner',options,preview,new AbortController().signal),/unavailable/);
 }finally{assert(path.resolve(base).startsWith(path.resolve(os.tmpdir())+path.sep));await rm(base,{recursive:true,force:true});}
});
test('attachments and tools exclude application storage and native backend paths before reading them',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'agentopia-protected-')),protectedFolder=path.join(root,'app-storage');await mkdir(protectedFolder);await writeFile(path.join(protectedFolder,'settings.json'),'PRIVATE');
 const files=new WorkspaceFiles(new Secrets(),undefined,[protectedFolder]);
 try{
  await assert.rejects(files.add('owner',[path.join(protectedFolder,'settings.json')]),/storage cannot be attached/);
  for(const file of ['\\\\wsl.localhost\\AgentopiaRuntime\\home\\agentopia\\app\\supabase\\config.toml','\\\\wsl$\\AgentopiaRuntime\\home\\agentopia\\app\\supabase\\config.toml',path.join(root,'.supabase','config.toml')])assert.throws(()=>files.checkPath(file),/cannot be attached/);
  const [ref]=await files.add('owner',[root]),context=await files.context('owner',[ref.id],'files');assert(!context[0].text.includes('PRIVATE'));
 }finally{assert(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep));await rm(root,{recursive:true,force:true});}
});
test('Responses tools use a namespace and preserve reasoning, call IDs, and outputs for the continuation',async()=>{
 const definition={name:'read_file',description:'Read a file',parameters:{type:'object',properties:{path:{type:'string'}},required:['path'],additionalProperties:false}},output=[{type:'reasoning',id:'rs_fixture',summary:[],encrypted_content:'opaque-private-reasoning'},{type:'function_call',id:'fc_fixture',call_id:'call_1',name:'read_file',namespace:'workspace',arguments:'{"path":"note.md"}'}];let body;
 const turn=await streamTurn('openai-oauth','fixture','gpt-6.1-sol','Instructions',[],new AbortController().signal,async()=>{},async(_url,args)=>{body=JSON.parse(args.body);return new Response('data: '+JSON.stringify({type:'response.completed',response:{output}})+'\n\n');},'high',[definition]);
 assert.equal(body.tools[0].type,'namespace');assert.equal(body.tools[0].name,'workspace');assert.equal(body.tools[0].tools[0].strict,true);assert.equal(body.store,false);assert.equal(body.parallel_tool_calls,false);assert(!('max_output_tokens' in body));assert.deepEqual(turn.continuation,output);assert.deepEqual(turn.calls,[{id:'call_1',name:'read_file',arguments:'{"path":"note.md"}',namespace:'workspace'}]);
});
test('ChatGPT completion with an empty output array retains the completed streamed tool items',async()=>{
 const output=[{type:'reasoning',id:'rs_live_shape',summary:[],encrypted_content:'opaque'},{type:'function_call',call_id:'call_live_shape',name:'read_file',namespace:'workspace',arguments:'{"path":"note.md"}'}];
 const events=[...output.map((item,output_index)=>({type:'response.output_item.done',item,output_index})),{type:'response.completed',response:{output:[]}}];
 const turn=await streamTurn('openai-oauth','fixture','gpt-6.1-sol','Instructions',[],new AbortController().signal,async()=>{},async()=>new Response(events.map(event=>'data: '+JSON.stringify(event)+'\n\n').join('')),'high',[{name:'read_file',description:'Read',parameters:{}}]);
 assert.equal(turn.calls.length,1);assert.equal(turn.calls[0].id,'call_live_shape');assert.deepEqual(turn.continuation,output);
});
test('OpenRouter collects fragmented tool arguments and preserves its reasoning blocks',async()=>{
 const chunks=[{choices:[{delta:{reasoning_details:[{type:'reasoning.encrypted',data:'opaque',index:0}],tool_calls:[{index:0,id:'call_1',function:{name:'read_file',arguments:'{"path":'}}]}}]},{choices:[{delta:{tool_calls:[{index:0,function:{arguments:'"note.md"}'}}]},finish_reason:'tool_calls'}]}];let body;
 const turn=await streamTurn('openrouter','fixture','openai/gpt-6.1-sol','Instructions',[],new AbortController().signal,async()=>{},async(_url,args)=>{body=JSON.parse(args.body);return new Response(chunks.map(chunk=>'data: '+JSON.stringify(chunk)+'\n\n').join('')+'data: [DONE]\n\n');},'high',[{name:'read_file',description:'Read',parameters:{}}]);
 assert.equal(body.tools[0].function.name,'read_file');assert.equal(body.provider.require_parameters,true);assert(!('parallel_tool_calls' in body),'OpenRouter GPT-6.1 endpoints do not advertise this routing parameter');assert.deepEqual(turn.calls,[{id:'call_1',name:'read_file',arguments:'{"path":"note.md"}'}]);assert.equal(turn.continuation[0].reasoning_details[0].data,'opaque');
 const rows=[{role:'assistant',content:{text:'Read the note.'},metadata:{tools:[{name:'read_file',status:'completed',arguments:{path:'note.md'},result:{content:'FILE_PRIVATE_CONTEXT'}}]}}];assert(JSON.stringify(providerHistory(rows,'openai-oauth',true)).includes('FILE_PRIVATE_CONTEXT'));assert(!JSON.stringify(providerHistory(rows,'openrouter',false)).includes('FILE_PRIVATE_CONTEXT'));
});
