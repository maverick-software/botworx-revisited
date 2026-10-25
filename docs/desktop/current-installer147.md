# Current complete installer acceptance

Outcome: provide a complete local recovery/fresh-installation package matching the ordinary checkpoint 146 installation, including the builder, its UI, and database migration 83. The running app already contains these changes. Keep its accounts, passwords, history, connections and profile untouched during construction.

Use the existing installer maker, short F-drive staging, pinned vendor helpers, streaming payload verifier and isolated startup check. No new packaging framework or product change is required.

Required acceptance:

- Follow the accepted archive chain from installed 146 through 142 to the payload in complete installer 141. Verify every declared compiled change, including the added builder module, and every archived module hash.
- Match all current ordinary supporting files after normalizing only the six isolated runtime ports to the existing production defaults. The new database file and schema-version metadata must be explicit differences from the prior complete release.
- Preserve the recorded recovery boundaries: prior full encrypted recovery evidence, current builder cold reopening, and complete installed 137-table/1,898-row preservation. Do not claim a new different-Windows-user test, physical reboot, or complete portable transfer of builder history.
- Construct Setup and the full package on F:, retaining shared vendor helper hashes. Stream every embedded program/resource file through its expected hash; verify the generated launcher, updater, embedded package and RELEASES metadata.
- Start that exact staged payload in an isolated profile with an intentionally absent runtime. It must refuse to use another installation's runtime and close normally, with no model calls.
- Confirm the ordinary main process, protected profile bytes and read-only database health remain unchanged. Record the installer path/hash and update the full goal table.

This is a matching recovery/fresh-installation artifact at the current product version. Existing users already running that version have the accepted installed patch; distributing it as an automatic upgrade requires an incremented release version. Final updater distribution remains separate from this local artifact acceptance.

Preservation acceptance clarification: the encrypted credentials bytes changed while the ordinary app remained running. The exact packaging-start binary was not copied, so byte identity cannot be claimed for that file. Compare the current snapshot in memory against the retained accepted146 backup, require both provider records and image-generation disabled state preserved, document all setting families that changed, and require the other three protected files to match the packaging-start hashes. Preserve failed comparisons and describe the older baseline explicitly.
