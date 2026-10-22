# Installed reference bundle inspection

The registered and running reference application is OpenAI.Codex 26.1013.4894.0. Eight JavaScript/CSS assets were read from its installed archive and parsed as data. The archive and inspected assets are identified by hashes in `F:/Agentopia/.supabase/desktop-reference-bundle/1792539633914/evidence.json`.

This provides stronger component-level evidence than a design assumption. It does not establish which optional routes or feature flags are visible in the current window. The Windows control connection still fails before initialization, so fresh reference screenshots and interaction checks remain outstanding. Reference code was not executed or copied into Agentopia.

## Confirmed component differences

| Area | Reference bundle | Frozen Agentopia 0.44.49 | Consequence |
|---|---|---|---|
| Completion alerts | Disabled, unfocused-only and always modes | Enabled responses notify only in the background; responses can be disabled | The always mode is missing |
| Waiting for input | Separate permission and question alert controls | Response/task switches; no separate permission/question settings | These categories require an implementation and actual event-delivery checks |
| Chat cleanup | Last-updated and archived/all filters, multiple selection, selected chat/subagent counts and one final review | Search/category tabs, single-chat archive/restore/delete review | Bulk dated cleanup remains a functional parity gap |
| Cleanup results | Separate deleted, changed/skipped and incomplete counts | One chat is deleted or reports an error | Bulk cleanup needs truthful partial-result handling and state rechecks |
| Typography | Scoped variables differ between surfaces and window types | Standard messages/composer use the same 14-pixel variable; large text uses 16 pixels | Root declarations alone cannot justify changing all font sizes; compare the actual target surface |

The shipped Storage and Notifications work remains useful and qualified. Its tests prove the implemented subset, including generated cleanup and backup preservation. They do not prove full parity with these richer reference controls. The next source work should address the missing notification categories/modes and reviewed bulk chat cleanup while preserving ownership, activity, draft, recovery and changed-item safeguards.

Independent subagent/native-profile deletion is currently absent in Agentopia. This inspection does not establish that the reference requires those independent deletion actions, so they remain documented limitations rather than new completion gates inferred from this inspection.

## Installation handoff

The pending 0.44.49 artifact is frozen and unchanged by this audit. After a generated Electron test established cooperative local process shutdown for normal, delayed and refused close cases, the ordinary 0.44.48 process completed normal closure using only the documented local PID command. It used no force, tree or remote flags. This allows the already-authorized maintenance to proceed despite the unavailable Windows UI controller.

Qualification: `F:/Agentopia/.supabase/desktop-cooperative-shutdown/1792539767204/evidence.json`.
Ordinary closure: `F:/Agentopia/.supabase/desktop-cooperative-shutdown/1792539833302-ordinary48/evidence.json`.
Microsoft command documentation: <https://learn.microsoft.com/windows-server/administration/windows-commands/taskkill>.
