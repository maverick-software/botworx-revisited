const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {mkdtemp,writeFile,readFile,readdir,rm}=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {WorkspaceFiles}=require('../build/workspace.js'),{WorkspaceTools}=require('../build/workspace-tools.js'),{AttachmentImages,imageData,maxImageBytes}=require('../build/attachment-images.js');
class Secrets{data=new Map();get(k){return this.data.get(k);}async set(k,v){this.data.set(k,v);}}
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/o9sAAAAASUVORK5CYII=','base64');
const cipher={isEncryptionAvailable:()=>true,encryptString:value=>Buffer.from(value.split('').reverse().join('')),decryptString:bytes=>bytes.toString().split('').reverse().join('')};
async function fixture(task){const root=await mkdtemp(path.join(os.tmpdir(),'sylvana-attachments-')),user=randomUUID(),secrets=new Secrets(),images=new AttachmentImages(path.join(root,'private'),cipher,bytes=>{imageData(bytes);return bytes;}),files=new WorkspaceFiles(secrets,{showMessageBox:async()=>({response:0})},[path.join(root,'private')],images);try{await task({root,user,secrets,images,files});}finally{assert(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep));await rm(root,{recursive:true,force:true});}}
test('attachment batches are atomic, serial, deduplicated, and keep native files unchanged',()=>fixture(async({root,user,files})=>{
 const file=path.join(root,'notes.md'),privateFile=path.join(root,'.env');await writeFile(file,'Original notes');await writeFile(privateFile,'private');
 await assert.rejects(files.attach(user,[{path:file},{path:privateFile}]),/Credential/);assert.equal(files.list(user).length,0);
 await assert.rejects(files.attach(user,[{name:'image.png',image:png.toString('base64')}],async()=>{throw new Error('account changed');}),/account changed/);assert.equal(files.list(user).length,0);
 const [first,second]=await Promise.all([files.attach(user,[{path:file}]),files.attach(user,[{path:root}])]);assert.equal(first.selected.length,1);assert.equal(second.references.length,2);
 const repeated=await files.attach(user,[{path:file},{path:file}]);assert.deepEqual(repeated.selected,first.selected);assert.equal(repeated.references.length,2);
 await files.remove(user,first.selected[0]);assert.equal(await readFile(file,'utf8'),'Original notes');
}));
test('pasted image selection authorizes context while ownership, preview, recovery and removal remain enforced',()=>fixture(async({root,user,secrets,images,files})=>{
 const result=await files.attach(user,[{name:'screenshot.png',image:png.toString('base64')}]),id=result.selected[0],other=randomUUID();assert.equal(result.references[0].source,'clipboard');
 assert.deepEqual(await files.preview(user,id),{image:imageData(png)});await assert.rejects(files.preview(other,id),/unavailable/);
 await assert.rejects(files.context(user,[id],'chat'),/Chat only/);assert.equal((await files.context(user,[id],'ask'))[0].image,imageData(png));
 const context=await files.context(user,[id],'files');assert.equal(context[0].image,imageData(png));
 const bytes=await readFile(path.join(root,'private',user,id+'.bin'));assert(!bytes.includes(png));assert(!bytes.includes(Buffer.from(png.toString('base64'))));
 const orphan=randomUUID();await images.write(user,orphan,png);const reopened=new WorkspaceFiles(secrets,undefined,[],images);await reopened.recover(user);assert.deepEqual(await readdir(path.join(root,'private',user)),[id+'.bin']);assert.equal((await reopened.preview(user,id)).image,context[0].image);
 const tools=new WorkspaceTools(files),options={permission:'files',mode:'chat',thinking:'default',files:[id]};assert.equal((await tools.view(user,options,{reference_id:id,path:''})).image,context[0].image);await assert.rejects(tools.read(user,options,{reference_id:id,path:''}),/image supplied/);await assert.rejects(tools.view(other,options,{reference_id:id,path:''}),/unavailable/);
 await files.remove(user,id);assert.deepEqual(await readdir(path.join(root,'private',user)),[]);await assert.rejects(files.preview(user,id),/unavailable/);assert.equal(context[0].image,imageData(png),'Previously captured message data changed when its reference was forgotten');
}));
test('invalid and oversized pasted data are rejected and cancelled commits remove newly written blobs',()=>fixture(async({root,user,images,files})=>{
 for(const value of ['',123,'garbage!',Buffer.from('text pretending to be an image').toString('base64'),Buffer.alloc(maxImageBytes+1).toString('base64')])assert.throws(()=>images.prepare(value),/image|Images|PNG/);
 await assert.rejects(files.attach(user,Array.from({length:5},()=>({name:'image.png',image:png.toString('base64')}))),/four images/);assert.equal(files.list(user).length,0);
 let calls=0;await assert.rejects(files.attach(user,[{name:'image.png',image:png.toString('base64')}],async()=>{if(++calls===2)throw new Error('account changed after file write');}),/after file write/);assert.deepEqual(await readdir(path.join(root,'private',user)),[]);assert.equal(files.list(user).length,0);
 await assert.rejects(images.read('../bad',randomUUID()),/Invalid attachment/);
}));
