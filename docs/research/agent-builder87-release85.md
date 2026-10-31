# Seamless agent creation in 0.44.85

The agent builder now applies each fresh AI response directly to the draft. Creation requests produce the name, description, supported icon and color, instructions, and one to six conversation starters. Instructions contain populated ROLE, INSTRUCTIONS, and CONSTRAINTS headings. Follow-up requests update the requested fields. The user can continue editing the draft and uses the existing Create agent or Save control to persist it; there is no separate review-suggestions step after each message.

The reported blank result was reproduced with a valid saved response containing all nine proposed fields. PostgreSQL stores JSON objects with a different key order. The editor compared serialized object order, incorrectly treated the unchanged capability catalog as stale, and returned before applying the core fields. Normalizing the catalog before comparison fixes that failure while retaining ownership, availability, and stale-response checks. Draft comparisons likewise tolerate object key order and preserve meaningful array order and manual edits.

Incomplete initial generation receives at most one automatic completion request. An uncertain request is never replayed. A retained pending response can complete after reopening only when its owner, source, model, creation context, and draft basis still match. Capability assignment continues through the existing owned APIs, and an assignment error no longer withholds otherwise valid core content. Icon selection uses the existing icon library; image generation remains disabled.

## Verification

- Thirty generation and instruction contract checks passed, including complete creation, the three populated headings, legacy prompt recovery, and field comparisons.
- Twenty-two editor checks passed with delayed responses and database-serialized JSON, covering direct application, follow-up changes, recovery, and bounded completion.
- Twelve capability-resource checks passed, including reordered objects and rejection of genuinely changed catalogs.
- Eight composer and chat-progress checks passed, retaining the single focus treatment, separator, and font alignment.
- Preservation policy checks and both TypeScript builds passed.
- The actual packaged application completed an isolated upgrade and cold reopening. All original rows across 144 tables were compared, and the cold reopening sent no model requests.

The optional fresh live-model check stopped before a model request because the saved access token had expired. No refresh credential was copied into the test account, and no model request was sent. Fresh live-model generation therefore remains unconfirmed; the reproduced database-roundtrip failure and editor behavior were verified locally.

## Package and installation provenance

The application was built from commit `c80f4fa721fab44f2e02ee22db87e798a950fbc3`. Package proof: `F:/Agentopia/.supabase/desktop-release85/1793034289860/package-proof.json`. Application archive SHA-256: `6569d547fc5f9b401738c060c58ec413ab66e64564376ce8dad50371a721b903`. Schema 90 and recovery capability 18 are unchanged; this release adds no database migration or dependency.

Full installer verification found that the shared launcher version allowlist ended at 0.44.84. Its sole change adds 0.44.85. Actual executable-section, template, machine, and negative mutation checks passed. The successful qualification remains immutable. A reviewed installation controller attests the exact helper change, verifies every other frozen source hash, and reversibly derives the existing controller without changing backup, rollback, idle-close, database, or credential checks. Its receipt is `F:/Agentopia/.supabase/desktop-release85/1793034289860/stub-controller85-1793035728697/worker-proof.json`.

Installation and final native acceptance are recorded separately in the release's installation evidence and completion receipt.

The first installation attempt stopped before invoking the updater. Independent recovery validation exposed an older Python reader that accepted editor and preview drafts but omitted the builder locations already supported by the application. It also omitted the builder's saved application receipts. The prior version was reopened normally. The correction adds those exact locations and receipt validation, preserves the account/source/creation bindings and existing size limits, and retains the capability requirement for creation-bound drafts. Nine focused regression groups pass, including malformed and foreign records. The replacement candidate keeps the same application archive and changes only this recovery reader. Its qualification validates the exact retained backup that exposed the issue, performs a new isolated cold reopening and strict database comparison, and retains the original successful upgrade evidence without repeating that upgrade.

The replacement proof is `F:/Agentopia/.supabase/desktop-release85/1793036393888/package-proof.json`, with source commit `e6fabdb` and recovery-reader SHA-256 `42a637cf5436f7170e6a75ca13c8c4ee2e710d6be868e6da48bdb4e90a6c0352`. This candidate passed the retained full recovery validation, cold packaged reopening, comparison of all 144 database tables, and four negative package-mutation checks. Original qualification and upgrade receipts remain byte-identical. Its fresh qualification includes the reviewed launcher allowlist and recovery correction, so normal installer construction and installation use the frozen scripts directly.

## Delivered

Version 0.44.85 is installed at `C:/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.85/Agentopia.exe` and reopened normally. Final receipt: `F:/Agentopia/.supabase/desktop-release85/1793036393888/installation-1793036941194/completion.json`. The installed archive and corrected reader match their qualified hashes. All six core services are healthy. The strict database comparison preserved every original row, account password and role, readable Vault entry, and encryption binding. All protected settings and provider connection values were identical after reopening. Image generation remains disabled. Native inspection confirmed the retained conversation and document link, composer appearance, and Worked for separators.

During installation, Windows' Linux runtime timed out before the updater ran. A normal WSL shutdown and restart restored operation. The saved closed-app attempt resumed with a narrowly attested controller that accepts that exact recorded startup error; every backup, rollback, database and credential check remained unchanged. The updater then completed successfully. Both earlier failed attempts and all recovery files remain available. Fresh live-model generation remains unconfirmed as described above.
