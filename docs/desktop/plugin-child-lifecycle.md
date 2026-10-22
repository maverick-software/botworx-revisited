# Native children, plugin revocation and cleanup

**Later qualification:** the interruption presentation is corrected and the first 0.44.4 installer is now verified in the separate child-presentation revision. See [the current installer checkpoint](child-chat-presentation-0.44.4.md). The earlier portable image and evidence below remain unchanged.

October 17, 2026. Controlled tests now exercise an actual Codex 0.163.0 child through the packaged Agentopia harness. The corrected 0.44.4 portable candidate is qualified and remains uninstalled. Its first installer is held for the interruption presentation follow-up described below. Installed Agentopia remains 0.43.7; no production API, migration or live inference was used in this checkpoint.

## Behavior demonstrated

The fixture starts an actual native parent with an assigned, reviewed plugin skill. A controlled response asks the real native spawn tool to create one independent child. The parent then finishes its turn. The child's reference request is explicitly held until the harness records parent completion; it subsequently discovers the private Agentopia reader, reads the reviewed package bytes, and saves that completed activity through the ordinary ToolService path.

The child's next stream remains open. Revoking its plugin interrupts that stream, closes its native runtime, preserves the child transcript and completed reference receipt, emits an interrupted background state and rejects its old live controls. Attempting to restore the child with the changed plugin configuration is rejected before another model request. Another account cannot read the saved child chat. The package's derived cache can then be removed.

This uses the actual native executable, spawn tool, child session, private MCP transport, gateway and host executor. Responses and authentication credentials in the fixture are controlled. No real model chose the tools, so actual ChatGPT task quality and live authorization remain separate acceptance gates. Four controlled provider requests cover the parent and child; paid inference usage is zero.

Evidence:

- `.supabase/desktop-plugin-children/candidate-0444/units/child-evidence.json` includes the explicit parent-before-reference ordering, cancellation, persisted activity, ownership check, blocked restore and cache removal.
- `.supabase/desktop-plugin-children/ui-1792292268790/evidence.json` covers five workflows in the delivered renderer: compact interrupted child inside the parent chat, saved reference activity in its dedicated chat, rejected follow-up with draft retention, separate parent/child drafts and reload restoration. This renderer is byte-identical in 0.44.4. Its bridge and saved draft store are controlled, using the real child's saved view.

The UI verifier's initial duplicate-status selector and reload URL reset were fixture errors. The corrected run passes; earlier failure records are retained.

## Cleanup defect and correction

An overlap test against the frozen 0.44.3 module reproduced a cleanup defect: package removal could return while an earlier skill setup was still writing. That setup later renamed its temporary copy into the derived cache, then correctly failed its revoked-assignment check. Access was blocked, but uninstall had left those derived files behind.

`NativePluginSkills` now tracks complete in-flight setup operations by account and package. Removal waits for matching operations to settle, including their final authority check, then verifies and removes their owned derived files. A second test holds another account's setup open and verifies that it neither blocks removal nor loses its files.

Only `desktop/src/native-plugin-skills.ts` changes in product source relative to 0.44.3. The before/after comparison is recorded under `.supabase/desktop-plugin-children/fix-1792292412584/`: the old module reproduces the failure, and the corrected cache and actual-child checks pass. Existing backend/renderer compilation and 32 focused checks also pass.

## Corrected portable artifact

Directory: `.supabase/desktop-plugin-children/candidate-0444/`.

Application archive SHA-256: `edfbfc9305d0330072e08d5e3b4067dcb32c8490523803dce765017678920a63`.

The prepared snapshot contains all 1,143 product source files. Of 1,014 compiled modules, only `native-plugin-skills.js` changes from 0.44.3. All 2,232 dependency files and 6,144 resources outside version metadata match the prior candidate, including the complete interface, native runtimes and all 55 database migrations. Metadata identifies version 0.44.4/schema55. The root development version remains 0.43.6 by the coordination agreement.

`units/evidence.json` records 84 passing checks with the archived module bytes and delivered native runtime. `built-ui/evidence.json` records five passing skill import/selection/provider/revocation workflows in the delivered interface. `qualification.json` combines the archive/resource comparisons and these results. No installer or production upgrade has been performed for this candidate.

## Remaining work

At the source checkpoint recorded here, the child screen repeated its interruption notice and labelled plugin revocation with “Agentopia stopped.” The later child-presentation revision corrects the saved reason, shows one neutral notice, collapses identifiers and pairs completed native calls with their saved receipts. Its exact UI and installer evidence are recorded in the current installer checkpoint linked above.

The revised interface and first 0.44.4 installer have since passed their controlled checks. The frozen 0.44.3 installer should not be promoted because it lacks the cleanup correction. Fresh human ChatGPT authorization remains required for actual model-driven skill/browser acceptance. Backup, installed workflows, restart recovery, clean-machine installation and Windows reboot checks remain open. [Full acceptance table](capability-acceptance-snapshot.md).
