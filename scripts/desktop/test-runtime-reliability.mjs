import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {build as bundle} from 'esbuild';
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'.supabase/runtime-reliability',String(Date.now())),build=path.join(out,'build'),exec=promisify(execFile);await mkdir(build,{recursive:true});const temp=path.join(out,'temp');await mkdir(temp);
const evidence={success:false,at:new Date().toISOString(),out,productionWrites:0,productionRestarts:0,providerRequests:0,checks:[]},env={...process.env,TEMP:temp,TMP:temp,TMPDIR:temp,PYTHONDONTWRITEBYTECODE:'1',AGENTOPIA_PREVIEW_BUILD:build,PYTHONPATH:path.join(root,'desktop/runtime')};
async function run(name,args,options={}){try{const result=await exec(options.exe??process.execPath,args,{cwd:root,env:{...env,...options.env},windowsHide:true,timeout:180000,maxBuffer:4000000});await writeFile(path.join(out,name+'.log'),result.stdout+result.stderr);evidence.checks.push(name);return result;}catch(error){await writeFile(path.join(out,name+'.log'),String(error.stdout??'')+String(error.stderr??''));throw error;}}
try{
 await run('backend-types',['node_modules/typescript/bin/tsc','-p','desktop/tsconfig.json','--outDir',build,'--noEmitOnError']);await writeFile(path.join(build,'package.json'),'{}');
 await run('renderer-types',['node_modules/typescript/bin/tsc','-p','desktop/ui/tsconfig.json']);
 const baseline=(await exec('git',['show','737136dccd11edf721c48101fc00fe71889f85c0:desktop/ui/durable-editor-draft.ts'],{cwd:root,windowsHide:true,encoding:'utf8'})).stdout;
 await bundle({stdin:{contents:baseline,resolveDir:path.join(root,'desktop/ui'),sourcefile:'durable-editor-draft.ts',loader:'ts'},bundle:true,platform:'node',format:'cjs',outfile:path.join(build,'baseline-durable-editor-draft.js')});
 let reproduced=false;try{await run('old-transport-reproduction',['--test','--test-reporter=tap','desktop/tests/draft-connection-recovery.test.cjs'],{env:{AGENTOPIA_RELIABILITY_DRAFT:path.join(build,'baseline-durable-editor-draft.js')}});}catch(error){reproduced=String(error.stdout).includes('# fail 1')&&String(error.stdout).includes('fetch failed');}assert(reproduced,'The historical draft transport failure was not reproduced');evidence.historicalRejectedReadMemoReproduced=true;
 await bundle({entryPoints:[path.join(root,'desktop/ui/durable-editor-draft.ts'),path.join(root,'desktop/ui/editor-journal.ts')],bundle:true,platform:'node',format:'cjs',outdir:build});
 await run('connection-and-draft-tests',['--test','--test-concurrency=1','desktop/tests/local-runtime-connection.test.cjs','desktop/tests/runtime-reconnect.test.cjs','desktop/tests/offline-runtime-controls.test.cjs','desktop/tests/task-scheduler.test.cjs','desktop/tests/draft-connection-recovery.test.cjs','desktop/tests/durable-editor-draft.test.cjs']);
 await run('existing-services-python',['-B','desktop/tests/runtime-resume-existing.test.py'],{exe:'python'});
 await run('existing-stopped-pid-python',['-B','desktop/tests/database-state.test.py'],{exe:'python'});
 evidence.success=true;
}catch(error){evidence.error=String(error.stack??error);process.exitCode=1;}
await writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
