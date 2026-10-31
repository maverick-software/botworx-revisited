import path from 'node:path';
import {createHash} from 'node:crypto';
import {mkdir,lstat,readFile,writeFile,realpath} from 'node:fs/promises';
import {backupDirectory} from './backup-archives';
import {protectBackupFolder} from './backup-private-folder';
export function profileRecoveryDirectory(profile:string){const absolute=path.resolve(profile);return path.join(path.parse(absolute).root,'.sylvana-recovery-'+createHash('sha256').update(process.platform==='win32'?absolute.toLowerCase():absolute).digest('hex').slice(0,12));}
export async function prepareProfileRecoveryDirectory(profile:string,guard:()=>Promise<void>){
 await guard();await backupDirectory(profile);let family=profileRecoveryDirectory(profile),fresh=false;
 try{await mkdir(family);fresh=true;}catch(error){const code=(error as NodeJS.ErrnoException).code;if(code==='EACCES'||code==='EPERM'){family=path.join(path.dirname(profile),path.basename(family));try{await mkdir(family);fresh=true;}catch(fallback){if((fallback as NodeJS.ErrnoException).code!=='EEXIST')throw fallback;}}else if(code!=='EEXIST')throw error;}
 await backupDirectory(family);await protectBackupFolder(family);const absolute=path.resolve(profile),owner={format:1,profile:process.platform==='win32'?absolute.toLowerCase():absolute},file=path.join(family,'owner.json');
 if(fresh)await writeFile(file,JSON.stringify(owner),{flag:'wx',mode:0o600});else{const info=await lstat(file),actual=await realpath(file);if(!info.isFile()||info.isSymbolicLink()||info.nlink!==1||info.size>16384||(process.platform==='win32'?actual.toLowerCase()!==file.toLowerCase():actual!==file)||JSON.stringify(JSON.parse(await readFile(file,'utf8')))!==JSON.stringify(owner))throw Error('This private recovery directory belongs to another profile or an unfinished allocation.');}
 await guard();return family;
}
