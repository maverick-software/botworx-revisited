// Reuse the qualified build to check the same restoration with installed Git 2.48.
import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash} from './phased-backup-control.mjs';
desktopOperation('check streamed recovery compatibility with established system Git');
const root=path.resolve(import.meta.dirname,'../..'),proof=path.resolve(process.argv[2]??''),q=await json(proof);assert(q.success);for(const[file,digest]of Object.entries(q.sourceHashes))assert.equal(await hash(path.join(root,file)),digest);
const out=path.join(root,'.supabase/desktop-chat-file-history69','legacy-git-'+Date.now()),temp=path.join('F:/Agentopia-Acceptance',path.basename(out));await mkdir(out);await mkdir(temp);
const env={...process.env,TEMP:temp,TMP:temp,TMPDIR:temp,AGENTOPIA_CHAT_OUTPUT_BUILD:q.build,AGENTOPIA_PROFILE_TEST_BUILD:q.build,AGENTOPIA_SCHEDULE_PROJECT_BUILD:q.build,AGENTOPIA_PRODUCT_SOURCE:root,AGENTOPIA_SCHEDULE_RECOVERY_FIXTURES:temp,AGENTOPIA_SCHEDULE_GIT_BINARY:'C:/Program Files/Git/cmd/git.exe'};for(const key of ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','OPENAI_API_KEY','OPENROUTER_API_KEY'])delete env[key];
const e={success:false,out,qualifiedBuild:proof,sourceHashes:q.sourceHashes,installed:false,productionAccess:false,providerRequests:0};
try{const result=await promisify(execFile)(process.execPath,['--require',path.join(q.out,'loader.cjs'),'--test','--test-reporter=tap','--test-name-pattern=^(verified archive removes|Long private recovery paths|Git storage layout restores SHA-256)','desktop/tests/scheduled-workspace-maintenance.test.cjs'],{cwd:root,env,windowsHide:true,encoding:'utf8',timeout:120000,maxBuffer:2*1024*1024});await writeFile(path.join(out,'test.log'),result.stdout);assert(/# fail 0\b/.test(result.stdout));e.passed=Number(result.stdout.match(/^# pass (\d+)/m)?.[1]);assert.equal(e.passed,3);for(const[file,digest]of Object.entries(q.sourceHashes))assert.equal(await hash(path.join(root,file)),digest);e.success=true;}catch(error){await writeFile(path.join(out,'private-error.log'),String(error.stdout??'')+'\n'+String(error.stderr??''));e.error=error.message;process.exitCode=1;}
await writeFile(path.join(out,'evidence.json'),JSON.stringify(e,null,2));console.log(JSON.stringify({success:e.success,out,passed:e.passed}));
