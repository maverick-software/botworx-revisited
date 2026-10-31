// Runs the unmodified installed application against an owned empty private runtime.
// Cloud service keys are deliberately absent from this child's environment.
import assert from 'node:assert/strict';
import {readFile,writeFile,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {launchDurableProfileProbe} from './sylvana-profile-probe.mjs';
const root=process.env.SYLVANA_INSTALLED_VERIFICATION_ROOT;
assert(root&&/^[Ff]:[\\/]/.test(root));
for(const key of Object.keys(process.env))assert(!/SUPABASE_SERVICE|STRIPE_SECRET|OPENROUTER_API/i.test(key),'Backend credentials must never enter the desktop.');
const cfg=JSON.parse(await readFile(root+'/config.json','utf8'));
const installedProgram=cfg.program;
if(process.env.SYLVANA_VERIFY_CANDIDATE_PROGRAM){const candidate=process.env.SYLVANA_VERIFY_CANDIDATE_PROGRAM;assert(candidate==='F:/Sylvana/verification/public-release-0.46.4/cold-start-candidate/program');cfg.program=candidate;cfg.exe=candidate+'/Sylvana.exe';}
cfg.imageSha256=createHash('sha256').update(await readFile(cfg.program+'/resources/app.asar')).digest('hex');
const bridge=process.env.SYLVANA_VERIFY_BRIDGE,bridgeKey=process.env.SYLVANA_VERIFY_BRIDGE_KEY;
assert(/^http:\/\/127\.0\.0\.1:\d+$/.test(bridge)&&bridgeKey);
const profile=path.join(cfg.legacy,'test-profiles',cfg.testName);
const result=await launchDurableProfileProbe(cfg,{label:'installed-new-user',expectedProfile:profile,expectedRuntime:'ready',resumeDebugWorkers:true,isolateOsHome:true,startupTimeoutMs:600000,evaluationTimeoutMs:60000,normalCloseTimeoutMs:120000,
 prepareReady:async application=>{await application.evaluate(({shell},args)=>{
  globalThis.fetch=globalThis.__durableProbeOriginalFetch;
  shell.openExternal=async authorize=>{const url=new URL(authorize);if(url.hostname!=='xukoabvnftoosxyrfbea.supabase.co'||url.pathname!=='/auth/v1/oauth/authorize')throw Error('Unexpected external link during new-user verification');const r=await fetch(args.bridge+'/oauth',{method:'POST',headers:{Authorization:'Bearer '+args.bridgeKey,'Content-Type':'application/json'},body:JSON.stringify({authorize})});if(!r.ok)throw Error('Verification browser consent failed');};
 },{bridge,bridgeKey});},
 runReady:async({application})=>{
  const initialUsers=await application.evaluate(async()=>{const r=await globalThis.__coordination.broker.admin.auth.admin.listUsers({page:1,perPage:1000});if(r.error)throw Error('Could not verify the empty local runtime');return r.data.users.length;});assert.equal(initialUsers,0,'The new-user test requires a genuinely empty local account store.');
  await writeFile(root+'/native-ready.json',JSON.stringify({ready:true,profile,initialLocalUsers:initialUsers,program:cfg.program,imageSha256:cfg.imageSha256}));
  const deadline=Date.now()+45*60000;while(Date.now()<deadline){
   const status=await application.evaluate(async()=>{const b=globalThis.__coordination.broker;let identity;try{identity=await b.identity();}catch{}if(!identity)return {signedIn:false};const requests=await b.admin.from('desktop_requests').select('id,status,error,created_at').eq('user_id',identity.id).order('created_at',{ascending:false}).limit(8);if(requests.error)throw Error('Could not inspect generated requests');return {signedIn:true,owner:identity.id,requests:requests.data,provider:b.providers.account.status(identity.id)};});
   await writeFile(root+'/native-state.json',JSON.stringify(status,null,2));
   try{await access(root+'/finish.json');assert(status.signedIn);assert(status.requests.filter(r=>r.status==='completed').length>=2);return {realModelRequests:true,syntheticInference:false,cloudOwner:status.owner,requests:status.requests,credentialStorage:'Actual Windows safeStorage',signInInitiatedFromInstalledUI:false,signInInitiatedFromNativeApplicationAPI:true};}catch(error){if(error.code!=='ENOENT')throw error;}
   await new Promise(resolve=>setTimeout(resolve,2000));
  }throw Error('Installed new-user verification requires completion or normal close; no paid request is replayed automatically.');
 }});
await writeFile(root+'/native-acceptance.json',JSON.stringify({...result,program:cfg.program,productionAccess:true,syntheticInference:false,providerRequests:2,externalRequestsAttempted:undefined},null,2));
if(cfg.program!==installedProgram){console.log('New-user model checks complete; waiting for the exact final installer and preserved-profile upgrade checks.');const deadline=Date.now()+45*60000;let installed;while(Date.now()<deadline){try{installed=JSON.parse(await readFile(root+'/installed-ready.json','utf8'));break;}catch(error){if(error.code!=='ENOENT')throw error;}await new Promise(resolve=>setTimeout(resolve,2000));}assert(installed?.success&&installed.imageSha256===cfg.imageSha256&&installed.programFilesVerified>7000);cfg.program=installedProgram;cfg.exe=installedProgram+'/Sylvana.exe';}
const reopened=await launchDurableProfileProbe(cfg,{label:'installed-cold-reopen',expectedProfile:profile,expectedRuntime:'ready',resumeDebugWorkers:true,isolateOsHome:true,startupTimeoutMs:600000,normalCloseTimeoutMs:120000,
 prepareReady:async application=>application.evaluate(()=>{globalThis.fetch=globalThis.__durableProbeOriginalFetch;}),
 runReady:async({application})=>application.evaluate(async(_,owner)=>{const b=globalThis.__coordination.broker,identity=await b.identity();if(identity.id!==owner)throw Error('Saved sign-in did not restore the new cloud owner.');await b.providers.account.verifySession(owner,true);const account=b.providers.account.status(owner);if(!account.linked||account.allowance.unlimited_llm||account.allowance.status!=='active'||account.allowance.reserved_units!==0)throw Error('The restored subscriber entitlement is incorrect.');return {owner:identity.id,windowsEncryptedSignInRestored:true,allowance:account.allowance,providerRequests:0};},result.workflow.cloudOwner)
});
await writeFile(root+'/cold-reopen-acceptance.json',JSON.stringify({...reopened,productionAccess:true,syntheticInference:false,providerRequests:0,externalRequestsAttempted:undefined},null,2));
console.log(JSON.stringify({success:true,receipt:root+'/native-acceptance.json'}));
