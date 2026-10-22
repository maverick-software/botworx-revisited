# Independent saved-record acceptance for persistent agents

The completed October 19 review is recorded in [the installed 0.44.44 acceptance report](persistent-agent-acceptance-04444.md). The successful live run and its independent records already exist; its private backend has been removed. Use the pure assessor on those saved records for further review. The collection instructions below apply while a future owning test is still running; they are not instructions to recreate that backend or repeat its requests.

The packaged live test owns model dispatch and application lifecycle. The independent recorder reads its existing private backend and saved application archive; it never sends another model request, loads credentials, renews a connection, edits a database row or starts a runtime. Keep the private backend running until this recorder finishes.

Call the exported helper after all agent workflow requests are terminal and before the owning test removes its private backend:

```javascript
const {recordWorkspaceAgentAcceptance} = await import('./record-workspace-agent-acceptance.mjs');
const proof = await recordWorkspaceAgentAcceptance({db, call, evidence, out, release});
```

Here `db` is the existing private test Supabase client, `call` is the existing renderer bridge, `evidence` is the packaged workflow evidence, `out` is its output directory containing `program/resources/app.asar`, and `release` is the qualified release manifest. No environment variables or credentials are written into the result. The helper hashes the actual application archive and compares it with the release, then writes `independent-agent-evidence.json`. A missing invariant saves a failed proof and throws. Read that evidence before deciding whether any targeted follow-up is needed; never repeat a completed or uncertain provider request to regenerate proof.

The recorder verifies these outcomes from actual saved records:

- The earlier Starter response and later Mira response remain in the same chat under their original agent identities. The leading @ prompt selects Mira and the response uses the saved role, standard procedure and skill revision.
- A completed memory-save receipt identifies the agent-authored note, project A, and exact source message. A different native chat of Mira belongs to project B and recalls the note without the marker in its prompt. The answer must include the exact source-message citation, rather than only the conversation identifier.
- The parent invokes the actual saved Inspector instance. The child retains its definition revision and restricted policy and performs the permitted assignment-list operation. A separate completed parent read must identify that same completed instance and contain its saved specialist result. Echoing a specialist code alone does not pass.
- Both configured connections remain present, ChatGPT stays preferred, and all five examined requests use the intended ChatGPT model and native harness. The fixture must report that it did not copy a usable refresh credential. Global network guards and the owning workflow's transport evidence establish the broader absence of renewal or OpenRouter requests.

Run the recorder's synthetic checks with `node --test scripts/desktop/test-workspace-agent-acceptance-recorder.mjs`. They deliberately remove source links, change projects and identities, remove or redirect reads, broaden specialist permissions, and substitute an application archive. These checks establish that incomplete proof is rejected; they do not establish live model performance.

The existing controlled concurrency, isolation, memory editing, cancellation and fresh-process checks remain separately documented in `.supabase/desktop-workspace-agents/qualification-checkpoint.json`. Compare delivered module hashes before reusing that evidence. Installed navigation and data preservation still require their own installed-app evidence before the overall goal can be marked complete.
