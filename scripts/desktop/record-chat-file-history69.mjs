import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash} from './phased-backup-control.mjs';
desktopOperation('record source-qualified long-history file-link repair');
const root=path.resolve(import.meta.dirname,'../..'),pointer=await json(path.join(root,'.supabase/desktop-chat-file-history69/current.json')),evidence=await json(pointer.evidence);
assert(evidence.success&&evidence.sourceOnly&&!evidence.installed&&evidence.passed>=70&&evidence.restoredLinkCases>=9);
for(const [file,digest] of Object.entries(evidence.sourceHashes))assert.equal(await hash(path.join(root,file)),digest);
const text=`# Private file links in long chats — source qualification for the next release

The installed application remains accepted 0.44.68. This repair is implemented and tested in an isolated source build on F:. It has not been packaged or installed.

Private generated-file links were accepted only when their original assistant message appeared among the newest 200 assistant messages. In a longer conversation, clicking an older download could therefore fail even though the file and its original offer still existed. The lookup now reads batches of 200 messages until it finds the exact offered link or reaches the end. Each batch continues before the previous message's saved sequence and identifier, which keeps new replies from displacing older messages and handles equal sequence values. The account guard runs between reads. Existing ownership, exact-link, chat-branch, sensitive-file and physical-path checks remain enforced before any export.

The focused source run passes ${evidence.passed} file-link, edited-copy, permission and recovery checks, plus ${evidence.restoredLinkCases} restored-workspace link cases. New generated cases cover an offer behind 450 later replies, equal-sequence boundaries, an absent offer in an exact 400-message history, another account/chat or user message, new replies during lookup, account changes, read errors and a foreign private branch. A controlled transport case also uses the actual Supabase client to verify its serialized filters and cursor. These cases use generated files and controlled database replies. They establish service behavior and client serialization; a real long-chat PostgreSQL/package/ordinary-window check is still required.

The first runner placed temporary output under the protected .supabase directory and omitted the scheduler test's fixture settings. The application refused those attachments. The corrected runner puts generated files in F:/Agentopia-Acceptance, binds every tested import to the isolated build and supplies explicit test settings. The failed evidence remains retained. No production profile, provider request or image setting was changed.

Qualification: \`${pointer.evidence.replaceAll('\\','/')}\`.

Next: qualify the repair through real PostgreSQL and the frozen next package, complete ordinary installation/recovery acceptance, then continue persistent agent files, inline app mentions, avatars/starters, builder preview and the remaining full parity scope. Keep image generation disabled and preserve completed or uncertain requests without replay.
`;
await writeFile(path.join(root,'docs/desktop/file-links69.md'),text);
const ledgerFile=path.join(root,'.supabase/desktop-recovery-bootstrap/next-acceptance.json'),ledger=await json(ledgerFile);ledger.chatFileHistory69={sourceQualified:true,installed:false,evidence:pointer.evidence,checks:evidence.passed,restoredLinkCases:evidence.restoredLinkCases,realDatabaseLongHistoryPending:true};ledger.next[1]='Private native offered-file lookup beyond 200 messages is source-qualified. Verify the real PostgreSQL query and frozen next package before claiming installed behavior. See docs/desktop/file-links69.md.';await writeFile(ledgerFile,JSON.stringify(ledger,null,2));
const matrixFile=path.join(root,'docs/desktop/parity-requirements57.md');let matrix=await readFile(matrixFile,'utf8');matrix=matrix.replace('The full goal remains active. The matrix records','The private generated-file lookup beyond 200 assistant messages is now implemented and source-qualified; real database, packaged and installed acceptance remain pending. [Repair and limits](file-links69.md).\n\nThe full goal remains active. The matrix records');await writeFile(matrixFile,matrix);
console.log(JSON.stringify({success:true,sourceQualified:true,installed:false,evidence:pointer.evidence}));
