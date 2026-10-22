// Inspect a copied, encrypted connection without refreshing it or contacting a provider.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {desktopOperation} from './operation-lock.mjs';
import {hash,list} from './phased-backup-control.mjs';
import {launchDurableProfileProbe} from './launch-durable-profile-probe.mjs';

desktopOperation('inspect live context-test connection readiness without provider calls');
const root=path.resolve(import.meta.dirname,'../..'),json=async f=>JSON.parse(await readFile(f,'utf8')),pointer=await json(path.join(root,'.supabase/desktop-profile-release54/current.json')),proof=await json(pointer.proof),source='C:/Users/charl/.agentopia/desktop/profile',stamp=String(Date.now()),out=path.join(proof.out,'live-context-readiness-'+stamp),home=path.resolve('F:/Agentopia-Acceptance','live-context54-'+stamp,'home'),roaming=path.join(home,'AppData/Roaming'),profile=path.join(roaming,'Agentopia'),instance=randomUUID(),distribution='AgentopiaRuntime-'+instance;
assert.equal(await hash(proof.image),proof.imageSha256);await mkdir(out);await mkdir(profile,{recursive:true});const exec=promisify(execFile),sid=(await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command','[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],{windowsHide:true,encoding:'utf8'})).stdout.trim();assert(/^S-1-5-[0-9-]+$/.test(sid));for(const dir of [out,path.dirname(home)])await exec('icacls.exe',[dir,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F','/Q'],{windowsHide:true});
const before={};for(const name of ['credentials.bin','Local State']){before[name]=await hash(path.join(source,name));await copyFile(path.join(source,name),path.join(profile,name));assert.equal(await hash(path.join(profile,name)),before[name]);}
await writeFile(path.join(profile,'runtime-binding.json'),JSON.stringify({format:1,distribution,instanceId:instance}));assert(!(await list(false)).includes(distribution));
const cfg={out,temp:path.join(out,'temp'),home,roaming,legacy:profile,program:proof.program,exe:proof.exe,assets:proof.assets,imageSha256:proof.imageSha256,instance,distribution};await writeFile(path.join(out,'intent.json'),JSON.stringify(cfg,null,2),{flag:'wx'});const e={success:false,at:new Date().toISOString(),out,imageSha256:proof.imageSha256,productionWrites:0,providerRequests:0,credentialRefreshes:0,copiedCredentialsRemainEncrypted:true,sourceUnchanged:false};
try{
 const result=await launchDurableProfileProbe(cfg,{label:'read-only-connection',testProfile:false,initialProfile:profile,expectedProfile:profile,expectedRuntime:'missing',isolateOsHome:true,hiddenWindow:true,runMissing:async({application})=>application.evaluate(async({app})=>{
  const req=globalThis.__durableProbeRequire,{Secrets}=req(app.getAppPath()+'/build/secrets.js'),secrets=new Secrets(app.getPath('userData'));await secrets.load();const now=Date.now(),connections=[];
  for(const key of Object.keys(secrets.values))if(/^openai:[a-f0-9-]{36}$/i.test(key)){
   const saved=secrets.get(key),scope=typeof saved?.scope==='string'&&saved.scope.split(' ').includes('chatgpt.tokens.use.direct'),tokenPresent=typeof saved?.access_token==='string'&&saved.access_token.length>0,expiresAt=Number(saved?.expires_at),remainingMs=Number.isFinite(expiresAt)?expiresAt-now:null;
   connections.push({owner:key.slice(7),planAccess:scope,tokenPresent,expiresAt:Number.isFinite(expiresAt)?new Date(expiresAt).toISOString():null,freshForTenMinuteTest:scope&&tokenPresent&&remainingMs>600000,expired:remainingMs!==null&&remainingMs<=0});
  }
  return {connections,checkedAt:new Date(now).toISOString(),networkRequests:0,refreshes:0};
 })});assert(result.success&&result.normalExit===0&&result.hiddenOwnedWindowVerified&&result.absentPrivateRuntimeRefused);e.probe=path.join(result.out,'evidence.json');e.connectionReadiness=result.workflow;for(const name of Object.keys(before))assert.equal(await hash(path.join(source,name)),before[name]);e.sourceUnchanged=true;e.success=true;assert.equal(result.externalRequestsAttempted,0);
}catch(error){e.error=error.stack;e.cause=error.cause?.stack;process.exitCode=1;}
await writeFile(path.join(out,'evidence.json'),JSON.stringify(e,null,2));await writeFile(path.join(proof.out,'live-context-readiness-current.json'),JSON.stringify({success:e.success,out,evidence:path.join(out,'evidence.json')},null,2));console.log(JSON.stringify({success:e.success,out,connections:e.connectionReadiness?.connections.length,freshConnections:e.connectionReadiness?.connections.filter(row=>row.freshForTenMinuteTest).length,expiredConnections:e.connectionReadiness?.connections.filter(row=>row.expired).length,sourceUnchanged:e.sourceUnchanged,providerRequests:0,error:e.error,cause:e.cause}));
