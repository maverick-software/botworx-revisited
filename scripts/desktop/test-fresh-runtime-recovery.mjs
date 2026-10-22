import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createRequire} from 'node:module';
import {createReadStream} from 'node:fs';
import {mkdir,readFile,writeFile,copyFile,cp,realpath,stat} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {createServer} from 'node:net';
import {extractAll} from '@electron/asar';
import path from 'node:path';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';

desktopOperation('fresh isolated native runtime recovery and cold restart');
const root=path.resolve(import.meta.dirname,'../..'),exec=promisify(execFile);
const candidate=path.join(root,'.supabase/desktop-native-goals/candidate-0446');
const release=JSON.parse(await readFile(path.join(candidate,'release-proof.json'),'utf8'));
const rehearsal=JSON.parse(await readFile(path.join(root,'.supabase/desktop-upgrade-rehearsal/latest.json'),'utf8'));
assert(release.success&&rehearsal.success&&!release.installed&&release.imageSha256===rehearsal.imageSha256);
const sourceEvidence=JSON.parse(await readFile(rehearsal.evidence,'utf8'));
const id=randomUUID(),distribution='AgentopiaRuntime-'+id;
const production='AgentopiaRuntime-a91a4800-e08f-4440-a4ec-588762d01bfd';
const out=path.join(root,'.supabase/desktop-fresh-recovery',String(Date.now())),profile=path.join(out,'profile');
const resources=path.join(out,'resources'),storage=path.join(out,'wsl');
const delivered=path.join(candidate,'staging/out/Agentopia-win32-x64/resources/resources');
const image=path.join(candidate,'staging/out/Agentopia-win32-x64/resources/app.asar');
const json=async file=>JSON.parse(await readFile(file,'utf8'));
const hashFile=async file=>{const h=createHash('sha256');for await(const bytes of createReadStream(file))h.update(bytes);return h.digest('hex');};
assert.equal(await hashFile(image),release.imageSha256);
assert.equal(await hashFile(path.join(delivered,'runtime.tar.gz')),(await readFile(path.join(delivered,'runtime.sha256'),'utf8')).trim());
const decode=bytes=>(bytes.includes(0)?bytes.toString('utf16le'):bytes.toString('utf8')).replace(/^\uFEFF/,'').trim();
const linux=value=>'/mnt/'+value[0].toLowerCase()+value.slice(2).replaceAll('\\','/');
const run=async(args,timeout=60000)=>{
 try{const result=await exec('wsl.exe',args,{windowsHide:true,encoding:'buffer',timeout,maxBuffer:16*1024*1024});return decode(result.stdout);}
 catch(error){await writeFile(path.join(out,'private-wsl-error.log'),Buffer.concat([error.stdout??Buffer.alloc(0),error.stderr??Buffer.alloc(0)]));throw Error('The owned WSL operation failed; inspect the private diagnostic before recovery.');}
};
const list=async(running=false)=>(await run(['--list',...(running?['--running']:[]),'--quiet'])).split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
const before={registered:await list(),running:await list(true)};
assert(before.running.includes(production)&&!before.running.includes('AgentopiaRuntime')&&!before.registered.includes(distribution));
await mkdir(out,{recursive:true});assert.equal((await realpath(out)).toLowerCase(),out.toLowerCase());
const sid=(await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command','[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],{encoding:'utf8',windowsHide:true})).stdout.trim();
assert(/^S-1-5-[0-9-]+$/.test(sid));
await exec('icacls.exe',[out,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F','/Q'],{windowsHide:true});
await mkdir(profile);await mkdir(path.join(resources,'runtime'),{recursive:true});
await copyFile(path.join(root,'scripts/desktop/audit-fresh-runtime-recovery.py'),path.join(out,'audit-fresh-runtime-recovery.py'));
await copyFile(path.join(root,'scripts/desktop/test-fresh-runtime-recovery.mjs'),path.join(out,'test-fresh-runtime-recovery.mjs'));
extractAll(image,path.join(out,'archived'));
const require=createRequire(path.join(out,'archived/package.json'));
const {Runtime,coreServicesReady}=require('./build/runtime.js'),{receiveBackup}=require('./build/transfer.js');
await cp(path.join(delivered,'runtime'),path.join(resources,'runtime'),{recursive:true});
await cp(path.join(delivered,'database'),path.join(resources,'database'),{recursive:true});
await copyFile(path.join(delivered,'version.json'),path.join(resources,'version.json'));
const handles=[];let base;
try{
 for(let attempt=0;attempt<30;attempt++){
  base=59000+Math.floor(Math.random()*2500);
  try{for(let offset=0;offset<6;offset++){const server=createServer();await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(base+offset,'127.0.0.1',resolve);});handles.push(server);}break;}
  catch{await Promise.all(handles.splice(0).map(server=>new Promise(resolve=>server.close(resolve))));base=undefined;}
 }
 assert(base&&handles.length===6);
}finally{await Promise.all(handles.map(server=>new Promise(resolve=>server.close(resolve))));}
const ports={api:base+1,database:base+2,shadow:base,studio:base+3,smtp:base+4,inspector:base+5};
assert.equal(await run(['-d',production,'-u','agentopia','--exec','python3','-c',
 'import socket; sockets=[]\ntry:\n for port in range('+base+','+(base+6)+'):\n  connection=socket.socket(); connection.bind(("127.0.0.1",port)); sockets.append(connection)\n print("free")\nfinally:\n for connection in sockets: connection.close()']), 'free');
