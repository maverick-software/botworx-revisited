import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('Chrome runtime verification');
const require=createRequire(import.meta.url),{ChromeRuntime}=require('../../desktop/build/chrome-runtime.js'),{nativeMcpResult,mcpImages}=require('../../desktop/build/mcp-content.js');
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'.supabase/desktop-chrome-runtime'),directory=path.join(out,'profiles'),owner=randomUUID(),conversationId=randomUUID(),receipt='CHROME-'+randomUUID(),note='NOTE-'+randomUUID();await mkdir(out,{recursive:true});
const manager=new ChromeRuntime(path.join(root,'desktop/resources'),directory,path.join(root,'node_modules/electron/dist/electron.exe'));
const evidence={at:new Date().toISOString(),simulated:false,inference:false,runtime:'Google Chrome DevTools MCP',version:'1.11.0'};
let submissions=0,uploaded='',slowStarted,releaseSlow;
const slow=new Promise(resolve=>slowStarted=resolve),slowResponse=new Promise(resolve=>releaseSlow=resolve);
const server=createServer(async(req,res)=>{
 if(req.url==='/slow'){slowStarted();await slowResponse;res.end('released');return;}
 if(req.url==='/submit'){let body='';for await(const chunk of req)body+=chunk;assert.equal(body,note);submissions++;res.end(receipt);return;}
 if(req.url==='/upload'){for await(const chunk of req)uploaded+=chunk;res.end('uploaded');return;}
 res.setHeader('content-type','text/html');res.end(`<!doctype html><html><title>Agentopia Chrome verification</title><style>body{font:20px system-ui;padding:40px;background:#fafafa}button,input{font:inherit;margin:12px;padding:8px}</style><h1>Chrome runtime verification</h1><label>Note <input aria-label="Note" id="note"></label><button id="send">Submit note</button><label>Upload sample<input aria-label="Upload sample" id="file" type="file"></label><p id="receipt"></p><script>console.log('Chrome fixture ready');send.onclick=async()=>{receipt.textContent=await(await fetch('/submit',{method:'POST',body:note.value})).text()};file.onchange=async()=>{await fetch('/upload',{method:'POST',body:await file.files[0].text()})};</script></html>`);
});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port+'/';
const text=r=>r.content.filter(p=>p.type==='text').map(p=>p.text).join('\n');
const call=async(name,args,signal=AbortSignal.timeout(30000),context={conversationId})=>{const r=await manager.call(owner,name,args,signal,async()=>{},context);if(r.isError)throw new Error(name+': '+text(r));return r;};
try{
 evidence.connection=await manager.connect(owner,'dedicated',async()=>{});assert.equal(evidence.connection.phase,'connected');const catalog=await manager.inventory(owner);assert(catalog.length>=30);await writeFile(path.join(out,'catalog.json'),JSON.stringify(catalog,null,2));
 await call('new_page',{url});const pages=text(await call('list_pages',{})),match=pages.split('\n').find(line=>line.includes(url))?.match(/^(\d+):/);assert(match,pages);const pageId=Number(match[1]);evidence.pageId=pageId;
 const snapshot=text(await call('take_snapshot',{pageId}));const uid=label=>{const line=snapshot.split('\n').find(line=>line.includes(label));const id=line?.match(/uid=(\S+)/)?.[1];assert(id,snapshot);return id;};
 await call('fill',{pageId,uid:uid('textbox "Note"'),value:note});await call('click',{pageId,uid:uid('button "Submit note"')});assert.equal(submissions,1);assert(text(await call('take_snapshot',{pageId})).includes(receipt));evidence.realInputAndServerReceipt=true;
 const screenshot=await call('take_screenshot',{pageId}),images=mcpImages(screenshot);assert.equal(images.length,1);assert.equal(images[0].mimeType,'image/jpeg');const native=nativeMcpResult(screenshot);assert.equal(native.content[1].type,'image');assert(!native.content[0].text.includes(images[0].data));await writeFile(path.join(out,'chrome-page.jpeg'),Buffer.from(images[0].data,'base64'));evidence.realScreenshot={mimeType:images[0].mimeType,bytes:Buffer.from(images[0].data,'base64').length,nativeImageBlock:true};
 await call('take_screenshot',{pageId,filePath:'browser-proof.jpeg'});await readFile(path.join(directory,'chrome-tools',owner,'artifacts',conversationId,'browser-proof.jpeg'));evidence.ownedOutput=true;
 await assert.rejects(call('take_snapshot',{pageId,filePath:'../escape.txt'}),/simple file name|artifacts/);
 await assert.rejects(call('take_snapshot',{pageId,filePath:path.join(out,'outside.txt')}),/artifacts/);
 await assert.rejects(call('upload_file',{pageId,uid:uid('Upload sample'),filePaths:[path.join(out,'unattached.txt')]}),/Attach/);
 const fixtureFile=path.join(out,'sample.txt');await writeFile(fixtureFile,'ATTACHED-UPLOAD');await call('upload_file',{pageId,uid:uid('Upload sample'),filePaths:[fixtureFile]},AbortSignal.timeout(30000),{conversationId,readInput:async file=>{assert.equal(file,fixtureFile);return readFile(file);}});for(let n=0;n<30&&uploaded!=='ATTACHED-UPLOAD';n++)await new Promise(resolve=>setTimeout(resolve,100));assert.equal(uploaded,'ATTACHED-UPLOAD');const staged=await readdir(path.join(directory,'chrome-tools',owner,'private-inputs'));assert.equal(staged.length,1);evidence.selectedInputStaging=true;
 const scriptFile=path.join(out,'read-title.js');await writeFile(scriptFile,'() => document.title');const evaluated=await call('evaluate_script',{pageId,sourcePath:scriptFile},AbortSignal.timeout(30000),{conversationId,readInput:async file=>{assert.equal(file,scriptFile);return readFile(file);}});assert(text(evaluated).includes('Agentopia Chrome verification'));evidence.selectedScriptInput=true;
 const consoleText=text(await call('list_console_messages',{pageId})),networkText=text(await call('list_network_requests',{pageId}));assert(consoleText.includes('Chrome fixture ready'));assert(networkText.includes('/submit'));evidence.consoleAndNetwork=true;
 const blocked=await manager.call(owner,'new_page',{url:'file:///C:/Windows/win.ini'},AbortSignal.timeout(30000),async()=>{});assert(blocked.isError);evidence.privilegedNavigationBlocked=true;
 const first=call('evaluate_script',{pageId,function:`async () => (await fetch('/slow')).text()`});await slow;const cancelled=new AbortController(),second=call('click',{pageId,uid:uid('button "Submit note"')},cancelled.signal);second.catch(()=>{});cancelled.abort();releaseSlow();await first;await assert.rejects(second,{name:'AbortError'});assert.equal(submissions,1);evidence.cancelledQueuedActionNotDispatched=true;
 const other=randomUUID();let release;const gated=new Promise(resolve=>release=resolve),connecting=manager.connect(other,'dedicated',()=>gated);connecting.catch(()=>{});assert.equal((await manager.status(other)).phase,'connecting');await assert.rejects(manager.connect(other,'dedicated',async()=>{}),/already waiting/);await manager.disconnect(other);release();await assert.rejects(connecting);assert.equal((await manager.status(other)).phase,'disconnected');evidence.connectCancellationAndExclusion=true;
 evidence.success=true;console.log('PASS real Chrome: 33 tool schemas; input and server receipt; JPEG delivered as native MCP image; attached upload/script staging; owned outputs; console/network; privileged navigation blocked; cancellation and connection isolation.');
}catch(e){evidence.error=e.message;throw e;}
finally{releaseSlow();await manager.close();const staged=await readdir(path.join(directory,'chrome-tools',owner,'private-inputs')).catch(()=>[]);if(staged.length)evidence.cleanupError='Staged Chrome inputs remain after disconnect.';else evidence.stagedInputsRemovedOnDisconnect=true;server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));}
