const test=require('node:test'),assert=require('node:assert/strict');
const {mkdtemp,mkdir,writeFile,readFile,rm,link,symlink}=require('node:fs/promises');const path=require('node:path'),os=require('node:os');
const {WorkspaceFiles}=require('../build/workspace.js'),{WorkspaceTools}=require('../build/workspace-tools.js');
const {mcpImages,nativeMcpResult}=require('../build/mcp-content.js');
const {chromePlugin,validatePluginPackage}=require('../build/plugin-validation.js');
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5O8AAAAASUVORK5CYII=';
test('MCP images remain image content for the native harness and stay out of serialized text',()=>{
 const result={content:[{type:'text',text:'Browser view'},{type:'image',mimeType:'image/png',data:png}],untrusted:true};const native=nativeMcpResult(result);assert.equal(native.content.length,2);assert.equal(native.content[1].data,png);assert(!native.content[0].text.includes(png));assert(native.content[0].text.includes('untrusted'));assert(!native.isError);assert(nativeMcpResult({error:'denied'}).isError);
 for(const part of [{type:'image',mimeType:'text/html',data:png},{type:'image',mimeType:'image/jpeg',data:png},{type:'image',mimeType:'image/png',data:'bad!'},{type:'image',mimeType:'image/png',data:'A'.repeat(2*1024*1024+1)}])assert.throws(()=>mcpImages({content:[part]}));assert.throws(()=>mcpImages({content:[result.content[1],result.content[1],result.content[1]]}));
});
test('only a pinned bundled plugin can select the managed Chrome runtime',()=>{
 assert.equal(chromePlugin.manifest.extensions['com.agentopia'].managedMcp,'chrome-devtools');assert.throws(()=>validatePluginPackage(chromePlugin));const altered=structuredClone(chromePlugin);altered.manifest.extensions['com.agentopia'].managedMcp='powershell';assert.throws(()=>validatePluginPackage(altered,true));
});
test('Chrome local input access follows attached workspaces, ownership, revocation, and link exclusions',async()=>{
 const base=await mkdtemp(path.join(os.tmpdir(),'agentopia-chrome-input-')),root=path.join(base,'workspace'),outside=path.join(base,'outside');await mkdir(root);await mkdir(outside);await mkdir(path.join(root,'private'));await writeFile(path.join(root,'note.txt'),'ATTACHED');await writeFile(path.join(root,'.env'),'SECRET');await writeFile(path.join(root,'private','note.txt'),'PRIVATE');await writeFile(path.join(outside,'note.txt'),'OUTSIDE');
 const saved=new Map(),secrets={get:key=>saved.get(key),set:async(key,value)=>saved.set(key,value)},files=new WorkspaceFiles(secrets),tools=new WorkspaceTools(files,[path.join(root,'private')]);
 try{
  const [ref]=await files.add('owner',[root]),options={permission:'ask',mode:'chat',thinking:'default',files:[ref.id]};assert.equal((await tools.chromeInput('owner',options,path.join(root,'note.txt'))).toString(),'ATTACHED');
  for(const file of [path.join(outside,'note.txt'),path.join(root,'.env'),path.join(root,'private','note.txt'),'note.txt'])await assert.rejects(tools.chromeInput('owner',options,file));
  await assert.rejects(tools.chromeInput('other',options,path.join(root,'note.txt')));await assert.rejects(tools.chromeInput('owner',{...options,files:[]},path.join(root,'note.txt')));await assert.rejects(tools.chromeInput('owner',{...options,permission:'chat'},path.join(root,'note.txt')));
  await link(path.join(outside,'note.txt'),path.join(root,'linked.txt'));await assert.rejects(tools.chromeInput('owner',options,path.join(root,'linked.txt')),/Linked/);await symlink(outside,path.join(root,'redirect'),'junction');await assert.rejects(tools.chromeInput('owner',options,path.join(root,'redirect','note.txt')),/Linked/);
  await files.remove('owner',ref.id);await assert.rejects(tools.chromeInput('owner',options,path.join(root,'note.txt')));
 }finally{assert(path.resolve(base).startsWith(path.resolve(os.tmpdir())+path.sep));await rm(base,{recursive:true,force:true});}
});
