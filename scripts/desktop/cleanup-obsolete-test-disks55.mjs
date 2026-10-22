import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {desktopOperation} from './operation-lock.mjs';
import {probeMaintenanceWindowsContext} from './maintenance-windows-context.mjs';
import {hash} from './phased-backup-control.mjs';
desktopOperation('remove three stopped obsolete C test runtime disks');
const root=path.resolve(import.meta.dirname,'../..'),exec=promisify(execFile),json=async p=>JSON.parse(await readFile(p,'utf8'));
const completed=await json((await json(path.join(root,'.supabase/desktop-cleanup55/current.json'))).evidence);assert(completed.success&&completed.reopened.success&&completed.database.success);
const accepted=await json(path.join((await json(path.join(root,'.supabase/desktop-normal-maintenance/current-update55.json'))).job,'installed-data-accepted.json'));assert(accepted.success&&accepted.version==='0.44.55');assert((await probeMaintenanceWindowsContext()).success);
const job=path.join(root,'.supabase/desktop-test-disk-cleanup55',String(Date.now()));await mkdir(job,{recursive:true});
const command=async(exe,args,timeout=120000)=>(await exec(exe,args,{cwd:root,windowsHide:true,encoding:'utf8',timeout,maxBuffer:1024*1024})).stdout.trim();
const sid=await command('powershell.exe',['-NoProfile','-NonInteractive','-Command','[Security.Principal.WindowsIdentity]::GetCurrent().User.Value']);assert(/^S-1-5-[0-9-]+$/.test(sid));await command('icacls.exe',[job,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F','/Q']);
const script=path.join(root,'scripts/desktop/remove-obsolete-test-disks55.ps1');await writeFile(path.join(job,'intent.json'),JSON.stringify({job,script,scriptSha256:await hash(script),productionProfile:accepted.ordinaryFProfileSelected,standingObsoleteBuildCleanupAuthorization:true,forceStopsAllowed:false},null,2));
await writeFile(path.join(root,'.supabase/desktop-test-disk-cleanup55/current.json'),JSON.stringify({job,evidence:path.join(job,'evidence.json')}));
try{await command('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script,'-Job',job],180000);const e=await json(path.join(job,'evidence.json'));assert(e.success&&e.removed.length===3&&e.productionRuntimeUntouched&&e.forceStops===0);console.log(JSON.stringify({success:true,job,removedDisks:e.removed.length,removedDiskBytes:e.removed.reduce((n,r)=>n+r.diskBytes,0),productionRuntimeUntouched:true}));}
catch(error){await writeFile(path.join(job,'private-error.json'),JSON.stringify({message:error.message,stdout:error.stdout,stderr:error.stderr}));throw Error('Inspect obsolete test-disk cleanup: '+job);}
