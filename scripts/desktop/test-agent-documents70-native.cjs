const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{randomUUID,createHash}=require('node:crypto'),{execFile}=require('node:child_process');
const {createClient}=require('@supabase/supabase-js');
(async()=>{
 const cfg=JSON.parse(await fs.readFile(process.argv[2],'utf8')),phase=process.argv[3],base=new URL(cfg.base),checks=[];
 const relay=request=>new Promise((resolve,reject)=>{const child=execFile('C:/Windows/System32/wsl.exe',['-d','AgentopiaRuntime-0d473265-a4e8-4919-9e7f-9181ae61fed5','-u','agentopia','--exec','python3','/mnt/f/Agentopia/scripts/desktop/file-history69-http-relay.py'],{windowsHide:true,encoding:'utf8',timeout:30000,maxBuffer:40*1024*1024},(error,stdout)=>{if(error)return reject(Error('QA-only HTTP relay failed'));try{resolve(JSON.parse(stdout));}catch{reject(Error('QA relay returned invalid JSON'));}});child.stdin.end(JSON.stringify(request));});
 const db=createClient(cfg.base,cfg.token,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(input,init)=>{const url=new URL(String(input));assert.equal(url.origin,base.origin);const result=await relay({url:url.href,method:init?.method??'GET',headers:Object.fromEntries(new Headers(init?.headers)),body:init?.body??null});return new Response([204,205,304].includes(result.status)?null:result.body,{status:result.status,headers:result.headers});}}});
 const {AgentDocuments}=require(path.join(cfg.build,'agent-documents.js')),{DocumentReader}=require(path.join(cfg.build,'documents.js')),reader=new DocumentReader(),docs=new AgentDocuments(db,reader,()=>{}),guard=async()=>{},signal=new AbortController().signal;
 const rpc=async(name,args)=>{const result=await db.rpc(name,args);assert.equal(result.error,null,result.error?.message);return result.data;};
 const assign=ids=>rpc('desktop_save_agent_settings',{p_user:cfg.owner,p_agent:cfg.agent,p_section:'documents',p_value:{ids}}),hash=value=>createHash('sha256').update(value).digest('hex');
 try{
 if(phase==='seed'){
  const ids=[],originals={};await fs.mkdir(cfg.temp,{recursive:true});
  for(const extension of ['md','pdf','docx','xlsx','pptx']){
   const bytes=extension==='md'?Buffer.from('QA-DOCUMENT-7041\nThe orchard budget is 74 apples.'):await fs.readFile(path.join(__dirname,'../../desktop/tests/fixtures/documents/sample.'+extension)),file=path.join(cfg.temp,'persistent-reference.'+extension);await fs.writeFile(file,bytes);
   const uploaded=await docs.import(cfg.owner,cfg.agent,file,guard,signal);ids.push(uploaded.id);originals[uploaded.id]=hash(bytes);await fs.unlink(file);
  }
  assert.equal((await docs.snapshot(cfg.owner,cfg.agent)).documents.length,0);await assign(ids);
  const snapshot=await docs.snapshot(cfg.owner,cfg.agent);assert.equal(snapshot.documents.length,5);
  const result=await docs.execute(cfg.owner,snapshot,'search_agent_documents',{query:'74 apples'},guard,signal);assert.equal(result.matches.length,1);
  for(const id of ids){const row=await rpc('desktop_read_agent_document',{p_user:cfg.owner,p_agent:cfg.agent,p_id:id,p_original:true});assert.equal(hash(Buffer.from(row.base64,'base64')),originals[id]);}
  const foreign=await db.rpc('desktop_read_agent_document',{p_user:randomUUID(),p_agent:cfg.agent,p_id:ids[0],p_original:true});assert(foreign.error);
  const bad=await db.rpc('desktop_import_agent_document',{p_user:cfg.owner,p_agent:cfg.agent,p_id:randomUUID(),p_value:{name:'invalid.txt',extension:'.txt',mime:'text/plain',text:'bad',base64:'YWJj',sha256:'0'.repeat(64)}});assert(bad.error);
  await fs.writeFile(cfg.checkpoint,JSON.stringify({ids,originals,snapshot},null,2));
 }else{
  const saved=JSON.parse(await fs.readFile(cfg.checkpoint,'utf8'));const snapshot=await docs.snapshot(cfg.owner,cfg.agent);assert.equal(snapshot.key,saved.snapshot.key);
  for(const id of saved.ids){const row=await rpc('desktop_read_agent_document',{p_user:cfg.owner,p_agent:cfg.agent,p_id:id,p_original:true});assert.equal(hash(Buffer.from(row.base64,'base64')),saved.originals[id]);const text=await docs.execute(cfg.owner,snapshot,'read_agent_document',{document_id:id,offset:0,characters:16000},guard,signal);assert(text.text.length>0);}
  checks.push('Actual Supabase/PostgREST calls import and read text, PDF, Word, Excel and PowerPoint after their original upload files are removed.');
  checks.push('A fresh reader process reads the restored original hashes and extracted text after the logical database restore.');
  await assign([]);await assert.rejects(docs.execute(cfg.owner,snapshot,'read_agent_document',{document_id:saved.ids[0],offset:0,characters:100},guard,signal),/assigned documents changed/);
  const denied=await db.rpc('desktop_read_agent_document',{p_user:cfg.owner,p_agent:cfg.agent,p_id:saved.ids[0],p_original:true});assert(denied.error);
  await assign(saved.ids);assert.equal((await docs.snapshot(cfg.owner,cfg.agent)).documents.length,5);
  checks.push('Removing an assignment revokes the active snapshot and direct document RPC; the library originals remain available for reassignment.');
  checks.push('Foreign-account reads and mismatched upload hashes were rejected by the actual database.');
  await assign([]);await fs.writeFile(cfg.result,JSON.stringify({success:true,checks,providerRequests:0},null,2));
 }
 }finally{await reader.close();}
 console.log(JSON.stringify({success:true,phase}));
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
