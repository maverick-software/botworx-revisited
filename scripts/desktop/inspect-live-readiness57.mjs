import assert from 'node:assert/strict';
import {mkdir,copyFile,writeFile,realpath} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash} from './phased-backup-control.mjs';
desktopOperation('read-only current encrypted provider metadata, without inference or credential refresh');
const root=path.resolve(import.meta.dirname,'../..'),proof=await json((await json(path.join(root,'.supabase/desktop-agent-report-release57/current.json'))).proof),selector=await json('C:/Users/charl/.agentopia/desktop/profile-location.json'),source=path.resolve(selector.profile),out=path.join(root,'.supabase/desktop-live-readiness57',String(Date.now())),exec=promisify(execFile);
assert.equal(source.toLowerCase(),'f:\\agentopia-data\\profiles\\a91a4800-e08f-4440-a4ec-588762d01bfd\\profile');assert.equal((await realpath(source)).toLowerCase(),source.toLowerCase());assert.equal(await hash(proof.image),proof.imageSha256);
await mkdir(path.join(out,'profile'),{recursive:true});await mkdir(path.join(out,'appData'));await mkdir(path.join(out,'temp'));
const sid=(await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command','[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],{windowsHide:true,encoding:'utf8'})).stdout.trim();assert(/^S-1-5-[0-9-]+$/.test(sid));await exec('icacls.exe',[out,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F','/Q'],{windowsHide:true});
const before={credentials:await hash(path.join(source,'credentials.bin')),localState:await hash(path.join(source,'Local State'))};await copyFile(path.join(source,'Local State'),path.join(out,'profile/Local State'));assert.equal(await hash(path.join(out,'profile/Local State')),before.localState);
const intent={out,source,program:proof.program},intentFile=path.join(out,'intent.json');await writeFile(intentFile,JSON.stringify(intent,null,2),{flag:'wx'});
const helper=path.join(root,'scripts/desktop/inspect-live-readiness57-helper.cjs'),electron=path.join(root,'node_modules/electron/dist/electron.exe'),env={...process.env,AGENTOPIA_READINESS_INTENT:intentFile,TEMP:path.join(out,'temp'),TMP:path.join(out,'temp')};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
try{
 await exec(electron,[helper],{cwd:out,env,windowsHide:true,encoding:'utf8',timeout:60000,maxBuffer:1024*1024});const readiness=await json(path.join(out,'readiness.json'));assert(readiness.success&&readiness.networkRequests===0&&readiness.credentialRefreshes===0&&!readiness.credentialValuesReturned);assert.equal(await hash(path.join(source,'credentials.bin')),before.credentials);assert.equal(await hash(path.join(source,'Local State')),before.localState);
 const evidence={...readiness,out,version:proof.version,imageSha256:proof.imageSha256,sourceMetadataUnchanged:true,copiedCredentialFile:false,localStateCopiedEncrypted:true,helperSha256:await hash(helper),controllerSha256:await hash(import.meta.filename),electronSha256:await hash(electron),fullGoalComplete:false};await writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2),{flag:'wx'});await writeFile(path.join(root,'.supabase/desktop-live-readiness57/current.json'),JSON.stringify({out,evidence:path.join(out,'evidence.json')},null,2));
 console.log(JSON.stringify({success:true,out,accounts:readiness.accounts.length,freshChatGPT:readiness.accounts.filter(row=>row.chatgpt.freshForTenMinutes).length,expiredChatGPT:readiness.accounts.filter(row=>row.chatgpt.expired).length,configuredComposio:readiness.accounts.filter(row=>row.composio.projectKeySaved).length,configuredImages:readiness.accounts.filter(row=>row.images.configured).length,providerRequests:0,sourceMetadataUnchanged:true}));
}catch(error){await writeFile(path.join(out,'failure.json'),JSON.stringify({success:false,message:error.message,providerRequests:0},null,2));throw error;}
