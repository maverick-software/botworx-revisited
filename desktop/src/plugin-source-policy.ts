import path from 'node:path';
import {safeName,type WorkspaceFiles} from './workspace';

// Public Codex declarations can have dot-prefixed names. They still pass the
// host's protected-path check and the importer's bounded, regular-file checks.
const publicDeclarations=new Set(['.codex-plugin','.mcp.json']);
export function checkPluginSourcePath(file:string,files:Pick<WorkspaceFiles,'checkPath'>){
 files.checkPath(file);const name=path.basename(file);
 if(!publicDeclarations.has(name.toLowerCase())&&!safeName(name))throw new Error('Credential and private files cannot be imported as plugin packages.');
}
