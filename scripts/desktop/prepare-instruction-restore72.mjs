import assert from 'node:assert/strict';
import path from 'node:path';
import {writeFile} from 'node:fs/promises';
import {desktopOperation} from './operation-lock.mjs';
import {json,list} from './phased-backup-control.mjs';
import {prepareOwnedRuntime72} from './prepare-owned-runtime72.mjs';

desktopOperation('prepare an empty exact72 instruction recovery target on F');
const root=path.resolve(import.meta.dirname,'../..'),pointerFile=path.join(root,'.supabase/desktop-instruction-apps72-real/current.json');
const pointer=await json(pointerFile),source=await json(pointer.sourceIntent);
const accepted=await json(path.join(source.out,'instruction-recovery-source-accepted.json')),e=await json(accepted.evidence);
assert(accepted.success&&e.success&&e.runtimeStopped&&e.normalExit===0&&e.controlledResponses===0);
assert(!(await list(true)).includes(source.distribution));assert(!pointer.restoredIntent);
pointer.restoredIntent=path.join(pointer.parent,'restored/intent.json');await writeFile(pointerFile,JSON.stringify(pointer,null,2));
const result=await prepareOwnedRuntime72({parent:pointer.parent,role:'restored',candidateFile:pointer.candidateFile,bundle:accepted.bundle});
assert.equal(result.intent,pointer.restoredIntent);
