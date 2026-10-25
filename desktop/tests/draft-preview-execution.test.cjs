const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),os=require('node:os');
const {mkdtemp,mkdir,writeFile,rename,rm}=require('node:fs/promises');
const build=process.env.AGENTOPIA_PREVIEW_BUILD||path.resolve(__dirname,'../build');
const {DraftPreviewExecution,previewDigest}=require(path.join(build,'draft-preview-execution.js')),{agentDraftPreviewInput,draftPreviewOptions}=require(path.join(build,'agent-draft-preview-contracts.js')),{WorkspaceFiles}=require(path.join(build,'workspace.js')),{WorkspaceTools}=require(path.join(build,'workspace-tools.js')),{ToolService}=require(path.join(build,'tool-service.js'));
const {AttachmentImages,imageData}=require(path.join(build,'attachment-images.js'));
const png=require('../../scripts/desktop/preview-clipboard104-png.cjs').png,secondPng=Buffer.concat([png,Buffer.from('second generated image')]),cipher={isEncryptionAvailable:()=>true,encryptString:value=>Buffer.from('TEST:'+value),decryptString:value=>{assert(value.toString().startsWith('TEST:'));return value.toString().slice(5);}};
const owner='11111111-1111-4111-8111-111111111111',other='99999999-9999-4999-8999-999999999999',id='22222222-2222-4222-8222-222222222222',session='33333333-3333-4333-8333-333333333333';
const policy=()=>({tools:null,delegation:true,delegateAgents:null,memory:true,memoryWrite:true,maxDepth:2,maxTurns:10}),user={id:owner,email:'capture@example.invalid',admin:true};
const input=(files=[],execution={})=>agentDraftPreviewInput({sessionId:session,requestId:id,sourceAgentId:null,text:'Test the selected generated folder.',snapshot:{name:'Draft reader',description:'Generated execution snapshot',instructions:'Retain the requested facts.',personality:'',provider:'openai-oauth',model:'fixture-model',thinking:'default',behavior:{handle:'draft-reader',role:'Review handoffs.',sops:'Read first.',guardrails:'Preserve input.',skills:[],policy:policy()},execution:{permission:'ask',mode:'chat',files,...execution}}});
class Secrets{rows=new Map();get(key){return this.rows.get(key);}async set(key,value){this.rows.set(key,value);}}
async function fixture(t){
 const base=await mkdtemp(path.join(os.tmpdir(),'draft-execution-'));t.after(async()=>{const target=path.resolve(base),parent=path.resolve(os.tmpdir());assert(target.startsWith(parent+path.sep)&&path.basename(target).startsWith('draft-execution-'));await rm(target,{recursive:true,force:true});});
 const folder=path.join(base,'workspace');await mkdir(folder);await writeFile(path.join(folder,'note.md'),'Original note\n');const secrets=new Secrets(),images=new AttachmentImages(path.join(base,'private-images'),cipher,bytes=>bytes),files=new WorkspaceFiles(secrets,{},[path.join(base,'private-images')],images),[reference]=await files.add(owner,[folder]),workspace=new WorkspaceTools(files),f={base,folder,files,reference,secrets,images,identity:{...user},allowed:true};
 const tools=new ToolService({from(){throw Error('Capture must not create database rows.');}},workspace,()=>{},async()=>f.identity,undefined,undefined,{authorize(current){assert(current.admin);}}),engine=new DraftPreviewExecution(files,tools),signal=new AbortController().signal,validate=async()=>{if(!f.allowed)throw Error('Source revoked.');};
 const capture=value=>engine.capture(f.identity,value,signal,validate),request=(value,context)=>({id,user_id:owner,conversation_id:session,snapshot:value.snapshot,execution_context:context,input_text:value.text,output_text:'',status:'running',created_at:'2026-10-23T00:00:00Z'});
 return Object.assign(f,{tools,engine,signal,validate,capture,request});
}
test('preview selection rejects execution authority injection and copies normal selected options',()=>{
 const value=input([id],{files:[id,id]});assert.deepEqual(value.snapshot.execution.files,[id]);assert.equal(draftPreviewOptions(value.snapshot).harness,'codex');
 for(const extra of [{harness:'legacy'},{goalId:id},{provider:'openrouter'},{thinking:'ultra'},{execution_context:{}},{files:['invalid']},{windows:['0'.repeat(36)]}])assert.throws(()=>input([],{...extra}));
});
test('capture resolves owned files, input context and root bindings before creating a bounded tool frame',async t=>{
 const f=await fixture(t),value=input([f.reference.id]),context=await f.capture(value),{key,...body}=context;assert.equal(key,previewDigest(body));assert.equal(context.owner,owner);assert.deepEqual(context.options.files,[f.reference.id]);assert.equal(context.references[0].path,f.folder);assert.equal(context.roots[0].id,f.reference.id);assert(context.inputFiles.some(file=>file.name===path.basename(f.folder)));assert(context.definitions.some(tool=>tool.name==='write_file'));assert(!context.definitions.some(tool=>tool.name==='manage_file'));assert.equal(context.policy.delegation,true);assert.equal(context.policy.memory,false);assert.notEqual(context.policy.tools,null);
 await f.engine.validate(user,f.request(value,context),f.signal,f.validate);const frame=await f.engine.frame(user,f.request(value,context),f.signal,f.validate);assert.equal(frame.key,key);
});
test('read-only and Chat only frames retain their actual permissions and expose no write tool',async t=>{
 const f=await fixture(t);for(const permission of ['files','chat']){const value=input(permission==='chat'?[]:[f.reference.id],{permission}),context=await f.capture(value);assert(!context.definitions.some(tool=>tool.name==='write_file'));if(permission==='chat')assert.equal(context.definitions.length,0);}
 await assert.rejects(f.capture(input([f.reference.id],{permission:'chat'})),/Chat only blocks/);await assert.rejects(f.capture(input([],{windows:[id]})),/unavailable or revoked/);
});
test('a forgotten reference, foreign owner or replaced folder invalidates the accepted execution bindings',async t=>{
 const f=await fixture(t),value=input([f.reference.id]),context=await f.capture(value),request=f.request(value,context);await rename(f.folder,f.folder+'-retained');await mkdir(f.folder);await writeFile(path.join(f.folder,'note.md'),'Replacement\n');await assert.rejects(f.engine.validate(user,request,f.signal,f.validate),/resource changed/);
 await f.files.remove(owner,f.reference.id);await assert.rejects(f.engine.validate(user,request,f.signal,f.validate),/resource changed/);f.identity={...user,id:other};await assert.rejects(f.engine.capture(f.identity,value,f.signal,f.validate),/unavailable for this account/);
});
test('selected single-file replacement preserves the parent binding while keeping the accepted input snapshot',async t=>{
 const f=await fixture(t),[,reference]=await f.files.add(owner,[path.join(f.folder,'note.md')]),value=input([reference.id]),context=await f.capture(value),captured=JSON.stringify(context.inputFiles);await writeFile(path.join(f.folder,'next.md'),'Replacement\n');await rename(path.join(f.folder,'next.md'),path.join(f.folder,'note.md'));await f.engine.validate(user,f.request(value,context),f.signal,f.validate);assert.equal(JSON.stringify(context.inputFiles),captured);
});
test('recomputed hashes cannot broaden declarations/policy or replace the accepted selection',async t=>{
 const f=await fixture(t),value=input([f.reference.id]);value.snapshot.behavior.policy.tools=['read_file'];const context=await f.capture(value);
 for(const mutate of [c=>{c.options.permission='full';},c=>{c.policy.tools=['workspace.write_file'];},c=>{c.definitions.push({name:'write_file',parameters:{}});}]){const changed=structuredClone(context);mutate(changed);const {key,...body}=changed;changed.key=previewDigest(body);await assert.rejects(f.engine.validate(user,f.request(value,changed),f.signal,f.validate),/snapshot changed|declarations or policy changed/);}
});
test('current account, administrator and source checks run during capture and before later inference or tools',async t=>{
 const f=await fixture(t),value=input([f.reference.id],{permission:'full'}),context=await f.capture(value),request=f.request(value,context);f.identity={...user,admin:false};await assert.rejects(f.engine.validate(user,request,f.signal,f.validate),/Full access is unavailable/);f.identity={...user,id:other};await assert.rejects(f.engine.validate(user,request,f.signal,f.validate),/account changed/);f.identity={...user};f.allowed=false;await assert.rejects(f.engine.validate(user,request,f.signal,f.validate),/Source revoked/);
});
test('raw draft policy changes alter preview branch identity even when the available tool ceiling stays the same',async t=>{
 const f=await fixture(t),first=input([f.reference.id]),second=structuredClone(first);second.snapshot.behavior.policy.memory=false;const a=await f.capture(first),b=await f.capture(second);assert.equal(a.key,b.key);assert.notEqual(previewDigest({snapshot:first.snapshot,execution:a.key}),previewDigest({snapshot:second.snapshot,execution:b.key}));
});
test('updated attachment contents retain execution authority while each accepted message keeps its original context',async t=>{
 const {previewExecutionIdentity}=require(path.join(build,'draft-preview-execution.js')),f=await fixture(t),value=input([f.reference.id]),first=await f.capture(value),before=JSON.stringify(first.inputFiles);await writeFile(path.join(f.folder,'note.md'),'Later attached facts\n');const next=await f.capture(value);assert.notEqual(first.key,next.key);assert.equal(previewExecutionIdentity(first),previewExecutionIdentity(next));assert.equal(JSON.stringify(first.inputFiles),before);assert(JSON.stringify(next.inputFiles).includes('Later attached facts'));
});
test('pasted-image capture binds the exact context image without declaring filesystem tools or resolving its display label',async t=>{
 const f=await fixture(t),{selected:[image]}=await f.files.attach(owner,[{image:png.toString('base64'),name:'generated.png'}]),value=input([image]);f.files.checkPath=()=>{throw Error('A pasted-image label must not become a filesystem path.');};
 const context=await f.capture(value);assert.deepEqual(context.inputFiles,[{name:'generated.png',image:imageData(png)}]);assert.deepEqual(context.definitions,[]);assert.deepEqual(context.policy.tools,[]);assert.equal(context.roots[0].device,'clipboard-image-sha256');assert.equal(context.roots[0].inode,previewDigest(context.inputFiles[0].image));
 const frame=await f.engine.frame(user,f.request(value,context),f.signal,f.validate);await assert.rejects(frame.execute('write_file',{},'unavailable',f.signal),/not declared/);
});
test('mixed folder and duplicate-name pasted images retain separate content bindings while clipboard text operations remain refused',async t=>{
 const f=await fixture(t),{selected:images}=await f.files.attach(owner,[{image:png.toString('base64'),name:'same.png'},{image:secondPng.toString('base64'),name:'same.png'}]),value=input([images[1],f.reference.id,images[0]]),context=await f.capture(value);
 assert(context.definitions.some(tool=>tool.name==='write_file'));assert.equal(context.roots[0].inode,previewDigest(imageData(secondPng)));assert.equal(context.roots[2].inode,previewDigest(imageData(png)));assert.equal(context.inputFiles.filter(file=>file.name==='same.png').length,2);
 await assert.rejects(new WorkspaceTools(f.files).read(owner,context.options,{reference_id:images[0],path:''}),/cannot be edited as a text file/);
});
test('forgotten or replaced owned image bytes invalidate the accepted preview before further execution',async t=>{
 const f=await fixture(t),{selected:[image]}=await f.files.attach(owner,[{image:png.toString('base64')}]),value=input([image]),context=await f.capture(value),request=f.request(value,context);
 await writeFile(path.join(f.base,'private-images',owner,image+'.bin'),cipher.encryptString(secondPng.toString('base64')));await assert.rejects(f.engine.validate(user,request,f.signal,f.validate),/resource changed/);assert.equal(context.inputFiles[0].image,imageData(png));
 await f.files.remove(owner,image);await assert.rejects(f.engine.validate(user,request,f.signal,f.validate),/resource changed/);
});
test('capture binds the image actually read, rejecting bytes that change back before final validation',async t=>{
 const f=await fixture(t),{selected:[image]}=await f.files.attach(owner,[{image:png.toString('base64')}]);let reads=0;f.images.read=async()=>++reads===1?imageData(secondPng):imageData(png);
 await assert.rejects(f.capture(input([image])),/resource changed/);assert.equal(reads,2);
});
test('Chat only and foreign selections refuse before reading clipboard storage',async t=>{
 const f=await fixture(t),{selected:[image]}=await f.files.attach(owner,[{image:png.toString('base64')}]);let reads=0;f.images.read=async()=>{reads++;return imageData(png);};
 await assert.rejects(f.capture(input([image],{permission:'chat'})),/Chat only blocks/);await assert.rejects(f.engine.capture({...user,id:other},input([image]),f.signal,f.validate),/account changed|unavailable for this account/);assert.equal(reads,0);
});
test('source revocation, account switches and cancellation during clipboard reads prevent capture acceptance',async t=>{
 for(const mode of ['source','account','cancel']){const f=await fixture(t),{selected:[image]}=await f.files.attach(owner,[{image:png.toString('base64')}]),controller=new AbortController();f.images.read=async()=>{if(mode==='source')f.allowed=false;if(mode==='account')f.identity={...user,id:other};if(mode==='cancel')controller.abort();return imageData(png);};await assert.rejects(f.engine.capture(user,input([image]),controller.signal,f.validate),/Source revoked|account changed|aborted/);}
});
test('clipboard image limits are enforced by the shared context reader before a preview is accepted',async t=>{
 const f=await fixture(t),a=await f.files.attach(owner,Array.from({length:4},()=>({image:png.toString('base64')}))),b=await f.files.attach(owner,[{image:png.toString('base64')}]);await assert.rejects(f.capture(input([...a.selected,...b.selected])),/up to four images/);
});
test('owned pasted-image preview bindings survive an independent cache-reader reopening',async t=>{
 const f=await fixture(t),{selected:[image]}=await f.files.attach(owner,[{image:png.toString('base64')}]),value=input([image]),context=await f.capture(value),reopened=new WorkspaceFiles(f.secrets,{},[],new AttachmentImages(path.join(f.base,'private-images'),cipher,bytes=>bytes)),engine=new DraftPreviewExecution(reopened,f.tools);
 await engine.validate(user,f.request(value,context),f.signal,f.validate);const cold=await engine.capture(user,value,f.signal,f.validate);assert.equal(cold.key,context.key);assert.equal(cold.inputFiles[0].image,imageData(png));
});

