const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const {createHash, randomBytes} = require('node:crypto');
const {gzipSync} = require('node:zlib');
const {pack} = require('tar-stream');
const {
  workspaceRecoveryInventory: inventory,
  recoveryFile, writeWorkspaceRecovery: write, verifyWorkspaceRecovery: verify,
} = require(path.join(process.env.SYLVANA_SCHEDULE_PROJECT_BUILD, 'workspace-recovery-files.js'));
const fixtures = process.env.SYLVANA_SCHEDULE_RECOVERY_FIXTURES;
assert(fixtures && path.isAbsolute(fixtures));
const guard = async () => {}, signal = () => new AbortController().signal;
const sha = value => createHash('sha256').update(value).digest('hex');
let counter = 0;
async function setup() {
  const root = path.join(fixtures, String(++counter));
  await fs.mkdir(root);
  const source = path.join(root, 'workspace');
  await fs.mkdir(source);
  return {root, source, target: path.join(root, 'recovery.tar.gz')};
}
async function snapshot(state, extras = []) {
  const captured = await inventory(state.source, guard, signal());
  return write(state.source, captured, extras, {run: 'controlled recovery test'}, state.target, guard, signal());
}
async function crafted(state, entries, members, options = {}) {
  const record = {format: 1, kind: 'sylvana-workspace-recovery', entries, extras: [], contentSha256: sha(JSON.stringify(entries)), metadata: {}};
  const manifest = Buffer.from(JSON.stringify(record));
  const tar = pack(), chunks = [];
  const drain = (async () => { for await (const chunk of tar) chunks.push(chunk); })();
  tar.entry({name: 'manifest.json', size: manifest.length}, manifest);
  for (const member of members) tar.entry(member.header, member.bytes ?? Buffer.alloc(0));
  tar.finalize(); await drain;
  const compressed = gzipSync(Buffer.concat(chunks)); await fs.writeFile(state.target, compressed);
  return {path: state.target, sha256: sha(compressed), bytes: compressed.length, manifestSha256: sha(manifest), files: 0, expandedBytes: 0, ...options};
}
const directory = {path: '', kind: 'folder', size: 0, mode: 0o700};

test('streams and restores ignored, Unicode, empty directories and binary files with verified extras', async () => {
  const state = await setup();
  await fs.mkdir(path.join(state.source, 'empty'));
  await fs.mkdir(path.join(state.source, '日本語 folder'));
  const binary = randomBytes(4 * 1024 * 1024 + 137);
  await fs.writeFile(path.join(state.source, '日本語 folder', 'draft.bin'), binary);
  await fs.writeFile(path.join(state.source, '.env'), 'PRIVATE_LOCAL_ONLY=controlled-value\n');
  await fs.writeFile(path.join(state.source, '.gitignore'), '.env\n');
  await fs.writeFile(path.join(state.source, 'empty.txt'), '');
  await fs.writeFile(path.join(state.source, '.git'), 'gitdir: controlled-metadata\n');
  const extras = [];
  for (const name of ['history.bundle', 'index.bin']) {
    const file = path.join(state.root, name); await fs.writeFile(file, randomBytes(151));
    extras.push({name, path: file, ...await recoveryFile(file, guard, signal())});
  }
  const captured = await inventory(state.source, guard, signal());
  assert.equal(captured.files, 4); assert(!captured.entries.some(entry => entry.path === '.git'));
  const artifact = await write(state.source, captured, extras, {run: 'controlled'}, state.target, guard, signal());
  const record = await verify(artifact, guard, signal()); assert.equal(record.extras.length, 2);
  const restored = path.join(state.root, 'restored'); await verify(artifact, guard, signal(), restored);
  const recovered = await inventory(path.join(restored, 'files'), guard, signal());
  assert.equal(recovered.contentSha256, captured.contentSha256);
  assert.deepEqual(await fs.readFile(path.join(restored, 'files', '日本語 folder', 'draft.bin')), binary);
  assert.equal(await fs.readFile(path.join(restored, 'files', '.env'), 'utf8'), 'PRIVATE_LOCAL_ONLY=controlled-value\n');
  for (const extra of extras) assert.equal((await recoveryFile(path.join(restored, extra.name), guard, signal())).sha256, extra.sha256);
});

