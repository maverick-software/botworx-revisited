import {readFile,writeFile,readdir,lstat} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {extractFile,listPackage,statFile} from '@electron/asar';
import {desktopOperation} from './operation-lock.mjs';
import {hash} from './phased-backup-control.mjs';
desktopOperation('verify exact47 archive identity and retained regression provenance');
const root=path.resolve(import.meta.dirname,'../..'),candidate=path.join(root,'.supabase/desktop-platform-release/candidate-04447'),json=async file=>JSON.parse(await readFile(file,'utf8')),proof=await json(path.join(candidate,'package-proof.json')),base=await json(path.join(root,'.supabase/desktop-platform-release/candidate-04446/package-proof.json')),backendFile=path.join(root,'.supabase/desktop-platform-release/candidate-04446/qualification.json'),backend=await json(backendFile),uiFile=proof.currentUiQualification,ui=await json(uiFile),uiProof=await json(proof.currentUiProofFile);
assert(proof.success&&proof.version==='0.44.47'&&proof.migrations===69&&proof.compiledBackendByteIdenticalTo46&&proof.uiBytesIdenticalToInstalledCorrection3);
assert(backend.success&&backend.backendChecks===63&&backend.imageSha256===base.imageSha256&&ui.success&&ui.readingChecks===15&&ui.uiChecks===17&&ui.agentChecks===5&&ui.agentFormChecks===15);
assert.equal(await hash(proof.image),proof.imageSha256);assert.equal(await hash(base.image),base.imageSha256);
const files=image=>listPackage(image).map(name=>name.replace(/^[/\\]/,'')).filter(name=>!statFile(image,name).files).sort(),before=files(base.image),after=files(proof.image);assert.deepEqual(after,before);
let compared=0;for(const name of after){if(name==='package.json')continue;assert(extractFile(base.image,name).equals(extractFile(proof.image,name)),'Archive code changed: '+name);compared++;}
const manifest=JSON.parse(extractFile(proof.image,'package.json').toString());assert.equal(manifest.version,'0.44.47');const priorManifest=JSON.parse(extractFile(base.image,'package.json').toString());assert.deepEqual({...manifest,version:priorManifest.version},priorManifest);
const uiEntries=object=>Object.fromEntries(Object.entries(object).filter(([name])=>name.startsWith('ui/')));assert.deepEqual(uiEntries(proof.resourceFiles),uiEntries(uiProof.resourceFiles));
for(const [name,digest]of Object.entries(proof.resourceFiles)){assert.equal(await hash(path.join(proof.resources,name)),digest);if(!name.startsWith('ui/')&&name!=='version.json')assert.equal(digest,base.resourceFiles[name]);}
for(const key of ['uiEvidence','readingEvidence','agentEvidence','agentFormEvidence'])assert.equal(await hash(ui[key]),ui[key+'Sha256']);
assert.deepEqual(await json(path.join(proof.resources,'version.json')),{...await json(path.join(base.resources,'version.json')),version:'0.44.47'});
const result={...proof,success:true,at:new Date().toISOString(),phase:'controlled-qualified-awaiting-private-recovery',archiveFilesCompared:compared,onlyArchiveChange:'package.json version 0.44.46 to 0.44.47',backendChecks:63,backendChecksRetainedByExactCodeIdentity:true,backendQualification:{file:backendFile,sha256:await hash(backendFile)},uiChecks:52,uiChecksRetainedByExactAssetIdentity:true,uiQualification:{file:uiFile,sha256:await hash(uiFile)},fullPackagedAcceptancePending:true,migrationCompatibilityQualified:false,productionProfileChanged:false,providerRequests:0,installed:false,installerCreated:false};
await writeFile(path.join(candidate,'qualification.json'),JSON.stringify(result,null,2),{flag:'wx'});console.log(JSON.stringify({success:true,version:result.version,archiveFilesCompared:compared,retainedBackendChecks:63,retainedUiChecks:52,fullPackagedAcceptancePending:true,installed:false}));
