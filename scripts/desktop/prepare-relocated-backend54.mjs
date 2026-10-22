import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir,lstat,copyFile,link,cp,access} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createServer} from 'node:net';
import path from 'node:path';
import {desktopOperation} from './operation-lock.mjs';
import {hash,list,linux,registration,run} from './phased-backup-control.mjs';
import {capturePrivateProfile} from './capture-private-profile.mjs';

desktopOperation('prepare isolated complete-backend profile relocation acceptance');
const root=path.resolve(import.meta.dirname,'../..'),json=async f=>JSON.parse(await readFile(f,'utf8')),exec=promisify(execFile);
const pp=await json(path.join(root,'.supabase/desktop-profile-release54/current.json')),p=await json(pp.proof),foundation=await json(path.join(p.out,'foundation-qualified.json')),base=await json(p.acceptedBase),oldBase=await json(base.acceptedBase),qa=await json((await json(path.join(oldBase.out,'capability10-restore-accepted.json'))).retainedIntent),compact=await json((await json(path.join(oldBase.out,'context-compaction-qualification.json'))).evidence);
assert(foundation.success&&compact.success);assert.equal(await hash(p.image),p.imageSha256);assert(!(await list(true)).includes(qa.distribution));
const stamp=Date.now(),out=path.join(p.out,'backend-relocation-'+stamp),home=path.join('F:/Agentopia-Acceptance','relocated-backend54-'+stamp,'home'),source=path.join(home,'.agentopia/desktop/profile'),instance=qa.distribution.slice('AgentopiaRuntime-'.length),target=path.join('F:/Agentopia-Data/profiles',instance,'profile'),program=path.join(home,'AppData/Local/AgentopiaDesktop/app-0.44.54');
await assert.rejects(access(target),error=>error.code==='ENOENT');await mkdir(out);await mkdir(path.dirname(source),{recursive:true});
const sid=(await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command','[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],{windowsHide:true,encoding:'utf8'})).stdout.trim();assert(/^S-1-5-[0-9-]+$/.test(sid));await exec('icacls.exe',[out,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F','/Q'],{windowsHide:true});
const copied=await capturePrivateProfile(qa.profile,source,{headroomBytes:512*1024**2});await writeFile(path.join(out,'source-copy.json'),JSON.stringify(copied,null,2));
// A relocated profile retains its Windows home. This fixture first clones that
// home too, so preserve its completed recovery journal rather than rerun recovery.
const recovery=await json(path.join(qa.home,'.agentopia/recovery-state.json'));assert.equal(recovery.status,'completed');
for(const name of ['recovery-state.json','public-output-recovery-operation.json'])await copyFile(path.join(qa.home,'.agentopia',name),path.join(home,'.agentopia',name));
try{await cp(path.join(qa.home,'Agentopia Files'),path.join(home,'Agentopia Files'),{recursive:true,errorOnExist:true,force:false});}catch(error){if(error.code!=='ENOENT')throw error;}await mkdir(path.join(home,'Agentopia Files'),{recursive:true});
for(const name of await readdir(p.program,{recursive:true})){const from=path.join(p.program,name),to=path.join(program,name),info=await lstat(from);assert(!info.isSymbolicLink());if(info.isDirectory())await mkdir(to,{recursive:true});else{assert(info.isFile());await mkdir(path.dirname(to),{recursive:true});if(['Agentopia.exe','resources/resources/runtime/config.toml'].includes(name.replaceAll('\\','/')))await copyFile(from,to);else await link(from,to);}}
const assets=path.join(program,'resources/resources'),python=path.join(assets,'script-runtimes/python-3.14.8/python.exe');
await writeFile(path.join(source,'.agentopia-native-relocation.json'),JSON.stringify({format:1,codex:'0.163.0',sourceProfile:qa.profile,destinationProfile:source,state:'copied'}));
const rebased=await exec(python,['-I','-B',path.join(assets,'runtime/relocate-native-profile.py'),source],{windowsHide:true,encoding:'utf8',timeout:120000,maxBuffer:1024*1024});assert(JSON.parse(rebased.stdout).success);await writeFile(path.join(out,'source-native-rebase.json'),rebased.stdout);
const receipt=JSON.stringify({format:1,status:'complete',files:copied.fileCount,copyManifestSha256:await hash(path.join(out,'source-copy.json')),encryptedStorageVerified:true,nativeHistoryVerified:true,generatedFixtureOnly:true});await writeFile(path.join(source,'profile-migration.json'),receipt);await writeFile(path.join(home,'.agentopia/desktop/profile-location.json'),JSON.stringify({format:1,kind:'verified-profile-migration',installationRoot:path.dirname(program),profile:'profile',runtimeInstanceId:instance,migrationSha256:createHash('sha256').update(receipt).digest('hex')}),{flag:'wx'});
let portBase;
for(let attempt=0;attempt<25;attempt++){
 const candidate=44000+Math.floor(Math.random()*5000),sockets=[];
 try{for(let n=0;n<6;n++){const socket=createServer();await new Promise((resolve,reject)=>{socket.once('error',reject);socket.listen(candidate+n,'127.0.0.1',resolve);});sockets.push(socket);}await Promise.all(sockets.splice(0).map(s=>new Promise(resolve=>s.close(resolve))));const code='import socket\nsockets=[]\ntry:\n for port in range('+candidate+','+(candidate+6)+'):\n  s=socket.socket();s.bind(("127.0.0.1",port));sockets.append(s)\n print("free")\nfinally:\n for s in sockets:s.close()';await run(['-d','AgentopiaRuntime-a91a4800-e08f-4440-a4ec-588762d01bfd','-u','agentopia','--exec','python3','-c',code]);portBase=candidate;break;}
 catch{}finally{await Promise.all(sockets.map(s=>new Promise(resolve=>s.close(resolve))));}
}
assert(portBase);const configFile=path.join(assets,'runtime/config.toml'),original=await readFile(configFile,'utf8');let custom=original;for(let n=0;n<6;n++)custom=custom.replaceAll(String(57320+n),String(portBase+n));await writeFile(configFile,custom);assert.equal(await hash(path.join(program,'resources/app.asar')),p.imageSha256);assert.equal(await hash(path.join(p.assets,'runtime/config.toml')),p.resourceFiles['runtime/config.toml']);
const standardAccepted=await json(path.join(oldBase.out,'standard-user-connections-accepted.json')),standard=await json(standardAccepted.evidence);
const cfg={out,home,roaming:path.join(home,'AppData/Roaming'),legacy:source,profile:source,source,target,instance,distribution:qa.distribution,storage:qa.storage,registration:await registration(qa.distribution),program,exe:path.join(program,'Agentopia.exe'),assets,imageSha256:p.imageSha256,temp:path.join(out,'temp'),packageProof:pp.proof,primaryAccountFile:path.join(path.dirname(qa.sourceEvidence),'private-generated-account.json'),owner:standard.originalOwner,remoteSnapshot:standard.remoteSnapshot,compact:{agent:compact.agent,conversation:compact.conversation,title:compact.title,nativeThread:compact.nativeThread},sourceRequestId:randomUUID(),relocatedRequestId:randomUUID(),marker:randomUUID().slice(0,8),portBase,originalConfigSha256:createHash('sha256').update(original).digest('hex'),qaConfigSha256:await hash(configFile),resourceDifference:'Only the disposable QA runtime port template differs from the exact candidate resources.',productionAccess:false,installed:false};
await writeFile(path.join(out,'intent.json'),JSON.stringify(cfg,null,2),{flag:'wx'});await writeFile(path.join(p.out,'backend-relocation-current.json'),JSON.stringify({out,intent:path.join(out,'intent.json')},null,2));console.log(JSON.stringify({success:true,out,instance,portBase,sourceFiles:copied.fileCount,productionAccess:false}));
