import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

const state = JSON.parse(readFileSync(process.argv[2], 'utf8'));
assert.equal(state.runtime, 'native');
const config = state.env;
assert.equal(new URL(config.API_URL).port, '56321');
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const user = createClient(config.API_URL, config.ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const id = randomUUID();
const email = `native-proof-${id}@example.com`;
const password = randomBytes(24).toString('base64url') + '!Aa1';
let userId;
let bucketCreated = false;
let channel;
function check(result) { if (result.error) throw result.error; return result.data; }
function pass(message) { console.log(`PASS: ${message}`); }

try {
  const accounts = check(await admin.auth.admin.listUsers()).users;
  assert(accounts.some(u => u.email === 'admin@sylvana.local'));
  assert(accounts.some(u => u.email === 'user@sylvana.local'));
  pass('Both original accounts are present in the restored native database.');
  const signup = check(await user.auth.signUp({ email, password, options: {
    data: { first_name: 'Native', last_name: 'Proof' },
  } }));
  userId = signup.user.id;
  assert(signup.session);
  const profile = check(await user.from('profiles').select('first_name,last_name').eq('id', userId).single());
  assert.equal(profile.first_name, 'Native');
  const roles = check(await user.from('user_roles').select('roles(name)').eq('user_id', userId));
  assert(roles.some(r => r.roles?.name === 'user'));
  pass('Signup creates a profile and standard role through the restored triggers.');
  check(await user.auth.signOut());
  assert(check(await user.auth.signInWithPassword({ email, password })).session);
  assert((await user.auth.signInWithPassword({ email, password: 'incorrect-password!Aa1' })).error);
  pass('Password sign-in works and rejects an incorrect password.');

  const forbidden = await user.from('sylvana_runtime_probe').insert({ id, value: 'forbidden' });
  assert(forbidden.error);
  pass('The database rejects an unprivileged write to the restricted probe table.');

  let receive;
  const event = new Promise(resolve => { receive = resolve; });
  channel = new WebSocket(config.API_URL.replace('http', 'ws') +
    '/realtime/v1/websocket?apikey=' + config.ANON_KEY + '&vsn=1.0.0');
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Realtime subscription timed out')), 20000);
    channel.on('open', () => channel.send(JSON.stringify({
      topic: `realtime:native-proof-${id}`, event: 'phx_join', ref: '1', payload: {
        config: { broadcast: { self: false }, presence: { key: '' }, postgres_changes: [
          { event: 'INSERT', schema: 'public', table: 'sylvana_runtime_probe' },
        ] }, access_token: config.SERVICE_ROLE_KEY,
      },
    })));
    channel.on('error', error => { clearTimeout(timeout); reject(error); });
    channel.on('message', data => {
      const message = JSON.parse(data.toString());
      if (message.event === 'system' && message.payload.status === 'ok') {
        clearTimeout(timeout); resolve();
      }
      if (message.event === 'postgres_changes') receive(message.payload.data);
    });
  });
  check(await admin.from('sylvana_runtime_probe').insert({ id, value: 'persistent-native-proof' }));
  const payload = await Promise.race([event, new Promise((_, reject) => {
    const timeout = setTimeout(() => reject(new Error('Realtime change delivery timed out')), 20000);
    timeout.unref();
  })]);
  assert.equal(payload.record.id, id);
  assert.equal(check(await admin.from('sylvana_runtime_probe').select('value').eq('id', id).single()).value, 'persistent-native-proof');
  pass('Windows REST requests persist data and realtime delivers the database change.');

  check(await admin.storage.createBucket(`native-proof-${id}`, { public: false }));
  bucketCreated = true;
  const bucket = admin.storage.from(`native-proof-${id}`);
  check(await bucket.upload('proof.txt', Buffer.from('native-storage-proof'), { contentType: 'text/plain' }));
  assert.equal(await check(await bucket.download('proof.txt')).text(), 'native-storage-proof');
  check(await bucket.remove(['proof.txt']));
  pass('Private storage upload, download, and deletion work from Windows.');

  const probe = await fetch(`${config.API_URL}/functions/v1/runtime-probe`, { signal: AbortSignal.timeout(20000) });
  assert.equal(probe.status, 200);
  assert.equal((await probe.json()).status, 'ready');
  pass('A bundled Edge Function executes in the native runtime.');
} finally {
  if (channel) channel.close();
  if (bucketCreated) check(await admin.storage.deleteBucket(`native-proof-${id}`));
  if (userId) check(await admin.auth.admin.deleteUser(userId));
  // Keep the non-sensitive proof row to check database durability after restart.
  await user.auth.signOut();
}
