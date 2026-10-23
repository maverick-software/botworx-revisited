import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {desktopOperation} from './operation-lock.mjs';
import {json,run,linux,list,hash} from './phased-backup-control.mjs';

desktopOperation('qualify library lifecycle against actual restored QA PostgreSQL');
const root=path.resolve(import.meta.dirname,'../..'),source=await json((await json(path.join(root,'.supabase/desktop-agent-library71/current.json'))).evidence);
assert(source.success);for(const [file,digest]of Object.entries(source.sourceHashes))assert.equal(await hash(path.join(root,file)),digest,file);
const pointer=await json(path.join(root,'.supabase/desktop-agent-documents70-real/current.json')),cfg=await json(pointer.restoredIntent);
assert(cfg.instance==='7d87fd24-b2da-41ea-81a9-e9a764327845');assert(!(await list(true)).includes(cfg.distribution));
const out=path.join(root,'.supabase/desktop-agent-library71','postgres-'+Date.now());await mkdir(out);
try{const result=await run(['-d',cfg.distribution,'-u','agentopia','--exec','python3',linux(path.join(root,'scripts/desktop/test-agent-library71-postgres.py')),linux(out),linux(pointer.restoredIntent),linux((await json(path.join(root,'.supabase/desktop-agent-library71/current.json'))).evidence)],600000);await writeFile(path.join(out,'controller.log'),result);}
catch{console.error('Inspect the owned QA evidence at '+out);}
let e;try{e=await json(path.join(out,'evidence.json'));}catch{}
if(e?.qaServicesStopped)await run(['--terminate',cfg.distribution]);
else{console.error('The QA runtime was left available for inspection; no termination was attempted without a completed service-stop receipt.');process.exitCode=1;}
if(e?.success&&e.previousRowsAndSchemaRestored&&e.qaServicesStopped)await writeFile(path.join(root,'.supabase/desktop-agent-library71/postgres-current.json'),JSON.stringify({success:true,evidence:path.join(out,'evidence.json')},null,2));
else process.exitCode=1;
console.log(JSON.stringify({success:e?.success??false,out,checks:e?.checks.length,productionAccess:false,previousRowsAndSchemaRestored:e?.previousRowsAndSchemaRestored,error:e?.error,cleanupError:e?.cleanupError}));
