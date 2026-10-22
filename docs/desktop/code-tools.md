# Bundled Windows code tools

Version 0.34.0 adds private Git, ripgrep and PowerShell runtimes to the command environment. This closes the dependency on development tools installed separately on the owner's computer. Node.js, npm and Python remain bundled as in 0.33.0. Both AI connections continue to use the unmodified pinned Codex app-server 0.163.0.

## Runtime and preparation

- Git for Windows MinGit 2.56.0.windows.2, preserving its complete official portable archive.
- PowerShell 7.6.7, preserving its complete official self-contained archive.
- ripgrep 15.2.0, reusing the executable already pinned inside Codex, with its MIT/Unlicense and PCRE2 notices included.

`npm run desktop:prepare-code-tools` downloads pinned upstream archives, verifies SHA-256 values, rejects unsafe archive entries and stages a verified replacement. Pins are in `desktop/code-tool-pins.json`; the generated inventory is `desktop/src/code-tool-manifest.json`. Builds use `--verify` and require no tool download. Vendor licenses and source information stay in the resource tree. The package does not register these tools globally or change the Windows user's PATH, default shell or Git configuration.

Command processes receive bundled directories before inherited PATH entries. The environment handles Windows PATH casing consistently. Managed commands and interactive terminals invoke the private PowerShell 7 executable. Codex receives the same tool directories and runtime instructions, including children. Native tool descriptions and schemas remain identical to 0.33.0, preserving recorded configuration identities for older children.

First use verifies pinned files asynchronously, sharing one pending validation per resource root. Cancellation during validation prevents that caller's supervisor or native client from starting. Validation yields to the application event loop; commands start only after it succeeds. Installed-resource audits independently verify the same inventory.

## Terminal history fix

A fresh PowerShell 7 terminal initially exposed Agentopia's initialization command through Up-arrow history. Clearing PSReadLine before the first prompt did not solve it. ConsoleHost records the encoded startup command in engine history after execution; PSReadLine initializes later and imports engine history when SaveNothing is selected. The upstream implementation confirms that delayed import from Get-History: [PSReadLine source](https://github.com/PowerShell/PSReadLine/blob/master/PSReadLine/ReadLine.cs).

The one-time first prompt now clears both engine and editor history, restores the ordinary prompt and signals readiness before user input is accepted. A regression test verifies that the first user command is the only editor history entry, SaveNothing is active, and both shared Windows history files retain their original fingerprints. The legacy Windows PowerShell fixture also passes. Diagnostics use safe counts and fingerprints without printing shared command history.

## Verification scope

Automated fixtures run actual local commits, clones, linked worktrees, diffs and Unicode searches with development tools absent from PATH. A native Codex command/exec request uses the same binaries without inference. A controlled Git hook launches Node and Python; cancelling must terminate all descendants. A fresh process tests event-loop responsiveness and cancellation before any shell starts.

`node scripts/desktop/test-live-code-tools.mjs --live` qualifies real ChatGPT execution, a composer switch to OpenRouter and one native OpenRouter child inspecting a changed linked worktree. Proof requires completed command items, actual version/search output, recalled earlier context, delivered child results and unchanged messages after reload. Successful evidence is retained to avoid repeating paid inference for verifier changes.

The installed workflow runs from a temporary directory with a minimal Windows PATH. It checks managed Git operations, interactive commands, native Codex execution, first-command responsiveness and saved provider/child results. Resource and data audits cover compiled modules, pinned inventories, runtime scripts, schema, original accounts/passwords/roles and earlier conversations.

All 177 automated regression checks passed. A separate public HTTPS Git remote lookup passed with a minimal PATH and credential prompts disabled. Real ChatGPT created a local repository, committed its Unicode file, cloned it, created a linked worktree and searched its marker. After an actual composer switch, one OpenRouter native child inspected a changed worktree and returned its new marker and one-line diff. The parent retained the earlier ChatGPT marker and commit; its delivered child result and all four messages reopened unchanged.

The initial live verifier expected an unquoted Git path. Git quotes non-ASCII filenames in numstat output by default, so the verifier was corrected to accept that representation while still requiring the exact diff counts and completed native execution. The saved command items and binary paths were rechecked with inference disabled; neither paid request was repeated. Evidence and the original verifier-failure record are under `.supabase/desktop-code-tools/`.

## Installed qualification

The actual 0.34.0 Windows installer passed its embedded-payload check and upgraded the installation. The disposable upgrade fixture retained its account, project, protected MCP connection, instructions, message order and completed response, then was removed.

Installed verification passed from a temporary directory with development tools removed from PATH. Managed execution committed, cloned and created a linked worktree, then searched a Unicode file. The interactive terminal ran the bundled interpreters, Git, ripgrep and PowerShell. The installed unmodified Codex executor ran Git and searched the same repository without inference. Both provider connections, four saved cross-provider messages and the delivered child result survived installation and reopened unchanged.

The first installed test command took 8.6 seconds, including interpreter checks and the local Git workflow. Tool verification still adds first-use startup work. During that command, the main-process heartbeat ran 333 times with a largest gap of 51 milliseconds, demonstrating that it remained responsive on this machine. The separate cold-process regression proves cancellation prevents managed or interactive supervisors from starting during validation.

The installed-resource audit matched 978 compiled modules, 12 UI files, 370 pinned Chrome files, 401 computer-helper files, 4,199 script-runtime files, 1,038 code-tool files, licenses, runtime scripts and all 37 migrations. The data audit preserved both original accounts/passwords and roles, all 82 pre-release conversations and 258 messages, and all 37 migration checksums. The database backup and encryption-root hashes passed verification. Agentopia was reopened with all six backend services healthy.

Release records are under `.supabase/desktop-code-tools/release/`, including the installer digest, previous-installer digest, backup record, actual upgrade checks, installed workflow, resource audit and original-data audit. The installer is `desktop/staging/out/make/squirrel.windows/x64/AgentopiaSetup.exe`, 1,502,334,976 bytes, SHA-256 `4bbd3c8b9e6444884e7accb4aa0a8a66726bac2ea0ca144cd39ef188b1504c53`.

Windows computer input, existing-profile Chrome consent and broader interaction parity remain separate work. Authenticated Git remotes, credential-manager sign-in, a fresh Windows restart and installation on another clean computer are not qualified by these local/public Git and upgrade tests.
