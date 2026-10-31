# Release82 computer access delivery

Outcome: install the reviewed persistent Computer use setting and native helper 1.0.4 as Agentopia 0.44.82. Keep schema88, recovery capability18, image generation disabled, and existing data/settings/provider connections.

## Source and build contract

Run from `F:/Agentopia` after the runtime and interface changes are accepted. Merge this tooling commit, set only the root `package.json` version and both root version fields in `package-lock.json` to `0.44.82`, regenerate the helper with `node scripts/desktop/prepare-computer.mjs`, and commit the reviewed source plus generated `desktop/src/computer-runtime-manifest.json`. The existing helper preparation builds with portable SDK10.0.402 and regenerates every helper resource fingerprint. The release builder checks those bytes against the frozen source manifest. `desktop/package.json` has no release version field to change.

The production base is exactly `F:/Agentopia/.supabase/desktop-release81/installed-current.json`, pointing to the final81 C proof `F:/Agentopia/.supabase/desktop-skills-viewport81/1792992263401/package-proof.json`; its archive hash is `96f01f9cc0defe36603b0d50441647d3a47da486b9ed0c126cb7691dcf12e66f`. The C proof has no QA intent. Its `originalInstalledProof` supplies only the existing QA configuration; application bytes always come from C. The release builder compiles every frozen TypeScript source, typechecks and builds the renderer, includes the exact pinned native helper, and verifies packaged dependencies and external imports. It does not allow SQL or runtime resource changes.

Run changed-feature tests specified by the accepted source, then the read-only tooling checks:

```powershell
node scripts/desktop/test-release82-tooling.mjs
python scripts/desktop/test_release82_preservation.py
node scripts/desktop/prepare-release82.mjs --preflight
```

Confirm the existing QA runtime is stopped safely before building. Its instance is `b521a8fe-d803-4031-af23-4bb51f4e1e56`, distribution `AgentopiaRuntime-b521a8fe-d803-4031-af23-4bb51f4e1e56`, API60749, database60750, and profile `F:/Agentopia-Acceptance/agent-creation75-transition76-1792860573077-source/home/AppData/Roaming/Agentopia`. Its current marker must be version81/schema88. Preserve its original rows through the actual upgrade.

```powershell
$acceptedSource = git rev-parse HEAD
node scripts/desktop/prepare-release82.mjs --accepted-source $acceptedSource
node scripts/desktop/qualify-release77.mjs --release82
node scripts/desktop/make-recovery-installer75.mjs --release82
node scripts/desktop/verify-recovery-installer75.mjs --release82
```

Each command retains its own evidence and exits on failure. The qualifier runs the packaged82 application against the existing81 QA database, verifies its automatic backup and all original application rows, normally closes it, and cold reopens it without model calls or replay. A failed upgrade must be inspected before a resume; `--resume-upgraded` is only for a proven completed upgrade whose verifier failed. Do not repeat a completed upgrade.

## Production installation

Root performs the final source/package review and normal application closure. Installation uses the existing `install-release77.mjs --release82` controller. Its fresh logical capture, protected-profile copy, portable recovery verification, full rollback inventory, idle health check, installed updater fingerprint, strict resource checks and post-install audits remain required. The controller waits for normal closure; it never forces termination.

```powershell
node scripts/desktop/install-release77.mjs --release82
```

Protect all original rows across144 tables (3830 at the accepted81 checkpoint), all191 Vault records, all112 protected settings except valid signed authentication renewals, provider/model configuration and image-OFF. Fresh capture may contain legitimate work since that checkpoint. Release82 automatically supplies its hash-bound `composio-public-jwks82.json` to the strict81 token-renewal policy. Both old/new RS256 ID tokens must validate with the accepted public keys and retain authority, identity and scopes. Never restore expired tokens to bypass the comparison.

The maintenance controller intentionally uses the historical52 helper at its pinned path/hash `8049f8a010589c0cbe3b49303cb123ee7541c74cfaf321b04044b6bd4649d9d1`; the packaged current `runtime/database_state.py` remains hash `6f3e05562768cc5492a15884667a4004fcfbac48e592cf81878c6aff4faba9be`. These are separate contracts.

Inspect the retained installation job on any post-check failure. Never invoke the updater again blindly. Complete the ordinary signed-in interface inspection, existing connections and selected model checks, image-OFF check, Computer use setting persistence across reopening, and one harmless native feature check before reporting delivery complete. Preserve untracked user documentation/research files.
