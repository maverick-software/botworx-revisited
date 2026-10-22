# Private Windows candidate 0.44.2

October 17, 2026. The Windows installer is built and its embedded payload is verified. **It is not installed.** The ordinary application remains 0.43.7 with production schema 45. Full desktop parity and the live/installed release gates remain open.

## Included changes

This candidate carries the persistent named-agent and OAuth recovery work from frozen 0.44.0, the folder-upload and compact browser-activity work from private 0.44.1, and the new reviewed plugin file/folder/ZIP importer. It also adds migration **0055-browser-folder-receipts.sql**, which prevents simultaneous deliveries of one folder-upload call from creating separate receipts. Earlier migrations retain their original contents.

Compared with 0.44.1, the backend adds `plugin-import.js` and `plugin-picker.js` and changes only `broker.js`. The other 1,008 compiled modules and all 2,232 packaged dependency files are byte-identical. The delivered interface includes the reviewed import controls and compact source label. The source project version remains 0.43.6 under the existing coordination agreement; the private package identifies itself as 0.44.2.

The importer reads declarations without extracting or executing package files. It retains schema/address/digest review before installation and existing agent assignment and protected connection settings. Executable package skills/hooks, local MCP servers and OAuth-only plugin connections remain outside the importer's implemented capabilities. [Behavior and source qualification](plugin-file-import.md).

## Verification

- **59 focused tests** exercise the exact compiled inputs delivered in the package: importer handling, both provider response formats, ChatGPT defaults and recovery, model/thinking rules, agent policy/queue/references and sign-in persistence. Provider responses are controlled; no actual inference occurs.
- **11 delivered-interface checks** use the actual minified UI. They cover saved chat/draft restoration, compact folder activity, agent switching, retained provider/model choices, historical attribution, retired agents and reviewed plugin import. The real archived broker and parser reject changed accounts and protected paths; the picker and installation store in these checks are controlled.
- **21 actual Chromium cases** load browser modules directly from the archive and independently verify directory bytes and relative paths. They include the 100-file boundary, embedded documents, closed browser components, visible/minimized window behavior, cancellation, revocation, budgets and cleanup.
- **Two actual Windows picker workflows** select a generated ZIP and folder through Computer Use. Both return the same package digest through the archived broker/parser to the delivered UI, without installing a plugin. They use an isolated profile and controlled account/store. Two unavailable-geometry input attempts were followed by fresh modal/receipt observations and refreshed foreground captures before retry; the final native selections succeeded. Ordinary installed-account qualification remains separate.
- **Six installer-payload checks** verify the setup hash, all 6,146 resource paths and sizes, archive integrity, the application's archive hash, migration/schema metadata and the full application package embedded inside Setup. The embedded package and its `RELEASES` record match the standalone package.

The earlier seven real Supabase/PostgreSQL temporary-record checks establish plugin storage/assignment, controlled MCP discovery/execution/revocation and saved folder-tool activity. The exact new migration passed five actual PostgreSQL cases in a removed disposable database, including competing connections. Production did not receive that migration; its two original accounts, 101 conversations and 338 messages remained. Those checks retain their own earlier evidence and scope.

No live ChatGPT or OpenRouter inference was used for this candidate. No service was started or restarted, and no production migration or installed application replacement occurred. Read-only inspection still finds an expired saved ChatGPT access token. The earlier rejected renewal requires fresh human authorization; this preparation did not retry it.

## Artifacts and recovery record

Candidate directory: `.supabase/desktop-plugin-import/candidate-0442/`.

The setup executable is `staging/out/make/squirrel.windows/x64/AgentopiaSetup.exe`, 1,502,569,472 bytes. Its SHA-256 is `7ae47bb1ba78f03bafdf6b45e2d1c141e461053b8d6d01a87cc21c921793d799`.

The application archive SHA-256 is `08f270c12b86bc145de48c7c6a0cb008694fb9c73407449a873499a89d9ffa9c`. It contains 1,011 compiled modules. The resources include 55 immutable migrations and schema metadata 55. The full application package inside Setup has SHA-256 `55243ecf9033d6ee6dc6ba37e8f29a63126b90b978e141071d26eb0202a5e361`.

`preparation.json`, `package-proof.json`, `qualification.json`, `installer-proof.json` and `installer-verification/evidence.json` preserve the build and payload checks. `units/`, `built-ui/`, `packaged-directory/` and `native-picker-1792288947652/` contain their separate evidence. The native fixture closed cleanly and left the ordinary app open. `release-proof.json` combines these receipts without replacing the earlier checkpoints.

The first copied resource metadata still reported schema 54. `metadata-correction/` retains its original bytes and proof before correction. Prepared and delivered metadata were corrected to 55 before installer creation; the application archive, compiled modules and UI were unchanged. Installer verification independently reads the corrected metadata and migration from the application package.

The installer was made from the already qualified package, avoiding a second compilation. The pinned Squirrel helpers received the same bounded large-address-space adjustment used by earlier releases; their original bytes are retained privately and were restored after creation. Frozen 0.44.0 and 0.44.1 archives still match their original hashes.

Repeat the read-only portable comparison with `node scripts/desktop/verify-plugin-followup-release.mjs --inspect`. Preparation, packaging, unit/interface/browser verification and installer creation use separate private scripts and do not alter shared build output. Scripts that create evidence or artifacts refuse to overwrite a previous operation; inspect its recorded outcome instead of replaying it.

## Remaining acceptance

Fresh human ChatGPT authorization is needed before exact-image live browser and persistent-agent acceptance. The actual iframe coordinate-review draft and fixture remain preserved for continuation without replay. A production update then needs a fresh verified backup, coordinated ordinary-app close, the recorded installer, schema/data/credential checks and installed navigation/history, native picker, startup and recovery verification. Latest-release Windows reboot and clean-machine gates remain open.

The wider goal also includes remaining physical voice, broader Windows/display and Chrome-profile cases, executable plugin capabilities and visual/interaction parity. [Full requirement checkpoint](capability-acceptance-snapshot.md). A small wide-dialog layout issue remains visible: the example and JSON-edit utility links need spacing in the next UI pass; it does not affect package review or execution.
