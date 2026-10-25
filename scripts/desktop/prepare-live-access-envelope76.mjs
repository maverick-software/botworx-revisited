import assert from 'node:assert/strict';
import {mkdir,copyFile,writeFile} from 'node:fs/promises';
import {randomUUID,generateKeyPairSync} from 'node:crypto';
import path from 'node:path';
import {hash,list} from './phased-backup-control.mjs';
import {launchDurableProfileProbe} from './launch-durable-profile-probe.mjs';

export async function prepareValidationAccess76({out,proof,source,sourceOwner,routerOnly=false}){
 const directory=path.join(out,'access-envelope'),home=path.join(directory,'home'),roaming=path.join(home,'AppData/Roaming'),profile=path.join(roaming,'Agentopia'),instance=randomUUID(),distribution='AgentopiaRuntime-'+instance;
 await mkdir(profile,{recursive:true});const before=await hash(path.join(source,'credentials.bin'));await copyFile(path.join(source,'Local State'),path.join(profile,'Local State'));await writeFile(path.join(profile,'runtime-binding.json'),JSON.stringify({format:1,distribution,instanceId:instance}));assert(!(await list(false)).includes(distribution));
 const pair=generateKeyPairSync('rsa',{modulusLength:3072}),publicKey=pair.publicKey.export({type:'spki',format:'pem'}),privateKey=pair.privateKey.export({type:'pkcs8',format:'pem'}),cfg={out:directory,temp:path.join(directory,'temp'),home,roaming,legacy:profile,program:proof.program,exe:proof.exe,assets:proof.assets,imageSha256:proof.imageSha256,instance,distribution};
 const probe=await launchDurableProfileProbe(cfg,{label:'read-only-access',testProfile:false,initialProfile:profile,expectedProfile:profile,expectedRuntime:'missing',isolateOsHome:true,hiddenWindow:true,runMissing:async({application})=>application.evaluate(async({app},{source,sourceOwner,publicKey,routerOnly})=>{
  const req=globalThis.__durableProbeRequire,crypto=req('node:crypto'),{Secrets}=req(app.getAppPath()+'/build/secrets.js'),secrets=new Secrets(source);await secrets.load();const session=secrets.get('session');if(!session?.access_token||JSON.parse(Buffer.from(session.access_token.split('.')[1],'base64url').toString()).sub!==sourceOwner)throw Error('The original local account changed');
  const saved=secrets.get('openai:'+sourceOwner),models=secrets.get('models:openai-oauth:'+sourceOwner),router=secrets.get('openrouter'),routerModels=secrets.get('models:openrouter:shared');
  if(!router?.key||!routerModels?.some(row=>row.id==='openai/gpt-6.1-sol')||!routerOnly&&(!saved?.access_token||saved.expires_at<Date.now()+600000||!saved.scope.split(' ').includes('chatgpt.tokens.use.direct')||!models?.some(row=>row.id==='gpt-6.1-sol')))throw Error('Fresh selected access and its existing model catalogs are required');
  const connection=routerOnly?null:{client_id:saved.client_id,subject:saved.subject,email:'',id_token:'',access_token:saved.access_token,refresh_token:'',scope:saved.scope,expires_at:saved.expires_at},key=crypto.randomBytes(32),iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv),ciphertext=Buffer.concat([cipher.update(JSON.stringify({connection,models:routerOnly?[]:models,router:{key:router.key},routerModels}),'utf8'),cipher.final()]);
  return {success:true,envelope:{key:crypto.publicEncrypt({key:publicKey,oaepHash:'sha256'},key).toString('base64'),iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:ciphertext.toString('base64')},expiresAt:routerOnly?null:new Date(saved.expires_at).toISOString(),...(routerOnly?{routerOnly:true,oauthCredentialIncluded:false,leaseExpiresAt:new Date(Date.now()+50*60000).toISOString()}:{}),refreshCredentialIncluded:false,sourceWrites:0,networkRequests:0,credentialValuesReturned:false};
 },{source,sourceOwner,publicKey,routerOnly})});
 assert(probe.success&&probe.normalExit===0&&probe.externalRequestsAttempted===0&&probe.absentPrivateRuntimeRefused);assert.equal(await hash(path.join(source,'credentials.bin')),before);
 return {envelope:probe.workflow.envelope,privateKey,metadata:{expiresAt:probe.workflow.expiresAt,...(routerOnly?{routerOnly:true,oauthCredentialCopied:false,leaseExpiresAt:probe.workflow.leaseExpiresAt}:{}),refreshCredentialCopied:false,sourceUnchanged:true,envelopeEvidence:path.join(probe.out,'evidence.json'),privateKeyPersisted:false}};
}
