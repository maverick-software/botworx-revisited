import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {desktopOperation} from './operation-lock.mjs';
import {hash} from './phased-backup-control.mjs';

desktopOperation('qualify stopped relocation copy and handoff54');
const root=path.resolve(import.meta.dirname,'../..'),json=async f=>JSON.parse(await readFile(f,'utf8')),pointer=await json(path.join(root,'.supabase/desktop-profile-release54/current.json')),proof=await json(pointer.proof),out=path.join(root,'.supabase/desktop-relocated-profile54','staging-'+Date.now());await mkdir(out);const e={success:false,at:new Date().toISOString(),out,productionAccess:false,realRuntimeAccess:false,realProviderRequests:0,generatedAcceptanceReceipts:true,actualWindowsFileCopy:true,sourceHashes:{}};
for(const name of ['scripts/desktop/stage_relocated_profile.py','scripts/desktop/test-stage-relocated-profile54.py','scripts/desktop/activate_relocated_profile.py','scripts/desktop/profile_location_activation.py','desktop/runtime/copy-desktop-profile.py'])e.sourceHashes[name]=await hash(path.join(root,name));
try{const result=await promisify(execFile)(path.join(proof.assets,'script-runtimes/python-3.14.8/python.exe'),['-I','-B',path.join(root,'scripts/desktop/test-stage-relocated-profile54.py')],{windowsHide:true,encoding:'utf8',timeout:60000,maxBuffer:2*1024*1024});await writeFile(path.join(out,'tests.log'),result.stdout+result.stderr);assert(result.stderr.includes('Ran 19 tests')&&result.stderr.includes('OK'));e.success=true;e.checks=19;}catch(error){await writeFile(path.join(out,'tests.log'),String(error.stdout??'')+String(error.stderr??''));e.error=error.message;process.exitCode=1;}
await writeFile(path.join(out,'evidence.json'),JSON.stringify(e,null,2));await writeFile(path.join(root,'.supabase/desktop-relocated-profile54/staging-qualified.json'),JSON.stringify({success:e.success,out,evidence:path.join(out,'evidence.json')},null,2));console.log(JSON.stringify({success:e.success,out,checks:e.checks,error:e.error,productionAccess:false}));
