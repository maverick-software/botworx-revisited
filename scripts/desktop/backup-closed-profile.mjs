import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {execFileSync,spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';

// Run only after the installed app exits normally. This does not stop it.
desktopOperation('complete normally closed application profile backup');
const root=path.resolve(import.meta.dirname,'../..'),require=createRequire(import.meta.url),backupName=process.argv[2];
assert(/^\d{4}-\d{2}-\d{2}T[\d-]+\.\d{3}Z-manual$/.test(backupName));
const maintenance=JSON.parse(await readFile(path.join(root,'.supabase/desktop-maintenance-0437/update.json'),'utf8'));
assert(maintenance.success&&maintenance.phase==='completed'&&maintenance.version==='0.43.7');
const candidate=JSON.parse(await readFile(path.join(root,'.supabase/desktop-plugin-updates/candidate-0448/release-proof.json'),'utf8'));
assert(candidate.success&&candidate.version==='0.44.8'&&!candidate.installed&&candidate.migrations===58);
const parent=path.join(root,'.supabase/desktop-installed-0448'),out=path.join(parent,'profile-backup-'+Date.now());await mkdir(parent,{recursive:true});
const sid=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],{encoding:'utf8',windowsHide:true}).trim();assert(/^S-1-5-[0-9-]+$/.test(sid));
execFileSync('icacls.exe',[parent,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F','/Q'],{windowsHide:true,stdio:'ignore'});
await mkdir(out);
const config={at:new Date().toISOString(),profile:maintenance.ordinaryProfile,backupName,expectedDistribution:maintenance.distribution,previousVersion:'0.43.7',candidateVersion:'0.44.8',candidateImageSha256:candidate.imageSha256,out,networkRequests:0,installed:false,productionMigrated:false};
await writeFile(path.join(out,'intent.json'),JSON.stringify(config,null,2),{flag:'wx'});
await copyFile(path.join(root,'scripts/desktop/full-profile-backup.cjs'),path.join(out,'main.cjs'));
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const code=await new Promise((resolve,reject)=>{const child=spawn(require('electron'),[path.join(out,'main.cjs')],{cwd:root,env,windowsHide:true,stdio:'inherit'});child.once('error',reject);child.once('exit',resolve);});
const result=JSON.parse(await readFile(path.join(out,'evidence.json'),'utf8'));assert.equal(code,0);assert(result.success);
await writeFile(path.join(parent,'latest-backup.json'),JSON.stringify({success:true,at:new Date().toISOString(),evidence:path.join(out,'evidence.json'),profileCopy:result.profileCopy,profileFingerprint:result.profileFingerprint,files:result.files,bytes:result.bytes,databaseBackup:result.databaseBackup,installed:false,productionMigrated:false},null,2));
