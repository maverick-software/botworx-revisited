import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {chmod} from 'node:fs/promises';
const exec=promisify(execFile);
export async function protectBackupFolder(directory:string){
 if(process.platform!=='win32'){await chmod(directory,0o700);return;}
 const output=await exec('whoami.exe',['/user','/fo','csv','/nh'],{windowsHide:true,encoding:'utf8'}),identities=output.stdout.match(/S-\d-\d+(?:-\d+)+/g);if(identities?.length!==1)throw Error('Your Windows account could not be identified for private backup storage.');
 await exec('icacls.exe',[directory,'/inheritance:r','/grant:r','*'+identities[0]+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F','/Q'],{windowsHide:true,encoding:'utf8'});
}
