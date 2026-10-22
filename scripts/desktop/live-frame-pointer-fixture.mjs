import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomUUID,randomBytes} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createClient} from '@supabase/supabase-js';
import path from 'node:path';
import assert from 'node:assert/strict';
import {checkpointWriter} from './checkpoint.mjs';
import {desktopOperation} from './operation-lock.mjs';

// The application is operated through its native UI. Observation is read-only;
// no provider credential is loaded or request dispatched by this helper.
const root=path.resolve(import.meta.dirname,'../..'),mode=process.argv[2],out=path.resolve(process.argv[3]??'');
assert(out.startsWith(path.join(root,'.supabase')+path.sep),'Choose a private evidence directory.');
const read=async name=>JSON.parse(await readFile(path.join(out,name),'utf8'));
const checked=result=>{if(result.error)throw Error(result.error.message);return result.data;};
const allowed=['browser_open','browser_list','browser_screenshot','browser_click'];

if(mode==='serve'){
 desktopOperation('native-UI ChatGPT embedded visual browser verification');await mkdir(out,{recursive:true});
 try{await readFile(path.join(out,'config.json'));throw Error('A fixture checkpoint exists. Inspect it instead of restarting or replaying.');}catch(error){if(error.code!=='ENOENT')throw error;}
 const tag='FRAME-VISUAL-'+randomBytes(4).toString('hex').toUpperCase(),receipt='FRAME-'+randomBytes(10).toString('hex').toUpperCase(),control=randomBytes(24).toString('hex');
 const state={at:new Date().toISOString(),tag,documents:[],clicks:[],violations:[],stopped:false},save=checkpointWriter(path.join(out,'server-state.json'));
 let outer,inner,controlServer;const sessions=new Set();
 inner=createServer(async(req,res)=>{
  if(req.method==='GET'&&req.url==='/frame'){
   const session=randomUUID();sessions.add(session);state.documents.push({session,at:new Date().toISOString()});await save(state);
   const script='const session='+JSON.stringify(session)+';let count=0;const canvas=document.querySelector("canvas"),ctx=canvas.getContext("2d");function draw(text){ctx.clearRect(0,0,720,150);ctx.fillStyle="#143421";ctx.font="25px Arial";ctx.fillText(text,15,65);}draw("Waiting for a verified click");document.querySelector("button").addEventListener("click",async event=>{count++;const response=await fetch("/click",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({session,trusted:event.isTrusted,count})});draw(await response.text());});';
   res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'}).end('<!doctype html><title>Embedded visual verifier</title><style>body{margin:0;background:#eaf5ed;font-family:Arial;color:#143421}h2{font-size:20px;margin:25px}button{position:absolute;top:145px;left:20%;width:170px;height:66px;background:#147a3f;color:white;border:0;border-radius:9px;font:24px Arial}canvas{position:absolute;top:260px;left:15px;width:calc(100% - 30px);height:auto}</style><h2>Embedded visual verifier</h2><button>VERIFY</button><canvas width="720" height="150"></canvas><script>'+script+'</script>');return;
  }
  if(req.method==='POST'&&req.url==='/click'){
   let body='';for await(const bytes of req){body+=bytes;if(body.length>10000){res.writeHead(413).end();return;}}
   let value;try{value=JSON.parse(body);}catch{res.writeHead(400).end();return;}
   const valid=sessions.has(value.session)&&value.trusted===true&&value.count===1&&state.clicks.length===0;
   const record={at:new Date().toISOString(),session:value.session,trusted:value.trusted,count:value.count,valid};state.clicks.push(record);if(!valid)state.violations.push(record);await save(state);
   res.writeHead(valid?200:409,{'Content-Type':'text/plain','Cache-Control':'no-store'}).end(valid?receipt:'UNCONFIRMED');return;
  }
  res.writeHead(404).end();
 });
 await new Promise(resolve=>inner.listen(0,'127.0.0.1',resolve));
 const frameUrl='http://localhost:'+inner.address().port+'/frame';
 outer=createServer((req,res)=>{if(req.url!=='/'){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'}).end('<!doctype html><title>Embedded visual check</title><style>body{margin:0;background:#f4f6f5;font-family:Arial}h1{font-size:22px;margin:25px}iframe{display:block;margin:25px;width:calc(100vw - 50px);height:470px;border:1px solid #bccfc1}</style><h1>Visual browser verification</h1><iframe title="Embedded visual verifier" src="'+frameUrl+'"></iframe>');});
 await new Promise(resolve=>outer.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+outer.address().port+'/';
 controlServer=createServer(async(req,res)=>{if(req.headers.authorization!=='Bearer '+control){res.writeHead(403).end();return;}if(req.method==='POST'&&req.url==='/stop'){state.stopped=true;await save(state);res.end('Stopped');for(const server of [outer,inner,controlServer]){server.closeAllConnections();server.close();}return;}res.writeHead(404).end();});
 await new Promise(resolve=>controlServer.listen(0,'127.0.0.1',resolve));
 const prompt=tag+'. Use only Agentopia browser_open, browser_list, browser_screenshot and browser_click through agentopia_host MCP. Open exactly one tab at '+url+'. Take a browser screenshot and locate the green VERIFY button INSIDE the embedded page named Embedded visual verifier. Click the center of that button exactly once using browser_click, that screenshot capture_id, left button and click_count 1. Take a fresh screenshot after the click. Read and report the exact FRAME receipt drawn below the button, then leave this browser tab open. Do not use DOM snapshots, browser_action, page scripts, commands, files, web search or subagents. Never repeat an uncertain click.';
 const config={format:1,version:'0.43.7',tag,receipt,url,frameUrl,controlUrl:'http://127.0.0.1:'+controlServer.address().port,control,prompt};assert(!prompt.includes(receipt));await writeFile(path.join(out,'config.json'),JSON.stringify(config,null,2),{flag:'wx'});await save(state);
 console.log(JSON.stringify({ready:true,tag,url,frameUrl,prompt}));
}else if(mode==='observe'){
 const cfg=await read('config.json'),server=await read('server-state.json'),distribution='AgentopiaRuntime-a91a4800-e08f-4440-a4ec-588762d01bfd';
 const status=JSON.parse(execFileSync('wsl.exe',['-d',distribution,'-u','agentopia','--cd','/home/agentopia/app','--exec','supabase','stack','status','--output-format','json'],{encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024}));
 const db=createClient(status.env.API_URL,status.env.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}}),users=checked(await db.auth.admin.listUsers()).users,owner=users.find(user=>user.email==='admin@agentopia.local');assert(owner);
 const messages=checked(await db.from('chat_messages_v2').select('id,conversation_id,content,metadata').eq('sender_user_id',owner.id).eq('role','user').eq('content->>text',cfg.prompt));assert(messages.length<=1,'Do not replay a submitted request.');
 const observation={at:new Date().toISOString(),version:cfg.version,tag:cfg.tag,requestFound:messages.length===1,server:{documents:server.documents,clicks:server.clicks,violations:server.violations},liveOpenRouterRequests:0};
 if(messages.length){
  const user=messages[0],request=checked(await db.from('desktop_requests').select('id,conversation_id,status,assistant_message_id,error').eq('user_message_id',user.id).single()),reply=checked(await db.from('chat_messages_v2').select('content,metadata').eq('id',request.assistant_message_id).single());
  observation.request=request;observation.options=user.metadata.options;observation.reply=reply.content.text;observation.messageStatus=reply.metadata.status;
  const tools=checked(await db.from('desktop_tool_calls').select('id,name,status,approval,result').eq('request_id',request.id).order('created_at')),turn=checked(await db.from('desktop_codex_turns').select('state').eq('request_id',request.id).maybeSingle()),native=turn?.state;
  observation.tools=tools.map(tool=>({id:tool.id,name:tool.name,status:tool.status,approval:tool.approval?{arguments:tool.approval.arguments,preview:tool.approval.preview}:undefined,result:tool.result?{tab_id:tool.result.tab_id,frame_url:tool.result.frame_url,action:tool.result.action,hasImage:tool.result.content?.some(item=>item.type==='image')}:undefined}));
  observation.native={version:native?.version,threadId:native?.threadId,items:(native?.items??[]).map(entry=>({type:entry.item.type,tool:entry.item.tool,status:entry.item.status,hasImage:entry.item.result?.content?.some(item=>item.type==='image')})),pendingApprovals:native?.approvals?.filter(approval=>approval.status==='pending').length??0};
  assert.equal(observation.options.provider,'openai-oauth');assert.equal(observation.options.harness,'codex');assert(observation.tools.every(tool=>allowed.includes(tool.name)),'Unexpected tool; stop and inspect instead of approving.');
  if(request.status==='completed'){
   assert.equal(reply.metadata.status,'completed');assert.equal(server.documents.length,1);assert.equal(server.clicks.length,1);assert(server.clicks[0].valid);assert.equal(server.violations.length,0);assert(reply.content.text.includes(cfg.receipt));assert(observation.native.threadId);assert.equal(observation.native.version,'0.163.0');assert(!observation.native.items.some(item=>['commandExecution','collabAgentToolCall','webSearch'].includes(item.type)));
   const clicks=observation.tools.filter(tool=>tool.name==='browser_click'&&tool.status==='completed');assert.equal(clicks.length,1);assert.equal(clicks[0].approval.arguments.target.tag,'BUTTON');assert.equal(clicks[0].approval.arguments.target.frame_url,cfg.frameUrl);assert(observation.native.items.some(item=>item.tool==='browser_screenshot'&&item.hasImage));observation.success=true;
   await writeFile(path.join(out,'evidence.json'),JSON.stringify(observation,null,2),{flag:'wx'});
  }
 }
 await writeFile(path.join(out,'observation.json'),JSON.stringify(observation,null,2));console.log(JSON.stringify(observation,null,2));
}else if(mode==='stop'){
 const cfg=await read('config.json'),evidence=await read('evidence.json');assert(evidence.success);const response=await fetch(cfg.controlUrl+'/stop',{method:'POST',headers:{Authorization:'Bearer '+cfg.control}});assert(response.ok);console.log('Stopped the verified owned fixture.');
}else throw Error('Choose serve, observe or stop.');
