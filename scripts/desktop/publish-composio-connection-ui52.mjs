import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {desktopOperation} from './operation-lock.mjs';
import {closed,hash,linux,run} from './phased-backup-control.mjs';
import {capturePrivateProfile} from './capture-private-profile.mjs';

desktopOperation('recover and publish qualified per-user Composio connection UI');
const root=path.resolve(import.meta.dirname,'../..'),exec=promisify(execFile),json=async f=>JSON.parse(await readFile(f,'utf8')),proofFile=(await json(path.join(root,'.supabase/desktop-composio-connection-ui52/current.json'))).proof,proof=await json(proofFile),q=await json(path.join(proof.out,'qualification.json'));
assert(q.success&&q.packagedStandardAccounts===2&&q.documentRenderChecks===4&&q.backendAndRuntimeUnchanged);assert.equal(await hash(proofFile),q.proofSha256);assert.equal(await hash(q.evidence),q.evidenceSha256);await closed();
const out=path.join(root,'.supabase/desktop-normal-maintenance',String(Date.now()));await mkdir(out);const sid=(await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command','[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],{windowsHide:true,encoding:'utf8'})).stdout.trim();assert(/^S-1-5-[0-9-]+$/.test(sid));await exec('icacls.exe',[out,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F','/Q'],{windowsHide:true});
const intent={out,at:new Date().toISOString(),uiProof:proofFile,targetImageSha256:proof.baseImageSha256,sourceProgram:'C:/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.52',sourceProfile:'C:/Users/charl/.agentopia/desktop/profile',standingAuthorization:true,uiOnly:true};await writeFile(path.join(out,'intent.json'),JSON.stringify(intent,null,2),{flag:'wx'});console.log('Fresh UI recovery: '+out);
const base=await json(proof.baseProof),distro='AgentopiaRuntime-a91a4800-e08f-4440-a4ec-588762d01bfd';
try{
 await run(['-d',distro,'-u','agentopia','--exec','python3',linux(path.join(root,'scripts/desktop/maintenance-existing-runtime52.py')),'start-existing',linux(path.join(base.assets,'runtime/database_state.py')),linux(out)],360000);
 await exec(process.execPath,[path.join(root,'scripts/desktop/capture-production-logical.mjs')],{cwd:root,windowsHide:true,encoding:'utf8',timeout:180000,maxBuffer:1024*1024});
 const logical=await json(path.join(root,'.supabase/desktop-production-logical/current.json'));assert((await json(logical.evidence)).success);await writeFile(path.join(out,'logical-recovery.json'),JSON.stringify(logical,null,2));
 await closed();const raw=await capturePrivateProfile(intent.sourceProfile,path.join(out,'profile-recovery'));await writeFile(path.join(out,'profile-recovery.json'),JSON.stringify(raw,null,2));console.log('Verified current database and '+raw.fileCount+' profile files.');
 console.log(await run(['-d',distro,'-u','agentopia','--exec',linux(process.execPath),path.join(root,'scripts/desktop/verify-composio-ui-physical52.mjs'),out],180000));
 console.log(await run(['-d',distro,'-u','agentopia','--exec','python3',linux(path.join(root,'scripts/desktop/apply-composio-connection-ui52.py')),linux(out)],180000));
 await writeFile(path.join(proof.out,'installed.json'),JSON.stringify({success:true,installed:true,out,evidence:path.join(out,'evidence.json'),ordinaryAcceptancePending:true},null,2),{flag:'wx'});
}catch(error){await writeFile(path.join(out,'controller-error.json'),JSON.stringify({message:error.message,stdout:error.stdout,stderr:error.stderr},null,2));console.error('UI publication stopped; recovery and private diagnostics: '+out);process.exitCode=1;}
