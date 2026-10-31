const test=require('node:test'),assert=require('node:assert/strict');
const {mkdtemp,readFile,rm}=require('node:fs/promises'),path=require('node:path');
const {SylvanaServices,serviceOperationId}=require('../build/sylvana-services.js');
const owner='12345678-1234-4123-8123-123456789abc',request='22345678-1234-4123-8123-123456789abc';
const options={permission:'ask',mode:'chat',thinking:'default',files:[]};
test('Managed service operation identity is stable and contains no prompt-derived data',()=>{assert.equal(serviceOperationId(owner,request,'call-1'),serviceOperationId(owner,request,'call-1'));assert.notEqual(serviceOperationId(owner,request,'call-1'),serviceOperationId(owner,request,'call-2'));assert.match(serviceOperationId(owner,request,'call-1'),/^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-a[a-f0-9]{3}-[a-f0-9]{12}$/);});
test('Managed audio is saved locally and a video submission returns its existing operation',async()=>{
 const directory=await mkdtemp('F:/Sylvana/verification/managed-media-test-'),calls=[];
 const account={status:()=>({linked:true,simulated:false}),verifySession:async()=>{},providerRequest:async(_owner,route,init)=>{calls.push({route,init});return route==='/v1/audio/speech'?new Response(Buffer.from('synthetic-audio'),{headers:{'Content-Type':'audio/mpeg'}}):Response.json({id:'synthetic-operation',status:'pending'});}};
 const service=new SylvanaServices(account,directory,{list:()=>[]});
 try{const audio=await service.execute(owner,request,'call-1','sylvana_generate',{capability:'audio/speech',model:'sylvana-model',parameters_json:'{"input":"Synthetic words"}',audio_attachment_id:null},options,new AbortController().signal,async()=>{});assert.equal((await readFile(audio.path)).toString(),'synthetic-audio');assert.ok(path.resolve(audio.path).startsWith(path.resolve(directory)+path.sep));assert.equal(new Headers(calls[0].init.headers).get('Idempotency-Key'),serviceOperationId(owner,request,'call-1'));const video=await service.execute(owner,request,'call-2','sylvana_generate',{capability:'videos',model:'sylvana-video',parameters_json:'{"prompt":"Synthetic scene","duration":5}',audio_attachment_id:null},options,new AbortController().signal,async()=>{});assert.equal(video.status,'pending');assert.equal(calls.length,2);}finally{assert.ok(path.resolve(directory).startsWith(path.resolve('F:/Sylvana/verification/managed-media-test-')));await rm(directory,{recursive:true,force:true});}
});
test('Managed generation refuses routing overrides, unselected audio, and plan-mode dispatch',async()=>{
 let calls=0;const service=new SylvanaServices({status:()=>({linked:true,simulated:false}),verifySession:async()=>{},providerRequest:async()=>{calls++;throw Error('Unexpected dispatch');}},'F:/Sylvana/verification/unused-media-output',{list:()=>[]});
 const args={capability:'audio/transcriptions',model:'sylvana-model',parameters_json:'{}',audio_attachment_id:null};
 await assert.rejects(service.execute(owner,request,'c1','sylvana_generate',{...args,parameters_json:'{"provider":{"zdr":false}}'},options,new AbortController().signal,async()=>{}),/routing overrides/);
 await assert.rejects(service.execute(owner,request,'c2','sylvana_generate',{...args,audio_attachment_id:'unselected'},options,new AbortController().signal,async()=>{}),/selected/);
 await assert.rejects(service.execute(owner,request,'c3','sylvana_generate',args,{...options,mode:'plan'},new AbortController().signal,async()=>{}),/supported managed generation/);assert.equal(calls,0);
});
