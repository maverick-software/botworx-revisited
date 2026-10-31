import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir,lstat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {extractAll,extractFile} from '@electron/asar';

const root=path.resolve(import.meta.dirname,'../..');
const proofFile=process.env.SYLVANA_CANDIDATE_PROOF;
const out=path.resolve(process.env.SYLVANA_CANDIDATE_TEST_OUTPUT??'');
const resources=process.env.SYLVANA_CANDIDATE_TEST_RESOURCES;
assert(proofFile&&resources&&/^[Ff]:[\\/]/.test(out),'Provide a candidate proof, native test resources and a new F-drive output folder.');
assert.equal(await lstat(out).catch(()=>null),null,'Inspect existing candidate evidence before running again.');
const proof=JSON.parse(await readFile(proofFile,'utf8'));
assert(proof.success&&proof.program&&/^\d+\.\d+\.\d+$/.test(proof.version));
const hash=async file=>{const value=createHash('sha256');for await(const chunk of createReadStream(file))value.update(chunk);return value.digest('hex');};
const image=path.join(proof.program,'resources/app.asar');
assert.equal(await hash(image),proof.imageSha256);
const metadata=JSON.parse(extractFile(image,'package.json').toString());
assert.equal(metadata.version,proof.version);
const account=extractFile(image,'build/sylvana-account.js').toString();
assert(/['"]X-Sylvana-Policy-Version['"]\s*:\s*['"]3['"]/.test(account),'The candidate must advertise the current firm-policy protocol.');
const resourceVersion=JSON.parse(await readFile(path.join(proof.program,'resources/resources/version.json'),'utf8'));
assert.equal(resourceVersion.version,proof.version);
const migrations=(await readdir(path.join(root,'desktop/database'))).filter(name=>name.endsWith('.sql'));
assert.equal(resourceVersion.schema,migrations.length);
for(const name of migrations)assert.equal(await hash(path.join(root,'desktop/database',name)),await hash(path.join(proof.program,'resources/resources/database',name)));
await mkdir(out,{recursive:true});
const archive=path.join(out,'archive');extractAll(image,archive);
const loader=path.join(out,'candidate-loader.cjs');
// Electron provides its module as a host builtin. These Node unit cases use
// the same development shim as source tests; they do not invoke GUI APIs.
// All application modules and other runtime dependencies come from the archive.
await writeFile(loader,`const Module=require('node:module'),path=require('node:path'),original=Module._resolveFilename,source=${JSON.stringify(path.join(root,'desktop/build')+path.sep)},candidate=${JSON.stringify(path.join(archive,'build')+path.sep)},electron=${JSON.stringify(path.join(root,'node_modules/electron'))};Module._resolveFilename=function(request,parent,...args){let selected=request==='electron'?electron:request;if(typeof request==='string'&&(request.startsWith('.')||path.isAbsolute(request))){const absolute=path.resolve(parent?.filename?path.dirname(parent.filename):process.cwd(),request);if(absolute.startsWith(source))selected=candidate+absolute.slice(source.length);}return original.call(this,selected,parent,...args);};const realFetch=global.fetch;global.fetch=(url,args)=>{const target=new URL(String(url));if(target.protocol!=='http:'||target.hostname!=='127.0.0.1')throw Error('Unexpected external request in candidate verification');return realFetch(url,args);};`);
const env={...process.env,SYLVANA_GOAL_BUILD:path.join(archive,'build'),SYLVANA_PROFILE_TEST_BUILD:path.join(archive,'build'),SYLVANA_GOAL_RESOURCES:resources,SYLVANA_GOAL_OUTPUT:path.join(out,'goals'),TEMP:path.join(out,'temp'),TMP:path.join(out,'temp')};
await mkdir(env.SYLVANA_GOAL_OUTPUT);await mkdir(env.TEMP);
const names=['native-events','native-steering-context','sylvana-account','sylvana-provider','sylvana-services','firm-model-tiers','native-child-report-context','chat-file-history','chat-output-edits','wizard-profile','native-goals'];
const result=spawnSync(process.execPath,['--require',loader,'--test','--test-concurrency=1','--test-reporter=tap',...names.map(name=>'desktop/tests/'+name+'.test.cjs')],{cwd:root,env,windowsHide:true,encoding:'utf8',maxBuffer:8*1024*1024});
const log=(result.stdout??'')+(result.stderr??'');await writeFile(path.join(out,'tests.log'),log);
const passed=Number(log.match(/^# pass (\d+)/m)?.[1]),failed=Number(log.match(/^# fail (\d+)/m)?.[1]);
const receipt={success:result.status===0&&passed===89&&failed===0,at:new Date().toISOString(),version:proof.version,imageSha256:proof.imageSha256,actualCandidateArchive:true,electronImport:'Development Node shim; GUI APIs are outside this suite',currentDesktopPolicy:3,migrationsMatched:migrations.length,passed,failed,controlledInference:true,paidRequests:0,installedProfileChanged:false,publicInstallerQualified:false,out};
assert.equal(await hash(image),proof.imageSha256,'Candidate changed during verification.');
await writeFile(path.join(out,'evidence.json'),JSON.stringify(receipt,null,2));
console.log(JSON.stringify(receipt));assert(receipt.success,'Inspect '+path.join(out,'tests.log'));
