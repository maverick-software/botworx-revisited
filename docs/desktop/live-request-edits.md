# Live Request edits acceptance

October 19, 2026: **the installed 0.44.47 document-refresh-12 passes a fresh real agent editing workflow.** The test started from Request edits on an open, generated Word file in a fresh QA chat. Only that file was attached. ChatGPT OAuth, the actual Codex harness 0.163.0, GPT-6.1 Sol High and Full access were selected. The request was submitted once, with no OpenRouter fallback or replay.

Request `34e5083e-d654-4975-8f2e-f56bea380791`, chat `8527f1c7-1569-46f3-87b3-4f4167ea6c1e`, completed in two successful native commands with no approval prompts. The agent changed the first title of the existing file and returned its original absolute file link. Independent comparison verifies all 18 ZIP parts: only the requested title bytes in `word/document.xml` changed, the other 17 parts are byte-identical, and package order and ZIP metadata are preserved. Headers, tables and formatting XML remain identical.

The installed preview retained the old title and offered Refresh for latest with folder navigation closed. Selecting it displayed the edited title. Closing the preview and clicking the agent's returned link reopened the same edited original. The reference desktop app opened that same file and displayed the same title and formatting. The original user chat, PDF attachment, empty draft, Native Codex Assistant and ChatGPT model/permission selection are restored.

All pre-existing rows across 126 tables remain unchanged, including account/password records. The intentional QA addition brings totals to two accounts, 116 chats, 400 messages and 200 requests, with no running request. This establishes the direct-file Word editing path; it does not establish every Office format or every private-scratch export case.

Evidence: `D:/Users/charl/AgentopiaQA/request-edits-live/1792472175718/`, including intent, saved request captures, `before.docx`, edited file, independent `output-comparison.json`, saved-data comparison and `acceptance.json`. Current pointer: `.supabase/desktop-request-edits-live/current.json`.

## Private exported copies

A separate local reproduction found three private-scratch export failures: reopening an edited copy failed, equal outputs in different chats shared one path, and equal filenames in different folders of one chat also shared a path. These checks used generated files and a controlled owned-chat database, with no model calls.

The source correction creates an editable copy per chat, source path and source version. It preserves that copy on reopening and keeps a newer source version separate. Registered legacy edited copies are cloned into independent paths while the old files remain intact; unregistered legacy content cannot replace the original source. Existing copies no longer depend on the old legacy file after migration. Account changes and linked paths remain blocked.

Twenty-one local workflow groups pass, including nine new copy/edit cases, existing real Word export/download and permission checks, and migrated-profile link checks. Frozen candidate: `C:/Users/charl/AgentopiaQA/chat-output-edits/1792472312657/`. Its archive changes only `build/chat-files.js`; all 219 installed UI files remain unchanged. Candidate SHA-256: `e5f435dd7b4611351f48c87b5b784c91fd87a0aeb4a0ad9f56801e5b429c46e4`.

**Follow-up: the corrected relative-source candidate is now installed and verified as chat-output-edits-13.** The earlier candidate described above is retained as historical evidence. See [installed private-output editing, recovery and the remaining combined-root relocation gap](private-output-edit-parity.md).

The full parity/workspace-agent goal remains active, including workspace-agent identity, memory, coordination, cancellation and restart acceptance, remaining context/image capabilities, and full installer/reboot/recovery verification.
