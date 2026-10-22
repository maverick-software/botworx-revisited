// Invoked from WSL as a native Windows process: read physical Windows files
// without thousands of separate cross-filesystem opens in the Linux worker.
import assert from 'node:assert/strict';
import {readFile,writeFile,readdir,lstat,realpath} from 'node:fs/promises';
import path from 'node:path';
import {hash} from './phased-backup-control.mjs';
const root=path.resolve(import.meta.dirname,'../..'),out=path.resolve(process.argv[2]??''),json=async f=>JSON.parse(await readFile(f,'utf8'));assert.equal(path.dirname(out),path.join(root,'.supabase/desktop-normal-maintenance'));
const intent=await json(path.join(out,'intent.json')),frozen=await json(intent.uiProof),base=await json(frozen.baseProof),raw=await json(path.join(out,'profile-recovery.json')),profile='C:/Users/charl/.agentopia/desktop/profile',program='C:/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.52',resources=path.join(program,'resources/resources');
for(const directory of [profile,program,raw.destination]){assert.equal((await realpath(directory)).toLowerCase(),path.resolve(directory).toLowerCase());assert(!(await lstat(directory)).isSymbolicLink());}
for(const [name,row]of Object.entries(raw.manifest.files)){assert.equal(await hash(path.join(profile,name)),row.sha256,'Physical profile differs: '+name);assert.equal(await hash(path.join(raw.destination,name)),row.sha256,'Recovery differs: '+name);}
assert.equal(await hash(path.join(program,'resources/app.asar')),frozen.baseImageSha256);
for(const [name,digest]of Object.entries(base.resourceFiles))assert.equal(await hash(path.join(resources,name)),digest,'Installed baseline differs: '+name);
const uiNames=[];for(const name of await readdir(path.join(resources,'ui'),{recursive:true})){const file=path.join(resources,'ui',name),stat=await lstat(file);assert(!stat.isSymbolicLink());if(stat.isFile())uiNames.push('ui/'+name.replaceAll('\\','/'));}assert.deepEqual(uiNames.sort(),Object.keys(base.resourceFiles).filter(n=>n.startsWith('ui/')).sort());
const result={success:true,at:new Date().toISOString(),out,physicalWindowsProcess:true,profileFiles:Object.keys(raw.manifest.files).length,resourceFiles:Object.keys(base.resourceFiles).length,profileManifestSha256:await hash(path.join(out,'profile-recovery.json')),uiProofSha256:await hash(intent.uiProof),baselineImageSha256:frozen.baseImageSha256,sourceProfile:profile,program,sourceUiBaselineUnchanged:true,readOnly:true,providerRequests:0};await writeFile(path.join(out,'physical-preflight.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({success:true,profileFiles:result.profileFiles,resourceFiles:result.resourceFiles}));