test('Bound workspace recovery validates authenticated metadata before extracting any body',async()=>{
 const state=await setup();await fs.writeFile(path.join(state.source,'private.txt'),'BODY MUST NOT BE EXTRACTED');const artifact=await snapshot(state),destination=path.join(state.root,'rejected');let calls=0;
 await assert.rejects(verify(artifact,guard,signal(),destination,async record=>{calls++;assert.equal(record.metadata.run,'controlled recovery test');assert.equal(record.entries.some(entry=>entry.path==='private.txt'),true);throw Error('controlled ownership mismatch');}),/ownership mismatch/);
 assert.equal(calls,1);assert.deepEqual(await fs.readdir(destination),[]);assert.equal(await fs.readFile(path.join(state.source,'private.txt'),'utf8'),'BODY MUST NOT BE EXTRACTED');
});
test('Bound workspace recovery never consults owner metadata until its trusted manifest hash is checked',async()=>{
 const state=await setup(),artifact=await snapshot(state);let calls=0;await assert.rejects(verify({...artifact,manifestSha256:'0'.repeat(64)},guard,signal(),undefined,()=>{calls++;}),/invalid/);assert.equal(calls,0);
});
test('Bound workspace recovery rechecks cancellation after asynchronous owner validation before writing bodies',async()=>{
 const state=await setup();await fs.writeFile(path.join(state.source,'draft.txt'),'keep');const artifact=await snapshot(state),destination=path.join(state.root,'cancelled'),controller=new AbortController();
 await assert.rejects(verify(artifact,guard,controller.signal,destination,async()=>{controller.abort(Error('controlled binding cancelled'));}),/cancelled|abort/i);assert.deepEqual(await fs.readdir(destination),[]);
});

test('raw private-backup inventory includes root Git files and directories without following links',async()=>{
 const state=await setup();await fs.mkdir(path.join(state.source,'.git'));await fs.writeFile(path.join(state.source,'.git','HEAD'),'ref: refs/heads/main\n');await assert.rejects(inventory(state.source,guard,signal()),/Git control file changed/);const raw=await inventory(state.source,guard,signal(),{includeGit:true});assert(raw.entries.some(entry=>entry.path==='.git/HEAD'));const other=await setup();await fs.symlink(state.source,path.join(other.source,'.git'),process.platform==='win32'?'junction':'dir');await assert.rejects(inventory(other.source,guard,signal(),{includeGit:true}),/Linked|special/);
});

