import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {desktopOperation} from './operation-lock.mjs';
import {json,run,linux,list} from './phased-backup-control.mjs';

desktopOperation('qualify streaming full-schema document recovery auditing');
const root=path.resolve(import.meta.dirname,'../..');
const pointer=await json(path.join(root,'.supabase/desktop-agent-documents70-real/current.json'));
const cfg=await json(pointer.restoredIntent),release=await json((await json(path.join(root,'.supabase/desktop-recovery70-release/current.json'))).proof);
assert(cfg.instance==='7d87fd24-b2da-41ea-81a9-e9a764327845'&&cfg.role==='restored');
assert(!(await list(true)).includes(cfg.distribution));
const out=path.join(root,'.supabase/desktop-logical-audit71',String(Date.now()));await mkdir(out,{recursive:true});
const exec=promisify(execFile),python=path.join(release.assets,'script-runtimes/python-3.14.8/python.exe');
const unit=await exec(python,['-I','-B','-c','import runpy,sys;sys.path.insert(0,sys.argv[1]);sys.argv=sys.argv[2:];runpy.run_path(sys.argv[0],run_name="__main__")',path.join(root,'scripts/desktop'),path.join(root,'scripts/desktop/test-logical-fingerprints71.py'),out],{windowsHide:true,timeout:120000,maxBuffer:1024*1024});
await writeFile(path.join(out,'unit-controller.log'),unit.stdout+unit.stderr);
const unitEvidence=await json(path.join(out,'unit-evidence.json'));assert(unitEvidence.success);
try{const output=await run(['-d',cfg.distribution,'-u','agentopia','--exec','python3',linux(path.join(root,'scripts/desktop/test-logical-audit71.py')),linux(out),linux(pointer.restoredIntent)],600000);await writeFile(path.join(out,'qa-controller.log'),output);}
catch{console.error('Inspect the owned QA audit at '+out);}
let e;try{e=await json(path.join(out,'evidence.json'));}catch{}
assert(e?.qaServicesStopped,'A completed service-stop receipt is required before terminating this QA runtime; inspect it if observation ended early.');
await run(['--terminate',cfg.distribution]);
assert(e.success&&e.originalDocumentRowsCompared===3);
await writeFile(path.join(root,'.supabase/desktop-logical-audit71/current.json'),JSON.stringify({out,evidence:path.join(out,'evidence.json')},null,2));
console.log(JSON.stringify({success:true,out,unitCases:unitEvidence.cases,tables:e.tablesCompared,originals:e.originalDocumentRowsCompared,completeDecodedDumpBuffered:false,productionAccess:false}));
