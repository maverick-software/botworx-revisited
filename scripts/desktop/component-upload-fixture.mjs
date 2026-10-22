import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import {checkpointWriter} from './checkpoint.mjs';

const configFile=path.resolve(process.argv[2]??''),cfg=JSON.parse(await readFile(configFile,'utf8'));
assert.equal(cfg.format,1);assert(/^\/component-upload-[a-f0-9-]{36}\/$/.test(cfg.base));assert(path.isAbsolute(cfg.output));assert.equal(path.dirname(configFile),cfg.output);assert.equal(cfg.receipts.length,2);
const state={format:1,at:new Date().toISOString(),phase:'prepared',uploads:[],violations:[],hideRequested:false,receiptHidden:false,forgotten:false},stateFile=path.join(cfg.output,'server-state.json');await writeFile(stateFile,JSON.stringify(state,null,2),{flag:'wx'});const writeState=checkpointWriter(stateFile);const save=async()=>{state.at=new Date().toISOString();await writeState(state);};
const base=cfg.base,hash=bytes=>createHash('sha256').update(bytes).digest('hex');let closing=false;
const html=`<!doctype html><title>Component upload verification</title><style>body{font:18px Arial;padding:24px;background:white;color:#222}section{margin:20px 0}p{line-height:1.5}</style><h1>Controlled component uploads</h1><p id="upload-name">Outside alias</p><section id="open"></section><section id="closed"></section><p id="receipt">No file received</p><script>
function setup(root,name,scope){root.innerHTML='<form action="${base}upload"><span id="upload-name">'+name+'</span><input type="file" hidden aria-labelledby="upload-name"></form>';root.querySelector('input').onchange=async event=>{if(event.target.files.length!==1)return;const body=new FormData();body.append('file',event.target.files[0]);body.append('scope',scope);body.append('inputValue',event.target.value);document.getElementById('receipt').textContent=await(await fetch('${base}upload',{method:'POST',body})).text();};}
const outer=document.getElementById('open').attachShadow({mode:'open'});outer.innerHTML='<section id="nested"></section>';setup(outer.getElementById('nested').attachShadow({mode:'open'}),'Component report','nested');setup(document.getElementById('closed').attachShadow({mode:'closed'}),'Closed report','closed');
const timer=setInterval(async()=>{try{if(await(await fetch('${base}phase',{cache:'no-store'})).text()!=='hide')return;document.getElementById('receipt').textContent='Ready for the next upload';clearInterval(timer);await fetch('${base}masked',{method:'POST',body:'cleared'});}catch{}},200);
</script>`;
const server=createServer(async(req,res)=>{
 try{
  if(req.url===base+'status'){
   if(req.headers.authorization!=='Bearer '+cfg.controlToken){res.writeHead(403).end('Forbidden');return;}
   res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify(state));return;
  }
  if(req.url===base+'hide'||req.url===base+'stop'){
   if(req.method!=='POST'||req.headers.authorization!=='Bearer '+cfg.controlToken){res.writeHead(403).end('Forbidden');return;}
   if(req.url.endsWith('/hide')){state.hideRequested=true;await save();res.end('Recorded');return;}
   state.phase='stopped';await save();res.end('Stopping');closing=true;setTimeout(()=>{server.closeAllConnections();server.close(()=>process.exit(0));},100);return;
  }
  if(req.url===base+'phase'){res.writeHead(200,{'Content-Type':'text/plain','Cache-Control':'no-store'}).end(state.hideRequested?'hide':'wait');return;}
  if(req.url===base+'masked'){
   let body='';for await(const chunk of req)body+=chunk;if(!state.hideRequested||body!=='cleared'){state.violations.push('Unexpected receipt masking acknowledgement');await save();res.writeHead(409).end('Invalid phase');return;}state.receiptHidden=true;await save();res.end('Recorded');return;
  }
  if(req.url===base+'forget'){
   state.forgotten=true;await save();res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store','Set-Cookie':cfg.cookieName+'=; Path='+base+'; Max-Age=0; HttpOnly; SameSite=Lax'}).end('<title>Verification session ended</title><p>Controlled session ended.</p>');return;
  }
  if(req.url===base+'upload'&&req.method==='POST'){
   const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>1024*1024)throw new Error('Controlled upload exceeded its test limit.');chunks.push(chunk);}
   const form=await new Response(Buffer.concat(chunks),{headers:{'Content-Type':req.headers['content-type']}}).formData(),file=form.get('file');assert(file&&typeof file.arrayBuffer==='function');const bytes=Buffer.from(await file.arrayBuffer()),index=state.uploads.length,expected=index===0?cfg.first:cfg.second,cookieMatched=(req.headers.cookie??'').includes(cfg.cookieName+'='+cfg.cookieValue),item={scope:form.get('scope'),name:file.name,size:bytes.length,sha256:hash(bytes),inputValue:form.get('inputValue'),cookieMatched};
   item.valid=index<2&&cookieMatched&&item.scope===(index===0?'nested':'closed')&&item.name===cfg.filename&&item.size===expected.size&&item.sha256===expected.sha256;state.uploads.push(item);if(!item.valid)state.violations.push('Unexpected or repeated file transfer');await save();res.writeHead(item.valid?200:409,{'Content-Type':'text/plain','Cache-Control':'no-store'}).end(item.valid?cfg.receipts[index]:'Controlled upload failed');return;
  }
  if(req.url!==base){res.writeHead(404).end('Missing controlled path');return;}
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Set-Cookie':cfg.cookieName+'='+cfg.cookieValue+'; Path='+base+'; HttpOnly; SameSite=Lax; Max-Age=3600'}).end(html);
 }catch(error){state.violations.push(error.message.slice(0,200));await save().catch(()=>{});if(!res.headersSent)res.writeHead(500);res.end('Controlled fixture needs inspection');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));state.phase='listening';await save();const info={format:1,pid:process.pid,url:'http://127.0.0.1:'+server.address().port+base};await writeFile(path.join(cfg.output,'server-info.json'),JSON.stringify(info,null,2),{flag:'wx'});console.log('Controlled upload fixture ready on loopback.');
setTimeout(()=>{if(closing)return;state.phase='lease-expired';void save().finally(()=>{server.closeAllConnections();server.close(()=>process.exit(0));});},45*60*1000).unref();
