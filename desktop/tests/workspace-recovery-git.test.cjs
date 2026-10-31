const test = require('node:test'), assert = require('node:assert/strict');
const path = require('node:path'), fs = require('node:fs/promises');
const {execFile} = require('node:child_process');
const {randomUUID, createHash} = require('node:crypto');
const build = process.env.SYLVANA_SCHEDULE_PROJECT_BUILD;
const {captureWorkspaceGit: capture} = require(path.join(build, 'workspace-recovery-git.js'));
const {workspaceRecoveryInventory: inventory, writeWorkspaceRecovery: write, verifyWorkspaceRecovery: verify} = require(path.join(build, 'workspace-recovery-files.js'));
const {ScheduledWorkspaces} = require(path.join(build, 'scheduled-workspaces.js'));
const {WorkspaceFiles} = require(path.join(build, 'workspace.js'));
const fixtures = process.env.SYLVANA_SCHEDULE_RECOVERY_FIXTURES;
const binary = process.env.SYLVANA_SCHEDULE_GIT_BINARY;
assert(fixtures && binary && path.isAbsolute(fixtures) && path.isAbsolute(binary));
const sha = value => createHash('sha256').update(value).digest('hex');
const guard = async () => {}, signal = () => new AbortController().signal;
const exists = async file => {try {await fs.lstat(file); return true;} catch (error) {if (error.code === 'ENOENT') return false; throw error;}};
function command(where, boundedGuard = guard, boundedSignal = signal()) {
  return async (args, options = {}) => {
    await boundedGuard(); boundedSignal.throwIfAborted();
    const env = {...process.env};
    for (const key of Object.keys(env)) if (/^GIT_/i.test(key)) delete env[key];
    Object.assign(env, {GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_SYSTEM: process.platform === 'win32' ? 'NUL' : '/dev/null', GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null', GIT_NO_LAZY_FETCH: '1', GIT_ALLOW_PROTOCOL: '', GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0', GIT_AUTHOR_NAME: 'Sylvana private recovery', GIT_AUTHOR_EMAIL: 'recovery@example.invalid', GIT_COMMITTER_NAME: 'Sylvana private recovery', GIT_COMMITTER_EMAIL: 'recovery@example.invalid', GIT_AUTHOR_DATE: '2026-10-22T00:00:00Z', GIT_COMMITTER_DATE: '2026-10-22T00:00:00Z'});
    if (options.indexFile) env.GIT_INDEX_FILE = options.indexFile;
    if(options.gitDirectory){env.GIT_DIR=options.gitDirectory;env.GIT_WORK_TREE=where;}
    const base = ['--no-replace-objects', '-c', 'core.longpaths=true', '-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', '-c', 'protocol.allow=never', '-c', 'maintenance.auto=false', '-c', 'gc.auto=0', '-c', 'submodule.recurse=false', '-c', 'commit.gpgSign=false', '-C', where];
    return new Promise((resolve, reject) => {
      const child = execFile(binary, [...base, ...args], {env, windowsHide: true, timeout: 30000, maxBuffer: 64 * 1024 * 1024, encoding: 'utf8', signal: boundedSignal}, (error, stdout) => error ? reject(error) : resolve(stdout));
      child.stdin.on('error', error => {if (error.code !== 'EPIPE') reject(error);});
      child.stdin.end(options.input ?? '');
    });
  };
}
class MemorySecrets {
  values = new Map(); get(key) {return structuredClone(this.values.get(key));}
  async set(key, value) {this.values.set(key, structuredClone(value));}
}
async function fixture() {
  const root = path.join(fixtures, 'git-' + randomUUID()); await fs.mkdir(root);
  const source = path.join(root, 'original project'); await fs.mkdir(source);
  const git = command(source); await git(['init', '-b', 'main']);
  await git(['config', 'core.autocrlf', 'false']);
  await fs.writeFile(path.join(source, 'seed.txt'), 'original commit\n'); await git(['add', '--', 'seed.txt']); await git(['commit', '-m', 'controlled initial fixture']);
  const owner = randomUUID(), secrets = new MemorySecrets(), files = new WorkspaceFiles(secrets, {showOpenDialog: async () => {throw Error('No interactive file picker in test');}}, [path.join(root, 'private')]);
  const selected = await files.attach(owner, [{path: source}]), ref = files.list(owner).find(file => file.id === selected.selected[0]);
  const bindings = [{id: ref.id, path: ref.path, kind: ref.kind}], service = new ScheduledWorkspaces(secrets, files, path.join(root, 'copies'), binary);
  const workspace = await service.capture(owner, {reference_id: ref.id}, bindings), run = {id: randomUUID(), taskId: randomUUID(), owner, status: 'starting', workspaceStartedAt: new Date().toISOString(), snapshot: {workspace, files: bindings}};
  const resolution = await service.prepare(run, signal(), guard), checkout = resolution.resolved.path, local = command(checkout);
  const gitDirectory = (await local(['rev-parse', '--absolute-git-dir'])).trim(), commonDirectory = (await local(['rev-parse', '--path-format=absolute', '--git-common-dir'])).trim();
  const output = path.join(root, 'private recovery'); await fs.mkdir(output);
  const scope = {owner, run: run.id, operation: randomUUID(), gitDirectory, commonDirectory, output};
  const phases = [], progress = async item => {phases.push(structuredClone(item));};
  return {root, source, checkout, git, local, scope, output, phases, progress};
}
async function restore(f, result) {
  const captured = await inventory(f.checkout, guard, signal());
  const artifact = await write(f.checkout, captured, result.extras, {git: {head: result.head, recovery: result.commit, metadata: result.metadata}}, path.join(f.root, 'complete.tar.gz'), guard, signal());
  const restored = path.join(f.root, 'restored'); await verify(artifact, guard, signal(), restored);
  const repository = path.join(f.root, 'independent-repository'); await fs.mkdir(repository); const git = command(repository);
  await git(['init', '-b', 'recovered']); await git(['bundle', 'verify', path.join(restored, 'history.bundle')]); await git(['bundle', 'unbundle', path.join(restored, 'history.bundle')]);
  await git(['checkout', '--detach', result.head]);
  const index = path.join(restored, 'index.bin'); if (await exists(index)) await fs.copyFile(index, path.join(repository, '.git', 'index'));
  return {restored, repository, git};
}

