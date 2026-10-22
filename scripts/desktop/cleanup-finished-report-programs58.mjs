import assert from 'node:assert/strict';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash} from './phased-backup-control.mjs';

desktopOperation('remove five finished report QA program copies while preserving profiles and evidence');
const root=path.resolve(import.meta.dirname,'../..');
const proof=await json((await json(path.join(root,'.supabase/desktop-parent-report-release58/current.json'))).proof);
const accepted=await json(path.join(proof.out,'delivery-accepted.json'));
assert(accepted.success&&accepted.installed&&accepted.ordinaryReopened&&accepted.packagedColdReopening);
const shell=path.join(proof.assets,'code-tools/powershell-7.6.7/pwsh.exe');
assert.equal(await hash(shell),proof.resourceFiles['code-tools/powershell-7.6.7/pwsh.exe']);
const result=await promisify(execFile)(shell,['-NoProfile','-NonInteractive','-File',path.join(root,'scripts/desktop/remove-finished-report-programs58.ps1')],{cwd:root,windowsHide:true,encoding:'utf8',timeout:120000,maxBuffer:1024*1024});
console.log(result.stdout.trim());
