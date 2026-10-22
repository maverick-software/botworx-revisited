// Authorized normal app closure, followed by an independently verified recovery.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {desktopOperation} from './operation-lock.mjs';
import {hash,run,linux,closed,list} from './phased-backup-control.mjs';
import {captureMaintenancePortable} from './capture-maintenance-portable.mjs';

desktopOperation('normally close Agentopia and capture matching production recovery');
const root=path.resolve(import.meta.dirname,'../..'),json=async p=>JSON.parse(await readFile(p,'utf8')),exec=promisify(execFile);
const pointer=await json(path.join(root,'.supabase/desktop-profile-release54/current.json')),proof=await json(pointer.proof),logical=await json(path.join(root,'.supabase/desktop-production-logical/current.json')),audit=await json(path.join(logical.out,'independent-verification.json'));
assert(proof.success&&audit.success&&audit.mismatches.length===0);
assert.equal(await hash(proof.image),proof.imageSha256);
const distribution='AgentopiaRuntime-a91a4800-e08f-4440-a4ec-588762d01bfd';
const resume=process.argv.indexOf('--resume');
if(resume<0)assert.deepEqual(await list(true),[distribution]);
const readiness=resume<0?JSON.parse(await run(['-d',distribution,'-u','agentopia','--exec','python3',linux(path.join(root,'scripts/desktop/runtime-maintenance-readiness54.py')),linux(logical.out)])):await json(path.join(logical.out,'runtime-maintenance-readiness.json'));
assert.equal(readiness.unfinishedRequests,0,'Leave active agent work running.');
const out=resume<0?path.join(root,'.supabase/desktop-normal-maintenance',String(Date.now())):path.resolve(process.argv[resume+1]);assert.equal(path.dirname(out),path.join(root,'.supabase/desktop-normal-maintenance'));assert(/^\d{13}$/.test(path.basename(out)));await mkdir(out,{recursive:true});
const normalClose=resume>=0?await json(path.join(out,'normal-close.json')):JSON.parse((await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command',
 String.raw`$ErrorActionPreference='Stop'; $main=@(Get-CimInstance Win32_Process -Filter "Name='Agentopia.exe'" | Where-Object { $_.CommandLine -notmatch '--type=' }); if($main.Count -ne 1){throw 'Expected one ordinary Agentopia main process'}; $p=Get-Process -Id $main[0].ProcessId; if($main[0].ExecutablePath -ne 'C:\Users\charl\AppData\Local\AgentopiaDesktop\app-0.44.53\Agentopia.exe'){throw 'Unexpected executable'}; if($main[0].CommandLine -match 'remote-debugging|inspect'){throw 'Unexpected debugging instance'}; if($p.MainWindowHandle -eq 0){throw 'No normal main window'}; $id=$p.Id; $accepted=$p.CloseMainWindow(); if(-not $accepted){throw 'Normal close was refused'}; $exited=$p.WaitForExit(45000); @{pid=$id;normalCloseAccepted=$accepted;exited=$exited;forcedTermination=$false}|ConvertTo-Json -Compress`
 ],{windowsHide:true,encoding:'utf8',timeout:55000})).stdout);
if(resume<0)await writeFile(path.join(out,'normal-close.json'),JSON.stringify(normalClose,null,2));assert(normalClose.exited&&!normalClose.forcedTermination&&normalClose.normalCloseAccepted);await closed();
console.log(JSON.stringify({normalClose,logicalSnapshot:logical.out,out}));
// A cold WSL startup failed after normal closure. Retain the fresh pre-close
// snapshot; repeat its live comparison after runtime recovery, before upgrading.
const databasePostCloseComparisonPending=resume>=0;
if(resume<0){const after=JSON.parse(await run(['-d',distribution,'-u','agentopia','--exec','python3',linux(path.join(root,'scripts/desktop/audit-production-logical.py')),linux(logical.out)]));assert(after.success&&after.mismatches.length===0);}
const cfg={out:path.join(out,'recovery'),sourceProfile:path.resolve('C:/Users/charl/.agentopia/desktop/profile'),sourceHome:path.resolve('C:/Users/charl'),sourcePublicRoot:path.resolve('C:/Users/charl/Agentopia Files'),logicalSnapshot:logical.snapshot,program:proof.program,exe:proof.exe,assets:proof.assets,imageSha256:proof.imageSha256,production:true,scope:'application-update'};
await mkdir(cfg.out);await writeFile(path.join(cfg.out,'intent.json'),JSON.stringify(cfg,null,2),{flag:'wx'});
const captured=await captureMaintenancePortable(cfg);assert(captured.success&&captured.sourceUnchanged);
const independent=JSON.parse((await exec(path.join(proof.assets,'script-runtimes/python-3.14.8/python.exe'),['-I','-B',path.join(root,'scripts/desktop/verify-maintenance-portable52.py'),path.join(cfg.out,'intent.json')],{windowsHide:true,encoding:'utf8',timeout:120000,maxBuffer:1024*1024})).stdout);assert(independent.success);
const evidence={success:true,at:new Date().toISOString(),out,normalClose,logicalSnapshot:logical.out,recovery:cfg.out,independent,databasePostCloseComparisonPending,installationAuthorizedByThisReceipt:!databasePostCloseComparisonPending,providerRequests:0};
await writeFile(path.join(out,'closed-recovery.json'),JSON.stringify(evidence,null,2),{flag:'wx'});await writeFile(path.join(root,'.supabase/desktop-normal-maintenance/current-closed54.json'),JSON.stringify({out,evidence:path.join(out,'closed-recovery.json')},null,2));console.log(JSON.stringify(evidence));
