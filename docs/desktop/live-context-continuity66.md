# Real context summarization and agent continuity in installed 0.44.65

The current 0.44.65 package passed a bounded real ChatGPT summarization check. The actual native Codex runtime generated a summary, saved its completed compaction event in PostgreSQL, continued the same thread with the correct saved identity and latest instruction, and reopened normally without replaying inference. The production app and its settings were left unchanged. The number 66 identifies this acceptance series; it is not a new installed version.

## What was tested and why

A new QA agent received a generated task with a unique task identifier, seal, recipient, quantities and prices, followed by 1,000 unrelated random reference records. Its first reply acknowledged readiness without repeating those task facts. The native runtime reported 50,524 actual input tokens. A second instruction changed the output color to red and supplied a new unique constraint. The answer preserved the original facts and calculated 37 × 4.20 = 155.40.

This used the actual packaged Codex 0.163.0 harness, connected ChatGPT model gpt-6.1-sol and actual QA PostgreSQL. Model replies and usage were real. The agent had a saved role and procedure, no enabled tools or delegation, and no memory-writing permission. Existing saved agent profiles, memories and five completed acceptance requests were compared before and after and stayed unchanged.

The QA runtime alone used a lower compaction threshold so that a bounded workload could exercise summarization. The first experiment set 16,000 tokens with the native `body_after_prefix` scope. The runtime accepted that setting but did not compact after the first two completed requests. That experiment remains recorded as a failed compaction acceptance; its successful model requests were preserved and never repeated.

One new continuation changed only the QA threshold scope to `total`. This produced an actual summary request and an actual subsequent answer on the same native thread. The summary was inspected in the native rollout history, independently of the answer: its 1,152 characters contain the saved role, task identifier, seal, recipient, exact total, red-output instruction and latest unique constraint. The summary omits the unrelated random reference records. The same summary is present in the native replacement history, and the completed compaction event is saved in PostgreSQL.

There were four actual ChatGPT responses across three submitted user requests: the readiness acknowledgment, the initial answer, the summary and the answer after summarization. There were no OpenRouter calls or external tool actions. Both normal QA reopening checks made zero inference requests before an explicitly requested continuation; the final reopening retained the completed result without another request.

## What this establishes and what remains open

This demonstrates that a real model summary preserves these task facts and the latest instruction, that the agent continues with its saved identity on the same native thread, and that completed work survives normal reopening without replay. It strengthens the earlier generated-response compaction fixture with actual summary content and actual model usage.

Codex also retained the original user reference corpus in its replacement history. The incoming request after compaction therefore remained large. This check does not establish recall after original tool results or source material have been removed, successful repeated compaction across hours of work, or behavior at the production default context limit. Those remain explicit requirements. The different token scopes were observed directly; this check does not infer the runtime's internal body-token count or a production defect from their difference.

Fresh ordinary-app/reference screenshots remain unavailable: the supported Windows inspection entry point again failed before JavaScript initialized with `failed to write kernel assets: The system cannot find the path specified. (os error 3)`. No native window was selected or screenshot captured. This acceptance uses isolated product execution and saved native/database records.

## Data, credentials and image preference

The ordinary 0.44.65 process stayed running. Its installed archive still matches the accepted release, and its encrypted account settings remained byte-for-byte unchanged. Only access credentials with no refresh token were temporarily leased into the encrypted QA store; the original synthetic QA credentials were restored after each test, and the QA runtime stopped normally.

The user's instruction to keep image generation disabled was checked against the current protected account metadata. Image generation remains disabled, the existing OpenRouter credential remains available, and the chat choice is unchanged. Enabling image generation later remains a separate account setting. The metadata inspection made no provider requests or account-setting changes.

Evidence:

- Original two-request experiment: `F:/Agentopia/.supabase/desktop-live-continuity66/1792646990256/evidence.json`.
- Successful total-scope continuation and cold inspection: `F:/Agentopia/.supabase/desktop-live-continuity66/1792646990256/total-scope-1792647184952/evidence.json`.
- Independent native-summary review, its hash and explicit retained-source limitation: `F:/Agentopia/.supabase/desktop-live-continuity66/1792646990256/total-scope-1792647184952/summary-review.json`.
- Fresh account/image metadata: `F:/Agentopia/.supabase/desktop-live-readiness64/1792647295947/evidence.json`.

The overall parity goal remains active and incomplete. The next context test should verify a real continuation after original tool output has been removed from the active context, then address repeated/default-window and longer unattended behavior without replaying these completed requests.
