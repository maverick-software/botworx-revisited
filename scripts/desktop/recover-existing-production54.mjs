// Restore original installed services and reopen the unchanged ordinary app.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {desktopOperation} from './operation-lock.mjs';
import {hash,run,linux,closed} from './phased-backup-control.mjs';
import {inventoryPrivateProfile} from './capture-private-profile.mjs';
desktopOperation('recover original production services and reopen ordinary Agentopia');
const root=path.resolve(import.meta.dirname,'../..'),json=async p=>JSON.parse(await readFile(p,'utf8')),exec=promisify(execFile),saved=await json(path.join(root,'.supabase/desktop-normal-maintenance/current-closed54.json')),recovery=await json(saved.evidence),reset=await json(path.join(saved.out,'runtime-reset.json')),proof=await json(path.join(root,'.supabase/desktop-connection-release53/1792573621559/package-proof.json')),base=await json(proof.acceptedBase),helper=path.join(base.assets,'runtime/database_state.py'),distribution='AgentopiaRuntime-a91a4800-e08f-4440-a4ec-588762d01bfd';
const recordOnly=process.argv.includes('--record-reopened');
assert(reset.success&&recovery.success);if(!recordOnly)await closed();assert.equal(await hash(helper),proof.resourceFiles['runtime/database_state.py']);
const services=recordOnly?await json(path.join(saved.out,'existing-runtime.json')):JSON.parse(await run(['-d',distribution,'-u','agentopia','--exec','python3',linux(path.join(root,'scripts/desktop/maintenance-existing-runtime52.py')),'start-existing',linux(helper),linux(saved.out)],360000));assert(services.success&&services.coreServicesHealthy===6&&services.sqlWrites===0);
const audit=JSON.parse(await run(['-d',distribution,'-u','agentopia','--exec','python3',linux(path.join(root,'scripts/desktop/audit-production-logical.py')),linux(recovery.logicalSnapshot)]));assert(audit.success&&audit.mismatches.length===0);
const cfg=await json(path.join(recovery.recovery,'intent.json')),raw=await json(path.join(recovery.recovery,'private-profile-recovery.json'));if(!recordOnly)assert.deepEqual(await inventoryPrivateProfile(cfg.sourceProfile),raw.manifest);
const exe=path.resolve('C:/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.53/Agentopia.exe');assert.equal(await hash(path.join(path.dirname(exe),'resources/app.asar')),proof.imageSha256);
if(!recordOnly)try{await exec('explorer.exe',[exe],{windowsHide:true,timeout:15000});}catch(error){if(error.code!==1)throw error;/* Explorer may return 1 after successfully dispatching the executable. Verify the process below. */}
let main;const deadline=Date.now()+30000;while(Date.now()<deadline){const output=(await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command',`$p=@(Get-CimInstance Win32_Process -Filter "Name='Agentopia.exe'" | Where-Object { $_.CommandLine -notmatch '--type=' }); if($p.Count -eq 1){@{pid=$p[0].ProcessId;exe=$p[0].ExecutablePath;debug=($p[0].CommandLine -match 'remote-debugging|inspect')}|ConvertTo-Json -Compress}`],{windowsHide:true,encoding:'utf8'})).stdout.trim();if(output){main=JSON.parse(output);break;}await new Promise(r=>setTimeout(r,500));}
assert(main&&main.exe===exe&&!main.debug);
const result={success:true,at:new Date().toISOString(),services,audit,closedWindowsProfileUnchanged:true,ordinaryApplicationReopened:main,installedVersion:'0.44.53',candidate54Installed:false,providerRequests:0};await writeFile(path.join(saved.out,'runtime-recovered.json'),JSON.stringify(result,null,2),{flag:'wx'});console.log(JSON.stringify(result));
