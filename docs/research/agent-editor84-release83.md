# Installed agent editor update — 0.44.83

Delivered October 26, 2026 from reviewed source `3ab38924b69a8ee0b261b2d8d36ee83392e61996`.

The Create and Edit Agent pages now use an avatar-triggered profile modal, a separate conversation starter modal with AI generation and review, compact Apps and Skills rows with searchable two-pane pickers, and one Instructions editor with a collapsed icon toolbar. Model and access settings remain available through compact controls. Existing defaults and capability assignments are retained.

Old Role, Procedure, Guardrails and embedded skill text are folded into editable Instructions without truncation. Opening the editor does not rewrite saved agents. Explicit Save commits the unified text and enforced access settings in one transaction, with revision and ownership checks. Earlier definitions remain in history. Reusable account skills stay in their own catalog and assignments.

The Instructions limit is 500,000 characters so the largest previously valid combination of legacy fields remains editable. Message limits stay unchanged. Migration 0089 adds the atomic save and forward instruction validators; it does not rewrite existing agent rows or modify historical migrations.

Verification completed:

- Backend and interface type checks; 58 instruction, preview, builder and draft tests.
- 11 plugin runtime and credential regression checks, including the accepted Computer plugin manifest.
- 13 combined editor and 16 resource picker checks in Electron, with light/dark layouts, keyboard controls, retained drafts, failed/stale writes, large skill catalogs, generation cancellation and stale-result rejection.
- Actual isolated PostgreSQL checks for atomic saving, original history, long text, ownership, invalid access policies and stale revisions. All fixture changes rolled back.
- Actual packaged 82→83 upgrade and second startup, automatic recovery verification, and exact installer payload checks.
- Normal production close, recoverable encrypted profile and workspace backup, rollback copy, one updater invocation, and normal reopening.
- Final read-only comparison after native UI inspection: all 3,831 original rows across 144 tables preserved, two accounts, 123 chats, 430 messages, 191 readable Vault records and four encryption-root bindings.
- All 112 protected setting records compared. Two configured AI connections remained identical and image generation stayed disabled. Local account and Composio session renewals passed the existing strict verification policy.

Native inspection confirmed the installed profile, Apps, Skills and starter modals and expandable icon toolbar. The retained creation draft restored with seven selected apps; the skill picker showed 228 reusable skills. No draft content, assignments, permissions or saved agents were changed during inspection. AI generation was verified using controlled model replies through the actual preview path; no paid model calls were made.

Completion evidence: `F:/Agentopia/.supabase/desktop-release83/1793024450525/installation-1793025287580/completion.json`.

The prior compact Computer use design, native helper 1.0.4, Supabase 2.121.0, recovery format 18, runtime files and dependencies remain pinned. Existing legacy storage remains available for compatibility and recovery.
