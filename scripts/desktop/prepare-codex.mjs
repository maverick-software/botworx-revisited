import {mkdir,readFile,writeFile,cp,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..'),version='0.163.0';
const dest=path.join(root,'desktop/resources/codex'),cache=path.join(root,'.supabase/desktop-poc/codex-native');
const integrity='QQGQ/q9dCJ5C5jqhgFrwycpWG3szIyFNThMiKl6hYtu6N/eM3Qd7StesgnCFAfzVED8IkE3N3oH71szzcludqw==';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
if(process.argv.includes('--verify')){
 const manifest=JSON.parse(await readFile(path.join(dest,'manifest.json'),'utf8'));
 if(manifest.version!==version)throw Error('Run npm run desktop:prepare-codex to prepare the pinned runtime.');
 for(const [name,expected] of Object.entries(manifest.files))if(sha(await readFile(path.join(dest,name)))!==expected)throw Error('Codex resource checksum failed: '+name);
 console.log('Pinned Codex runtime checksums verified.');
}else{
 await mkdir(dest,{recursive:true});await mkdir(cache,{recursive:true});
 const archive=path.join(cache,'openai-codex-'+version+'-win32-x64.tgz');let bytes;
 try{bytes=await readFile(archive);}catch{const response=await fetch(`https://registry.npmjs.org/@openai/codex/-/codex-${version}-win32-x64.tgz`);if(!response.ok)throw Error('Pinned Codex download failed.');bytes=Buffer.from(await response.arrayBuffer());await writeFile(archive,bytes);}
 if(createHash('sha512').update(bytes).digest('base64')!==integrity)throw Error('Pinned Codex package integrity failed.');
 const unpack=spawnSync('tar',['-xf',archive,'-C',cache],{windowsHide:true,stdio:'inherit'});if(unpack.status!==0)throw Error('Codex extraction failed.');
 await cp(path.join(cache,'package/vendor/x86_64-pc-windows-msvc'),path.join(dest,'x86_64-pc-windows-msvc'),{recursive:true});
 const source='https://raw.githubusercontent.com/openai/codex/rust-v'+version+'/';
 for(const name of ['LICENSE','NOTICE']){const response=await fetch(source+name);if(!response.ok)throw Error('Codex '+name+' could not be retrieved.');await writeFile(path.join(dest,name),await response.text());}
 const response=await fetch(source+'codex-rs/models-manager/models.json');if(!response.ok)throw Error('Pinned model catalog unavailable.');const catalog=await response.json(),extra=[];
 for(const model of catalog.models){
  // Public Responses routes do not support encrypted V2 agent_message input.
  // Use the unmodified runtime's native V1 subagent tools. Retain each model's tool mode.
  model.multi_agent_version='v1';model.prefer_websockets=false;model.use_responses_lite=false;
  if(model.slug.startsWith('gpt-')||/^o[134]/.test(model.slug))extra.push({...model,slug:'openai/'+model.slug});
 }
 catalog.models.push(...extra);await writeFile(path.join(dest,'models.json'),JSON.stringify(catalog));
 await writeFile(path.join(dest,'CATALOG-NOTICE.txt'),'Agentopia modifies the pinned Codex model catalog to select native V1 multi-agent coordination and HTTP Responses for both connections. It adds OpenRouter-qualified model slugs. The Codex executables and built-in agent loop are unchanged. Source: '+source+'codex-rs/models-manager/models.json\n');
 const names=['x86_64-pc-windows-msvc/bin/codex.exe','x86_64-pc-windows-msvc/bin/codex-code-mode-host.exe','x86_64-pc-windows-msvc/codex-resources/codex-command-runner.exe','x86_64-pc-windows-msvc/codex-resources/codex-windows-sandbox-setup.exe','x86_64-pc-windows-msvc/codex-path/rg.exe','models.json','LICENSE','NOTICE'];
 const files={};for(const name of names)files[name]=sha(await readFile(path.join(dest,name)));
 await writeFile(path.join(dest,'manifest.json'),JSON.stringify({version,packageIntegrity:'sha512-'+integrity,files},null,2));console.log('Prepared Codex '+version+' with native V1 subagents.');
}
