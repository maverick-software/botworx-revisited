import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,cp,readdir,lstat,realpath} from 'node:fs/promises';
import path from 'node:path';
import {desktopOperation} from './operation-lock.mjs';
import {hash} from './phased-backup-control.mjs';
desktopOperation('retain the applicable pinned PostgreSQL test dependency on F');
const root=path.resolve(import.meta.dirname,'../..'),source='D:/Users/charl/software/Agentopia/.supabase/desktop-scheduler/pg-fixture',destination=path.join(root,'.supabase/desktop-scheduler/pg-fixture');
const files=['package.json','package-lock.json'];for(const name of files)assert((await readFile(path.join(root,'desktop/tests/fixtures/scheduler-postgres',name))).equals(await readFile(path.join(source,name))));
assert.equal(JSON.parse(await readFile(path.join(source,'node_modules/@electric-sql/pglite/package.json'),'utf8')).version,'0.5.10');
try{const info=await lstat(destination);assert(info.isDirectory()&&!info.isSymbolicLink());assert.equal((await realpath(destination)).toLowerCase(),destination.toLowerCase());assert.equal((await readdir(destination)).length,0,'The F-drive dependency folder is not empty; inspect its receipt before replacing it.');}catch(error){if(error.code!=='ENOENT')throw error;}
async function inventory(base){const result={};for(const name of [...files,...(await readdir(path.join(base,'node_modules'),{recursive:true})).map(name=>'node_modules/'+name.replaceAll('\\','/'))].sort()){const file=path.join(base,name),stat=await lstat(file);assert(!stat.isSymbolicLink());if(stat.isFile())result[name]=await hash(file);}return result;}
const before=await inventory(source);await mkdir(destination,{recursive:true});for(const name of [...files,'node_modules'])await cp(path.join(source,name),path.join(destination,name),{recursive:true,errorOnExist:true,force:false});assert.deepEqual(await inventory(destination),before);assert.deepEqual(await inventory(source),before);
const report={success:true,at:new Date().toISOString(),source,destination,version:'0.5.10',files:before,purpose:'Pinned embedded PostgreSQL engine used by current source/migration/agent fixture tests',oldBuildsCopied:0,sourceRemoved:false};await writeFile(path.join(destination,'relocation.json'),JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify({success:true,version:report.version,filesVerified:Object.keys(before).length,oldBuildsCopied:0,sourceRemoved:false}));
