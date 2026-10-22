# Current report status and independent stopping — 0.44.57

The accepted 0.44.57 application can report its own current assignment status while processing a specialist result. Its saved assignment controls can stop one report while another report continues. This additional acceptance uses the exact installed application archive in an isolated generated account; production remained open in its original process.

The test started two conversations using one saved coordinator identity. Each coordinator invoked a permitted saved specialist, finished its initial response, and received the specialist's automatic continuation. The continuations ran concurrently in separate actual Codex threads. The same retained PostgreSQL runtime used real account, request, invocation, message and native-turn records. External model responses were controlled and held so status and cancellation could be observed reliably; external network calls were blocked. This establishes the application behavior under those conditions, without measuring live model judgment or long unattended reliability.

Each continuation called the actual `list_agent_instances` tool. Its tool receipt reported its own assignment as working even though the initial request was completed. The authenticated assignments list and saved-work detail agreed. This verifies that current report processing is included in the status presented to agents and account settings.

The test then stopped the first saved assignment through its authenticated control. That report was recorded as cancelled, and its initial completed result remained intact. The second report stayed active in its own thread. Its sidebar spinner and unsent draft remained visible, as confirmed by the inspected packaged screenshot. Releasing the second controlled reply completed its report once. Its saved continuation could be read, its assignment returned to completed, its spinner stopped, and the draft remained unchanged.

Three workflow checks passed, using ten controlled model responses and zero live provider requests. The test application closed normally, its separate runtime stopped, and the original production process and installed archive were verified unchanged. This is additional execution evidence for the existing release; no product code, database migration or new installation was required.

The initial verifier expected the first stopped report to be interrupted. The actual explicit Stop correctly stored cancelled. That failed run and its records remain available. The corrected run inspected the earlier requests and terminal reports before starting fresh request IDs; none of the earlier requests was reused. No product change was made to satisfy the expectation.

Acceptance: `F:/Agentopia/.supabase/desktop-agent-report-release57/1792613505169/agent-report-status-accepted.json`.

Workflow: `F:/Agentopia/.supabase/desktop-agent-report-release57/1792613505169/status-audit-1792615309790/evidence.json`.

Inspected generated-account capture: `F:/Agentopia/.supabase/desktop-agent-report-release57/1792613505169/status-audit-1792615309790/one-report-stopped-other-working.png`.

The test program copies are disposable; their evidence, the retained private test profile/runtime and the current qualified program remain separate. This acceptance does not establish fresh ChatGPT Desktop visual parity, real Composio sign-in, live image generation, hardware input, Windows reboot or extended live workloads. Those requirements remain in [the full evidence map](parity-requirements57.md).
