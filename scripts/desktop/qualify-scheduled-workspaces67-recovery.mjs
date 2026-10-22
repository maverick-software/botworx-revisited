import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir, writeFile, copyFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {desktopOperation} from './operation-lock.mjs';
import {hash} from './phased-backup-control.mjs';

desktopOperation('scheduled-workspace streaming recovery qualification67');
const root = path.resolve(import.meta.dirname, '../..'), stamp = Date.now();
const out = path.join(root, '.supabase/desktop-scheduled-workspaces67', 'recovery-' + stamp);
const fixtures = path.join('F:/Agentopia-Acceptance', 'schedule67-recovery-' + stamp);
const build = path.join(out, 'build'), tests = path.join(out, 'tests');
const exec = promisify(execFile);
await mkdir(tests, {recursive: true}); await mkdir(fixtures, {recursive: true});
await writeFile(path.join(out, 'package.json'), '{"type":"commonjs"}');
await exec(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'desktop/tsconfig.json', '--outDir', build, '--noEmitOnError'], {cwd: root, windowsHide: true, timeout: 120000, maxBuffer: 1024 * 1024});
const names=['workspace-recovery-files.test.cjs','workspace-recovery-git.test.cjs'];
for(const name of names)await copyFile(path.join(root,'desktop/tests',name),path.join(tests,name));
const env = {...process.env, NODE_PATH: path.join(root, 'node_modules'), AGENTOPIA_SCHEDULE_PROJECT_BUILD: build, AGENTOPIA_SCHEDULE_RECOVERY_FIXTURES: fixtures, AGENTOPIA_SCHEDULE_GIT_BINARY:'C:/Program Files/Git/cmd/git.exe', TEMP: fixtures, TMP: fixtures, TMPDIR: fixtures};
for (const name of ['NODE_OPTIONS', 'ELECTRON_RUN_AS_NODE', 'OPENAI_API_KEY', 'OPENAI_BASE_URL', 'OPENROUTER_API_KEY', 'ANTHROPIC_API_KEY']) delete env[name];
let output, success = false;
try {
  output = (await exec(process.execPath, ['--test', '--test-concurrency=1', '--test-reporter=tap', ...names.map(name=>path.join(tests,name))], {cwd: root, env, windowsHide: true, timeout: 180000, maxBuffer: 2 * 1024 * 1024})).stdout;
  success = true;
} catch (failure) {output = failure.stdout ?? ''; await writeFile(path.join(out, 'failure.log'), failure.stderr ?? String(failure));}
await writeFile(path.join(out, 'tests.tap'), output);
const count = name => Number(new RegExp('^# ' + name + ' (\\d+)', 'm').exec(output)?.[1]);
const sourceHashes = {};
for (const file of ['desktop/src/workspace-recovery-files.ts','desktop/src/workspace-recovery-git.ts','desktop/src/scheduled-workspaces.ts', 'desktop/src/storage-files.ts', 'desktop/tests/workspace-recovery-files.test.cjs','desktop/tests/workspace-recovery-git.test.cjs', 'scripts/desktop/qualify-scheduled-workspaces67-recovery.mjs']) sourceHashes[file] = await hash(path.join(root, file));
const evidence = {success: success && count('fail') === 0 && count('cancelled') === 0 && count('skipped') === 0, at: new Date().toISOString(), out, fixtures, build, passed: count('pass'), failed: count('fail'), cancelled: count('cancelled'), skipped: count('skipped'), sourceHashes, actualFilesystem: true, actualGit:true, independentlyVerifiedBundle:success, controlledSecrets:true, trustedGitRunnerIsTestFixture:true, providerRequests: 0, productionWrites: 0, sourceOnly: true, installed: false, limitation: 'Streaming files and Git recovery helpers only; production command routing, owner/run maintenance journal, archival removal, restore workflow and UI acceptance remain.'};
await writeFile(path.join(out, 'evidence.json'), JSON.stringify(evidence, null, 2));
if (evidence.success) await writeFile(path.join(root, '.supabase/desktop-scheduled-workspaces67/current-recovery.json'), JSON.stringify({out, evidence: path.join(out, 'evidence.json')}, null, 2));
console.log(JSON.stringify({success: evidence.success, out, passed: evidence.passed, failed: evidence.failed}));
assert(evidence.success);
