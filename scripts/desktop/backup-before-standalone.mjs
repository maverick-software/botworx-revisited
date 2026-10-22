import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('standalone migration recovery backup');
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'.supabase/desktop-standalone/migration'),profile=process.argv[2],require=createRequire(import.meta.url),{Runtime}=require('../../desktop/build/runtime.js');
assert(profile&&path.isAbsolute(profile),'Pass the verified source profile as an absolute path.');
await readFile(path.join(profile,'credentials.bin'));await readFile(path.join(profile,'Local State'));
await mkdir(out,{recursive:true});
try{await readFile(path.join(out,'backup.json'));throw new Error('Preserve the recorded migration backup; verify it instead of creating another.');}catch(error){if(error.code!=='ENOENT')throw error;}
const runtime=new Runtime(path.join(root,'desktop/resources'),profile,()=>{});assert.equal((await runtime.command(['cat','/opt/agentopia/runtime-identity'])).trim(),'local.agentopia.desktop-runtime.v1');
const directory=await runtime.backup('standalone-migration'),manifest=JSON.parse(await readFile(path.join(directory,'manifest.json'),'utf8'));
assert.equal(manifest.format,1);const files=[];
for(const entry of manifest.files){assert(['auth.dump','application.dump','vault.dump','database.dump','recovery.dump','pgsodium_root.key'].includes(entry.name));const bytes=await readFile(path.join(directory,entry.name));assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256);files.push({name:entry.name,bytes:bytes.length,sha256:entry.sha256});}
for(const required of ['auth.dump','application.dump','vault.dump','database.dump','pgsodium_root.key'])assert(files.some(file=>file.name===required));
await writeFile(path.join(out,'backup.json'),JSON.stringify({at:new Date().toISOString(),sourceProfile:profile,directory,files,success:true},null,2));console.log(JSON.stringify({success:true,directory,verifiedFiles:files.length}));
