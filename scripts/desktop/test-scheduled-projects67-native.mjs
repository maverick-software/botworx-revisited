import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {desktopOperation} from './operation-lock.mjs';
import {hash,linux,run,list} from './phased-backup-control.mjs';
desktopOperation('full restored scheduler project/worktree schema and independent PostgreSQL concurrency67');
const root=path.resolve(import.meta.dirname,'../..'),parent=path.join(root,'.supabase/desktop-scheduled-workspaces67'),out=path.join(parent,'native-'+Date.now()),exec=promisify(execFile),distribution='AgentopiaRuntime-a91a4800-e08f-4440-a4ec-588762d01bfd';
assert((await list(true)).includes(distribution),'The ordinary runtime must already be running; do not start or restart it for this SQL test.');await mkdir(out,{recursive:true});
const sid=(await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command','[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],{windowsHide:true,encoding:'utf8'})).stdout.trim();assert(/^S-1-5-[0-9-]+$/.test(sid));await exec('icacls.exe',[out,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F','/Q'],{windowsHide:true});
const source=path.join(import.meta.dirname,'test-scheduled-projects67-native.py'),migration=path.join(root,'desktop/database/0070-scheduled-project-workspaces.sql');await writeFile(path.join(out,'intent.json'),JSON.stringify({at:new Date().toISOString(),out,distribution,sourceSha256:await hash(source),migrationSha256:await hash(migration),scope:'Read-only dump/inventory of ordinary database, then full restore, migration70 and generated SQL actions in a uniquely named scratch database only. No inference or app restart.',productionMigration:false,providerRequests:0},null,2),{flag:'wx'});
let error;try{console.log(await run(['-d',distribution,'-u','agentopia','--exec','python3',linux(source),linux(out)],180000));}catch(failure){error=failure;}
const evidence=JSON.parse(await readFile(path.join(out,'evidence.json'),'utf8'));assert.equal(await hash(source),JSON.parse(await readFile(path.join(out,'intent.json'),'utf8')).sourceSha256);assert.equal(await hash(migration),evidence.migrationSha256);if(error)throw Error('Inspect protected SQL evidence: '+out,{cause:error});assert(evidence.success);await writeFile(path.join(parent,'current-native.json'),JSON.stringify({out,evidence:path.join(out,'evidence.json')},null,2));console.log(JSON.stringify({success:true,out,checks:evidence.checks.length,productionUnchanged:evidence.productionInventoryUnchanged,removed:evidence.scratchDatabaseRemoved,providerRequests:0}));
