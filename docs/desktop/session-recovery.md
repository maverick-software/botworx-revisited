# Saved local sign-in recovery

Current behavior, October 27, 2026: Sylvana 0.45.1 requires **Continue with Sylvana** for login and upgrade recovery. The website handles passwords and password recovery. Local users and content remain stored locally, and the token-persistence safeguards described below still protect the internal data session. User-facing local password authentication is disabled. See [web-only login](web-only-login.md) for the current implementation and verification record. The following notes describe the earlier 0.43.7 repair and its historical evidence.

October 17, 2026. Included in installed 0.43.7. Compilation, focused authentication checks, five encrypted process-restart phases and the packaged interface workflow pass. Ordinary startup restored the existing administrator without entering a password. The application is open and signed in. See [the coordinated release](maintenance-0.43.7.md).

## Finding

The native Supabase authentication log records an HTTP 400 `refresh_token_already_used` response at 2026-10-17T23:41:32Z, when ordinary startup reached sign-in. The existing administrator password authenticated successfully afterward, and both provider connections, conversation history and workspace tabs remained available. The failure concerned the application's saved local sign-in credential.

Supabase renews access by rotating its refresh credential. Agentopia previously saved the replacement only at the end of `Broker.identity`, after user validation and a separate role lookup. A controlled reproduction using the actual Supabase JavaScript client made renewal succeed twice and made the subsequent role lookups fail. The encrypted-store interface still held the initial credential; a new client then received `refresh_token_already_used`. This establishes a concrete persistence defect with the observed failure outcome. The historical logs do not establish which operation interrupted the original application's persistence, so the exact historical trigger remains unproven.

## Change

The broker now subscribes to successful sign-in and refresh events. Supabase waits for the event handler to finish, so the replacement credential is saved through the existing Windows-encrypted store before the authentication call completes. The handler performs no further Supabase calls, which avoids re-entering the client's authentication lock. Later user or role checks no longer own token persistence.

Startup retains the saved credential on network, service, rate-limit and unknown errors, and exposes the existing startup Retry flow. Definitive invalid-credential responses clear the rejected saved pair and allow sign-in. A rejected old attempt cannot erase a newer saved pair. Failure to validate a restored account now stops startup for retry instead of being silently treated as a signed-out account.

Persistence is suspended while signing out or switching accounts. Explicit logout still clears local sign-in even if server logout fails, and late events cannot save a session after logout. Provider OAuth tokens, OpenRouter credentials, passwords, database schema and account roles are unchanged by this implementation.

## Verification and remaining work

The isolated checks use the real authentication client and broker with controlled local responses, in-memory credential storage and deliberately advanced time. They verify rotated credentials across a fresh client, interrupted role lookup and successful retry, temporary versus definitive restoration failures, newer-session protection, logout races and credential-write failure redaction. The existing logout regression checks run against the same isolated broker build. They make no live model requests and do not modify the installed profile or database.

An additional durable test passes across five actual Electron process exits and reopenings. It uses the real Windows `safeStorage` encryption, `Secrets`, broker and authentication client in a unique test profile. Two successful rotations survive deliberately failed role lookups. A fresh process loads the encrypted file, renews the credential again and restores its identity without a password. A rate-limited startup leaves the exact encrypted file unchanged. The following process restores successfully, signs out locally while the controlled server rejects logout, and another fresh process remains signed out. The credential file is checked for absence of plaintext credential fields and values. The backend responses and clock are controlled, and the production application, profile, database and providers are untouched.

Run `node scripts/desktop/test-session-recovery.mjs` with `AGENTOPIA_SESSION_MODULES` selecting compiled modules and `AGENTOPIA_SESSION_OUTPUT` selecting a fresh private output directory. The fixture closes each owned Electron process normally and stops its loopback server.

Initial evidence is retained in `.supabase/desktop-session-recovery/rotation-reproduction.json`, `auth-checks.log`, `durable-process/evidence.json` and `evidence.json`. Exact candidate-module checks, actual packaged-interface restart recovery, the installed file audit and ordinary account restoration are retained under `.supabase/desktop-maintenance-0437`. The installed administrator restored automatically after the update, with its original history, workspace and ChatGPT default. The earlier historical interruption remains unproven, and a full Windows reboot of this release remains a separate qualification.
