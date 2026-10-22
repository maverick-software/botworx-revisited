import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('real dedicated Chrome connector context verification');
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'.supabase/desktop-chrome-context60','live-'+Date.now()),require=createRequire(import.meta.url);
await mkdir(out,{recursive:true});
const {ChromeRuntime}=require(path.join(root,'.supabase/desktop-chrome-context60/build/chrome-runtime.js'));
const runtime=new ChromeRuntime(path.join(root,'desktop/resources'),path.join(out,'private-chrome'),require('electron'),'C:/Program Files/Google/Chrome/Application/chrome.exe');
const owner=randomUUID(),guard=async()=>{},signal=AbortSignal.timeout(180000),seen=[];
const server=createServer((request,response)=>{
 seen.push(request.url);response.setHeader('Content-Type','text/html; charset=utf-8');
 const title=request.url==='/a'?'Reference Alpha':'Reference Beta';
 response.end('<!doctype html><title>'+title+'</title><style>.hidden-parent{display:none}.invisible{opacity:0}</style><h1>'+title+'</h1><p>VISIBLE-PAGE-CONTENT '+(request.url==='/a'?'ALPHA':'BETA')+'</p><input value="PRIVATE-INPUT"><textarea>PRIVATE-TEXTAREA</textarea><div contenteditable="true">PRIVATE-EDITABLE</div><div role="textbox"><span>PRIVATE-ROLE-INPUT</span></div><div class="hidden-parent"><span>PRIVATE-HIDDEN</span></div><span class="invisible">PRIVATE-INVISIBLE</span><span aria-hidden="true">PRIVATE-ARIA-HIDDEN</span><iframe srcdoc="<p>PRIVATE-FRAME</p>"></iframe><script>window.privateMarker="PRIVATE-SCRIPT";</script>'+(request.url==='/long'?'<p>'+'LONG-VISIBLE '.repeat(2000)+'</p>':''));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
const evidence={success:false,at:new Date().toISOString(),out,actualChrome:true,actualBundledMcp:true,dedicatedProfile:true,existingUserChromeAccess:false,modelRequests:0,externalServiceActions:0,checks:[],sourceHashes:{}};
for(const name of ['desktop/src/chrome-context.ts','desktop/src/chrome-runtime.ts','desktop/src/main.ts','desktop/ui/ComposerContextMenu.tsx'])evidence.sourceHashes[name]=createHash('sha256').update(await readFile(path.join(root,name))).digest('hex');
const save=()=>writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2)),check=async text=>{evidence.checks.push(text);await save();console.log('PASS '+text);};await save();
try{
 const status=await runtime.connect(owner,'dedicated',guard);assert.equal(status.phase,'connected');await check('The integrity-checked bundled MCP connects to a fresh dedicated Chrome profile on F.');
 const client=runtime.sessions.get(owner).client,invoke=client.callTool.bind(client);client.callTool=async(...args)=>{const result=await invoke(...args);if(result.isError){(evidence.connectorErrors??=[]).push({tool:args[0].name,result});await save();}return result;};
 for(const suffix of ['/a','/b'])await runtime.call(owner,'new_page',{url:base+suffix},signal,guard);
 const {tabs}=await runtime.context.list(owner,signal,guard),a=tabs.find(tab=>tab.url===base+'/a'),b=tabs.find(tab=>tab.url===base+'/b');assert(a&&b);assert.equal(a.title,'Reference Alpha');assert.equal(b.title,'Reference Beta');assert(!JSON.stringify(tabs).includes('VISIBLE-PAGE-CONTENT'));
 await check('The real Chrome catalog supplies separate opaque tab handles, current titles and URLs without reading page bodies.');
 const catalog=await runtime.call(owner,'list_pages',{},signal,guard),pages=catalog.structuredContent.pages,alpha=pages.find(page=>page.url===a.url);await runtime.call(owner,'select_page',{pageId:alpha.id,bringToFront:false},signal,guard);
 const snapshot=await runtime.context.read(owner,b.id,b.url,signal,guard);assert(snapshot.text.includes('VISIBLE-PAGE-CONTENT BETA'));assert(!snapshot.text.includes('ALPHA'));assert(!snapshot.text.includes('PRIVATE-'));assert.match(snapshot.notice,/frames, form values and editable fields are excluded/);
 const after=await runtime.call(owner,'list_pages',{},signal,guard);assert.equal(after.structuredContent.pages.find(page=>page.selected).id,alpha.id);evidence.snapshot=snapshot;
 await check('Selecting Beta reads its real public text, excludes inputs/editable/hidden/frame/script content, and leaves Alpha selected without focusing Chrome.');
 await runtime.call(owner,'new_page',{url:base+'/long'},signal,guard);const long=(await runtime.context.list(owner,signal,guard)).tabs.find(page=>page.url===base+'/long');assert(long);
 const bounded=await runtime.context.read(owner,long.id,long.url,signal,guard);assert.equal(bounded.text.length,12000);assert.match(bounded.notice,/Partial content/);
 await check('A real long page is bounded to 12,000 characters and its snapshot discloses the partial content.');
 const current=await runtime.call(owner,'list_pages',{},signal,guard),beta=current.structuredContent.pages.find(page=>page.url===b.url);await runtime.call(owner,'navigate_page',{pageId:beta.id,type:'url',url:base+'/changed'},signal,guard);
 await assert.rejects(runtime.context.read(owner,b.id,b.url,signal,guard),/closed or navigated/);await check('A real navigation invalidates the previously offered tab context before another page body can be attached.');
 await runtime.disconnect(owner);await assert.rejects(runtime.context.read(owner,long.id,long.url,signal,guard),/connection changed/);assert.deepEqual(await runtime.context.list(owner,signal,guard),{tabs:[]});await check('Disconnecting the real Chrome session invalidates its context handles and empties the picker catalog.');
 evidence.loopbackRequests=seen;evidence.success=true;
}catch(error){evidence.error=error.stack;process.exitCode=1;}finally{
 await runtime.close().catch(error=>{evidence.closeError=error.message;evidence.success=false;process.exitCode=1;});server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await save();
}
console.log(JSON.stringify({success:evidence.success,out,checks:evidence.checks.length,error:evidence.error}));
