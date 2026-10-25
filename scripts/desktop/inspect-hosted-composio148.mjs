import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import * as asar from '@electron/asar';
import {discoverOAuthServerInfo,extractWWWAuthenticateParams} from '@modelcontextprotocol/client';
import {desktopOperation} from './operation-lock.mjs';

desktopOperation('read-only hosted Composio OAuth discovery');
const root=path.resolve(import.meta.dirname,'../..'),records=path.join(root,process.argv.includes('--network154')?'.supabase/desktop-oauth-network154':'.supabase/desktop-hosted-composio148'),out=path.join(records,String(Date.now())),require=createRequire(import.meta.url),candidate=process.argv.includes('--candidate')||process.argv.includes('--network154'),image=candidate?JSON.parse(await readFile(JSON.parse(await readFile(path.join(records,'current.json'),'utf8')).proof,'utf8')).image:'C:/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.76/resources/app.asar';
await mkdir(out,{recursive:true});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),json=async file=>JSON.parse(await readFile(file,'utf8'));
const installed=await json(candidate?path.join(records,'current.json'):path.join(root,'.supabase/desktop-computer-repair76/installed-current.json')),proof=await json(installed.proof);
assert.equal(sha(await readFile(image)),proof.imageSha256);
const moduleHashes={},isolatedBuild=path.join(out,'build');
await mkdir(isolatedBuild);await writeFile(path.join(isolatedBuild,'package.json'),JSON.stringify({type:'commonjs'}));
for(const name of ['mcp-oauth','mcp-oauth-network','mcp-client','mcp-oauth-scope']){
 const file='build/'+name+'.js',bytes=asar.extractFile(image,file);
 await writeFile(path.join(isolatedBuild,name+'.js'),bytes);moduleHashes[file]=sha(bytes);
}
const installedSdk=JSON.parse(asar.extractFile(image,path.join('node_modules','@modelcontextprotocol','client','package.json')).toString()),sdk=await json(path.join(root,'node_modules/@modelcontextprotocol/client/package.json'));assert.equal(sdk.version,installedSdk.version);
const diagnostic=path.join(out,'electron-network.cjs');await writeFile(diagnostic,`const https=require('node:https'),original=https.request,lookups=[];https.request=function(url,options,callback){const lookup=options.lookup;return original.call(this,url,{...options,lookup:(host,opts,cb)=>{lookups.push({all:opts.all===true,family:opts.family});return lookup(host,opts,cb);}},callback);};const {oauthNetwork}=require(${JSON.stringify(path.join(isolatedBuild,'mcp-oauth-network.js'))});(async()=>{try{const r=await oauthNetwork('https://connect.composio.dev/mcp',AbortSignal.timeout(20000))('https://connect.composio.dev/mcp',{headers:{Accept:'application/json, text/event-stream'}},true);console.log(JSON.stringify({success:true,versions:{node:process.versions.node,electron:process.versions.electron},status:r.status,lookups}));}catch(error){console.log(JSON.stringify({success:false,versions:{node:process.versions.node,electron:process.versions.electron},error:error.message,stack:error.stack,lookups}));}})();`);
const diagnosticResult=await promisify(execFile)(proof.exe,[diagnostic],{cwd:out,env:{...process.env,ELECTRON_RUN_AS_NODE:'1'},windowsHide:true,timeout:30000,encoding:'utf8'}),electronNetwork=JSON.parse(diagnosticResult.stdout.trim());
const {oauthNetwork}=require(path.join(isolatedBuild,'mcp-oauth-network.js')),address='https://connect.composio.dev/mcp',requests=[],network=oauthNetwork(address,AbortSignal.timeout(90000)),e={success:false,out,address,at:new Date().toISOString(),installedImageSha256:proof.imageSha256,moduleHashes,sdkVersion:sdk.version,electronNetwork,scope:'Public OAuth discovery only; no client registration, browser, account, credentials, model request or tool execution.',requests};
const fetchFn=async(input,init,headersOnly)=>{const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;const response=await network(input,init,headersOnly);requests.push({url,method:init?.method??'GET',status:response.status});return response;};
try{
 const challenge=await fetchFn(address,{headers:{Accept:'application/json, text/event-stream'}},true),params=extractWWWAuthenticateParams(challenge);
 e.challenge={status:challenge.status,resourceMetadataUrl:params.resourceMetadataUrl?.href,scope:params.scope};
 const discovery=await discoverOAuthServerInfo(address,{resourceMetadataUrl:params.resourceMetadataUrl,fetchFn});
 e.discovery=discovery;
 e.existingEngineRequirements={resourceMetadata:!!discovery.resourceMetadata,authorizationMetadata:!!discovery.authorizationServerMetadata,pkceS256:discovery.authorizationServerMetadata?.code_challenge_methods_supported?.includes('S256')===true,dynamicRegistration:!!discovery.authorizationServerMetadata?.registration_endpoint};
 e.success=Object.values(e.existingEngineRequirements).every(Boolean);
 if(!e.success)e.error='The real endpoint does not satisfy every existing automatic-registration prerequisite.';
}catch(error){e.error=error.message;e.stack=error.stack;}
await writeFile(path.join(out,'evidence.json'),JSON.stringify(e,null,2));
await writeFile(path.join(records,candidate?'candidate-discovery-current.json':'discovery-current.json'),JSON.stringify({evidence:path.join(out,'evidence.json')},null,2));
console.log(JSON.stringify({success:e.success,out,challenge:e.challenge,requirements:e.existingEngineRequirements,error:e.error,electronNetwork,requests}));
if(!e.success)process.exitCode=1;
