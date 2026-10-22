const test=require('node:test'),assert=require('node:assert/strict');
const {mkdtemp,writeFile,mkdir,rm}=require('node:fs/promises');
const path=require('node:path'),os=require('node:os');
const {WorkspaceFiles}=require('../build/workspace.js');
const {chatOptions,modelThinking,validateThinking,providerHistory,selectModel}=require('../build/composer.js');
const {streamText}=require('../build/providers.js');
const {pcmWave}=require('../build/audio.js');const {validateRecording}=require('../build/voice.js');
class Secrets{data=new Map();get(k){return this.data.get(k);}async set(k,v){this.data.set(k,v);}}
test('thinking levels and provider payloads preserve model capabilities and restrictions',async()=>{
 assert.deepEqual(modelThinking({supported_reasoning_efforts:['low','high','invalid']}),['low','high']);
 assert.deepEqual(modelThinking({reasoning:{supported_efforts:['high','medium','low']}}),['low','medium','high']);
 assert.deepEqual(modelThinking({id:'openai/gpt-5.6-sol'}),[]);
 assert.deepEqual(modelThinking({reasoning:{mandatory:true,supported_efforts:['none','low','high']}}),['low','high']);
 assert(!modelThinking({reasoning:{mandatory:true,supported_efforts:null}}).includes('none'));
 assert.throws(()=>validateThinking({id:'plain',name:'Plain',thinking:[]},'high'),/does not advertise/);
 assert.throws(()=>chatOptions({permission:'full-unrestricted'}),/Invalid/);
 const options=chatOptions({mode:'plan',permission:'files',thinking:'high'});assert.equal(options.mode,'plan');
 let body;await streamText('openai-oauth','test','test','Plan',[],new AbortController().signal,async()=>{},async(_url,args)=>{body=JSON.parse(args.body);return new Response('data: {"type":"response.completed"}\n\n');},'high');
 assert.deepEqual(body.reasoning,{effort:'high'});assert.equal(body.store,false);assert.equal(body.stream,true);assert(!('temperature' in body));
 const rows=[{role:'user',content:{text:'Inspect this',files:[{name:'note.md',text:'Context marker'},{name:'image.png',image:'data:image/png;base64,dGVzdA=='}]}}];
 assert(!JSON.stringify(providerHistory(rows,'openai-oauth',false)).includes('Context marker'));
 assert.equal(providerHistory(rows,'openai-oauth',true)[0].content[1].type,'input_image');
 assert.equal(providerHistory(rows,'openrouter',true)[0].content[1].type,'image_url');
});
test('provider selection preserves compatible thinking and restores remembered models without selecting unavailable models',()=>{
 const models=[{id:'vendor/default',name:'Default',thinking:[]},{id:'openai/gpt-5.6-sol',name:'GPT',thinking:['low','high']}];
 assert.deepEqual(selectModel(models,undefined,{model:'gpt-5.6-sol',thinking:'high'},'vendor/default'),{model:'openai/gpt-5.6-sol',thinking:'high'});
 assert.deepEqual(selectModel(models,{model:'vendor/default',thinking:'high'},{model:'gpt-5.6-sol',thinking:'high'}),{model:'vendor/default',thinking:'default'});
 assert.deepEqual(selectModel(models,{model:'removed/model',thinking:'high'},undefined,'vendor/default'),{model:'vendor/default',thinking:'default'});
 assert.equal(selectModel([]),undefined);
});
test('submitted attachments authorize context while ownership, sensitivity, and traversal limits remain enforced',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'agentopia-context-'));const secrets=new Secrets();let approvals=0;
 const files=new WorkspaceFiles(secrets,{showMessageBox:async()=>{approvals++;return {response:0};}});
 try{
  await writeFile(path.join(root,'notes.md'),'Public project notes');await writeFile(path.join(root,'.env'),'SECRET_DO_NOT_SHARE');await mkdir(path.join(root,'.codex'));await writeFile(path.join(root,'.codex','auth.json'),'PRIVATE_AUTH');await mkdir(path.join(root,'sub'));await writeFile(path.join(root,'sub','data.csv'),'a,b\n1,2');
  const refs=await files.add('owner',[root]);assert.equal(refs.length,1);
  await assert.rejects(files.context('other',[refs[0].id],'files'),/another account/);
  await assert.rejects(files.context('owner',[refs[0].id],'chat'),/Chat only/);
  const shared=await files.context('owner',[refs[0].id],'ask');assert(shared[0].text.includes('Public project notes'));assert.deepEqual(await files.context('owner',[refs[0].id],'ask'),shared);assert.equal(approvals,0);
  const cancelled=new AbortController();cancelled.abort();await assert.rejects(files.context('owner',[refs[0].id],'ask',cancelled.signal),/abort/i);
  const context=await files.context('owner',[refs[0].id],'files');assert.equal(context[0].fileCount,2);assert(context[0].text.includes('Public project notes'));assert(!JSON.stringify(context).includes('SECRET_DO_NOT_SHARE'));assert(!JSON.stringify(context).includes('PRIVATE_AUTH'));
  await assert.rejects(files.add('owner',[path.join(root,'.env')]),/Credential/);
  await files.remove('owner',refs[0].id);assert.equal(files.list('owner').length,0);
 }finally{const target=path.resolve(root),base=path.resolve(os.tmpdir());assert(target.startsWith(base+path.sep));await rm(target,{recursive:true,force:true});}
});
test('microphone WAV encoding downsamples correctly and rejects malformed recordings',()=>{
 const wave=pcmWave([new Float32Array(48000).fill(.1)],48000);const bytes=Buffer.from(wave);assert.equal(bytes.length,32044);assert.equal(bytes.readUInt32LE(24),16000);assert.equal(validateRecording(bytes.toString('base64')).length,32044);
 assert.throws(()=>validateRecording(Buffer.from('not audio').toString('base64')),/Record mono/);const malformed=Buffer.from(bytes);malformed.writeUInt16LE(2,22);assert.throws(()=>validateRecording(malformed.toString('base64')),/Record mono/);
});
test('picking a registered file again returns its selected ID, and cancelling selects nothing',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'agentopia-pick-')),file=path.join(root,'notes.md');
 let canceled=false;const files=new WorkspaceFiles(new Secrets(),{showOpenDialog:async()=>({canceled,filePaths:canceled?[]:[file]})});
 try{
  await writeFile(file,'Selected twice');const original=await files.add('owner',[file]);
  const picked=await files.pick('owner','file');assert.deepEqual(picked.selected,[original[0].id]);assert.equal(picked.references.length,1);
  canceled=true;const dismissed=await files.pick('owner','file');assert.deepEqual(dismissed.selected,[]);assert.equal(dismissed.references.length,1);
 }finally{assert(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep));await rm(root,{recursive:true,force:true});}
});
