import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalDatabaseSnapshot} from './qualify-runtime-reconnect80.mjs';

const before={rootFingerprint:'unchanged-root',tables:[{table:'auth.users',rows:2,sha256:'users-fingerprint'},{table:'vault.secrets',rows:3,sha256:'encrypted-vault-fingerprint'}]};
test('database table summary order does not change the saved-data comparison',()=>{
 const after={...before,tables:[...before.tables].reverse()};assert.deepEqual(canonicalDatabaseSnapshot(after),canonicalDatabaseSnapshot(before));assert.equal(after.tables[0].table,'vault.secrets');
});
test('a changed row fingerprint still fails after normalizing table summary order',()=>{
 const after=structuredClone(before);after.tables.reverse();after.tables[0].sha256='changed-encrypted-vault-fingerprint';assert.throws(()=>assert.deepEqual(canonicalDatabaseSnapshot(after),canonicalDatabaseSnapshot(before)),assert.AssertionError);
});
