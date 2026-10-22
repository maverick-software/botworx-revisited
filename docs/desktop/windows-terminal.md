# Windows commands and the terminal workspace

Installed **0.34.0** adds private Git, ripgrep and PowerShell 7 to Commands, Interactive session and native Codex shell execution. Tool verification runs asynchronously and respects cancellation before a shell starts. The terminal starts with session-only history, including removal of the internal initialization command. Real cross-provider/child execution, actual installer upgrade and installed Git/search/interpreter checks passed. [Use, verification and boundaries](code-tools.md).

Version 0.33.0 added bundled Node.js/npm and full CPython to Commands, Interactive session and native Codex shell execution. Their child-process PATH is scoped to Agentopia; Windows' global settings are unchanged. Live ChatGPT/OpenRouter-child execution and installed commands/results passed. [Usage and verification](script-runtimes.md).

The 0.16.0 implementation adds a Windows PowerShell tab beside files, plans, canvases, and browser tabs. This is an incremental desktop capability; interactive terminal sessions remain further work.

An Agentopia administrator can open Terminal from the chat header, the workspace tab menu, or the composer's Add menu. Choose an owned workspace folder and an optional existing subfolder, enter a command, and choose Run command. Output streams into the tab, with separate standard output and error text, elapsed time, status, and exit code. A history selector reopens saved results. Copy output copies a readable transcript. Manual terminal output is not sent to an AI provider automatically.

Windows commands are initially disabled. Enabling them requires a native confirmation. They run under the current Windows account, with that account's filesystem and network access. Selecting a working folder establishes the starting directory; a command can access other locations. This is not a filesystem sandbox. Command effects, including external effects, cannot be automatically undone. Agentopia standard users cannot enable, run, or retrieve host commands, including by bypassing the interface and calling the bridge directly. Database read policies also require the current account to own the log and hold the administrator role.

Agent permissions operate as follows:

| Permission/mode | Agent command behavior |
|---|---|
| Chat only | No command or file tools. |
| Selected files access | Selected file reads; no command execution. |
| Default permissions | Commands require Windows commands to be enabled and a selected folder. The exact command, working directory, limit, and reason are shown for approval before execution. |
| Full access | A separate native confirmation authorizes automatic selected-file edits and commands. External plugin calls retain their individual review. |
| Plan mode | Command execution and file writes are withheld, including when Full access is selected. |

Full access is saved for the administrator's account and applied only to requests that select that permission. Disable commands revokes both grants, stops managed commands, and cancels the account's active responses. Future composer/draft choices that relied on the revoked grant return to Default permissions. Earlier submitted message snapshots retain their original permissions and provider/model choices. Losing the administrator role or changing accounts also stops managed commands.

The same command tool serves ChatGPT and OpenRouter. Its saved result contains the actual command, working directory, output, exit code, status, and terminal identifier. A chat activity link opens that result in the workspace. Repeated provider command identifiers within a request return the existing result rather than starting a second process. Reusing an identifier with different arguments is rejected. A database uniqueness rule also prevents duplicate command activities with the same identifier. A fresh request can run another command; inspect partial or external effects before retrying uncertain work.

Commands use a fresh, noninteractive Windows PowerShell process for each run. Their limit is 1–300 seconds, with up to three simultaneous managed commands per account. Stored output is bounded to 100,000 characters of standard output and 50,000 of error output. A command producing more than one million characters is stopped. Output is displayed as text; recognized credential patterns are rejected in commands and redacted from output. Provider credentials are not added to the child environment. These precautions do not turn host execution into an isolation boundary.

A supervisor assigns itself to a Windows job before launching user code. Normal descendants inherit that job; cancellation, time limits, application close, and loss of the app-owned input pipe end the managed processes. Windows documents exceptions such as processes created through services or `Win32_Process.Create`; Linux work launched through WSL, external services, and prior side effects can require separate inspection and cleanup. [Microsoft job-object documentation](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects).

Logs are saved in PostgreSQL with account ownership, source, conversation/request links, and lifecycle status. Startup retains acknowledged partial output and marks unconfirmed runs Interrupted. Closing a terminal tab leaves its command running; Stop command, Stop response for an agent run, sign-out, or closing the application stops it. Deleting a linked chat or agent stops its managed commands before deleting their associated records.

Verification covers real PowerShell execution through both controlled provider adapters, actual file changes, approval and denial, Full access, role and account boundaries, cancellation, time limits, parent-only process termination, saved output, and recovery. Live-provider and installed-package evidence are recorded separately; simulated inference is not a live provider check.

The first live check received HTTP 400 before executing a command. ChatGPT identified `computer` as a reserved namespace and rejected the custom function. Commands now use the existing `workspace` namespace, with the same local permission and execution checks. A focused regression first reproduced the incorrect namespace, then passed after the change; both controlled provider paths also passed real Windows execution. The corrected source was packaged as 0.16.1. Both real providers then completed the reviewed command workflow; the installed regression and final preservation audit passed, and the installed modules match that source build. Failed generated checks are retained as diagnostic proof and their unexecuted disposable conversations/folders are removed only after confirming no command ran.

Version 0.17.0 adds a separate [interactive session view](interactive-terminal.md), shared command/session capacity, workspace-folder following, and complete partial-output receipts for cancelled responses. The Commands view retains its fresh-process behavior.
