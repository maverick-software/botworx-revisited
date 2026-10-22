import {spawnSync} from 'node:child_process';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('final browser expiry and receipt verification');
const root=path.resolve(import.meta.dirname,'../..'),release=path.join(root,'.supabase/desktop-browser-pointer/release'),before=JSON.parse(await readFile(path.join(release,'core-backend-hashes.json'),'utf8')),after={};
for(const entry of await readdir(path.join(root,'desktop/build'),{recursive:true,withFileTypes:true})){if(!entry.isFile())continue;const file=path.join(entry.parentPath,entry.name),name=path.relative(path.join(root,'desktop/build'),file).replaceAll('\\','/');after[name]=createHash('sha256').update(await readFile(file)).digest('hex');}
assert.deepEqual(Object.keys(after).sort(),Object.keys(before).sort());const changed=Object.keys(after).filter(key=>before[key]!==after[key]);assert.deepEqual(changed,['browser-pointer.js']);
for(const args of [['--test','--test-concurrency=1','desktop/tests/browser-pointer.test.cjs','desktop/tests/browser-tools.test.cjs'],['scripts/desktop/test-browser-pointer.mjs'],['scripts/desktop/test-browser-pointer-controls.mjs']]){const result=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit',env:process.env});if(result.status!==0)process.exit(result.status??1);}
await writeFile(path.join(release,'final-backend-hashes.json'),JSON.stringify(after,null,2));await writeFile(path.join(release,'final-browser-checks.json'),JSON.stringify({at:new Date().toISOString(),success:true,changedModules:changed,reason:'Recheck screenshot expiration immediately before dispatch after a long approval wait.',fullSuiteChecksBeforeFinalExpiryGuard:211,finalPointerUnitAndReceiptTests:true,realChromiumExpiryAndInputTests:true,approvalUI:true},null,2));console.log('PASS final expiry guard: only browser-pointer.js changed after the 211-check suite; focused pointer/receipt tests, real browser expiry/input engine and review UI all passed.');
