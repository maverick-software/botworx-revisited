import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';

// Keep the accepted 67 runtime fixture immutable. The 68 fixture uses a new
// distribution, private home, ports and program; its ownership checks are retained.
const directory=import.meta.dirname;
let source=await readFile(path.join(directory,'prepare-owned-runtime67.mjs'),'utf8');
for(const [before,after] of [
 ['prepareOwnedRuntime67','prepareOwnedRuntime68'],
 ['desktop-scheduled-workspaces67-real','desktop-agent-apps68-real'],
 ['desktop-scheduled-workspaces67-candidate','desktop-agent-apps68-release'],
 ['real-recovery67-','agent-apps68-'],
 ["candidate.version==='0.44.67'","candidate.version==='0.44.68'"],
 ['PostgreSQL recovery runtime67','PostgreSQL app-picker runtime68'],
]){assert(source.includes(before),before);source=source.replaceAll(before,after);}
assert(source.includes("assert(!before.registered.includes(distribution))"));
assert(source.includes("assert.equal(await hash(candidate.image),candidate.imageSha256)"));
assert(source.includes("assert not list(Path('/home/agentopia/.supabase/stacks').glob('*'))"));
assert(!source.includes('0.44.67'));
const target=path.join(directory,'prepare-owned-runtime68.mjs');
await writeFile(target,source,{flag:'wx'});
console.log('Prepared an independently owned 0.44.68 runtime fixture: '+target);
