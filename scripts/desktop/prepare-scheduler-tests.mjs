import path from 'node:path';
import {mkdir,readFile,writeFile,lstat,realpath} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('prepare embedded PostgreSQL test dependency');
const root=path.resolve(import.meta.dirname,'../..'),source=path.join(root,'desktop/tests/fixtures/scheduler-postgres'),cache=path.join(root,'.supabase/desktop-scheduler/pg-fixture');await mkdir(cache,{recursive:true});assert.equal((await realpath(cache)).toLowerCase(),cache.toLowerCase());assert(!(await lstat(cache)).isSymbolicLink());
for(const name of ['package.json','package-lock.json']){const expected=await readFile(path.join(source,name));try{assert((await readFile(path.join(cache,name))).equals(expected),'The owned test dependency metadata changed. Inspect it before replacing the cache.');}catch(error){if(error.code!=='ENOENT')throw error;await writeFile(path.join(cache,name),expected,{flag:'wx'});}}
let ready=false;try{ready=JSON.parse(await readFile(path.join(cache,'node_modules/@electric-sql/pglite/package.json'),'utf8')).version==='0.5.10';}catch(error){if(error.code!=='ENOENT')throw error;}
if(!ready){const target=path.join(cache,'node_modules');assert(target.startsWith(cache+path.sep));try{assert(!(await lstat(target)).isSymbolicLink());assert((await realpath(target)).startsWith(cache+path.sep));}catch(error){if(error.code!=='ENOENT')throw error;}const result=await promisify(execFile)(path.join(root,'desktop/resources/script-runtimes/node-24.22.0/node.exe'),[path.join(root,'desktop/resources/script-runtimes/node-24.22.0/node_modules/npm/bin/npm-cli.js'),'ci','--prefix',cache,'--ignore-scripts','--no-audit','--no-fund'],{cwd:root,windowsHide:true,encoding:'utf8',timeout:120000});console.log(result.stdout.trim());}
console.log('Prepared the pinned test-only PostgreSQL engine. Application dependencies and runtime resources are unchanged.');
