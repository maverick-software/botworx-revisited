# Persistent-agent acceptance in installed 0.44.44

Agentopia's persistent-agent implementation is installed and its intended workflows have been demonstrated. This review reuses the completed model requests and independently checks their saved outcomes. It adds installed navigation and archive verification without another model request, credential read, build, runtime restart or database edit.

The live workflow ran in an isolated packaged 0.44.24 app using the user's authorized ChatGPT connection and native Codex runtime. The agent definitions and task records were test data. The recorder checked five completed requests: an earlier Starter response, an @ switch to Mira, recall from another project, Mira's specialist assignment, and the specialist's response. Mira used her saved role, procedure and skill; saved a source-linked memory in project A; recalled it in a separate native chat in project B without receiving the remembered content again; then invoked the saved restricted Inspector and separately read its completed result. The recorder checks the actual identities, revisions, projects, tool receipts and exact source citation. Both configured connections remained available; these turns used ChatGPT. The private test backend was removed after recording.

Five simultaneous instances of one saved identity were tested separately with real native workers and an owner-scoped database, using a controlled model transport. Every worker reached that transport. A sixth instance inspected their saved running states. Stopping one preserved the other four, and stopping a parent also stopped its descendants. The same run checked correction, forgetting, project isolation, repeated-invocation reuse and memory delivery through both configured provider routes. A fresh process retained definitions and memory and interrupted uncertain queued work without inference. These tests establish application execution and scope behavior; the five-worker exercise did not send live provider requests.

All seven compiled agent core modules in the successful live archive are byte-for-byte identical to the qualified 0.44.44 archive. Six also match the original controlled concurrency build; agent policy and surrounding broker, runtime and tool integration code have changed since that earlier test. Their current behavior is covered by the release's exact-archive regression suite, including restricted native tools, delegation limits, descendant cancellation, policy recovery and fresh-agent creation. The retained backend log reports 483 passing checks and no failures, plus two schema checks. The exact packaged app separately passed concurrent native-turn, queue, stop and cold-reopen workflows using controlled transport. This provenance supports carrying forward the successful live outcome; it does not represent a new live run of 0.44.44.

The physical installed app archive was independently hashed through the already-running local runtime and matches the qualified archive: `b8f0fad63d1b219add58af03a18dc442a13b9e4abb819b0604dfb7023b535e04`. Ordinary installation and cold reopening were verified by the release owner. Its read-only comparison preserved 126 tables, including two accounts, 109 chats, 380 messages and 190 saved requests, and verified 191 readable encrypted database records. There was no active request or goal at that audit.

Read-only navigation in the ordinary installed app confirmed the agent library; the Behavior editor's saved revision, handle, role, procedures, guardrails, persistent skills and tool/delegation controls; the Memory panel's project selector and existing completed assignments; and the saved-work reader's actual conversation, source links and completed native tool receipts. Project settings expose **Isolate agent memory for this project**. No setting was changed and no test agent was added to the user's library. The user's existing chat and document tabs were restored after inspection.

| Intended outcome | Evidence |
| --- | --- |
| Persistent identity, role, skills and procedures | Live saved profiles and responses; installed Behavior editor |
| @ switching within an existing chat, retained authorship | Live Starter/Mira messages in one chat; controlled selection checks |
| Separate instances sharing the agent's authorized memory across projects | Live source-linked recall in a distinct project and native thread; controlled five-worker/sixth-reader exercise |
| Calling saved specialists with enforceable restrictions | Live named invocation, restricted child tool receipt and completed parent read; current native-policy regressions |
| Progress and prior-work inspection | Controlled running-instance queries, live assignment inspection and installed saved-work reader |
| Optional isolation, correction, forgetting and restart safety | Controlled database/native tests and fresh-process evidence; installed scope controls |
| Delivered app and preserved user data | Exact installed archive hash, ordinary installation/cold reopening and database comparison |

The central agent identity is a saved record. Each instance queries shared memories and assignment records when needed; its private working context is separate. It does not continuously receive every other instance's thoughts. Written guardrails guide the model, while explicit tool and delegation policies enforce access. Named assignments use explicit result queries. Execution requires the desktop app and local runtime to remain running. Five concurrent live-model completions and long-term model reliability were not separately measured.

The broader desktop project still has separate work, including durable production-profile adoption, Windows reboot testing and full Office editing. Those items are outside this persistent-agent goal and remain with the platform owner.

Evidence paths, relative to the repository:

- Final independently recomputed receipt: `.supabase/desktop-workspace-agents/acceptance-04444-20261019/evidence.json`.
- Installed control observations: `.supabase/desktop-workspace-agents/acceptance-04444-20261019/installed-ui.json`.
- Successful live workflow and independent saved records: `.supabase/desktop-packaged-coordination/1792362020470/evidence.json` and `independent-agent-evidence.json` in the same directory.
- Controlled concurrency and restart: `.supabase/desktop-workspace-agents/runtime/controlled-1792284711034/evidence.json` and `restart/evidence.json`.
- Delivered release and installation: `.supabase/desktop-platform-release/candidate-04444/release-proof.json`, `qualification.json`, `full-packaged-acceptance.json`, `ordinary-installed.json` and `ordinary-upgrade-audit/after-0.44.44.json`.

Use [the agent guide](using-persistent-agents.md) to create and use a named agent.
