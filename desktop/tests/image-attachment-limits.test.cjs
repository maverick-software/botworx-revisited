const test=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),fs=require('node:fs/promises'),{randomUUID,createHash}=require('node:crypto');
const real=Module._load;let dimensions={width:2,height:2};
Module._load=function(name,...args){if(name==='electron')return {dialog:{},shell:{},safeStorage:{},nativeImage:{createFromBuffer:()=>({getSize:()=>dimensions,isEmpty:()=>false,toPNG:()=>{throw Error('Original attachments must not be re-encoded');}})}};return real.call(this,name,...args);};
let AttachmentImages,imageData,maxImageBytes,WorkspaceFiles,WorkspaceTools,readImageFile;
try{({AttachmentImages,imageData,maxImageBytes}=require('../build/attachment-images.js'));({WorkspaceFiles}=require('../build/workspace.js'));({WorkspaceTools}=require('../build/workspace-tools.js'));({readImageFile}=require('../build/image-file.js'));}finally{Module._load=real;}
const limits=require('../build/image-limits.js'),png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/o9sAAAAASUVORK5CYII=','base64'),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const padded=size=>{const bytes=Buffer.alloc(size);png.copy(bytes);return bytes;};
const cipher={isEncryptionAvailable:()=>true,encryptString:v=>Buffer.from('TEST:'+v),decryptString:v=>{assert(v.toString().startsWith('TEST:'));return v.toString().slice(5);}};
class Store{data=new Map();get(k){return this.data.get(k);}async set(k,v){this.data.set(k,v);}async setMany(changes){for(const [k,v]of changes)this.data.set(k,v);}}
async function fixture(run){const root=await fs.mkdtemp(path.join(os.tmpdir(),'image-limit-')),owner=randomUUID(),store=new Store(),images=new AttachmentImages(path.join(root,'private'),cipher),files=new WorkspaceFiles(store,{},[path.join(root,'private')],images);try{await run({root,owner,store,images,files});}finally{assert.equal(path.dirname(root),os.tmpdir());await fs.rm(root,{recursive:true,force:true});}}

