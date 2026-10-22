# Bundled command-line runtimes

October 17, 2026 · Installed private release 0.33.0

Agentopia includes official Windows x64 Node.js 24.22.0 and CPython 3.14.8 distributions. The installer contains their software, npm, Python's standard library, pip, virtual-environment support and license notices. The same runtime directories are added to the child process PATH for managed commands, persistent interactive terminals and the actual Codex shell executor, including native children. ChatGPT and OpenRouter continue using Codex 0.163.0. Windows' user and system PATH values are unchanged.

The Python package is the full runtime ZIP used by Python's install manager, extracted privately without registering a Windows installation. Python documents copying these offline ZIP packages and invoking their executables directly. The developer preparation step verifies the published Node/Python archive hashes, validates ZIP paths, writes only regular files, and pins every installed file. Builds verify those pins before packaging. The execution service verifies the bundled files once before first use. [Python Windows/offline installation](https://docs.python.org/3/using/windows.html#offline-installs), [Python distribution manifest](https://www.python.org/ftp/python/index-windows.json), [Node release checksums](https://nodejs.org/dist/v24.22.0/SHASUMS256.txt).

## Using the runtimes

After enabling Windows commands, choose a workspace folder in Terminal. Both its Commands and Interactive session views have `node`, `npm`, `npx` and `python` available. Their compact caption shows the bundled versions. Agent requests use the same permissions as other Windows commands; plan/read-only restrictions, administrator ownership, reviews and Full access remain in effect.

JavaScript dependencies belong inside the project:

```powershell
npm install
node ./app.mjs
```

Create a separate Python environment inside each project:

```powershell
python -m venv .venv
./.venv/Scripts/python.exe -m pip install PACKAGE
./.venv/Scripts/python.exe ./script.py
```

The initial runtime and standard-library operations work offline. Additional packages require network access unless their files or wheels are available locally. pip refuses installation into the bundled base; npm's managed user/global configuration files are separate and empty. Project configuration remains available. Provider credentials, ambient Node injection options and Python path overrides are excluded from the execution environment. Python uses UTF-8, excludes the Windows account's user packages and avoids writing bytecode beside bundled libraries. Commands retain the Windows account's filesystem/network authority; this feature does not add a sandbox.

## Verification

Six focused checks passed using actual Windows processes with development tools removed from PATH. They prove JavaScript/Python versions and Unicode text, real npm installation of a local project package, a Python virtual environment and offline wheel installation, refusal to install into the base runtime, persistent interactive state, cancellation of a JavaScript process and its Python child, and discovery of both interpreters by the unmodified native Codex command executor. No provider inference was needed for these checks.

The first checks exposed a UTF-8 input bug in the PowerShell supervisor and invalid nested command-line configuration for Codex. Both were corrected. npm also rejected using the same null-device path for its user/global configuration; two distinct bundled configuration files resolved that conflict. Failed evidence is preserved beside the passing rerun.

The full regression suite passed all 172 checks. The live source workflow then passed using the owner's real ChatGPT and OpenRouter GPT-6.1 Sol connections at High thinking with a minimal PATH. ChatGPT executed both interpreters through native Codex and returned their versions and file-generated results. After an in-composer switch, one OpenRouter native child executed the same scripts with changed data, delivered its result to the parent, and the parent recalled the earlier ChatGPT results. The four saved messages reopened unchanged. The runtime pins still matched after real execution. The command descriptor was compared with installed 0.32.0 and retained exactly, avoiding a metadata-only native configuration change.

The first live attempt stopped at folder selection, before inference, because its fixture was inside the protected backend directory. The corrected run uses an ordinary workspace; the path protection remains enforced. Both the failed preflight and successful evidence are retained. Installer upgrade and installed checks are recorded in `.supabase/desktop-script-runtimes/release/` as they finish.

Windows mouse/keyboard input, existing-profile Chrome consent, additional tools/languages, Git on clean Windows computers and broader desktop parity remain separate work. The complete desktop goal remains open.

## Installed release evidence

The actual 0.33.0 installer upgrade retained its disposable account, project, protected MCP credential, agent instructions and messages, then removed that fixture. Installed verification launched from a temporary directory with development tools removed from PATH. The real terminal UI executed both runtimes from an accented folder, the persistent interactive view completed with exit zero, and the installed Codex executor ran both versions. The version caption was visible, and the saved ChatGPT/OpenRouter conversation and child results reopened without changing their messages. No inference was repeated for installed checks.

The first installed verifier omitted an account identifier; the ownership guard refused it. Subsequent synchronization fixes let the verifier wait for its new command/session instead of reading an earlier history selection. The successful run measured 5.8 seconds for the first managed command, including verification of the bundled resources. That first-use latency remains an optimization opportunity.

The resource audit matched all 977 compiled modules, 12 UI files, 370 Chrome files, 401 computer-helper files, 4,199 script-runtime files, license notices, runtime scripts and 37 migrations. The final preservation audit retained both original accounts/passwords and roles, all 81 conversations and 254 messages in the pre-release snapshot, and every prior migration checksum. The recovery backup's five dump/encryption files passed their checksums. The prior 0.32.0 installer is retained for recovery.

Installer: `desktop/staging/out/make/squirrel.windows/x64/AgentopiaSetup.exe`, 1,359,471,616 bytes, SHA-256 `c68c196c76c0e11daa41b1a8232caa8a349a90502c7c9b19d361963e38d0f582`. Evidence: `.supabase/desktop-script-runtimes/core-tests.log`, `tests-fixed2.log`, `live/evidence.json`, and `release/installed/`, `release/installed-resources.json`, `release/data-after.json`.
