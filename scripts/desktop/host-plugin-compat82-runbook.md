# Same-version82 bundled Computer identity repair

The original full82 package changed the bundled Computer plugin description, which changed its integrity digest. Existing saved Computer rows retain the accepted81 digest, so reads through `Plugins.checked` fail. Restore only the description and the byte-identical accepted81 `build/host-plugin-contracts.js`. Keep the current82 interface, native helper1.0.4, all other compiled modules, dependencies and resources. The original installer and its historical installation evidence stay unchanged.

After root accepts the one-line source repair, run from `F:/Agentopia`:

```powershell
node scripts/desktop/test-host-plugin-compat82-tooling.mjs
node scripts/desktop/prepare-host-plugin-compat82.mjs
node scripts/desktop/qualify-host-plugin-compat82.mjs
node scripts/desktop/install-host-plugin-compat82.mjs
```

The preparation pins full82 proof `1792993846372` and installed archive hash `fdbf68d394fbb74b0732c3314eccbe82c38d29262a72ea196bfb0ab553ac18d8`. It checks that the source repair exactly matches the accepted81 contract and that every archive entry except the one module is unchanged. It writes a complete program/resource manifest and isolated QA configuration under `.supabase/desktop-host-plugin-compat82`.

Qualification first reproduces the original82 `plugins.list` and `hostAvailability` failures using the stopped existing QA82 profile. It then cold opens the repaired package, reads Plugins through actual IPC and its packaged `Plugins` class, verifies saved Computer identity and active-agent availability, and checks original QA rows against the retained upgrade backup. No model request is needed.

Installation captures fresh logical recovery and waits up to120seconds for root's normal closure signal. Root closes the ordinary window when that message appears. It then verifies a compressed full-profile backup, copies protected profile files, retains the original archive onF, atomically swaps the one archive and normally reopens. It compares all application rows, all resources/program files, protected settings and the profile selector. Token renewals use strict82 auditing with the pinned81 public keys. It never runs Squirrel. New installed pointers are written only after these checks pass; final ordinary visual inspection remains root's responsibility.

On failure, inspect the retained job. Do not repeat an updater or blindly relaunch a process that is already running. The original full82 installer still contains the incompatible module; use the repaired installed proof as the next maintenance base.
