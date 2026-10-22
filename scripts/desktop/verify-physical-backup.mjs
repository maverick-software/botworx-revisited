import {readFile,writeFile,mkdir,realpath,open,stat,copyFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';

const root=path.resolve(import.meta.dirname,'../..'),parent=path.join(root,'.supabase/desktop-installed-0448');
const coreIndex=process.argv.indexOf('--core'),coreId=coreIndex>=0?process.argv[coreIndex+1]:null;
if(coreIndex>=0)assert(/^\d{13}$/.test(coreId??''));
const coreRecord=coreId?path.join(parent,'physical-backup-'+coreId,'core-evidence.json'):null;
const sealed=coreRecord?JSON.parse(await readFile(coreRecord,'utf8')):null;
if(sealed)assert(sealed.currentSnapshotComplete&&!sealed.fullBackupComplete&&sealed.phase==='current-snapshot-sealed'&&sealed.core?.success&&sealed.runtimeFiles?.success);
const backup=sealed?{success:true,evidence:coreRecord,runtimeImage:sealed.runtimeImage}:JSON.parse(await readFile(path.join(parent,'latest-backup.json'),'utf8'));
assert(backup.success&&(sealed||backup.physicalProfiles),'A completed current snapshot or full physical backup is required.');
const source=path.dirname(backup.evidence);
assert.equal(path.dirname(source),parent);assert(/^physical-backup-\d{13}$/.test(path.basename(source)));
assert.equal((await realpath(source)).toLowerCase(),source.toLowerCase());
const resume=JSON.parse(await readFile(backup.evidence,'utf8'));
assert(sealed||resume.success&&resume.phase==='completed'&&resume.files.success);
assert.equal(backup.runtimeImage.file,path.join(source,'runtime.vhdx'));
assert.equal((sealed?resume.runtimeImage:resume.image).sha256,backup.runtimeImage.sha256);
if(!process.argv.includes('--execute')){
 console.log(JSON.stringify({ready:true,source,operation:'Import a disposable copy of the cold disk and compare recorded critical files; database services remain stopped.',executed:false}));
 process.exit(0);
}
desktopOperation('verify cold physical backup through a disposable WSL import');
const exec=promisify(execFile),decode=bytes=>(bytes.includes(0)?bytes.toString('utf16le'):bytes.toString('utf8')).replace(/^\uFEFF/,'').trim();
const run=async(args,timeout=60000)=>decode((await exec('wsl.exe',args,{windowsHide:true,encoding:'buffer',timeout,maxBuffer:4*1024*1024})).stdout);
const list=async running=>(await run(['--list',...(running?['--running']:[]),'--quiet'])).split(/\r?\n/).map(s=>s.trim()).filter(Boolean).sort();
const hash=async file=>{const h=createHash('sha256');for await(const b of createReadStream(file))h.update(b);return h.digest('hex');};
const closed=async()=>assert.equal((await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command','@(Get-Process Agentopia,AgentopiaSetup -ErrorAction SilentlyContinue).Count'],{encoding:'utf8',windowsHide:true})).stdout.trim(),'0');
await closed();const before={registered:await list(false),running:await list(true)};
assert(!before.running.includes(resume.distribution)&&!before.running.includes('AgentopiaRuntime'));
assert.equal(await hash(backup.runtimeImage.file),backup.runtimeImage.sha256);
assert.equal((await stat(backup.runtimeImage.file)).size,backup.runtimeImage.bytes);
const imageHandle=await open(backup.runtimeImage.file,'r');
try{const bytes=Buffer.alloc(8);assert.equal((await imageHandle.read(bytes,0,8,0)).bytesRead,8);assert.equal(bytes.toString('ascii'),'vhdxfile');}finally{await imageHandle.close();}
const id=randomUUID(),distribution='AgentopiaBackupCheck-'+id;
assert(!before.registered.includes(distribution));assert.notEqual(distribution,resume.distribution);
const out=path.join(source,'restore-check',id),storage=path.join(out,'runtime');await mkdir(out,{recursive:true});
assert.equal((await realpath(out)).toLowerCase(),out.toLowerCase());
const linux=value=>'/mnt/'+value[0].toLowerCase()+value.slice(2).replaceAll('\\','/');
const python=path.join(out,'verify-files.py');await copyFile(path.join(root,'scripts/desktop/verify-physical-backup.py'),python);
await copyFile(path.join(root,'scripts/desktop/verify-physical-backup.mjs'),path.join(out,'controller.mjs'));
const evidence={success:false,phase:'prepared',at:new Date().toISOString(),source,sourceImageSha256:backup.runtimeImage.sha256,
 distribution,storage,instanceId:resume.instanceId,before,providerRequests:0,databaseServicesStarted:0,installed:false,productionMigrated:false,coreSnapshotOnly:!!sealed,fullBackupComplete:!sealed};
const record=path.join(out,'evidence.json'),save=()=>writeFile(record,JSON.stringify(evidence,null,2));await save();
let imported=false;
async function registration(){
 const query="$OutputEncoding=[Console]::OutputEncoding=[Text.UTF8Encoding]::new();Get-ChildItem 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Lxss'|ForEach-Object {$r=Get-ItemProperty -LiteralPath $_.PSPath;if($r.DistributionName -eq '"+distribution+"'){@{name=$r.DistributionName;path=$r.BasePath;version=$r.Version}|ConvertTo-Json -Compress}}";
 const found=JSON.parse((await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command',query],{encoding:'utf8',windowsHide:true})).stdout);
 assert.equal(found.name,distribution);assert.equal(found.version,2);
 const resolved=path.win32.normalize(found.path.replace(/^\\\\\?\\/,''));
 assert.equal(resolved.toLowerCase(),storage.toLowerCase());assert(resolved.toLowerCase().startsWith(out.toLowerCase()+path.sep));
 return found;
}
try{
 evidence.phase='importing';await save();await run(['--import',distribution,storage,backup.runtimeImage.file,'--vhd'],600000);imported=true;
 evidence.registration=await registration();evidence.phase='checking';await save();
 evidence.files=JSON.parse(await run(['-d',distribution,'-u','agentopia','--exec','python3',linux(python),linux(source),resume.instanceId]));
 assert(evidence.files.success&&evidence.files.criticalFiles>=6);await closed();
 await registration();await run(['--terminate',distribution]);await registration();await run(['--unregister',distribution],120000);imported=false;
 assert.deepEqual(await list(false),before.registered);assert.deepEqual(await list(true),before.running);
 assert.equal(await hash(backup.runtimeImage.file),backup.runtimeImage.sha256);
 evidence.phase='completed';evidence.success=true;evidence.ownedCopyRemoved=true;await save();
 const checked={success:true,at:new Date().toISOString(),evidence:record,source,sourceImageSha256:evidence.sourceImageSha256,criticalFiles:evidence.files.criticalFiles,ownedCopyRemoved:true,providerRequests:0,databaseServicesStarted:0,coreSnapshotOnly:!!sealed,fullBackupComplete:!sealed,scope:'Cold VHDX import and critical-file preservation only; application launch, database queries, account login and live model requests were not attempted.'};
 await writeFile(path.join(parent,sealed?'latest-core-import-check.json':'latest-backup-import-check.json'),JSON.stringify(checked,null,2));
 if(sealed){const latest=JSON.parse(await readFile(path.join(parent,'latest-core-backup.json'),'utf8'));assert.equal(latest.evidence,coreRecord);assert.equal(latest.runtimeImage.sha256,checked.sourceImageSha256);latest.appMayReopen=true;latest.diskImportCheck=checked;await writeFile(path.join(parent,'latest-core-backup.json'),JSON.stringify(latest,null,2));}
 console.log(JSON.stringify({success:true,evidence:record,criticalFiles:evidence.files.criticalFiles,providerRequests:0,databaseServicesStarted:0}));
}catch(error){evidence.error=error.message;await save();throw Error('Cold backup import check stopped; inspect '+record,{cause:error});}
finally{
 if(imported){await registration();if((await list(true)).includes(distribution))await run(['--terminate',distribution]);await registration();await run(['--unregister',distribution],120000);evidence.ownedCopyRemoved=true;await save();}
}