test('new-agent workspace skill capture binds selected contents and refuses later changes or forgotten attachments',async t=>{
 const f=await fixture(t),root=path.join(f.folder,'.agents/skills/local'),selection=path.join(root,'SKILL.md');await mkdir(root,{recursive:true});await writeFile(selection,'---\nname: local\ndescription: Review the local note.\n---\nLOCAL-WORKSPACE-108');const value=input([f.reference.id],{permission:'files',skills:[selection]}),context=await f.capture(value);assert.equal(context.pluginFiles,undefined);assert.equal(context.workspaceSkills.owner,owner);assert.equal(context.workspaceSkills.skills[0].referenceId,f.reference.id);assert(context.workspaceSkills.skills[0].files[0].bytes);const request=f.request(value,context);await f.engine.validate(f.identity,request,f.signal,f.validate);await writeFile(selection,'Changed');await assert.rejects(f.engine.validate(f.identity,request,f.signal,f.validate),/workspace skill changed/);await f.files.remove(owner,f.reference.id);await assert.rejects(f.engine.validate(f.identity,request,f.signal,f.validate),/unavailable|changed/);
});
test('workspace discovery checks owned selected folders, source authority and Chat-only attachment restrictions',async t=>{
 const f=await fixture(t),root=path.join(f.folder,'.agents/skills/local');await mkdir(root,{recursive:true});await writeFile(path.join(root,'SKILL.md'),'Local');const options=draftPreviewOptions(input([f.reference.id],{permission:'files'}).snapshot),result=await f.engine.discoverWorkspaceSkills(f.identity,options,f.signal,f.validate);assert.equal(result.snapshot.skills.length,1);await result.validate();f.allowed=false;await assert.rejects(result.validate(),/revoked/);f.allowed=true;await assert.rejects(f.engine.discoverWorkspaceSkills(f.identity,{...options,permission:'chat'},f.signal,f.validate),/Chat only/);await f.files.remove(owner,f.reference.id);await assert.rejects(f.engine.discoverWorkspaceSkills(f.identity,options,f.signal,f.validate),/unavailable/);
});

