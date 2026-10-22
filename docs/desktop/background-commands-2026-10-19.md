# Background command lifetime and chat controls

## Cause of the saved preview failure

The saved Slonski Landscaping turn started an actual native Node preview on port 4176 and verified an HTTP 200 response. Its HTML lived in that process's memory. The next user request, “Didn't load,” arrived 96 seconds after the parent response ended and found the port unavailable.

An isolated reproduction uses the frozen 29 CodexHarness and its actual bundled Codex 0.163.0 executable. A generated local server returns a unique nonce, the native terminal registry lists the process, and the parent response finishes. The harness nevertheless reports idle. Its unchanged 60-second disposal timer closes Codex after 60,155 milliseconds, and the previously working HTTP endpoint becomes unavailable. This establishes the worker-lifetime failure independently of the historical page's content or the external model.

Original evidence: `.supabase/desktop-preview-investigation/1792372562903/saved-preview-facts.json` and `.supabase/desktop-background-commands/1792372794327/evidence.json`. The original requests, command records and failed evidence remain preserved. No historical website request was replayed.

## Source correction

Live native commands now keep their worker occupied after the model response ends. Agentopia checks the actual Codex terminal registry every five seconds while otherwise idle, releases ownership after an observed exit, and resumes the ordinary 60-second worker cleanup. An uncertain registry read retains the command rather than closing its worker. Busy/capacity accounting, file-review exclusion and backup checks include background commands.

Late command output and completion use the full saved thread/turn/item identity. They update the original transcript even when a later response is using that worker. Main chats, dedicated child chats and parent reports expose compact, collapsible background-command rows with individual Stop controls.

Stop validates the signed-in account, saved request, thread, item and opaque native process identifier, then verifies that exact item/process pair in Codex's live registry before calling its native termination operation. It does not issue a model request or treat a native identifier as a Windows process ID. Request-level permission revocation also stops owned background commands while preserving independently owned work where possible.

Normal session closure saves stopped command state. Restart recovery marks an unavailable previous session as “Session ended,” preserves its output, and does not relaunch its commands. This does not assert that an arbitrary externally detached process has stopped. Actual native completion/exit codes remain available; a deliberate stop is labelled “Stopped” even when native termination reports a failed exit.

These are source changes only. Ordinary 0.44.24/schema67 and the frozen 29 installer are unchanged. No database migration is needed for the optional command-lifecycle fields in saved native JSON.

## Verification

The final source passes 84 backend checks, including command ownership and replacement-process refusal, late event routing, child scoping, permission revocation, paginated restart recovery, native goals, real child resumption, steering and both provider adapters. Backend and renderer type checks pass. Evidence: `.supabase/desktop-background-commands/check-1792373535668/evidence.json`.

Six real-renderer workflows exercise the actual main-turn and dedicated-child components through a controlled bridge: collapsed rows, scoped Stop parameters, pending-action handling, a rejected child stop, independent success, recovered history, and a narrow light layout. Evidence: `.supabase/desktop-background-commands/ui-1792373561580/evidence.json`.

The first actual native two-server run passes the former 60-second boundary, independently stops one server, observes the other's natural exit and observes both workers' subsequent idle disposal. Evidence: `.supabase/desktop-background-commands/1792373294393/evidence.json`. The final source-hash-bound run passes seven native checks and also stops an earlier command during a later real turn on the same worker. That later response stays active, the late completion stays in the old transcript, and both workers finish normal idle disposal. Five controlled model responses are used across the three real native turns. Evidence: `.supabase/desktop-background-commands/1792373651922/evidence.json`.

All these checks use generated files, an isolated profile/in-memory database and controlled external model responses. They make zero real ChatGPT/OpenRouter inference requests and do not access production account data. They prove native runtime behavior; they do not yet prove a delivered replacement package or ordinary installed acceptance.

## Remaining work

The replacement 0.44.30 candidate has subsequently passed frozen-archive qualification, actual Windows restored-data controls, cold recovery and installer verification. Fresh production backups are verified; ordinary installation and acceptance await the existing action-time confirmation. [Release evidence](platform-release-0.44.30.md).

The historical Slonski source has also been recovered into a self-contained user-workspace HTML file from its saved native rollout. Seven isolated renderer workflows verify layout, planner and actual downloads without a new model request. This specific page now survives application shutdown as a file. [Artifact and recovery evidence](saved-preview-recovery-2026-10-19.md). Broader desktop parity remains active.
