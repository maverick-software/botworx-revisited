# Browser sign-in in Sylvana 0.45.1

October 27, 2026. The installed desktop login screen offers **Continue with Sylvana**. Login, account creation, password selection, password recovery, and desktop approval happen on the website. Upgrade recovery uses the same browser flow. The installed Windows window was inspected after ordinary startup and contains no email/password, local registration, or first-administrator form.

## Account and data preservation

The user chose a fresh web account at `mail@enspyredigital.com`, with both old accounts archived together with their chats and settings. The user received the setup email, selected a password on the website, and reported setup complete. A subsequent read-only cloud check confirmed the identity, successful sign-in, active membership, and completed workspace setup. No user password was collected or stored by the development tools.

Both old cloud identities were retained and banned from sign-in. Their ownership records and content were not deleted. A protected recovery archive includes database/auth/Vault recovery material, the encrypted desktop profile, managed output, the prior profile selector, and the prior application image. The original profile and its stopped WSL runtime remain available for recovery. Archive metadata is in `F:/Sylvana-Data/profiles/private-recovery/20261027-web-only/archive-receipt.json`. Access is restricted to the current Windows user and SYSTEM.

The fresh account has a separate encrypted profile at `F:/Sylvana-Data/profiles/501d9962-f901-4207-8db8-2537c2dab5e4/profile` and a separate runtime. A format-4 verified selector records the fresh-profile cutover and binds it to the verified archive receipt. The fresh profile is pinned to the new cloud identity. Its encryption was checked by reading its saved state in a separate Electron process. The new workspace starts empty, as requested; archived chats and settings are retained with their original owners.

After installation, the original profile's 13,425 files and all five managed output files were compared with the archived inventories. File bytes, hashes, modification times, and directory inventories remained identical. The full original runtime was retained without applying the new schema to it.

## Authentication changes

The public desktop password, registration, first-administrator, and local user-creation actions are refused. Schema 92 also rejects local password authentication at the local Auth service. A refused password attempt does not log out a valid browser-backed session. User records and password hashes are retained for data preservation.

Verified browser login calls a shared internal activation routine, which reuses the verified cloud ownership identifier, checks local suspension and role rules, and establishes an internal session for the local data service. Connection, identity binding, and internal credentials are saved together using Windows encryption. A failed publication revokes the staged local session. The first user on an empty profile retains the existing local administrator bootstrap rule.

Restricted upgrade recovery has its own browser action and uses the same activation routine without constructing the ordinary broker or starting agents. Browser cancellation closes the callback listener, timers, and pending requests. Older callbacks and verification results cannot replace or clear a later account session.

Definitive local or cloud session loss stops account work and returns to browser login. Startup, foreground, and periodic checks validate web authorization. Temporary connection errors retain credentials for retry, and allowance refusals do not end login. Draft ownership guards remain active, including unsent text in a new workspace before an agent is selected.

The website supports recovery requests, protected recovery callbacks, single-use setup/recovery links, password confirmation, and return to the pending desktop consent request. Recovery state is encrypted in an expiring HttpOnly cookie. Password replacement requires verified recovery proof; replay is refused. Consent also offers account switching.

## Verification and delivery

Evidence is retained at `F:/Sylvana/verification/web-only-login-implementation/`:

- Fifty-one focused checks cover browser identity binding, atomic activation, session persistence and loss, profile selection, and restricted recovery. Type checking and the production build passed.
- Website unit, cloud, OAuth, recovery API, and browser checks passed. Recovery tests changed a generated account's password through the real cloud service, preserved its identity, and refused reuse of the link. Source secret scanning passed.
- Three packaged-application checks exercised real browser approval, actual local Auth activation, a cold process restart with encrypted session and unsent draft, local password refusal, web revocation, and restricted upgrade recovery. These checks used generated identities and made no paid AI requests.
- Six installer-payload checks verified the final installer, its embedded package and application image, runtime configuration, schema 92, and resource paths/sizes. Installation through the normal Windows shell verified all 7,559 installed files against their SHA-256 hashes. The actual installed window was then inspected.

The installed application image has SHA-256 `8e2536d521383a067b3406d075e691b677c429f4fa4f87e7fa5a0a22810bae93`. The installer has SHA-256 `28ce38701899661a90932131d2a03326b54436bcaa2dc33ae43555951c1619c1`. The installed app was left at the browser sign-in screen for the user's new account; the developer checks did not impersonate that user in the desktop.

The hosted download now serves 0.45.1. Its published file size and first/last 64 KB were checked against the qualified local installer. Initial public-object reads intermittently returned 404; bounded retries succeeded without uploading a second copy. Production deployment `dpl_FtHYAQbnhwMf8nXQUM9zNda7CBFV` reached READY, and the canonical release metadata, download redirect, and login route were verified. The final receipt is `F:/Sylvana/verification/web-only-login-implementation/delivery.json`.

The managed provider remains simulated, with the existing restrictions on unsupported inference and agent/tool workflows. This login release does not qualify those capabilities, release signing, production provider retention, or a full Windows reboot. Browser recovery and packaged process restart were verified as described above.