test('20 MB originals survive selection, preview and context; text and ownership limits stay enforced',()=>fixture(async({root,owner,files})=>{
 const bytes=padded(maxImageBytes),file=path.join(root,'large.png');await fs.writeFile(file,bytes);
 const {selected:[id]}=await files.attach(owner,[{path:file}]);
 for(const value of [(await files.preview(owner,id)).image,(await files.context(owner,[id],'full'))[0].image,(await new WorkspaceTools(files).view(owner,{permission:'full',mode:'chat',thinking:'default',files:[id]},{reference_id:id,path:''})).image])assert.equal(sha(Buffer.from(value.split(',')[1],'base64')),sha(bytes));
 await assert.rejects(files.context(owner,[id],'chat'),/Chat only/);await assert.rejects(files.preview(randomUUID(),id),/unavailable/);
 const text=path.join(root,'large.txt');await fs.writeFile(text,Buffer.alloc(2*1024**2+1));await assert.rejects(files.attach(owner,[{path:text}]),/text files/);
 const huge=path.join(root,'over.png');await fs.writeFile(huge,padded(maxImageBytes+1));await assert.rejects(files.attach(owner,[{path:huge}]),/20 MB/);await assert.rejects(readImageFile(huge),/20 MB/);
}));
test('pasted JPEG and WebP preserve original bytes, extension, dimensions policy and cold reads',()=>fixture(async({owner,files,images,store,root})=>{
 for(const [name,header,extension]of [['photo.jpg',Buffer.from([255,216,255,224]),'.jpg'],['drawing.webp',Buffer.from('RIFF0000WEBP'),'.webp']]){
  const bytes=Buffer.concat([header,Buffer.alloc(3*1024**2)]),result=await files.attach(owner,[{name,image:bytes.toString('base64')}]),id=result.selected[0];assert(result.references.find(row=>row.id===id).name.endsWith(extension));
  const reopened=new WorkspaceFiles(store,{},[],new AttachmentImages(path.join(root,'private'),cipher));assert.equal(sha(Buffer.from((await reopened.preview(owner,id)).image.split(',')[1],'base64')),sha(bytes));
 }
 dimensions={width:10000,height:4000};try{assert.throws(()=>images.prepare(png.toString('base64')),/32 million/);}finally{dimensions={width:2,height:2};}
 assert.throws(()=>images.prepare(padded(maxImageBytes+1).toString('base64')),/20 MB/);
}));
test('aggregate image limits reject the whole paste and selected-context batch',()=>fixture(async({owner,root,files})=>{
 const bytes=padded(15*1024**2),items=Array.from({length:3},()=>({name:'image.png',image:bytes.toString('base64')}));await assert.rejects(files.attach(owner,items),/40 MB/);assert.deepEqual(files.list(owner),[]);
 const ids=[];for(let index=0;index<3;index++){const file=path.join(root,index+'.png');await fs.writeFile(file,bytes);ids.push((await files.attach(owner,[{path:file}])).selected[0]);}
 await assert.rejects(files.context(owner,ids,'full'),/40 MB/);
}));
test('a linked image cannot replace the selected original',()=>fixture(async({root})=>{const file=path.join(root,'source.png'),link=path.join(root,'linked.png');await fs.writeFile(file,png);await fs.symlink(file,link,'file');await assert.rejects(readImageFile(link),/regular/);}));
test('the sandboxed preload accepts 20 MB images and bounds aggregate bytes before IPC',async()=>{
 const source=await fs.readFile(require.resolve('../build/preload.js'),'utf8'),calls=[];let api;
 vm.runInNewContext(source,{exports:{},Buffer,require:name=>{assert.equal(name,'electron');return {contextBridge:{exposeInMainWorld:(_name,value)=>api=value},ipcRenderer:{invoke:async(...args)=>{calls.push(args);return 'accepted';}},webUtils:{getPathForFile:file=>file.path??''}};}});
 const file=size=>({name:'photo.png',type:'image/png',size,arrayBuffer:async()=>padded(size)});
 assert.equal(await api.attach([file(maxImageBytes)],'OWNER'),'accepted');assert.equal(Buffer.from(calls[0][1].items[0].image,'base64').length,maxImageBytes);assert.equal(calls[0][1].owner,'OWNER');
 await assert.rejects(api.attach([file(maxImageBytes+1)],'OWNER'),/20 MB/);await assert.rejects(api.attach([file(15*1024**2),file(15*1024**2),file(15*1024**2)],'OWNER'),/40 MB/);assert.equal(calls.length,1);
 assert(JSON.stringify(calls[0][1]).length<limits.maxAttachmentRequestBytes);
});
test('the native gateway forwards a full-size original with owned thread routing and no credential exposure',async()=>{
 const {CodexGateway}=require('../build/codex-gateway.js'),original=global.fetch,thread=randomUUID(),turn=randomUUID(),bytes=padded(maxImageBytes);let forwarded=0;
 const gateway=await new CodexGateway('chatgpt',async scope=>{assert.equal(scope.threadId,thread);assert.equal(scope.turnId,turn);return 'GENERATED-TEST-TOKEN';},new Set(['test-model'])).start();
 global.fetch=async(url,args)=>{assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(args.headers.Authorization,'Bearer GENERATED-TEST-TOKEN');const body=JSON.parse(args.body);assert.equal(sha(Buffer.from(body.input[0].content[0].image_url.split(',')[1],'base64')),sha(bytes));assert.equal(body.store,false);assert.equal(body.stream,true);forwarded++;return new Response('data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});};
 try{const reply=await original(gateway.baseUrl+'/responses',{method:'POST',headers:{Authorization:'Bearer '+gateway.bearer,'Content-Type':'application/json','thread-id':thread,'x-codex-turn-metadata':JSON.stringify({thread_id:thread,turn_id:turn})},body:JSON.stringify({model:'test-model',input:[{role:'user',content:[{type:'input_image',image_url:imageData(bytes)}]}]})});assert.equal(reply.status,200);assert.equal(await reply.text(),'data: [DONE]\n\n');assert.equal(forwarded,1);}finally{global.fetch=original;gateway.close();}
});
test('native file-view results expose full-size pixels as image content without duplicating base64 in text',()=>{
 const {nativeMcpResult}=require('../build/mcp-content.js'),bytes=padded(maxImageBytes),result=nativeMcpResult({path:'selected.png',image:imageData(bytes)});
 assert.equal(result.content.length,2);assert.equal(result.content[1].type,'image');assert.equal(sha(Buffer.from(result.content[1].data,'base64')),sha(bytes));assert(result.content[0].text.length<200);assert.equal(JSON.parse(result.content[0].text).path,'selected.png');
 assert.throws(()=>nativeMcpResult({image:'data:image/jpeg;base64,'+png.toString('base64')}),/declared format/);
});
