import {readFile,writeFile,copyFile,realpath,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {execFile,execFileSync} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('resume and verify the owned full physical backup');
const root=path.resolve(import.meta.dirname,'../..'),parent=path.join(root,'.supabase/desktop-installed-0448'),id=process.argv[2];assert(/^\d{13}$/.test(id));
const out=path.join(parent,'physical-backup-'+id),cfg=JSON.parse(await readFile(path.join(out,'intent.json'),'utf8')),previous=JSON.parse(await readFile(path.join(out,'evidence.json'),'utf8'));
assert.equal((await realpath(out)).toLowerCase(),out.toLowerCase());assert(!previous.success&&previous.error,'Inspect the previous terminal failure before resuming.');
const closed=()=>assert.equal(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','@(Get-Process Agentopia,AgentopiaSetup -ErrorAction SilentlyContinue).Count'],{encoding:'utf8',windowsHide:true}).trim(),'0');
const exec=promisify(execFile),decode=b=>(b.includes(0)?b.toString('utf16le'):b.toString('utf8')).replace(/^\uFEFF/,'');
const run=async(args,timeout=60000)=>{const r=await exec('wsl.exe',args,{windowsHide:true,encoding:'buffer',timeout,maxBuffer:8*1024*1024});return decode(r.stdout).trim();};
const list=async running=>(await run(['--list',...(running?['--running']:[]),'--quiet'])).split(/\r?\n/).map(s=>s.trim()).filter(Boolean).sort();
const linux=value=>'/mnt/'+value[0].toLowerCase()+value.slice(2).replaceAll('\\','/');
closed();assert.deepEqual(await list(true),cfg.before.running);assert.deepEqual(await list(false),cfg.before.registered);
assert(!cfg.before.running.includes(cfg.distribution)&&!cfg.before.running.includes('AgentopiaRuntime'));
const stamp=Date.now(),script=path.join(out,'backup-resume-'+stamp+'.py'),record=path.join(out,'resume-'+stamp+'.json');
await copyFile(path.join(root,'scripts/desktop/backup-physical-profile.py'),script);await copyFile(path.join(root,'scripts/desktop/resume-physical-profile.mjs'),path.join(out,'controller-resume-'+stamp+'.mjs'));
const evidence={...cfg,resumedAt:new Date().toISOString(),previousFailure:previous.error,success:false};
await writeFile(record,JSON.stringify(evidence,null,2),{flag:'wx'});let started=false;
try{
 started=true;
 const output=await run(['-d',cfg.distribution,'-u','agentopia','--exec','python3',linux(script),linux(out)],0);
 await writeFile(path.join(out,'resume-copy-'+stamp+'.log'),output);evidence.files=JSON.parse(await readFile(path.join(out,'files-evidence.json'),'utf8'));assert(evidence.files.success);
 await run(['--terminate',cfg.distribution]);started=false;closed();assert.deepEqual(await list(true),cfg.before.running);
 const image=path.join(out,'runtime.vhdx');try{await stat(image);throw Error('A runtime image already exists. Inspect before exporting again.');}catch(error){if(error.code!=='ENOENT')throw error;}
 evidence.phase='exporting';await writeFile(record,JSON.stringify(evidence,null,2));
 const exported=await run(['--export',cfg.distribution,image,'--format','vhd'],600000);await writeFile(path.join(out,'export.log'),exported);
 closed();assert.deepEqual(await list(true),cfg.before.running);assert.deepEqual(await list(false),cfg.before.registered);
 const h=createHash('sha256');for await(const bytes of createReadStream(image))h.update(bytes);
 evidence.image={file:image,bytes:(await stat(image)).size,sha256:h.digest('hex'),sourceDistribution:cfg.distribution,sourceRegistrationVerified:true};assert(evidence.image.bytes>1024*1024*1024);
 evidence.phase='completed';evidence.success=true;await writeFile(record,JSON.stringify(evidence,null,2));
 await writeFile(path.join(parent,'latest-backup.json'),JSON.stringify({success:true,at:new Date().toISOString(),evidence:record,physicalProfiles:true,roots:cfg.roots,ordinaryCopy:path.join(out,'ordinary'),overlayCopy:path.join(out,'overlay'),runtimeImage:evidence.image,files:evidence.files.files,bytes:evidence.files.bytes,installed:false,productionMigrated:false},null,2));
 console.log(JSON.stringify({success:true,evidence:record,files:evidence.files.files,bytes:evidence.files.bytes,imageBytes:evidence.image.bytes,providerRequests:0,installed:false},null,2));
}catch(error){evidence.error=error.message;await writeFile(record,JSON.stringify(evidence,null,2));throw Error('Owned backup resume stopped; inspect '+record,{cause:error});}
finally{if(started&&(await list(true)).includes(cfg.distribution))await run(['--terminate',cfg.distribution]);}
