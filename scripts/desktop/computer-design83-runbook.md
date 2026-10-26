# Computer settings renderer maintenance

This delivery retains version 0.44.82 and uses the accepted current package at
`F:/Agentopia/.supabase/desktop-host-plugin-compat82/1792995366465/package-proof.json`.
Its ASAR is `31e6d351eb269a1a19e014d71ed49b3ea4c7cb6e8a5cf422b06966f59e34c007`.
The executable, archive, helper, compiled backend modules, runtime resources,
database migrations, dependencies, and root package files remain byte identical.
Only the reviewed UI sources are built. Other desktop sources are copied from
the accepted frozen source, preserving unrelated current checkout changes.

Run from F:/Agentopia after accepting the UI and cherry-picking the helpers.
First run `node scripts/desktop/test-computer-design83-tooling.mjs`.
The root operator writes an F: JSON source acceptance file with:

```json
{
  "success": true,
  "rootAccepted": true,
  "sourceCommit": "FULL_CURRENT_COMMIT_AFTER_CHERRY_PICKS",
  "uiSourceHashes": {
    "ui/ComputerSettings.tsx": "SHA256",
    "ui/SettingsPanel.tsx": "SHA256",
    "ui/computer-settings.css": "SHA256"
  },
  "fixtureEvidence": "F:/Agentopia-Consolidation/skills/.supabase/computer-access82-ui/1793021794840/evidence.json",
  "fixtureEvidenceSha256": "SHA256"
}
```

Hashes must describe the accepted actual files. The fixture must have succeeded
in Electron with controlled calls, zero ordinary-profile writes, and zero live
provider requests. Preparation checks those properties before building.

```powershell
node scripts/desktop/prepare-computer-design83.mjs --source-approval F:/PATH/source-acceptance.json
node scripts/desktop/qualify-computer-design83.mjs
```

Qualification starts the actual candidate executable with an empty F: profile
and deliberately missing runtime. It checks the actual loaded compiled JavaScript
and stylesheet hashes against the frozen UI manifest, records a screenshot, and
closes its own window normally. This verifies packaged asset loading. The source
fixture verifies the redesigned page and permission behavior. The ordinary app's
final inspection confirms the page in its real account and display context.

Do not start installation until the root operator is ready to close the ordinary
window normally after the fresh logical capture signal:

```powershell
node scripts/desktop/install-computer-design83.mjs
```

The installer verifies the currently installed program/resources, checks that no
requests or approvals are active, captures a fresh logical snapshot, and prints
`Fresh logical recovery captured`. It waits up to 120 seconds for normal closure.
It never forces termination. While closed it captures and verifies a compressed
profile backup, copies the complete old UI into `installation-*/before-ui`, copies
the candidate into a separately named pending folder, and swaps only the UI folder.
The executable, archive, profile, and selector hashes are checked around the swap.
It reopens the ordinary application, checks all six core services, compares every
original database row against the fresh snapshot, and verifies protected settings.
Fresh counts are compared to themselves so user work since the earlier 3,830-row
acceptance remains included. There is no SQL migration or settings write.

The credential wrapper executes the original frozen comparator against the
accepted base program. Only imports, its root, and the fresh job parent path are
derived. Its existing old-kind proof guard, both protected-settings policy files,
and token signature/scope/renewal checks retain their exact bytes. The wrapper
first proves that the candidate program and all non-UI resources equal that base.
The final result requires the same number of settings as the fresh pre-swap
baseline, every baseline provider connection preserved with identical values,
all other protected settings preserved, and disabled image generation. Legitimate
settings or connections added before maintenance remain included in that baseline.
A renewal is accepted only by the existing strict
policy. The raw encrypted snapshots and private diagnostics remain on F: with
restricted job permissions; no values are printed.

After the root operator inspects Computer use in the ordinary window without
changing production permissions, the strict comparison can be repeated once:

```powershell
node scripts/desktop/audit-computer-design83-credentials.mjs --proof F:/PATH/package-proof.json --job F:/PATH/installation-TIMESTAMP --post-inspection
```

This writes `installed-credentials-post-inspection.json` and verifies the original
accepted receipt remains byte identical. Complete the final completion receipt only
after ordinary visual inspection and final manifest/data checks. The installer
deliberately retains `nativeVisualInspectionPending` until then.

If any check fails, inspect the existing job and any owned process before retrying.
The recoverable UI is in the verified F: `before-ui` directory; the raw profile
backup is `before-profile.tar.gz`. Do not restore expired credentials or old data
merely to roll back a visual change. A UI rollback uses a normal app close and
the same checked UI-folder swap, retaining the current account/profile and ASAR.
