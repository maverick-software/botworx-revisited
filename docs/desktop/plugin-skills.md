# Portable plugin skills through Codex

Subsequent source checkpoint: [reviewed plugin updates](plugin-updates.md) preserve assignment settings, replace skill bytes through the actual native harness, interrupt earlier skill sessions and remove their derived cache. The schema58 source passes controlled checks and remains uninstalled.

October 17, 2026. This is a source checkpoint after the frozen 0.44.2 installer. At this source checkpoint the feature had not been packaged or installed. It has since been packaged in the separate, uninstalled [0.44.3 candidate](plugin-skills-0.44.3.md). The ordinary application remains 0.43.7 with schema 45.

## What the user can do

Import a portable plugin folder, ZIP, or JSON envelope in Plugins. A package may contain remote MCP connections, skills, or both. Each skill retains its `SKILL.md`, references, helper scripts and assets under `skills/<folder>/`. The review shows native Codex skill names and descriptions, expandable instructions, every retained resource path and the digest of the complete package. Installing does not execute helpers.

Assign an installed package to an active agent. In that agent's chat, choose Add → Skills and select its procedure. The same selection remains valid when changing between ChatGPT and OpenRouter. The renderer uses a package-scoped identifier rather than exposing the private cache path. Refreshing after revocation shows an explicit removable unavailable selection and preserves the unsent draft.

Standard users' agents can list and read the reviewed package's reference files through `list_plugin_files` and `read_plugin_file`. These tools return bounded text pages or supported images from the stored package bytes. They require the current owner, active agent, enabled assignment and exact package digest. They do not read arbitrary local paths. Chat only disables these file tools. Native helper execution continues to require an available command tool and the existing account/chat permissions.

## Public format and actual runtime

The pinned Agent Plugins manifest schema remains unchanged. The `files` map is Agentopia's storage envelope for the exact reviewed bytes; it is not an extension added to the public manifest. The portable format automatically discovers `skills/` and root `mcp.json`, and keeps a skill's scripts, references and assets with its instructions. [Official plugin package documentation](https://developers.openai.com/plugins/deploy/submission#package-identity-and-components).

The implementation materializes verified, account-owned package copies and supplies their skill directories through the real Codex 0.163.0 `skills/extraRoots/set` and `skills/list` methods. Explicit selection becomes Codex's native skill input. The upstream execution loop and the two existing provider adapters remain in use. The public app-server documentation marks native plugin install/read/list methods as under development, so this feature uses the documented skill interfaces and Agentopia's existing reviewed package registry. [Official app-server API](https://learn.chatgpt.com/docs/app-server#api-overview).

Every skill byte contributes to the package digest and native conversation scope. Discovery does not request a provider model catalog or inference credential. Cache contents, ownership and assignments are rechecked before requests and host tool use. Disabling, unassigning or removing a package closes only affected native workers, including their report/child contexts. Removing a package deletes only its verified derived cache. Database storage uses existing plugin JSON and assignment tables; no migration is required.

## Verification and what it establishes

`npm run desktop:test:plugin-skills` compiles the backend and renderer into an isolated directory, then runs 32 focused checks. They include actual Codex protocol discovery, malformed instructions, exact resource retention, archive/folder limits, tampering and revocation. Actual native turns under controlled ChatGPT and OpenRouter responses contain the selected skill's instructions. A real native helper reads its bundled reference and creates a generated receipt under Full access. A standard account receives no native command tool. Another actual standard-user Codex turn discovers the read-only host reader, reads the exact reviewed reference through private MCP and saves the completed activity in the chat's ordinary tool path.

These are controlled responses, with zero live inference. They establish the runtime, transport, permissions and persistence paths exercised by the fixture. They do not establish that a real model will choose the appropriate skill or perform a user's task correctly.

Evidence directories under `.supabase/desktop-plugin-skills/`:

| Evidence | Scope and result |
| --- | --- |
| `check-1792291135002/evidence.json` | Backend/renderer compilation and 32 focused checks pass. |
| `storage-1792291164472/evidence.json` | Seven checks through the already-running Supabase API and actual Broker/Codex discovery: exact bytes, skill-only assignment, ownership, both connection selections, read-only references, retired-agent rejection, revocation and removal. Generated records removed; inventory remains 2 accounts / 101 conversations / 338 messages. No model/token lookup, migration or service start. |
| `ui-1792291163860/evidence.json` | Five real source-built chat UI cases: complete/escaped review, explicit install/assignment, skill selection, provider switching and unavailable-selection recovery. Light/narrow and dark/wide layouts have no horizontal overflow. |
| `regressions-1792291206131/evidence.json` | 32 existing provider, schema, policy, native steering/history/events/path/change and private MCP checks pass. Owned loopback fixtures only. Database-dependent legacy cases are outside this run. |
| `../desktop-plugin-import/ui-1792291206365/evidence.json` | Five existing MCP import/review/cancellation/error/installation UI checks pass. |

Earlier fixture preparation and tool-catalog failures remain in their original evidence directories. One broader regression invocation used the network-denying skill loader with loopback tests and omitted the legacy database configuration; it produced four setup failures. The corrected bounded loopback run above passes, and the generated-record storage run independently covers current database integration.

## Remaining release gates

Package this source into a new candidate, preserving the frozen 0.44.2 image. Recheck its exact archived modules and ordinary installed workflows, including skill discovery after restart and revocation during child work. Fresh human ChatGPT authorization is still required for the pending real model/browser test and live skill selection/execution acceptance. No authentication was automated and no paid requests were retried during this work.

The importer accepts the portable schema at the root or supported compatibility directory layout. It does not translate all schema-less Codex compatibility manifests. Hooks, local-command MCP packages, OAuth-only plugin connections, publisher signatures, marketplace delivery and in-place updates remain outside this checkpoint. The broader desktop acceptance table remains open.
