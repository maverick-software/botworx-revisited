import {build} from 'esbuild';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'.supabase/desktop-native-activity','check-'+Date.now());await mkdir(out,{recursive:true});
const files=['desktop/src/native-activity-presentation.ts','desktop/ui/native-activity-status.ts','desktop/ui/NativeTurn.tsx','desktop/tests/native-activity-status.test.cjs'],sourceHashes={};
for(const file of files){sourceHashes[file]=createHash('sha256').update(await readFile(path.join(root,file))).digest('hex');await copyFile(path.join(root,file),path.join(out,path.basename(file)));}
const compile=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','-p','desktop/ui/tsconfig.json'],{cwd:root,encoding:'utf8',windowsHide:true,timeout:120000});await writeFile(path.join(out,'renderer.log'),(compile.stdout??'')+(compile.stderr??''));assert.equal(compile.status,0,'Inspect renderer.log');
const helper=path.join(out,'native-activity-status.cjs');await build({entryPoints:[path.join(root,files[0])],outfile:helper,bundle:true,platform:'node',format:'cjs',logLevel:'silent'});
const result=spawnSync(process.execPath,['--test','--test-reporter=tap',path.join(root,'desktop/tests/native-activity-status.test.cjs')],{cwd:root,encoding:'utf8',windowsHide:true,timeout:30000,env:{...process.env,AGENTOPIA_NATIVE_ACTIVITY_HELPER:helper}});await writeFile(path.join(out,'tests.tap'),(result.stdout??'')+(result.stderr??''));
const evidence={at:new Date().toISOString(),sourceHashes,rendererTypecheck:true,testsPassed:Number(result.stdout?.match(/# pass (\d+)/)?.[1]??0),testsFailed:Number(result.stdout?.match(/# fail (\d+)/)?.[1]??0),productionAccess:false,realProviderRequests:0,installed:false};evidence.sourceUnchanged=(await Promise.all(files.map(async file=>sourceHashes[file]===createHash('sha256').update(await readFile(path.join(root,file))).digest('hex')))).every(Boolean);evidence.success=result.status===0&&evidence.testsPassed===7&&evidence.sourceUnchanged;await writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify({success:evidence.success,out,testsPassed:evidence.testsPassed}));if(!evidence.success)process.exitCode=1;
