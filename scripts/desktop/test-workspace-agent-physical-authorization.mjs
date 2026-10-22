import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const {physicalAuthorization}=createRequire(import.meta.url)('./workspace-agent-physical-authorization.cjs');
const id='1792308282156',now=Number(id);
function fixture(run){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'agentopia-physical-auth-test-')),directory=path.join(root,'.supabase/desktop-workspace-agents/authorization',id),snapshot=path.join(directory,'private-source');
 try{
  fs.mkdirSync(snapshot,{recursive:true});fs.mkdirSync(path.join(root,'scripts/desktop'),{recursive:true});
  for(const file of [path.join(directory,'inspector.mjs'),path.join(root,'scripts/desktop/inspect-physical-authorization.mjs')])fs.writeFileSync(file,'synthetic read-only inspector');
  const source={physicalOrdinaryProfile:true,sourceFilesUnchanged:true,files:{}};
  for(const name of ['Local State','credentials.bin']){const bytes=Buffer.from('synthetic encrypted fixture '+name);fs.writeFileSync(path.join(snapshot,name),bytes);source.files[name]={bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};}
  const evidence={success:true,currentProfile:true,physicalOrdinaryProfile:true,readyForLiveQualification:true,renewalAttempted:false,inferenceRequests:0,canonicalCredentialWrites:0,at:new Date(now).toISOString(),secondsRemaining:3600};
  const save=()=>{fs.writeFileSync(path.join(directory,'physical-source.json'),JSON.stringify(source));fs.writeFileSync(path.join(directory,'evidence.json'),JSON.stringify(evidence));};save();run({root,directory,snapshot,source,evidence,save});
 }finally{const target=fs.realpathSync.native(root),temporary=fs.realpathSync.native(os.tmpdir());assert(path.dirname(target).toLowerCase()===temporary.toLowerCase()&&path.basename(target).startsWith('agentopia-physical-auth-test-'));fs.rmSync(target,{recursive:true,force:true});}
}
test('accepts the two unchanged encrypted physical files and accounts for elapsed validity',()=>fixture(({root,snapshot})=>{const result=physicalAuthorization(root,id,now+1000);assert.equal(result.snapshot,snapshot);assert.equal(result.secondsRemaining,3599);}));
test('requires an explicit physical inspection identifier',()=>fixture(({root})=>assert.throws(()=>physicalAuthorization(root,'../profile',now),/authorization-snapshot/)));
test('rejects ordinary-directory evidence without physical-file provenance',()=>fixture(({root,evidence,save})=>{evidence.physicalOrdinaryProfile=false;save();assert.throws(()=>physicalAuthorization(root,id,now),/not ready/);}));
test('rejects an inspection that renewed credentials',()=>fixture(({root,evidence,save})=>{evidence.renewalAttempted=true;save();assert.throws(()=>physicalAuthorization(root,id,now),/read-only/);}));
test('rejects stale snapshots before launching Electron or inference',()=>fixture(({root})=>assert.throws(()=>physicalAuthorization(root,id,now+300001),/five minutes/)));
test('rejects access credentials too near expiry',()=>fixture(({root,evidence,save})=>{evidence.secondsRemaining=610;save();assert.throws(()=>physicalAuthorization(root,id,now+10000),/expires too soon/);}));
for(const name of ['Local State','credentials.bin'])test('rejects changed '+name,()=>fixture(({root,snapshot})=>{fs.appendFileSync(path.join(snapshot,name),'changed');assert.throws(()=>physicalAuthorization(root,id,now),/snapshot changed/);}));
test('rejects an inspector that differs from the reviewed source',()=>fixture(({root,directory})=>{fs.appendFileSync(path.join(directory,'inspector.mjs'),'changed');assert.throws(()=>physicalAuthorization(root,id,now),/inspector changed/);}));
test('rejects a physical source that changed while being copied',()=>fixture(({root,source,save})=>{source.sourceFilesUnchanged=false;save();assert.throws(()=>physicalAuthorization(root,id,now),/provenance/);}));
