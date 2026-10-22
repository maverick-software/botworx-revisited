import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const root=path.resolve(import.meta.dirname,'../..'),kind=process.argv[2];assert(['builds','cache'].includes(kind));
const directory=kind==='builds'?'desktop-obsolete-builds52':'desktop-obsolete-package43',script=kind==='builds'?'run-obsolete-build-cleanup52.mjs':'run-obsolete-cache-cleanup43.mjs',out=path.join(root,'.supabase',directory,String(Date.now())),exec=promisify(execFile);await mkdir(out,{recursive:true});
const sid=(await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command','[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],{windowsHide:true,encoding:'utf8'})).stdout.trim();assert(/^S-1-5-[0-9-]+$/.test(sid));await exec('icacls.exe',[out,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F','/Q'],{windowsHide:true});
const launcher=path.join(out,'Run-Checked-Cleanup.cmd');await writeFile(launcher,['@echo off','setlocal','set "ELECTRON_RUN_AS_NODE="','set "NODE_OPTIONS="',`powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -Command "Start-Process -FilePath '${process.execPath}' -ArgumentList @('${path.join(root,'scripts/desktop',script)}','${out}') -WorkingDirectory '${root}' -WindowStyle Hidden"`,'exit /b %errorlevel%',''].join('\r\n'));await writeFile(path.join(root,'.supabase',directory,'current.json'),JSON.stringify({out,launcher},null,2));await exec('explorer.exe',[launcher],{windowsHide:true}).catch(error=>{if(error.code!==1||error.stdout||error.stderr)throw error;});console.log(JSON.stringify({out,launcherRequested:true}));
