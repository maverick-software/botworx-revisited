// Inspect candidateB's already-built launcher; this test never runs an executable.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {hash,json} from './phased-backup-control.mjs';
import {verifySquirrelStub} from './squirrel-stub-integrity75.mjs';
const root=path.resolve(import.meta.dirname,'../..'),packageFile='F:/Agentopia-Tmp/i81-1792990068879/o/AgentopiaDesktop-0.44.81-full.nupkg',proof=await json('F:/Agentopia/.supabase/desktop-release81/1792989791205/installer-proof.json');
assert.equal(path.resolve(proof.fullPackage),path.resolve(packageFile));assert.equal(await hash(packageFile),proof.fullPackageSha256);assert.equal(proof.fullPackageSha256,'3157db8fca54a0bad8788c76608b7baf41f630f8c1dcca358987bdd5ce7ad5ff');
const template=await readFile(path.join(root,'node_modules/electron-winstaller/vendor/StubExecutable.exe'));assert.equal(createHash('sha256').update(template).digest('hex'),'d823e6d954f7e445fbbb5c04e40a39cf248a3621f9eccbafdf3f0f1e7acb11dd');
const actual=(await promisify(execFile)(path.join(root,'node_modules/electron-winstaller/vendor/7z.exe'),['e','-so',packageFile,'lib/net45/Agentopia_ExecutionStub.exe'],{windowsHide:true,encoding:'buffer',maxBuffer:4*1024*1024})).stdout,result=verifySquirrelStub(template,actual,'0.44.81');assert(result.success&&result.onlyWindowsResourcesDiffer);assert(Object.hasOwn(result.unchangedSections,'.text'));
assert.throws(()=>verifySquirrelStub(template,actual,'0.44.82'));
const changed=Buffer.from(actual),pe=changed.readUInt32LE(0x3c),table=pe+24+changed.readUInt16LE(pe+20);let mutated=false;
for(let i=0;i<changed.readUInt16LE(pe+6);i++){const section=table+i*40,name=changed.subarray(section,section+8).toString('ascii').replace(/\0.*$/,'');if(name==='.text'){const offset=changed.readUInt32LE(section+20);assert(changed.readUInt32LE(section+16)>0);changed[offset]^=1;mutated=true;break;}}
assert(mutated);assert.throws(()=>verifySquirrelStub(template,changed,'0.44.81'),/Generated Squirrel launcher code changed: \.text/);
console.log(JSON.stringify({success:true,actualCandidateBLauncherVerified:true,unsupported82Rejected:true,executableByteMutationRejected:true,...result,productionAccess:false,executablesRun:false}));