test('preview capture exposes only permitted shared-window tools and revalidates grants before inference',async t=>{
 const f=await fixture(t),window='44444444-4444-4444-8444-444444444444';let available=true;f.tools.computer={references:(account,ids)=>ids.map(id=>({id,available:available&&account===owner&&id===window})),finishRequest:()=>{}};
 const value=input([],{windows:[window],permission:'ask'}),context=await f.capture(value);assert.equal(context.options.windows[0],window);assert.equal(context.definitions.filter(tool=>tool.name.startsWith('computer_')).length,7);assert(context.definitions.every(tool=>tool.namespace==='tools'));assert.equal(context.policy.delegation,true);assert.equal(context.policy.memory,false);
 const plan=input([],{windows:[window],permission:'ask',mode:'plan'}),readOnly=await f.capture(plan);assert.deepEqual(readOnly.definitions.map(tool=>tool.name),['computer_windows','computer_snapshot']);
 value.snapshot.behavior.policy.tools=['computer_snapshot'];const limited=await f.capture(value);assert.deepEqual(limited.definitions.map(tool=>tool.name),['computer_snapshot']);available=false;await assert.rejects(f.engine.validate(user,f.request(value,limited),f.signal,f.validate),/window.*unavailable|window.*revoked/i);
});

test('preview window sharing refuses non-admin, unavailable and incompatible permission selections',async t=>{
 const f=await fixture(t),window='44444444-4444-4444-8444-444444444444';f.tools.computer={references:()=>[{id:window,available:true}]};
 for(const permission of ['chat','files'])await assert.rejects(f.capture(input([],{windows:[window],permission})),/computer.*permission|window.*permission/i);
 f.identity={...user,admin:false};await assert.rejects(f.capture(input([],{windows:[window],permission:'ask'})),/administrator|computer.*permission/i);f.identity={...user};f.tools.computer.references=()=>[{id:window,available:false}];await assert.rejects(f.capture(input([],{windows:[window],permission:'ask'})),/window.*unavailable|window.*revoked/i);
});

