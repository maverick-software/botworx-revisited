# Plugin, skills, credentials, and settings consolidation — execution record

Started October 25, 2026. Approved design: [consolidation plan](2026-10-24-plugin-skills-settings-consolidation.md).

## Baseline verified

- Starting source commit: `56a1fa7`; approved plan committed as `d733149`.
- Source and installed application both start at `0.44.78`. Source comparison against the verified installed release found no differing desktop source files.
- Fresh consistent database recovery: `.supabase/desktop-production-logical/1792926784210`. Both accounts and all five recovery file hashes verified. This is the database checkpoint; the complete protected profile/workspace backup will be captured and verified before installation.
- Read-only agent health audit: `.supabase/desktop-agent-health75/1792926860276`. No problems or observations; no running requests/assignments. Retained data includes 123 conversations, 426 messages, four agents, six projects, and two agent memories.
- Public binding/file-hash inventory: `.supabase/desktop-consolidation79/baseline-inventory.json`. There are 24 plugin records, 228 packaged skills in 16 skill-only packages, 39 plugin grants, four MCP connections, two retained legacy credentials, two system key slots, and no current scheduled tasks. No credential values were returned.
- `npm run desktop:typecheck` passed before implementation.
- Existing research files remain untouched. All new build/test/backup outputs use F:.

## Work allocation and review

Each workstream uses an isolated Git worktree under `F:\Agentopia-Consolidation` and the source baseline above. No implementation workstream may mutate production data, install, enable image generation, or make live provider requests. The primary agent reviews specification compliance and code quality before merging and performs integrated release verification.

| Stage | Status | Evidence / remaining work |
| --- | --- | --- |
| Preservation baseline | Verified | Database recovery, read-only health/inventory, baseline typecheck above. |
| Navigation/settings and agent-editor consolidation | In progress | `codex/consolidation-ui` worktree. |
| Independent skill storage, migration, editing, and execution compatibility | In progress | `codex/consolidation-skills` worktree. |
| Plugin ownership/enforcement and unified credential operations | In progress | `codex/consolidation-runtime` worktree. |
| Integrated source and database qualification | Pending | Combine verified slices; test real migration and preserved effective behavior. |
| Package and isolated upgrade/recovery qualification | Pending | Use existing verified 0.44.78 resources and release machinery; record intentional source/schema differences. |
| Complete protected backup, installation, and installed verification | Pending | Normal app closure/reopening, recoverable update, credential/data comparison, actual installed workflows. |

## Compatibility decisions

The existing creation-preview SQL directly validates plugin package identities. Independent skill data must preserve this enforcement while its execution binding evolves. If a private tool-less execution envelope is required as a transitional adapter, it must have no independent plugin authority, remain excluded from all plugin APIs/catalogs, be controlled exclusively by the authoritative skill transaction, and be covered by forgery/disable/revocation tests. Existing skill-only source records remain recovery and historical-selection inputs. New user-facing skills remain skills.

Old saved skill selections retain the original reviewed bytes. Editing a current skill creates a new revision and does not rewrite historical messages or immutable scheduled snapshots.

## Completion standard

The task remains open until the authorized stages are implemented, required verification passes, the update is installed, and the actual installed application has been checked. Any unsupported legacy service must retain its data and be accurately identified; a provider metadata row alone is not a working plugin.
