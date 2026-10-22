# Private 0.44.7 installer — goal limits and token budgets

The new Windows installer packages the [goal controls](goal-limits.md), additive migration 0057 and the preceding native child correction. It is built and verified with controlled responses. It remains uninstalled; production is still Agentopia 0.43.7/schema45.

## Delivered behavior

Add to chat → Goal keeps the existing three-response default and adds an explicit Keep working until complete option, optional finite limits up to 1,000 turns and a native Codex token budget. Saved goals keep their limits. Paused goals expose settings that save or save and resume while retaining their objective and recorded usage. Active work must stop before limits can change.

The same native Codex lifecycle works with ChatGPT and OpenRouter. A revised budget can reactivate a budget-limited goal without resetting recorded usage. Removing a budget retains usage. A spent allowance refuses new inference until it is revised. A separately created goal has a distinct allowance even when its text matches an earlier goal. Plan mode still produces one planning response.

The token allowance uses Codex’s active-goal accounting. An in-flight response may finish beyond the allowance, and Codex’s goal counter can differ from provider response usage. The setting does not estimate a currency charge; provider charges and account limits still apply.

## Verification on the delivered image

- 124 checks use modules extracted from this exact application archive, its dependencies and bundled native Codex executable. Controlled responses exercise twelve native turns, native completion, exhausted and revised budgets, provider routes, ownership, plugins, skills, permissions, child controls and defaults.
- Eleven workflows use the delivered minified interface. They cover native continuation and exact-turn steering, Pause versus Stop, completion, saved history and drafts, creating an unlimited goal, changing its budget, explicit resume through the selected ChatGPT connection, disabled running edits, rejected-save recovery and narrow layout.
- Five delivered skill workflows and five dedicated child-chat workflows pass. Skill discovery uses the actual packaged backend and native metadata, with zero model or credential requests. Three child presentation helper cases also pass.
- The first goal UI run passed all eleven workflows, but its screenshots caught the dialog fade-in. A second run waits for the finite animation before capture and again passes all eleven checks. Its computed opacity is 1 with an opaque RGB background. Settled dark and narrow captures were inspected; no product styling change was needed.
- Six installer checks verify setup’s complete embedded application package, all 6,148 delivered resource paths, archive integrity, the exact tested application archive, migration 0057 and schema57 metadata.

These checks use controlled identities and model responses. No live provider request or paid inference was used. Real model behavior, ordinary installed workflows and Windows reboot/clean-machine acceptance remain open.

## Exact artifact

- Version: 0.44.7, Windows x64.
- Installer: .supabase/desktop-goal-limits/candidate-0447/staging/out/make/squirrel.windows/x64/AgentopiaSetup.exe
- Installer size: 1502601728 bytes.
- Installer SHA-256: a1bfda96101ef7941d44b54f1a369c1564cb286f8dd512bcdfc03289fdd202b5
- Application archive SHA-256: 9e29038367080c4298253ad0decb0cc2a84010687c0f313fcb3599c674a5afb4
- Full package SHA-256: 1d9ff24b1a159b30398c95a7fe9529cae574473d974b6019037ec6a7273a0b9e
- Delivered schema: 57 migrations.

Relative to the frozen 0.44.6 archive, broker.js and codex-harness.js change and goal-settings.js is added. The other 1,012 compiled modules and all 2,232 dependency files remain byte-identical. The interface is rebuilt from the qualified source. All delivered styles, previous migrations and runtime resources are unchanged; 6,133 external resources outside the interface, new migration and version metadata remain identical. Installer helper binaries were restored and their original hashes verified after packaging.

Evidence is in .supabase/desktop-goal-limits/candidate-0447: preparation.json, package-proof.json, units/evidence.json, units/unlimited-goal.json, units/token-budget.json, goal-ui/evidence.json, goal-ui-settled/evidence.json, built-ui/evidence.json, child-ui/evidence.json, qualification.json, installer-proof.json, installer-verification/evidence.json, final-observation.json and release-proof.json.

## Recovery evidence and remaining acceptance

Seven subsequent [actual packaged startup checks](packaged-startup-0.44.7.md) pass on this exact image: the real executable restores the snapshot, applies schema57, reaches sign-in, handles a second launch, closes normally and reopens after backend shutdown. Both audits preserve all 20,134 compared rows and 190 readable vault records. The test uses a separate profile and ports with a local-only main-process fetch guard; no login or inference is attempted. Its owned runtime is removed, and production remains on 0.43.7/schema45. Ordinary installed and signed-in workflows retain their separate acceptance gates.

The new migration already passes a snapshot-based schema45-to-57 upgrade and recovery check, preserving 20,134 original rows across 141 tables. Earlier [fresh-runtime recovery](fresh-runtime-recovery-0.44.6.md) retains its schema56 scope: the runtime code and binaries remain unchanged, and that test demonstrated encryption-root restoration, 190 readable vault records and a full backend stop/restart. It does not substitute for current-image installed desktop and native-session recovery.

The latest read-only connection inspection still finds an expired ChatGPT access token. No renewal was retried. Fresh user authorization is needed before current-image live goal, skill and browser acceptance. Production remains at 2 accounts, 101 conversations, 338 messages and 45 applied desktop migrations. Its read-only checkpoint and the retained original WSL distribution’s stopped state are preserved.

Actual promotion still requires the live checks, a fresh backup of the complete normally closed profile, coordinated installer upgrade and migration, ordinary installed chat/browser/tool workflows, native-session restart recovery, a full Windows reboot and clean-machine acceptance. Broader desktop parity remains unfinished.
