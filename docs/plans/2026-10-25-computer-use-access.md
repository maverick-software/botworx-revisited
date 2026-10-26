# Persistent Computer use access

The user reported that Agentopia requires selecting and approving application windows for each chat. The current implementation stores temporary window grants and reviews each input under Default permissions. This creates repeated setup and review during an ordinary application task.

The requested outcome is an account-level Computer use page with persistent application choices. A user can enable Any App, or allow particular applications. An allowed application can be discovered in later chats without selecting each window again. Ordinary inputs within that explicit allowance do not request approval for every click or keystroke. Account-wide plugin enablement and individual agent capabilities still determine which agents receive the computer tools.

## Stages and acceptance

1. Extend the existing computer service and native helper with encrypted, account-owned preferences and verified application identity. Keep existing temporary window grants compatible. New global access starts disabled; installing the update does not silently expand existing authority. Dynamic window discovery remains restricted to permitted applications. Plan mode permits inspection, and Chat only withholds computer tools.
2. Add the genuine global Computer use page, including Any App, saved application choices, Stop and Resume. Replace mandatory chat window selection with access status and navigation to these controls. Retain removal of existing shared-window context for compatibility. Show only integrations that Agentopia actually provides.
3. Verify persistence across chats and service restarts, account separation, ordinary inputs without repeated review after an explicit saved allowance, cancellation and revocation before input, protected-window handling, fresh observations, agent capability checks, and preview behavior. Exercise UI changes in an isolated test; do not change production permission choices during verification.
4. Build and qualify the complete desktop update, including its native helper. Use the accepted installed 0.44.81 renderer repair as the baseline. Take recoverable production backups, normally close the app, install and reopen, then verify packaged resources and preservation of the original database rows, credentials, provider connections and image-generation setting.

Stop must cancel active computer work and invalidate temporary grants. Saved choices remain visible, with explicit Resume required after an emergency stop. Password, authentication, security, terminal and control-overlay protections remain enforced. A saved app allowance uses executable identity rather than a display name alone. Removing an allowance must invalidate work already prepared against that allowance.

No database migration or provider configuration change is intended. Existing data and permission choices are preserved. The installed default remains disabled until the user chooses global or application access.

## Status

Implementation and qualification in progress. The installed application remains the accepted 0.44.81 build until the complete update has passed its required checks.
