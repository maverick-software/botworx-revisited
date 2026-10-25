// Compare encrypted snapshots in an isolated Windows-encryption helper. Plaintext
// exists only in helper memory; no credential value is printed, exported or sent.
import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,copyFile,readFile,writeFile,stat} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash} from './phased-backup-control.mjs';
import {launchDurableProfileProbe} from './launch-durable-profile-probe.mjs';

desktopOperation('read-only isolated comparison of installed75 protected credentials');
const root=path.resolve(import.meta.dirname,'../..'),patchFlag=process.argv.find(value=>/^--patch(?:134|135|136|138|140|142|146|149|154)$/.test(value)),patch=!!patchFlag,preview=patch||process.argv.includes('--preview76'),version=preview?'0.44.76':'0.44.75',release=await json(path.join(root,patch?(patchFlag==='--patch154'?'.supabase/desktop-oauth-network154/current.json':patchFlag==='--patch149'?'.supabase/desktop-chrome149/current.json':patchFlag==='--patch146'?'.supabase/desktop-agent-builder146/current.json':patchFlag==='--patch142'?'.supabase/desktop-child-report142/current.json':patchFlag==='--patch140'?'.supabase/desktop-preview-continuation140/current.json':patchFlag==='--patch138'?'.supabase/desktop-preview-delegation138/current.json':patchFlag==='--patch136'?'.supabase/desktop-preview-command136/current.json':patchFlag==='--patch135'?'.supabase/desktop-preview-browser135/current.json':'.supabase/desktop-preview-computer134/current.json'):preview?'.supabase/desktop-preview131-release/current.json':'.supabase/desktop-recovery75-release/current.json'));
const proof=await json(release.proof),maintenance=patch?{job:path.resolve(process.argv[process.argv.indexOf(patchFlag)+1])}:await json(path.join(root,'.supabase/desktop-normal-maintenance',preview?'current-update76.json':'current-update75.json'));
if(patch)assert(path.dirname(maintenance.job)===proof.out&&/^installation-[0-9]+$/.test(path.basename(maintenance.job)));
const installed=await json(path.join(maintenance.job,patch?'evidence.json':'installed-data-accepted.json'));assert(patch?installed.installed&&installed.database?.success&&installed.version===version:installed.success&&installed.version===version);
await assert.rejects(stat(path.join(maintenance.job,'installed-credentials-accepted.json')),error=>error.code==='ENOENT');
const recovery=path.join(maintenance.job,patch?'profile':'recovery'),baseline=path.join(recovery,patch?'credentials.bin':'helper-home/AppData/Roaming/Agentopia/credentials.bin');
const expected=patch?(await json(path.join(maintenance.job,'profile-manifest.json')))['credentials.bin']:(await json(path.join(recovery,'private-profile-recovery.json'))).manifest.files['credentials.bin'].sha256;
assert.equal(await hash(baseline),expected);
const current=path.join('F:/Agentopia-Data/profiles/a91a4800-e08f-4440-a4ec-588762d01bfd/profile','credentials.bin');
const out=path.join(maintenance.job,'credential-audit-'+Date.now());await mkdir(out);
const exec=promisify(execFile),sid=(await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command','[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],{windowsHide:true,encoding:'utf8'})).stdout.trim();
assert(/^S-1-5-[0-9-]+$/.test(sid));await exec('icacls.exe',[out,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F','/Q'],{windowsHide:true});
const home=path.join(out,'helper-home'),roaming=path.join(home,'AppData/Roaming'),profile=path.join(roaming,'Agentopia');await mkdir(profile,{recursive:true});
await copyFile(path.join(recovery,patch?'Local State':'helper-home/AppData/Roaming/Agentopia/Local State'),path.join(profile,'Local State'));
await copyFile(baseline,path.join(out,'before.bin'));
const before=await stat(current);await copyFile(current,path.join(out,'after.bin'));const after=await stat(current);
assert.equal(before.size,after.size);assert.equal(before.mtimeMs,after.mtimeMs);assert.equal(await hash(current),await hash(path.join(out,'after.bin')));
const missing=randomUUID();await writeFile(path.join(profile,'runtime-binding.json'),JSON.stringify({format:1,distribution:'AgentopiaRuntime-'+missing,instanceId:missing}));
const cfg={out,home,roaming,legacy:profile,profile,temp:path.join(out,'temp'),program:proof.program,exe:proof.exe,imageSha256:proof.imageSha256};
const e={success:false,at:new Date().toISOString(),out,version:proof.version,imageSha256:proof.imageSha256,
 encryptedBeforeSha256:await hash(path.join(out,'before.bin')),encryptedAfterSha256:await hash(path.join(out,'after.bin')),
 secretValuesExported:false,providerRequests:0,productionProfileReadOnly:true};
try{
 const result=await launchDurableProfileProbe(cfg,{label:'helper',testProfile:false,initialProfile:profile,expectedProfile:profile,
  isolateOsHome:true,hiddenWindow:true,runMissing:async({application})=>application.evaluate(async({safeStorage},files)=>{
   const req=globalThis.__durableProbeRequire,fs=req('node:fs/promises'),assert=req('node:assert/strict');
   assert(safeStorage.isEncryptionAvailable());
   const left=JSON.parse(safeStorage.decryptString(await fs.readFile(files.before)));
   const right=JSON.parse(safeStorage.decryptString(await fs.readFile(files.after)));
   const stable=value=>JSON.stringify(value===undefined?null:value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
   let verifiedLocalSessionRenewal=false;
   if(stable(left.session)!==stable(right.session)){
    const crypto=req('node:crypto');let signing;
    try{signing=JSON.parse(req('node:child_process').execFileSync('wsl.exe',['-d','AgentopiaRuntime-a91a4800-e08f-4440-a4ec-588762d01bfd','-u','agentopia','--exec','python3','-c',"from pathlib import Path;print(Path('/home/agentopia/.config/agentopia/runtime-secrets.json').read_text())"],{windowsHide:true,encoding:'utf8',maxBuffer:20000}));}catch{throw Error('The local authentication signing material could not be read.');}
    const verified=token=>{let parts,header,claims;try{parts=token.split('.');assert(parts.length===3);header=JSON.parse(Buffer.from(parts[0],'base64url'));claims=JSON.parse(Buffer.from(parts[1],'base64url'));}catch{throw Error('A saved local sign-in token is invalid.');}const bytes=Buffer.from(parts[0]+'.'+parts[1]),signature=Buffer.from(parts[2],'base64url');let valid=false;if(header.alg==='HS256'){const expected=crypto.createHmac('sha256',signing.jwt_secret).update(bytes).digest();valid=signature.length===expected.length&&crypto.timingSafeEqual(signature,expected);}else if(header.alg==='ES256'){const k=signing.signing_key,key=crypto.createPublicKey({key:{kty:k.kty,crv:k.crv,x:k.x,y:k.y},format:'jwk'});valid=crypto.verify('sha256',bytes,{key,dsaEncoding:'ieee-p1363'},signature);}assert(valid,'The saved local sign-in signature does not match the original authentication service.');return {header,claims};};
    const before=verified(left.session?.access_token),after=verified(right.session?.access_token),identity=value=>Object.fromEntries(Object.entries(value).filter(([key])=>!['iat','exp','nbf','jti'].includes(key)));
    assert(before.header.alg===after.header.alg&&before.header.kid===after.header.kid,'The local authentication signer changed.');assert(typeof before.claims.sub==='string'&&before.claims.sub===after.claims.sub&&typeof before.claims.session_id==='string'&&before.claims.session_id===after.claims.session_id,'The signed-in account or local session identity changed.');assert(stable(identity(before.claims))===stable(identity(after.claims)),'The local session authority changed.');assert(after.claims.exp>before.claims.exp&&after.claims.iat>=before.claims.iat&&after.claims.exp*1000>Date.now(),'The changed local session is not a valid renewal.');assert(typeof right.session.refresh_token==='string'&&right.session.refresh_token.length>0,'The renewed local session has no retained refresh token.');verifiedLocalSessionRenewal=true;
   }
   const changes=[],families={};let identical=0;
   for(const key of new Set([...Object.keys(left),...Object.keys(right)])){
    if(stable(left[key])===stable(right[key])){identical++;continue;}
    const name=key.split(':')[0],family=/^[a-z][a-z0-9-]*$/.test(name)?name:'other';
    const status=!(key in left)?'added':!(key in right)?'removed':'updated';families[family]=(families[family]??0)+1;changes.push({family,status});
   }
   const providerKeys=Object.keys(left).filter(key=>key==='openrouter'||key==='openai'||key.startsWith('openai:'));
   const preservedProviderKeys=providerKeys.filter(key=>stable(left[key])===stable(right[key])).length;
   const imageKeys=[...new Set([...Object.keys(left),...Object.keys(right)])].filter(key=>key.startsWith('image-generation:'));
   const imageGenerationDisabled=imageKeys.every(key=>left[key]?.enabled!==true&&right[key]?.enabled!==true);
   return {beforeSettings:Object.keys(left).length,afterSettings:Object.keys(right).length,identicalSettings:identical,
    changedSettings:changes.length,changes,families,providerConnectionRecords:providerKeys.length,preservedProviderConnectionRecords:preservedProviderKeys,
    imageGenerationDisabled,verifiedLocalSessionRenewal,allOtherProtectedSettingsIdentical:changes.every(change=>change.family==='session')&&changes.length<2,allProviderConnectionValuesIdentical:preservedProviderKeys===providerKeys.length};
  },{before:path.join(out,'before.bin'),after:path.join(out,'after.bin')})});
 assert(result.success&&result.normalExit===0&&result.absentPrivateRuntimeRefused);e.comparison=result.workflow;
 assert(e.comparison.allProviderConnectionValuesIdentical&&e.comparison.providerConnectionRecords>0&&e.comparison.imageGenerationDisabled);
 assert.equal(e.comparison.beforeSettings,e.comparison.afterSettings);assert.equal(e.comparison.changedSettings,e.comparison.verifiedLocalSessionRenewal?1:0);assert(e.comparison.allOtherProtectedSettingsIdentical);
 assert.equal(e.comparison.identicalSettings+(e.comparison.verifiedLocalSessionRenewal?1:0),e.comparison.beforeSettings);
 assert.equal(await hash(path.join(out,'after.bin')),e.encryptedAfterSha256);
 e.success=true;e.normalHelperExit=true;e.helperDatabaseNeverStarted=true;
 const evidence=path.join(out,'evidence.json');await writeFile(evidence,JSON.stringify(e,null,2));
 await writeFile(path.join(maintenance.job,'installed-credentials-accepted.json'),JSON.stringify({success:true,evidence},null,2),{flag:'wx'});
 console.log(JSON.stringify({success:true,evidence,comparison:e.comparison,providerRequests:0}));
}catch(error){e.error=error.cause?.stack??error.stack;await writeFile(path.join(out,'evidence.json'),JSON.stringify(e,null,2));console.error('Inspect protected credential comparison at '+out);process.exitCode=1;}
