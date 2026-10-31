import {spawn} from 'node:child_process';
import {createReadStream,createWriteStream} from 'node:fs';
import {stat,mkdir} from 'node:fs/promises';
import {pipeline} from 'node:stream/promises';
import path from 'node:path';
import tar from 'tar-stream';
import {legacyDistribution,transferPrefix} from './runtime-binding';
const unpack=`import sys,tarfile,pathlib,shutil,os
root=pathlib.Path(sys.argv[1]).resolve()
root.mkdir(parents=True,exist_ok=True)
with tarfile.open(fileobj=sys.stdin.buffer,mode='r|') as archive:
 for member in archive:
  target=(root/member.name).resolve()
  assert member.isfile() and target.is_relative_to(root) and target!=root,'Invalid runtime resource'
  target.parent.mkdir(parents=True,exist_ok=True)
  with target.open('wb') as output: shutil.copyfileobj(archive.extractfile(member),output)
  os.chmod(target,member.mode & 0o777)
`;
function completion(child:ReturnType<typeof spawn>){
 return new Promise<void>((resolve,reject)=>{
  child.on('error',()=>reject(new Error('Windows could not start the WSL file transfer.')));
  child.on('close',code=>code===0?resolve():reject(new Error(`The private WSL file transfer failed (${code}). Retry startup.`)));
 });
}
export async function sendFiles(files:{name:string;file:string}[],destination:string,root=false,distribution=legacyDistribution){
 const child=spawn('wsl.exe',[...transferPrefix(distribution,root?'root':'sylvana'),'--exec','python3','-c',unpack,destination],{windowsHide:true,stdio:['pipe','ignore','ignore']});
 const done=completion(child),archive=tar.pack();
 const transfer=pipeline(archive,child.stdin!);
 try{
  for(const file of files){
   const info=await stat(file.file);
   const entry=archive.entry({name:file.name,size:info.size,mode:root?0o644:0o600});
   await pipeline(createReadStream(file.file),entry);
  }
  archive.finalize();await Promise.all([transfer,done]);
 }catch(error){archive.destroy();child.kill();await Promise.allSettled([transfer,done]);throw error;}
}
export async function receiveBackup(source:string,destination:string,distribution=legacyDistribution){
 await mkdir(destination,{recursive:true});
 const names=['database.dump','auth.dump','application.dump','vault.dump','pgsodium_root.key','manifest.json'];
 const child=spawn('wsl.exe',[...transferPrefix(distribution,'sylvana'),'--exec','tar','-cf','-','-C',source,...names],{windowsHide:true,stdio:['ignore','pipe','ignore']});
 const archive=tar.extract(),done=completion(child);
 archive.on('entry',(header,stream,next)=>{
  if(!names.includes(header.name)||header.type!=='file'){stream.resume();archive.destroy(new Error('Invalid backup resource.'));return;}
  pipeline(stream,createWriteStream(path.join(destination,header.name),{mode:0o600})).then(()=>next(),error=>archive.destroy(error));
 });
 try{await Promise.all([pipeline(child.stdout!,archive),done]);}catch(error){child.kill();throw error;}
}