test('preview frame completion waits for its tools and finishes only its own computer indicator',async t=>{
 const f=await fixture(t),value=input([f.reference.id]),context=await f.capture(value),finished=[];f.tools.computer={finishRequest:(account,request)=>finished.push([account,request])};let release;const gate=new Promise(resolve=>release=resolve);f.tools.execute=async()=>{await gate;return {content:'Observed'};};const frame=await f.engine.frame(user,f.request(value,context),f.signal,f.validate),work=frame.execute('read_file',{reference_id:f.reference.id,path:'note.md'},'held-read',f.signal);let joined=false;const ending=frame.finish().then(()=>joined=true);await new Promise(resolve=>setTimeout(resolve,5));assert.equal(joined,false);assert.deepEqual(finished,[]);release();await work;await ending;assert.deepEqual(finished,[[owner,id]]);
});


test('preview browser capabilities follow current permissions, Plan mode and unsaved policy',async t=>{
 const f=await fixture(t);f.tools.browser={};const value=input([]),context=await f.capture(value);assert(context.definitions.some(tool=>tool.name==='browser_open'));assert(context.definitions.some(tool=>tool.name==='browser_action'));assert(context.definitions.some(tool=>tool.name==='browser_upload'));assert(!context.definitions.some(tool=>tool.name==='run_command'));
 const plan=await f.capture(input([],{mode:'plan'}));assert(plan.definitions.some(tool=>tool.name==='browser_snapshot'));for(const name of ['browser_action','browser_upload','browser_close','browser_click'])assert(!plan.definitions.some(tool=>tool.name===name));
 for(const permission of ['chat','files'])assert(!(await f.capture(input([],{permission}))).definitions.some(tool=>tool.name.startsWith('browser_')));
 value.snapshot.behavior.policy.tools=['tools.browser_list'];assert.deepEqual((await f.capture(value)).definitions.map(tool=>tool.name),['browser_list']);
});


