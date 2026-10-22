import assert from 'node:assert/strict';
import {mkdir,copyFile,writeFile} from 'node:fs/promises';
import {randomUUID,generateKeyPairSync} from 'node:crypto';
import path from 'node:path';
import {hash,list} from './phased-backup-control.mjs';
import {launchDurableProfileProbe} from './launch-durable-profile-probe.mjs';

export async function prepareRouterEnvelope({out,proof,source,sourceOwner}){
 const directory=path.join(out,'router-envelope'),home=path.join(directory,'home'),roaming=path.join(home,'AppData/Roaming'),profile=path.join(roaming,'Agentopia'),instance=randomUUID(),distribution='AgentopiaRuntime-'+instance;
 await mkdir(profile,{recursive:true});const before=await hash(path.join(source,'credentials.bin'));await copyFile(path.join(source,'Local State'),path.join(profile,'Local State'));await writeFile(path.join(profile,'runtime-binding.json'),JSON.stringify({format:1,distribution,instanceId:instance}));assert(!(await list(false)).includes(distribution));
 const pair=generateKeyPairSync('rsa',{modulusLength:3072}),publicKey=pair.publicKey.export({type:'spki',format:'pem'}),privateKey=pair.privateKey.export({type:'pkcs8',format:'pem'}),cfg={out:directory,temp:path.join(directory,'temp'),home,roaming,legacy:profile,program:proof.program,exe:proof.exe,assets:proof.assets,imageSha256:proof.imageSha256,instance,distribution};
 const probe=await launchDurableProfileProbe(cfg,{label:'read-only-router',testProfile:false,initialProfile:profile,expectedProfile:profile,expectedRuntime:'missing',isolateOsHome:true,hiddenWindow:true,runMissing:async({application})=>application.evaluate(async({app},{source,sourceOwner,publicKey})=>{
  const req=globalThis.__durableProbeRequire,crypto=req('node:crypto'),{Secrets}=req(app.getAppPath()+'/build/secrets.js'),secrets=new Secrets(source);await secrets.load();
  const session=secrets.get('session');if(!session?.access_token||JSON.parse(Buffer.from(session.access_token.split('.')[1],'base64url').toString()).sub!==sourceOwner)throw Error('The selected original local account changed');
  const router=secrets.get('openrouter');if(typeof router?.key!=='string'||!router.key.trim()||router.key.length>16384||/[\r\n]/.test(router.key))throw Error('The existing encrypted OpenRouter connection is unavailable');
  const key=crypto.randomBytes(32),iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv),ciphertext=Buffer.concat([cipher.update(JSON.stringify({router:{key:router.key}}),'utf8'),cipher.final()]);
  const envelope={key:crypto.publicEncrypt({key:publicKey,oaepHash:'sha256'},key).toString('base64'),iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:ciphertext.toString('base64')};key.fill(0);
  return {success:true,envelope,sourceWrites:0,networkRequests:0,plaintextCredentialValuesReturned:false,chatGPTCredentialIncluded:false};
 },{source,sourceOwner,publicKey})});
 assert(probe.success&&probe.normalExit===0&&probe.externalRequestsAttempted===0&&probe.absentPrivateRuntimeRefused);assert.equal(await hash(path.join(source,'credentials.bin')),before);assert(!(await list(false)).includes(distribution));
 return {envelope:probe.workflow.envelope,privateKey,metadata:{sourceUnchanged:true,envelopeEvidence:path.join(probe.out,'evidence.json'),privateKeyPersisted:false,chatGPTCredentialIncluded:false}};
}
