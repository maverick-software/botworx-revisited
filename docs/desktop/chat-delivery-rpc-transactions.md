# Receiving-chat RPC transaction correction

The first complete packaged 0.44.23 test restored the original database successfully and completed its sending turn. Its receiving turn was cancelled before provider inference with `cannot execute SELECT FOR SHARE in a read-only transaction`.

The actual receiving-request validation was reproduced through native PostgREST: HTTP POST returned 405, while the same SQL invocation in a writable PostgreSQL session succeeded. The call graph identifies three STABLE functions that transitively call the profile manager, which takes row locks and can record a changed agent definition. PostgREST executes STABLE RPCs in read-only transactions even for POST. See the [official access-mode documentation](https://postgrest.org/en/stable/references/transactions.html).

Migration 0067 changes exactly those three function volatility declarations to VOLATILE, so their POST transactions can take the existing locks and update profiles when needed. Historical migration checksums, function bodies, ownership/scope/revocation checks, security-definer mode and grants remain unchanged. The functions remain restricted to the trusted service role.

The regression reproduced all three failing HTTP calls before the change, then verified successful POST and continued anonymous denial after it. Every other public function was unchanged. The original cancelled request stayed cancelled; no inference was replayed. A second regression now executes the broad durable-outbox suite against a real private PostgREST process rather than routing every RPC straight to SQL. Its 24 groups pass, including concurrency, revocation, native/steering descendants and scoped receiving requests. The temporary database was removed and production inventory was unchanged.

The original 0.44.23 candidate and failed package checkpoint are retained. The next image must contain migration 0067 and repeat complete packaged acceptance before installation. The installed 0.44.17/schema59 application is unchanged.

Evidence: `.supabase/desktop-packaged-coordination/1792360611512/rpc-volatility-diagnosis.json`, `rpc-modes-before.json`, `rpc-modes-apply-and-check.json`, and `.supabase/desktop-chat-delivery/storage-1792360915582/evidence.json`.

## Follow-up packaged verification

The corrected 0.44.24 image restored the database and completed the actual sending/receiving Codex workflow. A later goal test initially released its controlled in-flight response immediately after clicking Pause, before the asynchronous pause acknowledgement. That allowed an additional automatic native turn and invalidated the test's two-turn expectation. The driver now records request/acknowledgement/release times and waits for the acknowledgement before releasing the held response. It retains the exact two-turn, unlimited allowance, accumulated usage and queue-order assertions. This correction changes the test driver, not the shipped application. The repeated packaged goal/queue workflow passes.

The installed ChatGPT model picker also renewed the ordinary account normally. Read-only physical inspections before and after show the same registered client and subject, rotated access/refresh credentials, seven cached models, and the preserved preference for ChatGPT. No inference was sent during that renewal. Inspection IDs: `1792361038487` and `1792361100375`.
