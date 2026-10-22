import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('check advanced notification modes, event routing and recovery');
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'.supabase/desktop-advanced-notifications',Date.now()+'-backend'),temp=path.resolve('F:/Agentopia-Acceptance','advanced-notifications-'+path.basename(out));await mkdir(out,{recursive:true});await mkdir(temp,{recursive:true});
const env={...process.env,TEMP:temp,TMP:temp,TMPDIR:temp};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
const result={success:false,at:new Date().toISOString(),out,sourceOnly:true,installedVersion:'0.44.49',recoveryCapability:8,providerRequests:0,productionChanged:false,checks:{}};
async function run(name,exe,args){const r=spawnSync(exe,args,{cwd:root,env,encoding:'utf8',maxBuffer:8*1024*1024});const text=(r.stdout??'')+(r.stderr??'');await writeFile(path.join(out,name+'.log'),text);assert.equal(r.status,0,name+' failed; inspect '+out);console.log('PASS '+name);return text;}
try{
 await run('backend-types',process.execPath,['node_modules/typescript/bin/tsc','-p','desktop/tsconfig.json']);await run('ui-types',process.execPath,['node_modules/typescript/bin/tsc','-p','desktop/ui/tsconfig.json']);
 const output=await run('backend-tests',process.execPath,['--test','--test-concurrency=1','--test-reporter=tap',...['advanced-notifications','response-notifications','notification-preferences-broker','scheduled-notifications','backup-main','portable-settings','portable-backup','recovery-bootstrap'].map(name=>'desktop/tests/'+name+'.test.cjs')]);assert.match(output,/# fail 0\b/);assert.match(output,/# skipped 0\b/);result.checks.javascript=Number(output.match(/# pass (\d+)/)[1]);
 const python=path.join(root,'desktop/resources/script-runtimes/python-3.14.8/python.exe');for(const name of ['settings-preparation','layout-preparation']){const text=await run(name,python,['-I','-B','desktop/tests/'+name+'.test.py']);assert.match(text,/\bOK\b/);result.checks[name]=Number(text.match(/Ran (\d+) tests/)[1]);}
 const legacy=path.join(root,'.supabase/desktop-release-04449/1792536883499/program/resources/resources/runtime/Restore-Agentopia.ps1');const text=await run('powershell','powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File','scripts/desktop/test-notification-recovery-launcher.ps1','-LegacyHelper',legacy]);const ps=JSON.parse(text.trim().split(/\r?\n/).at(-1));assert(ps.success);result.checks.powershell=ps.groups;result.success=true;
}catch(error){result.error=error.stack;process.exitCode=1;console.error(error.message);}finally{await writeFile(path.join(out,'evidence.json'),JSON.stringify(result,null,2));}
console.log(JSON.stringify({success:result.success,out,checks:result.checks,sourceOnly:true}));
