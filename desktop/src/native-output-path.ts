import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
export function nativeOutputDirectory(nativeDirectory:string,home=os.homedir()){
 let receipt;try{receipt=JSON.parse(readFileSync(path.join(nativeDirectory,'profile-migration.json'),'utf8'));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 if(receipt?.format===3&&receipt.publicOutputRoot){const root=path.resolve(receipt.publicOutputRoot);if(path.dirname(root)!==path.join(home,'Sylvana Files')||!/^[a-f0-9]{12}$/.test(path.basename(root)))throw Error('The migrated public output folder is invalid.');return root;}
 return path.join(home,'Sylvana Files',createHash('sha256').update(path.resolve(nativeDirectory)).digest('hex').slice(0,12));
}

export function nativeWorkspaceScope(conversation:string,scope:string){return conversation+'-'+scope;}
