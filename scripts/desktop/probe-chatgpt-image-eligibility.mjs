import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createRequire} from 'node:module';
import {desktopOperation} from './operation-lock.mjs';

desktopOperation('one recorded ChatGPT image eligibility request');
const root=path.resolve(import.meta.dirname,'../..'),authorization=process.argv[2],responses=process.argv.includes('--responses-image-tool');
assert(/^\d{13}$/.test(authorization??''),'Pass a fresh physical authorization inspection timestamp.');
assert(process.argv.includes('--send-one-image'),'This probe sends one ChatGPT image request; use the explicit --send-one-image flag.');
const auth=path.join(root,'.supabase/desktop-workspace-agents/authorization',authorization),inspection=JSON.parse(await readFile(path.join(auth,'evidence.json'),'utf8'));
assert(inspection.success&&inspection.physicalOrdinaryProfile&&inspection.readyForLiveQualification&&inspection.secondsRemaining>600);
assert(Date.now()-Date.parse(inspection.at)<5*60*1000,'Refresh the physical authorization inspection.');
const base=path.join(root,'.supabase/desktop-image-generation'),ledger=path.join(base,responses?'eligibility-responses-image-tool.json':'eligibility-public-images.json');
await readFile(ledger).then(()=>{throw Error('A prior eligibility request is recorded. Inspect it; never replay completed or uncertain image requests.');},error=>{if(error.code!=='ENOENT')throw error;});
if(responses){const prior=JSON.parse(await readFile(path.join(base,'eligibility-public-images.json'),'utf8'));assert.equal(prior.outcome,'rejected','Inspect the earlier Images result before considering a different documented transport.');}
const out=path.join(base,(responses?'responses-eligibility-':'eligibility-')+Date.now());await mkdir(out,{recursive:true});
const exec=promisify(execFile),sid=(await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command','[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],{encoding:'utf8',windowsHide:true})).stdout.trim();assert(/^S-1-5-[0-9-]+$/.test(sid));
await exec('icacls.exe',[out,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F','/Q'],{windowsHide:true});
await copyFile(import.meta.filename,path.join(out,'probe.mjs'));
const source=path.join(auth,'private-source'),main=path.join(out,'main.cjs'),secrets=path.join(root,'.supabase/desktop-platform-release/candidate-04424/staging/build/secrets.js');
await writeFile(main,`const {app,nativeImage}=require('electron'),fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const out=${JSON.stringify(out)},source=${JSON.stringify(source)},ledger=${JSON.stringify(ledger)};
app.setPath('userData',path.join(out,'helper-profile'));fs.mkdirSync(app.getPath('userData'),{recursive:true});
for(const name of ['Local State','credentials.bin'])if(fs.realpathSync.native(path.join(source,name)).toLowerCase()!==path.join(source,name).toLowerCase())throw Error('Physical authorization source redirected');
fs.copyFileSync(path.join(source,'Local State'),path.join(app.getPath('userData'),'Local State'));
app.commandLine.appendSwitch('disable-background-networking');
const nativeFetch=globalThis.fetch;globalThis.fetch=async()=>{throw Error('Only the explicitly recorded image request may use the network');};
app.whenReady().then(async()=>{
 const evidence={at:new Date().toISOString(),success:false,scope:${JSON.stringify(responses?'One documented Responses image-generation tool request using the copied ordinary ChatGPT connection. This is a distinct transport after a definite Images-endpoint rejection; product/native chat integration remains unverified.':'One public Images endpoint eligibility request using the copied ordinary ChatGPT connection. No agent inference, production source change or product image feature is established.')},authorizationInspection:${JSON.stringify(authorization)},provider:'openai-oauth',OpenRouterRequests:0,refreshRequests:0,canonicalCredentialWrites:0,attempts:0,outcome:'not-dispatched'};
 try{
  const {Secrets}=require(${JSON.stringify(secrets)}),store=new Secrets(source);await store.load();
  const session=store.get('session'),owner=session?.access_token?JSON.parse(Buffer.from(session.access_token.split('.')[1],'base64url').toString('utf8')).sub:null;
  if(owner!=='9bf808b8-96a9-441d-b63c-eb835eb784c4')throw Error('Unexpected physical account');
  const connection=store.get('openai:'+owner);if(!connection?.access_token||!connection.scope.split(' ').includes('chatgpt.tokens.use.direct')||connection.expires_at-Date.now()<600000)throw Error('Use the running application to renew ChatGPT, then obtain a fresh read-only inspection');
  const prompt='Create one simple abstract test illustration: a single blue circle centered on a plain white square background. No text, letters, people, logos or additional objects.';
  const request=${responses?"{model:'gpt-6.1-sol',store:false,stream:true,instructions:'Generate exactly one requested image using the image generation tool. Do not use any other tools.',input:[{role:'user',content:[{type:'input_text',text:prompt}]}],tools:[{type:'image_generation'}],tool_choice:{type:'image_generation'}}":"{model:'gpt-image-2',prompt,background:'opaque',quality:'auto',size:'auto'}"};
  evidence.endpoint=${JSON.stringify(responses?'https://api.openai.com/v1/responses':'https://api.openai.com/v1/images/generations')};evidence.request=request;evidence.requestSha256=createHash('sha256').update(JSON.stringify(request)).digest('hex');evidence.expiresAt=new Date(connection.expires_at).toISOString();
  fs.writeFileSync(ledger,JSON.stringify({...evidence,out,attempts:1,outcome:'dispatched'},null,2),{flag:'wx',flush:true});evidence.attempts=1;evidence.outcome='dispatched';fs.writeFileSync(path.join(out,'dispatched.json'),JSON.stringify(evidence,null,2),{flag:'wx',flush:true});
  const response=await nativeFetch(evidence.endpoint,{method:'POST',headers:{Authorization:'Bearer '+connection.access_token,'Content-Type':'application/json','User-Agent':'Agentopia/0.44.24 image-eligibility'},body:JSON.stringify(request),signal:AbortSignal.timeout(180000)});
  evidence.httpStatus=response.status;const requestId=response.headers.get('x-request-id');if(requestId&&/^[a-zA-Z0-9_-]{1,200}$/.test(requestId))evidence.providerRequestId=requestId;
  let size=0;const chunks=[];for await(const chunk of response.body){size+=chunk.length;if(size>128*1024*1024)throw Error('Image response exceeds the bounded probe limit');chunks.push(Buffer.from(chunk));}const text=Buffer.concat(chunks).toString('utf8');let value;
  if(${responses}&&response.ok&&response.headers.get('content-type')?.includes('text/event-stream')){
   const images=new Map();let final,error;for(const line of text.split('\\n')){if(!line.startsWith('data:'))continue;const body=line.slice(5).trim();if(!body||body==='[DONE]')continue;const event=JSON.parse(body);if(event.type==='response.output_item.done'&&event.item?.type==='image_generation_call')images.set(event.item.id,event.item);if(event.type==='response.completed'||event.type==='response.failed'){final=event.response;for(const item of final?.output??[])if(item.type==='image_generation_call')images.set(item.id,item);if(final?.error)error=final.error;}if(event.type==='error')error=event.error??event;}
   evidence.responseStatus=final?.status??null;evidence.responseId=final?.id??null;if(final?.usage)evidence.usage=final.usage;value={data:[...images.values()].filter(item=>typeof item.result==='string'&&item.result).map(item=>({b64_json:item.result})),error};
  }else value=JSON.parse(text);
  if(!response.ok){for(const [key,field]of [['providerCode',value.error?.code],['providerErrorType',value.error?.type]])if(typeof field==='string'&&/^[a-zA-Z0-9_.-]{1,200}$/.test(field))evidence[key]=field;evidence.outcome='rejected';evidence.success=true;}
  else if(value.error){for(const [key,field]of [['providerCode',value.error.code],['providerErrorType',value.error.type]])if(typeof field==='string'&&/^[a-zA-Z0-9_.-]{1,200}$/.test(field))evidence[key]=field;evidence.outcome='rejected';evidence.success=true;}
  else{
   if(!Array.isArray(value.data)||value.data.length!==1||typeof value.data[0].b64_json!=='string')throw Error('The successful response has no single inline image; inspect the recorded operation before any further request');
   const b64=value.data[0].b64_json;if(b64.length>Math.ceil(32*1024*1024/3)*4)throw Error('Returned image exceeds the native 32 MiB limit');const bytes=Buffer.from(b64,'base64');if(bytes.toString('base64')!==b64)throw Error('Invalid image encoding');const image=nativeImage.createFromBuffer(bytes),dimensions=image.getSize();if(image.isEmpty()||dimensions.width*dimensions.height>64000000)throw Error('Invalid or oversized image');
   const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));if(!png)throw Error('Expected the native default PNG output');const file=path.join(out,'generated-image.png');fs.writeFileSync(file,bytes,{flag:'wx'});evidence.image={file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),...dimensions};evidence.outcome='completed';evidence.success=true;
  }
 }catch(error){evidence.error=String(error.message).slice(0,500);if(evidence.attempts)evidence.outcome='uncertain';}
 evidence.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));if(evidence.attempts)fs.writeFileSync(ledger,JSON.stringify({...evidence,out},null,2),{flush:true});console.log(JSON.stringify(evidence,null,2));app.exit(evidence.success?0:1);
});`);
const require=createRequire(import.meta.url),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const code=await new Promise((resolve,reject)=>{const child=spawn(require('electron'),[main],{cwd:root,env,windowsHide:true,stdio:'inherit'});child.once('error',reject);child.once('exit',code=>resolve(code??1));});
console.log('Image eligibility evidence: '+path.join(out,'evidence.json'));process.exitCode=code;
