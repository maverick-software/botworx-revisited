import {readFile,writeFile,readdir,stat,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const out=process.env.SYLVANA_WIZARD_OUTPUT??'F:/Sylvana/verification/windows-wizard-20261029/isolated-v1',destination=process.env.SYLVANA_WIZARD_TEST_DESTINATION;
if(!destination||!path.resolve(destination).startsWith('F:\\Sylvana\\verification\\windows-wizard-20261029\\'))throw Error('Use a dedicated F-drive verification destination.');
const proof=JSON.parse(await readFile(out+'/qualified-installer.json','utf8'));
assert(proof.isolatedVerification,'This verifier must not inspect or alter a live user installation.');
const hash=async file=>{const h=createHash('sha256');for await(const bytes of createReadStream(file))h.update(bytes);return h.digest('hex');};
assert.equal(await hash(proof.installer),proof.installerSha256,'The installer changed after qualification.');
const files={};
async function walk(directory,prefix=''){for(const item of await readdir(directory,{withFileTypes:true})){assert(!item.isSymbolicLink());const name=prefix+item.name,file=path.join(directory,item.name);if(item.isDirectory())await walk(file,name+'/');else files[name]=await hash(file);}}
await walk(proof.program);assert.deepEqual(files,proof.files,'The program changed after installer qualification.');let checked=0;
for(const [name,digest] of Object.entries(files)){assert.equal(await hash(path.join(destination,name)),digest,'Installed file differs: '+name);checked++;}
const home=process.env.SYLVANA_WIZARD_TEST_HOME,record=JSON.parse(await readFile(path.join(home,'.sylvana/desktop/wizard-installation.json'),'utf8'));
assert.equal(path.resolve(record.installationRoot),path.resolve(destination));assert.equal(path.resolve(record.home),path.resolve(home));
const phase=process.env.SYLVANA_WIZARD_TEST_PHASE??'fresh';assert(/^[a-z-]+$/.test(phase));
await writeFile(out+'/installed-'+phase+'.json',JSON.stringify({success:true,phase,installerSha256:proof.installerSha256,programFilesVerified:checked,installationRoot:destination,dataSelection:record,at:new Date().toISOString()},null,2));
console.log(JSON.stringify({installedFilesVerified:checked,phase,dataSelectionPreserved:true}));
