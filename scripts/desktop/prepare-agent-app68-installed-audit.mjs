import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
const directory=import.meta.dirname;
const files=['audit-agent-health67.mjs','audit-agent-health67.py','accept-installed67.mjs'];
for(const file of files){
 let source=await readFile(path.join(directory,file),'utf8');
 for(const other of files)source=source.replaceAll(other,other.replace('67','68'));
 source=source.replaceAll('0.44.67','0.44.68').replaceAll('desktop-agent-health67','desktop-agent-health68').replaceAll('current-update67','current-update68').replaceAll('desktop-scheduled-workspaces67-release','desktop-agent-apps68-release').replaceAll('97798aceb695969bca2275a4f92ccbb7d6b8e0d492575a9ad1052c3dacda9e8b','35a0df5646ddd149a070f96a917de68f4bc323e346f0958c9328e5e7cdd38da9');
 assert(!source.includes('0.44.67'));await writeFile(path.join(directory,file.replace('67','68')),source,{flag:'wx'});
 console.log('Prepared '+file.replace('67','68'));
}
