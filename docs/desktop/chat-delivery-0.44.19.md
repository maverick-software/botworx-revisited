# Chat coordination and goal queue — 0.44.19 candidate

October 18, 2026. This candidate is packaged and separately qualified. It is not installed, and there is no 0.44.19 Windows installer yet. The ordinary installation remains 0.44.17/schema 59.

## What is packaged

The candidate contains authorized cross-chat delivery, receiving Codex execution, sender links, chat-pair revocation and migrations 61–63. Native goals yield their automatic continuation to queued messages; the broker resumes only after successful saved outcomes. Goal cleanup preserves independently owned work. The composer has one goal strip and a readable active-agent chip.

The frozen application archive is:

`bf2db41c003dc684a2e0097772556e0e3e69cbdef7851835fc0a7f7fcd9867dd`

Candidate resources and source are under `.supabase/desktop-chat-delivery/candidate-04419`. `package-proof.json` records the frozen source and archive comparison. Only the planned modules, frontend, version and migrations differ from the frozen 0.44.18 baseline; pinned runtime resources remain unchanged.

## Evidence established

`qualification-1792351887213/evidence.json` and candidate `qualification.json` record 143 archived backend checks and fourteen delivered-renderer workflows. These include the actual bundled Codex process with controlled model responses, routing/permission checks, native goals, queues, steering, chat coordination, reading flow and the full goal composer. No live provider request was made. Two old test fixtures were updated to represent actual live-turn ownership; the original failures and revised test hashes are retained. Application guards and archive bytes were unchanged.

The first real-executable rehearsal is retained at `.supabase/desktop-packaged-coordination/1792351914223/evidence.json`. It restored a fresh database snapshot into a private runtime, applied schema 63 and compared all 20,327 original rows across 148 tables. All original row values remained present and 190 encrypted vault records were readable. The actual packaged entry point, sign-in UI and second-instance behavior passed without developer tools on PATH.

## Incomplete workflow and diagnosis

The first full sender/receiver workflow timed out before its inline authorization appeared. The application closed normally and its test runtime stopped. That run does not establish successful coordination, goal/queue interleaving or cold recovery.

The private profile chosen by that test produces a 211-character compact native home. The exact archived `nativeHome` function rejects it because its maximum is 210. An independent archived-function check reproduces that rejection and successfully creates a 201-character home with a shorter profile name. Evidence: `native-home-path-audit.json` in the failed run. This establishes a test setup defect; the original saved request outcome still needs inspection before attributing the entire timeout to it.

Read-only attempts to reopen the stopped test runtime then failed with `Wsl/Service/CreateInstance/HCS_E_CONNECTION_TIMEOUT`. The ordinary production runtime still responded. The revised test uses a shorter profile, checks the physical path length before importing WSL and captures broker preparation phases, controlled-network errors, the saved source request and rendered failure state. The failed evidence is preserved. Neither a new isolated fixture nor a test timeout authorizes replaying an uncertain paid request.

Microsoft's [WSL troubleshooting guide](https://learn.microsoft.com/en-us/windows/wsl/troubleshooting-guide) distinguishes Linux/application failures from WSL startup failures and describes collecting WSL diagnostics. The error alone does not identify its underlying cause. Avoid global WSL shutdown or service changes while another application's work could be affected.

The corrected rehearsal at `.supabase/desktop-packaged-coordination/1792352322196/evidence.json` stops during its fresh WSL import: the command reaches its ten-minute deadline before the app launches. No model request or target chat dispatch can occur in that phase. The partial disk and registration are retained for inspection; no further runtime is imported. A later probe of the ordinary app's local authentication endpoint returns HTTP200 while WSL command management is hanging. That health response establishes an available authentication service, not a successful cold start or complete application workflow.

## Remaining release gates

Complete the real packaged sender → inline authorization → receiving native turn → attributed saved response workflow, then the goal → queued human response → resumed goal case and cold outbox recovery. Audit original rows and encrypted records again afterward. Exercise current-image live ChatGPT separately from controlled model responses. Build and qualify the installer only after the required candidate checks pass; preserve the ordinary profile, database and provider preferences through any authorized upgrade.

The broader acceptance checklist remains open, including changed queued settings, permission revocation, parallel children, usable artifacts, schedules, skills, browser/computer workflows and clean-machine operation. The candidate's component passes do not establish full desktop parity.
