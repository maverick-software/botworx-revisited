# Actual eleven-stage autonomous goal on installed 0.44.66

The same saved goal has now completed all eleven stages. Its final continuation ran stages six through eleven automatically, passed the saved ten-turn policy default without changing its goal limits, and marked completion through the native goal controls. Independent checks verified every output file, and a normal reopening preserved the completed goal without replaying inference or tool operations.

## What this check tested

A named agent had a saved role, a written operating procedure, an assigned calculation skill and four permitted host tools: open a browser page, read its snapshot, create a new file and close that page. Full access allowed those enabled tools to run automatically. Commands, other agents and memory writes were excluded from this generated workload. The goal had no explicit turn limit or token budget; the saved agent policy's default remained ten turns.

Eleven generated local pages supplied changing order quantities. The first page supplied the original price, customer and seal; later pages changed shipping and discount and then supplied further quantities. The agent had to carry those facts, apply the latest user instruction to use green, and create one exact JSON receipt per stage. Each monetary result was independently calculated in integer cents. The last receipt must equal `27 × 6.25 + 4.40 − 1.50 = 171.65`.

The test used the real bundled Codex 0.163.0 runtime, ChatGPT OAuth with `gpt-6.1-sol`, the actual PostgreSQL backend, actual Chromium pages and actual workspace writes. Model replies were live. An isolated QA-only threshold of 16,000 total tokens caused repeated native summarization within this finite assignment. The production context configuration was unchanged. Previously written receipts were attached as folder context when the goal resumed; this is the application's normal selected-folder behavior.

## Recovery history and observed result

The original 0.44.65 attempt completed stage one and read stage two, then a summary supplied an absolute workspace-tool path. The bounded guard stopped that write before execution. The 0.44.66 repair distinguishes relative tool arguments from absolute display links and supplies current trusted host instructions to already-loaded native threads. A guarded resume before that compatibility repair sent zero provider requests. [Repair and its reproduction](workspace-paths66.md).

The next continuation completed the pending second receipt and stages three through five. The selected model then reported capacity. That failed request, all completed outputs and the paused goal were preserved. After a protected original-store token renewal, one new owned continuation resumed at stage six. Sources one through five were unavailable for rereading, existing receipt hashes were immutable, prior inference payloads were blocked from reuse, and only 24 further host actions and at most 46 further provider requests were allowed.

The final continuation used 37 actual provider requests and 24 confirmed host actions, with six further real native summaries. It completed all remaining stages and the native goal. Across the preserved recovery history there were 71 actual provider requests, including the earlier capacity refusal, twelve actual summaries, forty-four confirmed host actions and eleven distinct stage-writing turns. The goal's persisted count reached thirteen turns with both limits still unset. These totals include the interrupted and blocked history; they do not describe an uninterrupted eleven-stage run.

Every confirmed host action is accounted for: eleven page openings, eleven snapshots, eleven new-file writes and eleven tab closures. None of the completed sources or writes was repeated. All eleven receipts contain the required saved role, skill tag, original facts, latest instruction and correct calculation. The first five file hashes remained unchanged during the final continuation. Original browser tool outputs were absent from the saved replacement histories after summarization; the retained summaries and normal attached receipt context remained available.

## Reopening and data preservation

The isolated app closed and reopened normally. The same native thread, completed goal, thirteen-turn count, eleven file hashes, final report and all forty-four tool receipts were retained. There were zero inference requests during the cold check. The agent's saved role, procedure, skill and policy were unchanged, and the retained other agents' profiles, private memories and earlier requests passed comparison. The temporary QA access lease was removed and the original synthetic QA connection restored. No refresh credential was copied into QA.

The ordinary installed 0.44.66 app remained unchanged during the live check. Its protected settings passed comparison. The preceding installation had independently preserved all 1,800 saved database rows, both accounts and password/role records, 119 chats, 408 messages, four agent profiles and two memory records. Image generation remains disabled by the user's choice, with the existing connection available for later enablement.

## Evidence and limits

- Final workflow: `F:/Agentopia/.supabase/desktop-autonomous-goal68-finish66/1792652303583/evidence.json`.
- Independent native-history and file review: `F:/Agentopia/.supabase/desktop-autonomous-goal68-finish66/1792652303583/native-goal-review.json`.
- Earlier five-stage cold acceptance: `F:/Agentopia/.supabase/desktop-autonomous-goal68-recovery66/1792650674933/partial-acceptance-1792651131288/evidence.json`.
- Protected renewal: `F:/Agentopia/.supabase/desktop-primary-renewal66/1792652106112/evidence.json`.
- Installed image SHA-256: `74e4477cbbf3cbf3330e47ef5157646d0a113fd12fe786abdc776b654673d235`.

This demonstrates completion and recovery of this finite generated assignment, including automatic continuation beyond ten recorded turns. It does not establish general task accuracy, an uninterrupted eleven-stage run, compaction at the production default window, hours-long unattended operation or a physical Windows reboot. Fresh ordinary/reference visual comparison and live Composio authentication remain separate requirements. The Windows inspection runtime still failed before JavaScript initialization after a supported reset at 2026-10-22 07:09:40 UTC; no native window was selected or captured.
