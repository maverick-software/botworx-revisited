import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'../..'),id=process.argv[2];assert(/^\d{13}$/.test(id));
const base=path.join(root,'.supabase/desktop-packaged-live',id),intent=JSON.parse(await readFile(path.join(base,'intent.json'),'utf8'));
const resources=path.join(base,'program/resources/resources'),req=createRequire(path.join(base,'archived/package.json')),{scriptEnvironment}=req('./build/script-runtimes.js');
const out=path.join(base,'native-probe-'+Date.now());await mkdir(out);await copyFile(path.join(root,'scripts/desktop/probe-packaged-codex.mjs'),path.join(out,'probe.mjs'));
const executable=path.join(resources,'codex/x86_64-pc-windows-msvc/bin/codex.exe');
const fingerprint=await readFile(executable).then(bytes=>createHash('sha256').update(bytes).digest('hex'));
const environments=scriptEnvironment(resources,{...process.env,Path:process.env.SystemRoot+'\\System32;'+process.env.SystemRoot,PATH:process.env.SystemRoot+'\\System32;'+process.env.SystemRoot});
const results=[];
for(const [name,home] of [['short',path.join(out,'short-home')],['long',path.join(intent.profile,'codex','5ed8fc9d-bf01-498d-acf1-0b4503d57b89','openai-oauth','403a34f3-7147-46dd-9002-2c237924d74a-'+'a'.repeat(32))],['short-profile',path.join(path.dirname(intent.profile),'q7','codex','5ed8fc9d-bf01-498d-acf1-0b4503d57b89','openai-oauth','403a34f3-7147-46dd-9002-2c237924d74a-'+'b'.repeat(32))],['compact',path.join(intent.profile,'codex','_','openai-oauth','c'.repeat(32))]]){
 await mkdir(home,{recursive:true});const env={...environments,CODEX_HOME:name==='long'?path.toNamespacedPath(home):home,AGENTOPIA_INFERENCE_TOKEN:'probe-no-inference'};
 const args=['app-server','--listen','stdio://','-c','model_provider="agentopia"','-c','model_providers.agentopia.name="Agentopia no-inference probe"','-c','model_providers.agentopia.base_url="http://127.0.0.1:1/v1"','-c','model_providers.agentopia.wire_api="responses"','-c','model_providers.agentopia.env_key="AGENTOPIA_INFERENCE_TOKEN"','-c','model_providers.agentopia.requires_openai_auth=false','-c','web_search="disabled"'];
 const result=await new Promise(resolve=>{const child=spawn(executable,args,{env,cwd:out,windowsHide:true,stdio:['pipe','pipe','pipe']});let stdout='',stderr='',initialized=false,error;
  child.stdout.on('data',bytes=>{stdout+=bytes;if(stdout.includes('"id":1')&&!initialized){initialized=true;child.stdin.end();}});child.stderr.on('data',bytes=>stderr+=bytes);child.stdin.on('error',()=>{});child.on('error',failure=>error={code:failure.code,message:failure.message});
  const timeout=setTimeout(()=>child.kill(),15000);child.once('exit',code=>{clearTimeout(timeout);resolve({name,home,homeCharacters:home.length,initialized,exitCode:code,error,stdout,stderr});});child.stdin.write(JSON.stringify({id:1,method:'initialize',params:{clientInfo:{name:'agentopia_probe',title:'Agentopia',version:'0.44.8'},capabilities:{experimentalApi:true,requestAttestation:false}}})+'\n');});
 await writeFile(path.join(out,name+'-stdout.log'),result.stdout);await writeFile(path.join(out,name+'-stderr.log'),result.stderr);const {stdout,stderr,...record}=result;results.push({...record,stderrPreview:stderr.slice(0,1400)});
}
await writeFile(path.join(out,'evidence.json'),JSON.stringify({at:new Date().toISOString(),executableSha256:fingerprint,noTurns:true,noProviderCredentials:true,results},null,2));console.log(JSON.stringify({out,results},null,2));
