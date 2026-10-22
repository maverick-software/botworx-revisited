import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
const directory=import.meta.dirname;
for(const [input,output,replacements]of [
 ['make-workspace-paths-installer66-worker.mjs','make-scheduled-workspaces-installer67-worker.mjs',[['.supabase/desktop-workspace-paths-release66','.supabase/desktop-scheduled-workspaces67-release']]],
 ['squirrel-stub-integrity66.mjs','squirrel-stub-integrity67.mjs',[['0.44.66','0.44.67']]],
 ['verify-workspace-paths-installer66.mjs','verify-scheduled-workspaces-installer67.mjs',[['.supabase/desktop-workspace-paths-release66','.supabase/desktop-scheduled-workspaces67-release'],['squirrel-stub-integrity66.mjs','squirrel-stub-integrity67.mjs'],['0.44.66','0.44.67'],['0\\.44\\.66','0\\.44\\.67']]]
]){let source=await readFile(path.join(directory,input),'utf8');for(const [from,to]of replacements){assert(source.includes(from),input+': '+from);source=source.replaceAll(from,to);}if(output.startsWith('verify-')){const anchor="const updaterSize=(await lstat(path.join(made.stage,'Squirrel.exe'))).size";assert(source.includes(anchor));source=source.replace(anchor,"expected['lib/net45/Squirrel.exe']=updaterHash;"+anchor);}await writeFile(path.join(directory,output),source,{flag:'wx'});}
console.log(JSON.stringify({success:true,version:'0.44.67',pinnedTemplates:true,sharedVendorUnchanged:true}));
