import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {desktopOperation} from './operation-lock.mjs';

desktopOperation('isolated image-generation transport qualification');
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'.supabase/desktop-image-generation','source-check-'+Date.now()),hash=async file=>createHash('sha256').update(await readFile(file)).digest('hex');
await mkdir(path.join(out,'source'),{recursive:true});await mkdir(path.join(out,'tests'));
await writeFile(path.join(out,'package.json'),JSON.stringify({type:'commonjs'}));
const files=['desktop/tests/native-child-recovery-policy.test.cjs','desktop/src/codex-harness.ts','desktop/src/image-generation-contracts.ts','desktop/src/image-connections.ts','desktop/src/image-models.ts','desktop/src/image-generation-service.ts','desktop/src/plugins.ts','desktop/src/plugin-validation.ts','desktop/src/plugin-contracts.ts','desktop/src/tool-service.ts','desktop/src/broker.ts','desktop/src/main.ts','desktop/database/0068-image-generation.sql','desktop/tests/image-generation-service.test.cjs','desktop/src/image-generation-transport.ts','desktop/src/generated-images.ts','desktop/src/tool-contracts.ts','desktop/src/codex-mcp.ts','desktop/tests/image-generation-transport.test.cjs','desktop/tests/generated-images.test.cjs','desktop/tests/codex-mcp.test.cjs'];const hashes={};for(const file of files){hashes[file]=await hash(path.join(root,file));await copyFile(path.join(root,file),path.join(out,'source',path.basename(file)));}
await copyFile(import.meta.filename,path.join(out,'verification.mjs'));
const compilation=spawnSync(process.execPath,[path.join(root,'node_modules/typescript/bin/tsc'),'-p',path.join(root,'desktop/tsconfig.json'),'--outDir',path.join(out,'build')],{cwd:root,windowsHide:true,encoding:'utf8',timeout:120000});
await writeFile(path.join(out,'compilation.txt'),(compilation.stdout??'')+(compilation.stderr??''));
const evidence={at:new Date().toISOString(),out,scope:'Current-source image transport, plugin configuration and host service with the real image-journal migration in embedded PostgreSQL. Controlled HTTP responses and isolated assets; no installed or live generation claim.',sourceHashes:hashes,compilerExitCode:compilation.status,liveProviderRequests:0};
if(compilation.status===0){const tests=files.filter(file=>file.endsWith('.test.cjs')).map(file=>path.join(out,'tests',path.basename(file)));for(const file of files.filter(file=>file.endsWith('.test.cjs')))await copyFile(path.join(root,file),path.join(out,'tests',path.basename(file)));const check=spawnSync(process.execPath,['--test','--test-reporter=tap',...tests],{cwd:root,windowsHide:true,encoding:'utf8',timeout:120000,env:{...process.env,AGENTOPIA_TEST_ROOT:root}});await writeFile(path.join(out,'tests.tap'),(check.stdout??'')+(check.stderr??''));evidence.testExitCode=check.status;evidence.testsPassed=Number(check.stdout?.match(/# pass (\d+)/)?.[1]??0);evidence.testsFailed=Number(check.stdout?.match(/# fail (\d+)/)?.[1]??0);evidence.sourceUnchanged=(await Promise.all(files.map(async file=>hashes[file]===await hash(path.join(root,file))))).every(Boolean);evidence.success=check.status===0&&evidence.sourceUnchanged;}
else evidence.success=false;
await writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));if(!evidence.success)process.exitCode=1;
