# Sylvana Windows setup wizard

The assisted NSIS installer replaces the animation-only Squirrel experience for the next qualified public release. It provides a welcome page, program-folder selection, an explanation of retained personal data, visible extraction progress and file details, and a completion page. The production finish page offers to launch Sylvana. Installation is for the current Windows user; it does not silently elevate or install another user's data.

## Program and data locations

The chosen folder contains program files and the bundled runtime resources. Accounts, chats, settings, encrypted credentials, attachments, and the private runtime remain in their existing locations. The installer never copies or resets the user's database. The additional per-user `~/.sylvana/desktop/wizard-installation.json` record lets the application find its existing data from the new program folder.

An existing `profile-location.json` remains byte-for-byte unchanged. The wizard checks its receipts and runtime binding before installing, binds the new installation to its checksum, and checks the selection again before registering the completed installation. A changed receipt, active migration, linked record, unsupported redirected profile, or destination overlapping private data blocks installation. A first wizard install requires an empty destination folder. A reinstall can reuse its registered folder.

The previous Squirrel program is retained for recovery. After successful registration, a matching old Squirrel uninstall entry is exported privately and retired; its executable and personal data are not deleted. The current shortcut and browser sign-in registration point to the wizard installation. Normal setup never force-closes Sylvana. A running application must close before installation proceeds.

The uninstaller removes only the program paths delivered by that version. Additional files in the program folder survive. It keeps personal data and the data-selection record, allowing a later reinstall to find the same data. Files deliberately placed at the exact path of a delivered program file are program files and may be replaced during an upgrade.

## Build and verification

`scripts/desktop/build-windows-wizard.mjs` builds from the previously qualified complete program tree, preserving its application code except the profile-selection module and version metadata. This bounded transition avoids including unrelated working-tree changes. The complete local runtime remains bundled. The script records the input proof and changed files in its output directory.

The build uses pinned electron-builder 26.18.0 and its unified NSIS 1.2.1 toolset (NSIS 3.12). Outputs, tool caches, and test profiles stay on F:. The legacy Squirrel builder remains available for recovery and earlier maintenance workflows.

Example isolated verification build from the repository root:

```powershell
$env:SYLVANA_WIZARD_OUTPUT='F:/Sylvana/verification/windows-wizard-20261029/isolated-v1'
$env:SYLVANA_WIZARD_VERIFICATION='1'
$env:SYLVANA_WIZARD_TEST_HOME='F:/Sylvana/verification/windows-wizard-20261029/test-user'
node scripts/desktop/build-windows-wizard.mjs
```

The verification variant uses a separate installer identity and synthetic home. It creates no production shortcuts or browser protocol registration and does not launch the application after setup. Its profile helper only ignores unrelated live Sylvana processes in this isolated mode. Public release tools reject this variant.

For a failed compiler step, inspect the retained candidate first. `--resume-installer` requires its unchanged qualified application archive, refreshes the setup helper, and regenerates the installer include. Invalidate a stale generated `.nsis.7z` after changing delivered resource files; the packager's archive cache alone does not qualify those bytes. Never reuse an acceptance receipt after changing the installer.

Acceptance must establish:

1. Native wizard navigation, a selected folder containing spaces, the visible file-details/progress view, and cancellation before installation.
2. A fresh installation with every delivered file matching the qualified program.
3. Transition from a synthetic existing Squirrel profile and reinstall/upgrade of the wizard installation, preserving credentials, settings, chats, archived data, and data-selection receipts.
4. An extra file in the program folder survives upgrade and uninstall; personal data survives uninstall and subsequent installation.
5. A recoverable real upgrade and reopening against the user's existing profile before replacing its installation.
6. Valid publisher signatures, final-artifact integrity, and fresh/upgrade acceptance before replacing the dashboard download.

Evidence and execution checkpoints are retained at `F:/Sylvana/verification/windows-wizard-20261029/`. Type checking and 29 profile-selection tests passed. The real-filesystem setup-helper checks reject foreign Windows installation owners, missing migrated selections, linked destinations and unowned nonempty folders, and permit reinstallation into a registered folder after uninstall while preserving extra files.

Windows installer testing passed for a fresh installation, a same-version reinstall, a generated NSIS 0.46.1 predecessor upgraded to 0.46.2 in a different selected folder, and an existing Squirrel-profile migration. Each final installed program was compared against all 7,561 qualified program-file hashes. Synthetic settings, chats, archive data and Windows-protected credential bytes survived; the credentials remained decryptable. The installed application's actual profile-selection code selected the verified legacy profile. Uninstall removed every owned program file and retained personal data, the legacy program, and a user-created file in the earlier program folder. The test installation and its updater cache have been removed.

A read-only preflight against the live user's profile also passed without changing its location record or installing the candidate. The production installer contains the same program-file bytes as the final isolated test build. Its real Windows home/data bindings and production helper mode were inspected, and its actual welcome/folder-selection screens were opened and cancelled without installing. These results establish installer transfer and profile preservation; production first launch, browser sign-in and recovery on the final signed artifact remain unverified.

## Publication status

The dashboard still points to 0.46.1. The wizard has not been published or installed over the user's live application. A verified publisher signing identity remains unavailable. A clean Windows virtual-machine test is also pending: this session cannot access Hyper-V. Do not treat an unsigned local build or an isolated fixture installation as public-release approval.

The dashboard release verifier now supports NSIS qualification. It requires publisher signatures and a `windows-installer-acceptance.json` receipt bound to the final installer checksum, version and full program manifest. That receipt must establish fresh installation/startup/browser sign-in and a version upgrade with data preservation/startup/recovery, with scope `final-signed-installer`. Isolated test builds and receipts from other installer bytes cannot satisfy this gate. No such public-release acceptance receipt has been created for this unsigned candidate.

The candidate is `F:/Sylvana/verification/windows-wizard-20261029/candidate/SylvanaSetup.exe`. Keep its qualified source program at `F:/Sylvana/verification/windows-wizard-20261029/isolated-v1/program` while completing signing and release verification. A qualified shared program can be reused read-only with `SYLVANA_WIZARD_INPUT` and `--resume-installer`; its application checksum and setup-helper bytes must match the saved qualification.
