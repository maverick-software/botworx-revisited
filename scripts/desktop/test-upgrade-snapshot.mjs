import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {execFileSync,spawn} from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';

desktopOperation('isolated 0.44.6 database upgrade rehearsal');
const root=path.resolve(import.meta.dirname,'../..');
const candidate=path.join(root,'.supabase/desktop-native-goals/candidate-0446');
const proof=JSON.parse(await readFile(path.join(candidate,'release-proof.json'),'utf8'));
assert(proof.success&&proof.version==='0.44.6'&&!proof.installed);
const digest=createHash('sha256');
const image=path.join(candidate,'staging/out/Agentopia-win32-x64/resources/app.asar');
for await(const chunk of createReadStream(image))digest.update(chunk);
assert.equal(digest.digest('hex'),proof.imageSha256);
const running=execFileSync('wsl.exe',['--list','--running','--quiet'],{encoding:'buffer',windowsHide:true})
 .toString('utf16le').replace(/^\uFEFF/,'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
const distribution='AgentopiaRuntime-a91a4800-e08f-4440-a4ec-588762d01bfd';
assert(running.includes(distribution)&&!running.includes('AgentopiaRuntime'));
const out=path.join(root,'.supabase/desktop-upgrade-rehearsal',String(Date.now()));
await mkdir(out,{recursive:true});
await copyFile(path.join(root,'scripts/desktop/test-upgrade-snapshot.py'),path.join(out,'test-upgrade-snapshot.py'));
await copyFile(path.join(root,'scripts/desktop/test-upgrade-snapshot.mjs'),path.join(out,'test-upgrade-snapshot.mjs'));
const linux=value=>'/mnt/'+value[0].toLowerCase()+value.slice(2).replaceAll('\\','/');
await writeFile(path.join(out,'intent.json'),JSON.stringify({at:new Date().toISOString(),pid:process.pid,
 version:proof.version,imageSha256:proof.imageSha256,distribution,productionMigrated:false,
 source:'repeatable-read snapshot from the existing application database',
 target:'new generated database only',providerRequests:0},null,2),{flag:'wx'});
const code=await new Promise((resolve,reject)=>{
 const child=spawn('wsl.exe',['-d',distribution,'-u','agentopia','--exec','python3',
  linux(path.join(out,'test-upgrade-snapshot.py')),linux(out)],
  {cwd:root,windowsHide:true,stdio:'inherit'});
 child.once('error',reject);child.once('exit',value=>resolve(value??1));
});
const result=JSON.parse(await readFile(path.join(out,'evidence.json'),'utf8'));
assert.equal(code,0,'The rehearsal failed. Inspect its retained evidence before repeating.');
assert(result.success&&result.disposableDatabaseRemoved&&result.productionUnchanged);
console.log(JSON.stringify({success:true,version:proof.version,checks:result.checks,
 backup:result.backupDirectory,evidence:path.join(out,'evidence.json'),
 productionMigrated:false,installed:false,providerRequests:0},null,2));
