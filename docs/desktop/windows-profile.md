# Windows launch context and the saved profile

October 17, 2026 · 0.42.2 installed private release

## Finding

The desktop shortcut was exercised through a separate Windows Explorer window with Agentopia closed. It launched the installed executable from a Windows Store host's package cache. Startup eventually reached sign-in without restoring the existing account session. The normal Windows Roaming profile contained a fresh installation identifier, while the profile used by the verification executor retained the session and both AI connections.

These were two filesystem views of application data. The installed executable's physical location was in the host's `LocalCache/Local` directory. Its existing Agentopia data was in that host's `LocalCache/Roaming` directory. A normal Windows-shell process used the regular Roaming directory instead.

A read-only probe used the product's `Secrets` class in an isolated copy of the application. With the regular profile, it could not decrypt the other profile's saved credential store. Selecting the original `userData` and `sessionData` directories before Electron became ready restored access to the existing session, OpenRouter credential, and ChatGPT connection. The probe recorded presence flags only. Credentials were not printed or transferred. Recovery copies of the encrypted store and its Local State metadata were retained privately.

An earlier temporary startup tracer changed the promise behavior of a child-process function. Its resulting WSL failure was discarded as diagnostic interference. The profile-selection proof used the normal credential implementation without that wrapper.

## Change

Packaged Windows startup now resolves the executable's physical location before Electron initializes its profile. For an Agentopia installation in a Store host's package cache, it derives the matching Roaming directory for the same Windows user and selects both profile paths before the ready event. The host family and Windows username are not hardcoded. Normal installations, development builds, and explicitly isolated test profiles retain their existing locations.

This preserves the existing files in place. The fix does not copy, merge, delete, or re-encrypt credentials. The selected profile is also explicitly excluded from file attachment and workspace access. If its directory cannot be opened, startup reports the problem and leaves the saved data untouched.

Electron documents the requirement to select session storage before its ready event, and Windows-backed credential protection is provided through its storage API. [Application paths](https://www.electronjs.org/docs/latest/api/app), [protected storage](https://www.electronjs.org/docs/latest/api/safe-storage).

## Verification scope

Four regression checks cover the package-cache layout, matching Windows user, ordinary installations, unrelated executables, development/test isolation, synchronous selection, and visible filesystem failures. The complete 221-check desktop suite passed. The two controlled pre-upgrade Codex thread indexes already used physical rollout paths and were left unchanged.

Installed checks confirmed the physical profile and its exclusion from file attachment, both provider connections, retained saved actions, navigation, and all 995 compiled modules and pinned resources. Two unique real native Codex turns continued an existing diagnostic conversation through ChatGPT and OpenRouter at High, with imported history. Text-only permissions and removal of window sharing intentionally selected new configuration branches; this does not establish resumption of the earlier shared-window branch identifiers.

The live checker initially looked for provider choices on the assistant message; the user message is the authoritative stored record. Its completed first reply was reused. The next UI submission was blocked by an expired window grant. A database read confirmed that it created no user message; selecting Chat only removed the stale reference and allowed the OpenRouter submission. The original fixture draft was recovered from the encrypted backup and restored. A separate read-only checker verified two unique saved submissions, the actual provider/model/High choices, native Codex 0.163.0 states, and saved replies. Repeated verifier observations of the first request were not additional inference.

The actual desktop shortcut was then exercised through Windows Explorer. It restored the signed-in account and original conversation. Launching it again retained the same process and window. After a normal application shutdown, the running-distribution list confirmed that AgentopiaRuntime was stopped. Another Windows-shell launch started the backend, restored the account/chat, and reached six healthy required native services. Unrelated running distributions remained available. The renderer's actual profile argument matched the verified original directory. The app is left open and signed in.

The final database comparison retained both original accounts, passwords, roles, 93 earlier conversations and 304 earlier messages, plus all 45 immutable migrations. The two new diagnostic turns add four messages to the existing archived fixture conversation. Evidence is under `.supabase/desktop-tool-results/`.

The current installation remains in its original host-cache location. Standard installation-location and clean-machine/reboot qualification, full desktop parity, and broader browser, permissions, voice, and Windows application coverage remain separate gates. Startup duration was not qualified by this workflow.
