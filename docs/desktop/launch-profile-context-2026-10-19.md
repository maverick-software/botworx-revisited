# Host launch and ordinary profile isolation

October 19, 2026. Ordinary Agentopia 0.44.41 is installed, signed in and left open through its normal Desktop shortcut. Its installation/data acceptance remains passed. This investigation explains the separate sign-in screen seen during the installer's automatic launch; it does not change either saved profile or claim a startup fix.

The physical executable and profile-directory paths resolve to their ordinary Windows locations. In the Store-hosted executor, however, resolving individual files gives different results: `credentials.bin` and `Local State` resolve inside the host's package-cache Roaming copy, while `runtime-binding.json` resolves inside ordinary Roaming. A separate physical read from WSL confirms that the two credential files have different sizes and hashes. No credential values are printed or decrypted. This establishes file-level redirection, so checking only the directory or executable identity is insufficient to establish a consistent profile.

This behavior agrees with Microsoft's [packaged desktop AppData operations](https://learn.microsoft.com/en-us/windows/msix/desktop/desktop-to-uwp-behind-the-scenes): an existing private package file can take precedence over the corresponding real AppData file. The observed implication is that one launch can combine an old credential/session copy with the current runtime binding. Normal Desktop shortcut reopening in the completed41 acceptance restores the ordinary administrator session and original image draft.

## Isolated experiment

`scripts/desktop/test-profile-launch-context.mjs` creates a unique generated marker directory in ordinary Roaming and a corresponding package-cache directory. WSL writes different non-sensitive marker strings to the two physical directories. A compiled, windowless .NET probe then reads the same logical filename through three launch paths: direct process creation, an explicitly configured desktop-app process-tree policy followed by a grandchild, and Windows ShellExecute. It does not open Agentopia, connect to the database, inspect saved credentials, alter profile files, or make network/provider requests.

All three cases read the package-cache marker. Each probe reports itself as unpackaged, so `GetCurrentPackageFullName` alone also fails to identify this redirected filesystem view. The documented [desktop-app process policy](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-updateprocthreadattribute) and ordinary ShellExecute therefore do not establish an automatic relaunch fix in this environment. The experiment completed successfully; reaching the ordinary filesystem view did not succeed.

Exact completed evidence: `C:/Users/charl/AgentopiaQA/profile-launch/1792425299658/evidence.json`. All three process exits are zero, and no child remains running. The earlier experiment at `1792425247682` retains a controller failure: reading ExitCode from a Process object obtained by PID throws. Its generated output still shows the redirected marker. The corrected experiment reads the exit code through the retained Windows process handle. No completed provider operation is replayed.

## Consequence and remaining work

No product code is changed on the strength of an ineffective relaunch. A complete correction must establish one physical profile for all launch contexts before Electron initializes its encryption/session storage. Options still need qualification: a supported launcher that demonstrably reaches the ordinary view, or a recoverable one-time migration to a private location outside the redirected AppData trees. Either approach must preserve credentials, runtime ownership, native histories, attachments and browser state, retain protected-path exclusions, prevent concurrent use of divergent copies, and pass actual encrypted write/cold-reopen checks. Directory normalization or a different path spelling does not prove that result.

The installed41 shortcut remains the verified launch path. The full parity goal stays active; this finding is an additional startup consistency gap.

Source follow-up now supports a verified location record outside AppData. Generated encrypted-copy, cookie, native-index and two-process reopening checks pass; no ordinary migration or installation is performed. [Exact behavior, tests and delivery gates](durable-profile-location-2026-10-19.md).
