# ChatGPT connection renewal and recovery

## Ordinary-profile renewal succeeded — October 18, 2026, 12:24 AM Pacific

Clicking the existing Agentopia shortcut in File Explorer launched the installed 0.43.7 application against the ordinary physical profile. Launching the executable directly through the computer-use launcher had inherited the package-cache view instead. Physical credential-file hashes establish the difference; an executable path or the reported profile root alone did not.

The ordinary profile's old local Supabase session was rejected and cleared during startup. A session-only repair validated the latest retained local access token against the current backend and checked the existing administrator role. It merged only that local session into an encrypted copy of the ordinary store, independently compared all other saved values, and committed the result while the app was closed, with source-file hash guards. Account passwords, provider credentials and settings were preserved. No local token renewal, OpenAI request or OpenRouter request was made by this repair. The app reopened signed in as the original administrator.

The restored new-chat composer selected ChatGPT / GPT-6.1 Sol / High, with the existing ChatGPT-default preference enabled. One minimal message through the actual interface returned its exact verification marker. Saved request `7e1793ed-7290-4957-a738-664719bfa537`, conversation `4d752d56-3037-4f5f-b7b6-5752add39e22`, completed through Codex 0.163.0 with `openai-oauth`. Database reads found exactly one submitted message/request and its completed reply, with no tool calls.

Physical inspection immediately before and after the request confirms that the ordinary profile's ChatGPT access and refresh credentials both changed, while the issued client and account identity remained the same. The expired access token was replaced with a valid one, with about 59 minutes remaining at the post-request inspection. The package-cache credential file retained its pre-test hash. This establishes successful on-use renewal and persistence in the actual running app. No human reauthorization is required for this connection at this checkpoint; no OpenRouter inference was used.

Evidence: `.supabase/desktop-workspace-agents/local-session-transfer/1792308137769/{evidence.json,commit.json,live-evidence-verified.json}`; before inspection `authorization/1792308191573`; after comparison `authorization/1792308282156`. Paths are under `.supabase/desktop-workspace-agents`. The backup and exact 0.44.8 startup checks also passed, but this authenticated live message used installed 0.43.7. Full current-candidate live and installed acceptance remain separate work. Never renew credentials from a detached copied store or retry the old rejected package-cache pair.

## Physical-store correction — October 17, 2026, 11:42 PM Pacific

The earlier authorization inspector checked the resolved profile directory, but Windows package virtualization redirected its individual Local State and credentials.bin reads into the older Codex package cache. A new read-only inspection stages the actual ordinary files through WSL filesystem access, verifies their source/copy hashes, and decrypts only that protected copy with the installed application's storage module. The legacy inspector now refuses redirected files.

The physical current store has a saved local session, ChatGPT plan scope, seven cached models and the enabled ChatGPT-default preference. Its access token is expired. Compared with the retained package store, both access and refresh credentials differ, while client and account identities match; the current access expiry is 18,032 seconds later. No current refresh attempt, provider inference or canonical credential write occurred. This establishes that the older failure and inspection cannot determine whether the current refresh credential works. Human reauthorization is conditional on the outcome of a correctly sourced current-credential renewal.

Evidence: `.supabase/desktop-workspace-agents/authorization/1792305725510/evidence.json`, `physical-source.json` and the frozen inspector. Token values are not printed. The source files remain unchanged. After the active full-profile backup completes, verify renewal through the ordinary installed application so any rotation is saved in its real store; do not replay the older rejected credential or use OpenRouter as a fallback. The older observations below retain their historical scope.

Source checkpoint, October 17, 2026. These changes are qualified in source and handed to the coordinated 0.44.0 release. The installed application remains 0.43.7 until that release is separately packaged and verified.

## Observed failure

The native-UI iframe browser test selected ChatGPT and stopped during authorization before creating its chat request. A read-only query for the exact generated prompt found no request or user message. The owned fixture recorded no page load or click, so the verification had not reached inference or browser input.