test('changed source bytes after inventory reject snapshot without removing source', async () => {
  const state = await setup(), file = path.join(state.source, 'draft'); await fs.writeFile(file, 'before');
  const captured = await inventory(state.source, guard, signal()); await fs.writeFile(file, 'after!');
  await assert.rejects(write(state.source, captured, [], {}, state.target, guard, signal()), /changed/);
  assert.equal(await fs.readFile(file, 'utf8'), 'after!');
});
test('absolute Git-style forward slashes resolve to the same verified Windows file', async () => {
  const state=await setup(),file=path.join(state.source,'draft');await fs.writeFile(file,'same file');
  assert.deepEqual(await recoveryFile(file.replaceAll('\\','/'),guard,signal()),await recoveryFile(file,guard,signal()));
});
test('changed extra bytes reject recovery snapshot', async () => {
  const state = await setup(), file = path.join(state.root, 'index'); await fs.writeFile(file, 'before');
  const extra = {name: 'index.bin', path: file, ...await recoveryFile(file, guard, signal())}; await fs.writeFile(file, 'after!');
  await assert.rejects(snapshot(state, [extra]), /changed/);
});
test('compressed corruption and incorrect trusted manifest hash reject extraction', async () => {
  const state = await setup(), artifact = await snapshot(state);
  await assert.rejects(verify({...artifact, manifestSha256: '0'.repeat(64)}, guard, signal()), /invalid/);
  const corrupted = await fs.readFile(artifact.path); corrupted[15] ^= 0xff; await fs.writeFile(artifact.path, corrupted);
  await assert.rejects(verify(artifact, guard, signal()), /invalid/);
});
test('never overwrites an existing recovery file or extraction directory', async () => {
  const state = await setup(), artifact = await snapshot(state);
  await assert.rejects(snapshot(state), /EEXIST/);
  const target = path.join(state.root, 'existing'); await fs.mkdir(target); await fs.writeFile(path.join(target, 'keep'), 'keep');
  await assert.rejects(verify(artifact, guard, signal(), target), /EEXIST/);
  assert.equal(await fs.readFile(path.join(target, 'keep'), 'utf8'), 'keep');
});
test('recovery cannot be written inside its source workspace', async () => {
  const state = await setup(); state.target = path.join(state.source, 'recovery.tar.gz');
  await assert.rejects(snapshot(state), /outside/); assert.deepEqual(await fs.readdir(state.source), []);
});
test('hard-linked source files are held without reading their linked contents', async () => {
  const state = await setup(), other = path.join(state.root, 'outside'); await fs.writeFile(other, 'outside');
  await fs.link(other, path.join(state.source, 'link')); await assert.rejects(inventory(state.source, guard, signal()), /Linked/);
});
test('redirected source subdirectories and nested external Git metadata are held', async () => {
  const state = await setup(), other = path.join(state.root, 'outside'); await fs.mkdir(other);
  await fs.symlink(other, path.join(state.source, 'redirect'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(inventory(state.source, guard, signal()), /Linked/);
  const nested = await setup(); await fs.mkdir(path.join(nested.source, 'child')); await fs.writeFile(path.join(nested.source, 'child', '.git'), 'gitdir: elsewhere');
  await assert.rejects(inventory(nested.source, guard, signal()), /external Git metadata/);
});
test('cancellation and authorization revocation stop work and preserve source', async () => {
  const state = await setup(); await fs.writeFile(path.join(state.source, 'keep'), 'keep');
  const cancelled = new AbortController(); cancelled.abort();
  await assert.rejects(inventory(state.source, guard, cancelled.signal), /abort/i);
  const captured = await inventory(state.source, guard, signal()); let checks = 0;
  await assert.rejects(write(state.source, captured, [], {}, state.target, async () => {if (++checks === 3) throw Error('authorization revoked');}, signal()), /revoked/);
  assert.equal(await fs.readFile(path.join(state.source, 'keep'), 'utf8'), 'keep');
});
test('rejects traversal, reserved paths and duplicate case-folded manifest names', async () => {
  for (const name of ['../outside', 'C:/outside', 'child/../../outside', 'child\\outside', 'con.txt', 'child.']) {
    const state = await setup(); const artifact = await crafted(state, [directory, {path: name, kind: 'folder', size: 0, mode: 0o700}], []);
    await assert.rejects(verify(artifact, guard, signal()), /invalid/);
  }
  if (process.platform === 'win32') {
    const state = await setup(), artifact = await crafted(state, [directory, {...directory, path: 'a'}, {...directory, path: 'A'}], []);
    await assert.rejects(verify(artifact, guard, signal()), /invalid/);
  }
});
test('rejects missing, duplicate and unlisted archive members', async () => {
  for (const members of [[], [{header: {name: 'files/', type: 'directory'}}, {header: {name: 'files/', type: 'directory'}}], [{header: {name: 'files/', type: 'directory'}}, {header: {name: 'unexpected', size: 0}}]]) {
    const state = await setup(), artifact = await crafted(state, [directory], members);
    await assert.rejects(verify(artifact, guard, signal()), /invalid/);
  }
});
test('rejects archive links and file bytes that differ from manifest', async () => {
  const state = await setup(), entry = {path: 'draft', kind: 'file', size: 4, mode: 0o600, sha256: sha('good')};
  let artifact = await crafted(state, [directory, entry], [{header: {name: 'files/', type: 'directory'}}, {header: {name: 'files/draft', type: 'symlink', linkname: '../outside'}}], {expandedBytes: 4});
  await assert.rejects(verify(artifact, guard, signal()), /invalid/);
  artifact = await crafted(state, [directory, entry], [{header: {name: 'files/', type: 'directory'}}, {header: {name: 'files/draft', size: 4}, bytes: Buffer.from('evil')}], {expandedBytes: 4});
  await assert.rejects(verify(artifact, guard, signal()), /invalid/);
});
