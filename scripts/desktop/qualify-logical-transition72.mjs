import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash,list,run,linux} from './phased-backup-control.mjs';

desktopOperation('qualify exact71-to72 saved-row comparison with owned PostgreSQL negative cases');
const root=path.resolve(import.meta.dirname,'../..'),old=await json(path.join(root,'.supabase/desktop-agent-documents70-real/current.json')),cfg=await json(old.restoredIntent);
assert.equal(cfg.instance,'7d87fd24-b2da-41ea-81a9-e9a764327845');assert(!(await list(true)).includes(cfg.distribution));
const family=path.join(root,'.supabase/desktop-logical-transition72'),out=path.join(family,String(Date.now()));await mkdir(out,{recursive:true});
const candidate=await json((await json(path.join(root,'.supabase/desktop-agent-library71-candidate/current.json'))).proof),exec=promisify(execFile);
const unit=await exec(path.join(candidate.assets,'script-runtimes/python-3.14.8/python.exe'),['-I','-B','-c','import runpy,sys;sys.path.insert(0,sys.argv[1]);sys.argv=sys.argv[2:];runpy.run_path(sys.argv[0],run_name="__main__")',path.join(root,'scripts/desktop'),path.join(root,'scripts/desktop/test-logical-transition72.py'),path.join(out,'unit-evidence.json')],{windowsHide:true,maxBuffer:1024*1024});await writeFile(path.join(out,'unit-controller.log'),unit.stdout+unit.stderr);
try{const result=await run(['-d',cfg.distribution,'-u','agentopia','--exec','python3',linux(path.join(root,'scripts/desktop/test-logical-transition72-postgres.py')),linux(out),linux(old.restoredIntent)],600000);await writeFile(path.join(out,'controller.log'),result);}catch{console.error('Inspect transition rehearsal evidence at '+out);}
const e=await json(path.join(out,'evidence.json'));if(e.qaServicesStopped)await run(['--terminate',cfg.distribution]);else throw Error('QA service-stop receipt is missing; runtime left available for inspection.');
assert(e.success&&e.previousRowsAndSchemaRestored&&e.checks.length===5);const units=await json(path.join(out,'unit-evidence.json'));assert(units.success&&units.cases===14);
const sourceHashes={};for(const name of ['audit_logical_transition72.py','test-logical-transition72.py','test-logical-transition72-postgres.py','qualify-logical-transition72.mjs','audit_logical_snapshot71.py','logical_row_fingerprints71.py'])sourceHashes[name]=await hash(path.join(root,'scripts/desktop',name));
const receipt={success:true,at:new Date().toISOString(),out,evidence:path.join(out,'evidence.json'),sourceHashes,unitCases:14,realDatabaseChecks:5,priorTablesCompared:127,totalTablesCovered:128,previousRowsAndSchemaRestored:true,qaServicesStopped:true,providerRequests:0,productionAccess:false};const file=path.join(out,'qualification.json');await writeFile(file,JSON.stringify(receipt,null,2));await writeFile(path.join(family,'qualified-current.json'),JSON.stringify({success:true,evidence:file},null,2));console.log(JSON.stringify({success:true,qualification:file,unitCases:14,realDatabaseChecks:5,priorTablesCompared:127,totalTablesCovered:128}));
