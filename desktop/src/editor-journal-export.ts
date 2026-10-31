import {realpath,writeFile} from 'node:fs/promises';
import path from 'node:path';
import type {JournalRecoveryCopy} from './editor-journal-recovery-contracts';
type Host={owner:string;read:()=>Promise<JournalRecoveryCopy>;choose:(copy:JournalRecoveryCopy)=>Promise<string|undefined>;guard:()=>Promise<void>;checkPath:(file:string)=>void};
/** Export stays passive and never replaces an existing file. Recheck the
 * account and sealed snapshot after the native picker and before the write. */
export async function exportEditorJournal(host:Host){await host.guard();const copy=await host.read(),destination=await host.choose(copy);if(!destination)return {saved:false};await host.guard();const checked=await host.read();if(copy.id!==checked.id||copy.key!==checked.key||copy.raw!==checked.raw)throw Error('The retained draft changed. Inspect it again.');host.checkPath(destination);host.checkPath(await realpath(path.dirname(destination)));await host.guard();await writeFile(destination,JSON.stringify({format:1,kind:'sylvana-exported-editor-recovery',owner:host.owner,copy:checked},null,2),{flag:'wx',mode:0o600});return {saved:true};}