One controlled renewal through the installed provider code returned HTTP 400 with OAuth code `invalid_grant`, request ID `b1c17471-08d5-4bab-8d83-0456371ee6c0`. Its access token had expired 23,329 seconds earlier. The saved issued client ID, refresh credential, stable host identifier and plan-usage scope were present. The encrypted credential file remained unchanged. An initial isolated helper stopped before making any token request; the corrected helper used an isolated copy of the application's encrypted Local State so Windows could decrypt its existing store.

OpenAI documents `invalid_grant` during renewal as an unusable refresh credential requiring fresh authorization with the saved issued client ID. It also requires serialized renewal and keeping the latest rotating token set together. [Refresh recovery](https://developers.openai.com/siwc/token-sharing-open-source/errors-and-recovery#refresh-errors), [token renewal and storage](https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions#refreshing-tokens).

The earlier UI label reflected the saved plan grant. The installed code discarded the renewal response body and reported every HTTP failure as requiring reconnection, so it could not distinguish a temporary outage from a rejected credential. The exact reason OpenAI invalidated that credential is not established by the captured code.

## Source behavior

Renewal failures now retain bounded, sanitized diagnostic fields: HTTP status, recognized machine-readable code and provider request ID. Provider messages, arbitrary response text and token values are excluded. The connection pane distinguishes a rejected renewable session, configuration trouble and temporary failure. Temporary failures offer Retry; successful reconnection refreshes the displayed account state.

An unusable token pair is cleared while its issued registration and validated identity remain available for reauthorization. Explicit local disconnect also retains the registration mapping for later sign-in. A returning sign-in uses the same client and host identifiers. These changes do not add remote token revocation to the existing disconnect implementation.

Temporary failures retain credentials. Concurrent requests share one renewal. A received replacement is journaled through the encrypted store before remote identity-key validation. If that lookup fails, another process can validate the saved replacement without reusing the previous refresh credential. A delayed journal is validated against the time its response was received, then an expired access token is renewed using its latest saved refresh token. Returned identity fields cannot replace the selected account's registered identity. A mismatched or invalid signed identity is never activated.

Disconnecting or activating a newer connection prevents an older renewal result from replacing it. A failed credential-store write keeps the received rotation in the running provider instance and reports a storage error, allowing persistence to retry without another renewal. If neither the encrypted journal nor the active token pair could be saved, process loss still loses that in-memory receipt; fresh authorization may then be necessary.

ChatGPT remains the selected preferred provider when its recorded connection requires recovery. Saved conversations and unfinished drafts retain their choices. Recovery does not switch to OpenRouter or load its catalog. The user can still select OpenRouter explicitly.

## Verification

Backend and renderer type checks pass. The 25 focused checks cover OAuth sign-in/renewal, error redaction and classification, retained registration, shared renewal, account/disconnect races, identity-key interruption, delayed journal recovery with concurrent callers, malformed responses, storage failure, provider defaults and the existing OpenRouter streaming/catalog behavior.

Four actual Electron processes pass with Windows encryption in an isolated profile. The first receives a rotation and journals it while identity-key lookup fails. The second loads the encrypted journal and completes validation without another token request. The third records a terminal rejection while retaining registration. The fourth restores that reconnect state without retrying the rejected credential. Encrypted files are checked for absence of the synthetic token values. These phases use controlled responses and never access the canonical application profile, production database or real providers.

The actual React connection pane passes controlled reconnection, temporary retry, duplicate-operation prevention and light/dark layout checks. Its first screenshot attempt used a hidden verification window and timed out; the corrected inactive visible test window passes. No product change was needed for that screenshot issue.

Frozen source hashes and evidence are in `.supabase/desktop-oauth-recovery/source-proof.json`, `checks-storage.log`, `durable/evidence.json`, `ui-qualified/evidence.json` and `attempt2/renewal.json`. The companion live iframe fixture is retained at its saved draft URL, with zero submitted requests and zero page actions recorded at the checkpoint.

## Remaining work

Ordinary-profile renewal and a minimal actual-Codex chat now pass as described above. The combined release still requires current-candidate live acceptance, installed verification and its remaining workflow checks. The iframe visual test must inspect saved request records and fixture state before any submission. No live OpenRouter inference was used for this recovery work.