test('native preview command capability requires current grant, administrator, owned folder and unrestricted native policy',async t=>{
 const f=await fixture(t);let enabled=true;f.tools.terminal.permissions=current=>({enabled:enabled&&current.admin,administrator:current.admin,full:enabled&&current.admin});const value=input([f.reference.id]),context=await f.capture(value),request=f.request(value,context),frame=await f.engine.frame(user,request,f.signal,f.validate);assert.equal(frame.nativeCommands,true);assert(context.policy.tools.includes('workspace.run_command'));assert(!context.definitions.some(tool=>tool.name==='run_command'));enabled=false;await assert.rejects(f.engine.validate(user,request,f.signal,f.validate),/declarations or policy changed/);
 for(const [permission,mode,admin,grant,folder,restricted]of [['ask','chat',true,false,true,false],['ask','chat',false,true,true,false],['files','chat',true,true,true,false],['ask','plan',true,true,true,false],['ask','chat',true,true,false,false],['ask','chat',true,true,true,true]]){enabled=grant;f.identity={...user,admin};const v=input(folder?[f.reference.id]:[],{permission,mode});if(restricted)v.snapshot.behavior.policy.tools=['read_file'];const c=await f.capture(v),frame=await f.engine.frame(f.identity,f.request(v,c),f.signal,f.validate);assert.equal(frame.nativeCommands,false);}
});

test('native preview delegation captures the unrestricted draft policy and depth while private memory stays unavailable',async t=>{
 const f=await fixture(t),value=input([],{permission:'chat'}),context=await f.capture(value);assert.equal(context.policy.delegation,true);assert.equal(context.policy.maxDepth,2);assert.deepEqual(context.policy.delegateAgents,[]);assert.equal(context.policy.memory,false);assert.equal(context.policy.memoryWrite,false);assert(!context.policy.tools.includes('workspace.run_command'));
 for(const change of [{delegation:false},{tools:['read_file']},{maxDepth:0},{maxDepth:1}]){const next=structuredClone(value);Object.assign(next.snapshot.behavior.policy,change);const saved=await f.capture(next);assert.equal(saved.policy.delegation,!('tools'in change)&&change.delegation!==false);assert.equal(saved.policy.maxDepth,change.maxDepth??2);}
});
