// Exercise the actual installation controller's base-proof identity assertion without running it.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
const source=await readFile(new URL('install-release77.mjs',import.meta.url),'utf8'),check=source.match(/assert\.equal\(path\.resolve\(prior\.proof\),path\.resolve\(p\.baseProof\)\);/)?.[0];assert(check,'The actual base-proof identity assertion must retain normalized path equality');
const installed='F:\\Agentopia\\.supabase\\desktop-release80\\1792984969940\\package-proof.json',candidate='F:/Agentopia/.supabase/desktop-release80/1792984969940/package-proof.json',verify=(left,right)=>vm.runInNewContext(check,{assert,path,prior:{proof:left},p:{baseProof:right}});
verify(installed,candidate);verify(candidate,installed);verify(installed,installed);
for(const other of ['F:/Agentopia/.supabase/desktop-release79/1792984969940/package-proof.json','F:/Agentopia/.supabase/desktop-release80/1792984969941/package-proof.json','F:/Other/.supabase/desktop-release80/1792984969940/package-proof.json'])assert.throws(()=>verify(installed,other));
console.log(JSON.stringify({success:true,actualControllerAssertionVerified:true,slashVariantsAccepted:true,differentReleaseRejected:true,differentProofDirectoryRejected:true,differentRootRejected:true,controllerSha256:createHash('sha256').update(source).digest('hex'),productionAccess:false,applicationStarted:false}));
