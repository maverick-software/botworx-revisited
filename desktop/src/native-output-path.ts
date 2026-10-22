import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
export function nativeOutputDirectory(nativeDirectory:string,home=os.homedir()){return path.join(home,'Agentopia Files',createHash('sha256').update(path.resolve(nativeDirectory)).digest('hex').slice(0,12));}

export function nativeWorkspaceScope(conversation:string,scope:string){return conversation+'-'+scope;}
