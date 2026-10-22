# Public plugin package compatibility — source checkpoint

Subsequent delivery checkpoint: the fix is now frozen in32 and passes381 exact archived backend/schema checks,36 delivered interface workflows and both actual Codex converted-skill validations. Full Windows restored-data and ordinary installed acceptance remain open. [Packaged evidence and limits](platform-release-0.44.32.md).

The source importer now handles the portable Agent Plugins layout and the supported core of standalone Codex compatibility packages. This follows the current [official packaging guide](https://developers.openai.com/plugins/build/plugins). It is a source-qualified change; the installed application and frozen31 installer are unchanged.

## Format selection and preserved data

A recognized root `plugin.json` remains canonical for identity, `skills/` and `mcp.json`. Root `extensions.com.openai` settings replace the compatibility overlay as a whole. When that inline object is absent, `.codex-plugin/plugin.json` can supply presentation metadata. Overlay skill/MCP paths do not replace portable components.

A standalone Codex manifest is normalized into the pinned portable schema. Its declared skill directories and MCP configuration path are resolved inside the selected package. Custom skill directories are mapped to the host's canonical skill tree, retaining helpers and references inside each skill. Legacy remote HTTP declarations normalize to Streamable HTTP; explicit SSE remains SSE. File, folder and ZIP imports return the same canonical digest. ZIP entry order does not determine component discovery.

Portable manifests without a version receive a content-derived local revision; a missing description falls back to the package identity. This local revision identifies accepted components and metadata. It is not a publisher signature. Existing explicit versions and package digests remain stable for unchanged packages.

Descriptive OpenAI presentation fields are preserved and bounded. Unknown executable settings, registered app mappings, onboarding actions and hooks remain explicit errors. Local-command MCP, OAuth-only declarations and embedded credentials are not silently converted into unauthenticated remote servers. Only declared skill trees are installed; package-root helpers outside those trees are not added to the native cache. Existing credential configuration and per-agent assignment controls remain authoritative.

## Import and runtime boundaries

Import reads declarations and bounded skill snapshots without extracting or executing the selected package. Every ZIP entry is checked for declared size and CRC within the existing4MB compressed/16MB expanded limits. Selected declarations and skill files retain their narrower limits. Paths, private names, links, Windows aliases, overlapping roots, canonical collisions and unsupported schema declarations are rejected. Scripts do not run during validation or installation. The review screen still explains that schema validation does not certify the publisher or server.

## Verification

Final qualification passes57 backend checks and five PluginManager interface workflows, with both backend and renderer type checks. The public-format fixture passes ZIP/folder selection, exact server/skill/digest review, review invalidation after editing, held/cancelled selection, unsupported-hook refusal and explicit-only installation. Native picker results and the installation store are controlled. Dark and narrow/light screenshots were inspected; no ordinary account or SQL data is used.

Actual Codex also loads converted skills from both portable and Codex layouts. It sees the expected skill and all three reviewed files, leaves the generated helper marker absent, and clears its private validation staging. Validation uses a non-serving loopback model endpoint and submits no inference request. Existing native skill, reference/helper, child revocation/update and both provider-format tests pass within the57 checks using controlled responses.

The original frozen31 importer reproduces12 failures among the13 new compatibility cases. The first source qualification retains its22 successful import cases and30 broader successes; two native child tests failed when writing their result files because the qualification controller had not created its output directory. The identical compiled child cases pass after that directory is created. The final controller creates it before running the complete suite. Both attempts remain preserved.

Source acceptance: `.supabase/desktop-plugin-compatibility/1792383983187/acceptance-1792384579649/evidence.json`. Final qualification: `qualification-1792384375925`. Converted-skill runtime evidence: `qualification-1792384375925/native-converted/evidence.json`. The frozen31 archive still hashes to `69964ce0bf472ae74646ae111d8f9234ec968e46ea85558ac305f01d89933434`; the physical ordinary24 image remains `c8e56cf33466a7e5e3e531780d64df6bb5f1d5ff19bd2c732ad630279a5716b6`.

## Remaining delivery and parity work

These source changes require a subsequent packaged qualification and ordinary installed acceptance. They are not included in the already prepared31 installer, whose specific Windows installation confirmation remains pending. Marketplace/catalog management, registered apps, OAuth-only server onboarding, local MCP processes, hook trust/execution, publisher signing and broader skill instruction compliance remain open requirements. No update is installed, no paid provider request is sent, and the full desktop goal remains incomplete.