test('independent recovery retains reset-away detached commits, different staged/working bytes and ignored files', async () => {
  const f = await fixture(), original = (await f.git(['rev-parse', 'HEAD'])).trim(), sourceIndex = sha(await fs.readFile(path.join(f.source, '.git', 'index')));
  await fs.writeFile(path.join(f.checkout, 'detached-only.txt'), 'committed inside generated checkout'); await f.local(['add', '--', 'detached-only.txt']); await f.local(['commit', '-m', 'detached work']);
  const detached = (await f.local(['rev-parse', 'HEAD'])).trim(); await f.local(['reset', '--hard', original]);
  await fs.writeFile(path.join(f.checkout, 'draft.txt'), 'staged first version'); await f.local(['add', '--', 'draft.txt']); await fs.writeFile(path.join(f.checkout, 'draft.txt'), 'unstaged newer version');
  await fs.writeFile(path.join(f.checkout, '.gitignore'), '.env\n'); await fs.writeFile(path.join(f.checkout, '.env'), 'private ignored user data');
  const indexBefore = sha(await fs.readFile(path.join(f.scope.gitDirectory, 'index')));
  const result = await capture(f.scope, f.local, guard, signal(), f.progress), recovered = await restore(f, result);
  assert.equal(await recovered.git(['show', detached + ':detached-only.txt']), 'committed inside generated checkout');
  assert.equal(await recovered.git(['show', ':draft.txt']), 'staged first version');
  assert.equal(await fs.readFile(path.join(recovered.restored, 'files', 'draft.txt'), 'utf8'), 'unstaged newer version');
  assert.equal(await fs.readFile(path.join(recovered.restored, 'files', '.env'), 'utf8'), 'private ignored user data');
  assert.equal(sha(await fs.readFile(path.join(f.scope.gitDirectory, 'index'))), indexBefore);
  assert.equal(sha(await fs.readFile(path.join(f.source, '.git', 'index'))), sourceIndex);
  assert.equal((await f.git(['rev-parse', 'HEAD'])).trim(), original);
  assert.equal((await f.git(['for-each-ref', '--format=%(refname)', 'refs/sylvana/recovery/'])).trim(), '');
  assert.deepEqual(f.phases.map(item => item.phase), ['planned', 'reference', 'bundled', 'complete']);
});
test('conflict stages and resolve-undo blobs survive without original repository objects', async () => {
  const f = await fixture(), blobs = [];
  for (const text of ['base', 'ours', 'theirs']) blobs.push((await f.local(['hash-object', '-w', '--stdin'], {input: text})).trim());
  await f.local(['update-index', '--index-info'], {input: blobs.map((blob, i) => '100644 ' + blob + ' ' + (i + 1) + '\tconflict.txt\n').join('')});
  const expected = await f.local(['ls-files', '--stage', '-z']);
  const result = await capture(f.scope, f.local, guard, signal(), f.progress), recovered = await restore(f, result);
  assert.equal(await recovered.git(['ls-files', '--stage', '-z']), expected);
  for (const blob of blobs) assert(['base', 'ours', 'theirs'].includes(await recovered.git(['cat-file', 'blob', blob])));
  const resolved = await fixture();
  const undo = [];
  for (const text of ['old base', 'old ours', 'old theirs']) undo.push((await resolved.local(['hash-object', '-w', '--stdin'], {input: text})).trim());
  await resolved.local(['update-index', '--index-info'], {input: undo.map((blob, i) => '100644 ' + blob + ' ' + (i + 1) + '\tresolved.txt\n').join('')});
  await fs.writeFile(path.join(resolved.checkout, 'resolved.txt'), 'chosen resolution'); await resolved.local(['add', '--', 'resolved.txt']);
  const undoBefore = await resolved.local(['ls-files', '--resolve-undo', '-z']); assert(undoBefore.includes(undo[0]));
  const saved = await capture(resolved.scope, resolved.local, guard, signal(), resolved.progress), restored = await restore(resolved, saved);
  assert.equal(await restored.git(['ls-files', '--resolve-undo', '-z']), undoBefore);
  for (const blob of undo) assert(['old base', 'old ours', 'old theirs'].includes(await restored.git(['cat-file', 'blob', blob])));
});
test('split index becomes an independently usable copy and original bytes stay unchanged', async () => {
  const f = await fixture(); await fs.writeFile(path.join(f.checkout, 'staged.txt'), 'split-index staged version'); await f.local(['add', '--', 'staged.txt']); await f.local(['update-index', '--split-index']);
  assert((await f.local(['rev-parse', '--shared-index-path'])).trim());
  const before = sha(await fs.readFile(path.join(f.scope.gitDirectory, 'index'))), result = await capture(f.scope, f.local, guard, signal(), f.progress), recovered = await restore(f, result);
  assert.equal(await recovered.git(['show', ':staged.txt']), 'split-index staged version');
  assert.equal((await recovered.git(['rev-parse', '--shared-index-path'])).trim(), '');
  assert.equal(sha(await fs.readFile(path.join(f.scope.gitDirectory, 'index'))), before);
});
test('unfinished Git operation state gets a separately verified private archive', async () => {
  const f = await fixture(), head = (await f.local(['rev-parse', 'HEAD'])).trim();
  const blob=(await f.local(['hash-object','-w','--stdin'],{input:'only in auto-merge tree'})).trim();
  const tree=(await f.local(['mktree','-z'],{input:'100644 blob '+blob+'\tauto-merged.txt\0'})).trim();
  await fs.writeFile(path.join(f.scope.gitDirectory,'AUTO_MERGE'),tree+'\n');
  await fs.writeFile(path.join(f.scope.gitDirectory, 'MERGE_HEAD'), head + '\n'); await fs.writeFile(path.join(f.scope.gitDirectory, 'MERGE_MSG'), 'Unfinished local merge');
  const result = await capture(f.scope, f.local, guard, signal(), f.progress), destination = path.join(f.root, 'operation-state');
  await verify(result.metadata, guard, signal(), destination);
  assert.equal(await fs.readFile(path.join(destination, 'files', 'MERGE_MSG'), 'utf8'), 'Unfinished local merge');
  assert.equal(await fs.readFile(path.join(destination, 'files', 'MERGE_HEAD'), 'utf8'), head + '\n');
  const recovered=await restore(f,result);assert.equal(await recovered.git(['show',tree+':auto-merged.txt']),'only in auto-merge tree');
});
test('missing objects in unfinished operation state prevent recovery completion',async()=>{
  const f=await fixture();await fs.writeFile(path.join(f.scope.gitDirectory,'MERGE_HEAD'),'1'.repeat(40)+'\n');
  await assert.rejects(capture(f.scope,f.local,guard,signal(),f.progress),/missing or unsupported/);
  assert.deepEqual(f.phases.map(item=>item.phase),['planned']);assert(await exists(path.join(f.checkout,'seed.txt')));
});
test('an active index lock or external index cannot start recovery mutation', async () => {
  const f = await fixture(); await fs.writeFile(path.join(f.scope.gitDirectory, 'index.lock'), 'active writer');
  await assert.rejects(capture(f.scope, f.local, guard, signal(), f.progress), /writing/); assert.deepEqual(f.phases, []);
  const g = await fixture(), external = path.join(g.root, 'outside-index');
  await assert.rejects(capture(g.scope, async (args, options) => args.includes('--git-path') ? external : g.local(args, options), guard, signal(), g.progress), /outside/);
  assert.equal((await g.git(['for-each-ref', '--format=%(refname)', 'refs/sylvana/recovery/'])).trim(), '');
});
test('post-reference persistence failure retains inspectable intent and never repeats it', async () => {
  const f = await fixture(); let recorded;
  await assert.rejects(capture(f.scope, f.local, guard, signal(), async state => {recorded = state; if (state.phase === 'reference') throw Error('controlled persistence loss');}), /persistence loss/);
  assert.equal(recorded.phase, 'reference'); assert.equal((await f.git(['rev-parse', recorded.reference])).trim(), recorded.commit);
  await assert.rejects(capture(f.scope, f.local, guard, signal(), f.progress), /EEXIST/);
  assert.equal((await f.git(['rev-parse', recorded.reference])).trim(), recorded.commit);
  assert(await exists(path.join(f.checkout, 'seed.txt')));
});
test('changed index during capture holds recovery and retains checkout and temporary reference', async () => {
  const f = await fixture(); let changed = false;
  const controlled = async (args, options) => {
    const output = await f.local(args, options);
    if (!changed && args[0] === 'ls-files') {changed = true; await fs.writeFile(path.join(f.checkout, 'new-work.txt'), 'new user work'); await f.local(['add', '--', 'new-work.txt']);}
    return output;
  };
  await assert.rejects(capture(f.scope, controlled, guard, signal(), f.progress), /changed/);
  assert(await exists(path.join(f.checkout, 'new-work.txt'))); assert(f.phases.some(state => state.phase === 'reference')); assert(!f.phases.some(state => state.phase === 'complete'));
});
test('cancellation and revoked authority retain original workspace before mutation', async () => {
  const f = await fixture(), controller = new AbortController(); controller.abort();
  await assert.rejects(capture(f.scope, f.local, guard, controller.signal, f.progress), /abort/i);
  await assert.rejects(capture(f.scope, f.local, async () => {throw Error('owned scope revoked');}, signal(), f.progress), /revoked/);
  assert.deepEqual(await fs.readdir(f.output), []); assert.deepEqual(f.phases, []); assert(await exists(path.join(f.checkout, 'seed.txt')));
});
