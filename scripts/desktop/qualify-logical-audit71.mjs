import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash,linux} from './phased-backup-control.mjs';

desktopOperation('qualify schema-aware streaming audit against QA originals and current production snapshot');
const root=path.resolve(import.meta.dirname,'../..'),qaPointer=await json(path.join(root,'.supabase/desktop-logical-audit71/current.json'));
const qa=await json(qaPointer.evidence);assert(qa.success&&qa.tablesCompared===127&&qa.originalDocumentRowsCompared===3&&qa.qaServicesStopped);
const out=path.join(root,'.supabase/desktop-logical-audit71','qualified-'+Date.now());await mkdir(out);
const release=await json((await json(path.join(root,'.supabase/desktop-recovery70-release/current.json'))).proof);
const exec=promisify(execFile),python=path.join(release.assets,'script-runtimes/python-3.14.8/python.exe');
const unit=await exec(python,['-I','-B','-c','import runpy,sys;sys.path.insert(0,sys.argv[1]);sys.argv=sys.argv[2:];runpy.run_path(sys.argv[0],run_name="__main__")',path.join(root,'scripts/desktop'),path.join(root,'scripts/desktop/test-logical-fingerprints71.py'),out],{windowsHide:true,timeout:120000,maxBuffer:1024*1024});
await writeFile(path.join(out,'unit-controller.log'),unit.stdout+unit.stderr);
const units=await json(path.join(out,'unit-evidence.json'));assert(units.success&&units.cases===10);
const captured=await exec(process.execPath,[path.join(root,'scripts/desktop/capture-production-logical.mjs')],{cwd:root,windowsHide:true,timeout:180000,maxBuffer:1024*1024});
await writeFile(path.join(out,'capture-controller.log'),captured.stdout+captured.stderr);assert(JSON.parse(captured.stdout).success);
const source=await json(path.join(root,'.supabase/desktop-production-logical/current.json'));
const compared=await exec('wsl.exe',['-d','AgentopiaRuntime-a91a4800-e08f-4440-a4ec-588762d01bfd','-u','agentopia','--exec','python3',linux(path.join(root,'scripts/desktop/audit-production-logical71.py')),linux(source.out)],{windowsHide:true,timeout:180000,maxBuffer:1024*1024});
await writeFile(path.join(out,'production-controller.log'),compared.stdout+compared.stderr);
const production=JSON.parse(compared.stdout);assert(production.success&&production.tablesCompared===127&&production.schemaMigrations===71&&production.allApplicationTablesCovered);
const files=['logical_row_fingerprints71.py','audit_logical_snapshot71.py','audit-production-logical71.py','test-logical-fingerprints71.py','test-logical-audit71.py','test-logical-audit71.mjs'];
const sourceHashes={};for(const name of files)sourceHashes[name]=await hash(path.join(root,'scripts/desktop',name));
const e={success:true,at:new Date().toISOString(),out,sourceHashes,unitEvidence:path.join(out,'unit-evidence.json'),unitCases:10,
 qaEvidence:qaPointer.evidence,qaTables:127,qaOriginals:3,productionEvidence:path.join(source.out,'schema71-streaming-audit/evidence.json'),
 production,readOnlyProduction:true,ordinaryProcessClosedOrRestarted:false,providerRequests:0,earlierQualifiedMaintenanceUnchanged:true,fullGoalComplete:false};
const evidence=path.join(out,'evidence.json');await writeFile(evidence,JSON.stringify(e,null,2),{flag:'wx'});
await writeFile(path.join(root,'.supabase/desktop-logical-audit71/qualified-current.json'),JSON.stringify({success:true,evidence},null,2));
console.log(JSON.stringify({success:true,evidence,unitCases:10,productionTables:127,productionRows:production.savedRowsCompared,qaOriginals:3,providerRequests:0}));
