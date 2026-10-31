// Read the real built85 launcher and exercise the actual verifier without starting an application.
import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {verifySquirrelStub} from './squirrel-stub-integrity75.mjs';

const at=process.argv.indexOf('--proof');assert(at>=0&&process.argv[at+1],'Pass --proof with the already built85 package-proof.json');
const root=path.resolve(import.meta.dirname,'../..'),file=path.resolve(process.argv[at+1]),json=async name=>JSON.parse(await readFile(name,'utf8')),p=await json(file),q=await json(path.join(p.out,'qualification.json')),made=await json(path.join(p.out,'installer-proof.json')),sha=value=>createHash('sha256').update(value).digest('hex'),exec=promisify(execFile);
assert(p.success&&p.version==='0.44.85'&&p.schema===90&&q.success&&q.actualPackagedApp&&q.actualPostgres&&q.actualColdReopening&&made.success&&made.version===p.version);assert.equal(sha(await readFile(file)),q.proofSha256);assert.equal(made.imageSha256,p.imageSha256);
const original=(await exec('git',['show',p.sourceCommit+':scripts/desktop/squirrel-stub-integrity75.mjs'],{cwd:root,windowsHide:true,encoding:'buffer',maxBuffer:1024*1024})).stdout,current=await readFile(new URL('squirrel-stub-integrity75.mjs',import.meta.url)),old="'0.44.83','0.44.84'",next="'0.44.83','0.44.84','0.44.85'";
assert.equal(sha(original),q.sourceHashes['squirrel-stub-integrity75.mjs']);assert.equal(original.toString().split(old).length,2);assert(current.equals(Buffer.from(original.toString().replace(old,next))),'Only the exact85 version allowlist extension is approved');
const seven=path.join(root,'node_modules/electron-winstaller/vendor/7z.exe'),template=await readFile(path.join(root,'node_modules/electron-winstaller/vendor/StubExecutable.exe')),actual=(await exec(seven,['e','-so',made.fullPackage,'lib/net45/Agentopia_ExecutionStub.exe'],{windowsHide:true,encoding:'buffer',maxBuffer:2*1024*1024})).stdout,result=verifySquirrelStub(template,actual,'0.44.85');assert(result.success&&result.onlyWindowsResourcesDiffer);
assert.throws(()=>verifySquirrelStub(template,actual,'0.44.86'));assert.throws(()=>verifySquirrelStub(template,template,'0.44.85'));assert.throws(()=>verifySquirrelStub(template,actual,'0.44.84'));
const changed=Buffer.from(actual),pe=changed.readUInt32LE(0x3c),table=pe+24+changed.readUInt16LE(pe+20);let mutated=false;for(let i=0;i<changed.readUInt16LE(pe+6);i++){const section=table+i*40,name=changed.subarray(section,section+8).toString('ascii').replace(/\0.*$/,'');if(name==='.text'){changed[changed.readUInt32LE(section+20)]^=1;mutated=true;break;}}assert(mutated);assert.throws(()=>verifySquirrelStub(template,changed,'0.44.85'),/Generated Squirrel launcher code changed: \.text/);
const identity=Buffer.from(actual);identity.writeUInt16LE(identity.readUInt16LE(pe+4)^1,pe+4);assert.throws(()=>verifySquirrelStub(template,identity,'0.44.85'));
console.log(JSON.stringify({success:true,proof:file,proofSha256:q.proofSha256,imageSha256:p.imageSha256,installerSha256:made.installerSha256,fullPackageSha256:made.fullPackageSha256,qualifiedStubSha256:sha(original),reviewedStubSha256:sha(current),exactAllowlistExtensionOnly:true,actualLauncher:result,rejected86:true,rejectedWrongVersion:true,rejectedCodeMutation:true,rejectedMachineMutation:true,applicationStarted:false,providerRequests:0,productionWrites:0}));
