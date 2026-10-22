import {writeFile,unlink} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
export async function assertNormalWindowsInstallContext(){
 const name='agentopia-install-context-'+randomUUID()+'.tmp',file='C:/Users/charl/AppData/Local/'+name,linux='/mnt/c/Users/charl/AppData/Local/'+name,marker=randomUUID();
 await writeFile(file,marker,{flag:'wx'});
 try{const code='from pathlib import Path;import json;file=Path('+JSON.stringify(linux)+');print(json.dumps({"normal":file.is_file() and file.read_text()=='+JSON.stringify(marker)+'}))';const result=await exec('wsl.exe',['-d','AgentopiaRuntime-a91a4800-e08f-4440-a4ec-588762d01bfd','-u','agentopia','--exec','python3','-c',code],{windowsHide:true,encoding:'utf8',timeout:15000});const proof=JSON.parse(result.stdout.trim());if(!proof.normal)throw Error('Windows redirects this host’s Local AppData writes. Do not run the installer here; use the approved normal Windows installation route.');return {normal:true,physicalWriteVerified:true};}
 finally{await unlink(file);}
}