let configuration=await readFile(path.join(resources,'runtime/config.toml'),'utf8');
for(let offset=0;offset<6;offset++)configuration=configuration.replaceAll(String(57320+offset),String(base+offset));
assert(!configuration.includes('5732'));
await writeFile(path.join(resources,'runtime/config.toml'),configuration);
const manifestEntry=sourceEvidence.backupFiles.find(item=>item.name==='pgsodium_root.key');assert(manifestEntry);
const intent={at:new Date().toISOString(),pid:process.pid,version:'0.44.6',imageSha256:release.imageSha256,
 instanceId:id,distribution,storage,profile,ports,sourceBackup:sourceEvidence.backupDirectory,
 rootKeySha256:manifestEntry.sha256,production,productionMigrated:false,providerRequests:0,
 runtimeArchiveSha256:await hashFile(path.join(delivered,'runtime.tar.gz')),
 resourceDifference:'Supabase test ports only; all code and migrations remain delivered bytes.'};
await writeFile(path.join(out,'intent.json'),JSON.stringify(intent,null,2),{flag:'wx'});
const evidence={...intent,checks:[],phase:'prepared',before,progress:[]};
const save=()=>writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));
const check=async message=>{evidence.checks.push(message);await save();console.log('PASS: '+message);};
let runtime,registered=false;
const registration=async()=>{
 const script="$OutputEncoding=[Console]::OutputEncoding=[Text.UTF8Encoding]::new();Get-ChildItem 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Lxss'|ForEach-Object {$r=Get-ItemProperty $_.PSPath;if($r.DistributionName -eq '"+distribution+"'){@{name=$r.DistributionName;path=$r.BasePath}|ConvertTo-Json -Compress}}";
 const result=JSON.parse((await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{encoding:'utf8',windowsHide:true})).stdout);
 assert.equal(result.name,distribution);
 const actual=path.win32.normalize(result.path.replace(/^\\\\\?\\/,''));
 assert.equal(actual.toLowerCase(),storage.toLowerCase());assert(actual.toLowerCase().startsWith(out.toLowerCase()+path.sep));
 return result;
};
try{
 await receiveBackup(sourceEvidence.backupDirectory,path.join(profile,'migration-input'),production);
 const manifest=await json(path.join(profile,'migration-input/manifest.json'));
 for(const entry of manifest.files){assert(sourceEvidence.backupFiles.some(file=>file.name===entry.name&&file.sha256===entry.sha256));assert.equal(await hashFile(path.join(profile,'migration-input',entry.name)),entry.sha256);}
 const baseline=await run(['-d',production,'-u','agentopia','--exec','python3','-c',
  'from pathlib import Path; print(Path('+JSON.stringify(sourceEvidence.backupDirectory+'/private-snapshot-fingerprints.json')+').read_text())']);
 await writeFile(path.join(out,'private-snapshot-fingerprints.json'),baseline);
 await check('The exact previously verified snapshot and recovery key transfer into the private test profile with matching checksums.');
 evidence.phase='importing-clean-runtime';await save();
 await run(['--import',distribution,storage,path.join(delivered,'runtime.tar.gz'),'--version','2'],600000);
 registered=true;evidence.registration=await registration();evidence.phase='registered';await save();
 await run(['-d',distribution,'-u','root','--exec','python3','-c',
  "from pathlib import Path; assert Path('/opt/agentopia/runtime-identity').read_text().strip()=='local.agentopia.desktop-runtime.v1'; assert not list(Path('/home/agentopia/.supabase/stacks').glob('*')); Path('/opt/agentopia/runtime-instance').write_text("+JSON.stringify(id)+")"]);
 await writeFile(path.join(profile,'runtime-binding.json'),JSON.stringify({format:1,distribution,instanceId:id}));
 await check('The delivered Linux archive imports as a new owned WSL 2 distribution with no existing database or account state.');
 const progress=value=>{evidence.progress.push({at:new Date().toISOString(),...value});console.log('Runtime: '+value.phase+' — '+value.message);};
 runtime=new Runtime(resources,profile,progress);evidence.phase='restoring';await save();
 const ready=await runtime.start();assert.equal(ready.accounts,sourceEvidence.before.users);assert.equal(new URL(ready.env.DB_URL).port,String(ports.database));
 assert(runtime.state.ready);evidence.phase='restored';await save();
 await check('The delivered runtime supervisor starts native Supabase, imports the backup with its encryption root, applies all 56 migrations and reports ready.');
 const audit=async(mode='audit')=>JSON.parse(await runtime.command(['python3',linux(path.join(out,'audit-fresh-runtime-recovery.py')),linux(out),mode],60000));
 evidence.firstAudit=await audit();assert(evidence.firstAudit.success);assert(coreServicesReady({runtime:'native',services:evidence.firstAudit.services}));
 await check('The restored runtime retains all 141 source tables and their original values, and all four encryption-root bindings match the backup.');
 evidence.encryptionProbeBefore=await audit('probe-create');assert(evidence.encryptionProbeBefore.decryptionVerified);
 await runtime.stop();runtime=undefined;assert(!(await list(true)).includes(distribution));
 evidence.phase='cold-stopped';await save();
 await check('Normal shutdown stops and terminates only the owned recovery runtime.');
 runtime=new Runtime(resources,profile,progress);const restarted=await runtime.start();assert.equal(restarted.accounts,sourceEvidence.before.users);
 evidence.encryptionProbeAfter=await audit('probe-check-and-remove');assert(evidence.encryptionProbeAfter.decryptionVerified&&evidence.encryptionProbeAfter.probeRemoved);
 await check('A controlled vault record encrypted before shutdown decrypts to its exact value after cold restart and is then removed.');
 evidence.secondAudit=await audit();assert(evidence.secondAudit.success);assert(coreServicesReady({runtime:'native',services:evidence.secondAudit.services}));
 await check('A cold restart retains the restored rows, encryption root and schema 56 while all six required native services become healthy.');
 await runtime.stop();runtime=undefined;assert(!(await list(true)).includes(distribution));
 await registration();await run(['--unregister',distribution],120000);registered=false;
 const after={registered:await list(),running:await list(true)};
 assert.deepEqual([...after.registered].sort(),[...before.registered].sort());
 assert.deepEqual([...after.running].sort(),[...before.running].sort());
 evidence.after=after;evidence.disposableRuntimeRemoved=true;
 await check('The owned recovery distribution is removed after verifying its registered path, and every other distribution keeps its original running state.');
 evidence.phase='completed';evidence.success=true;await save();
 console.log(JSON.stringify({success:true,version:'0.44.6',checks:evidence.checks,evidence:path.join(out,'evidence.json'),
  productionMigrated:false,installed:false,providerRequests:0},null,2));
}catch(error){
 evidence.success=false;evidence.error=error.message;evidence.registered=registered;await save();
 throw Error('Fresh-runtime recovery stopped. Inspect its checkpoint before any retry: '+out,{cause:error});
}finally{
 if(runtime){try{await runtime.stop();evidence.failureRuntimeStopped=true;}catch{evidence.failureRuntimeStopped=false;}await save();}
}
