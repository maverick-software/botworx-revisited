# Native Codex image generation investigation

October 18, 2026. The ordinary installed application remains 0.44.24/schema67, with image generation unconfigured. Current source integrates a pinned image plugin, separate image connections, the existing Codex host-tool executor, an atomic PostgreSQL operation journal, encrypted assets and inline chat controls. Controlled source and packaged qualification pass; live configured-provider and ordinary installation acceptance are still required.

## Finding and connection choice

The bundled Codex 0.163.0 contains its native `image_gen.imagegen` extension, but Agentopia's current provider configuration excludes that tool from the model's actual tool registry. Changing the provider's display name to OpenAI does not enable it. A controlled local actor-proxy configuration registers the real tool and successfully invokes its native HTTP, events and saved-image path using a generated fixture response. This establishes a way to integrate the existing harness; it does not establish live account eligibility or an OpenRouter image adapter.

OpenAI's [Codex image-generation documentation](https://learn.chatgpt.com/docs/image-generation) describes the built-in tool, local image files and Codex usage. The [public Images guide](https://developers.openai.com/api/docs/guides/image-generation) documents API image requests, while the [app-server authentication reference](https://developers.openai.com/codex/app-server) documents external ChatGPT token handling. Live checks below establish that this application's current subscription-sharing connection rejects both documented image paths. OpenRouter support remains on its existing chat connection; image generation needs an explicitly configured image-capable plugin connection.

## Live connection findings

The ordinary app refreshed only its selected ChatGPT catalog, renewing its existing connection through the normal flow. Read-only physical inspection `1792364946723` verified the same account/client, direct-use scope, seven cached models and unchanged OpenRouter key/default. The eligibility helpers read an encrypted copy, perform no detached refresh and make no canonical credential writes. Two distinct requests were recorded durably before dispatch:

| Supported API path tested | Recorded result | Consequence |
| --- | --- | --- |
| `POST https://api.openai.com/v1/images/generations`, native `gpt-image-2` payload | HTTP401, `hardened_oauth_rule_missing`, `rejected_by_hardened_oauth_boundary`; provider request `req_4b6af401969b4069a8cec78f12f122f6` | This connection has no allowed Images route. |
| `POST https://api.openai.com/v1/responses`, selected `gpt-6.1-sol` with the documented `image_generation` tool | HTTP400, `subscription_sharing_unsupported_capability` | Using the existing Responses route does not grant image generation. |

Evidence: `.supabase/desktop-image-generation/eligibility-1792364953214/evidence.json` and `responses-eligibility-1792365011687/evidence.json`. The second check followed a definite rejection on a different API path. Neither request returned an image; neither was retried; OpenRouter received zero requests. `eligibility-public-images.json` and `eligibility-responses-image-tool.json` prevent replay, including after uncertain outcomes. Do not rerun these requests.

The supported Sign in with ChatGPT text connection remains intact. The app-server authentication documentation distinguishes managed Codex login from Sign in with ChatGPT and constrains the deployments where managed login is permitted. A separate managed Codex account would require its own eligible integration and user authorization; its capabilities cannot be inferred from the current subscription-sharing credential. The existing [Sign in with ChatGPT app-server integration](https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server) uses a custom Responses provider with OpenAI-auth delegation disabled, matching Agentopia's current connection architecture. Keep that supported connection and native agent loop intact while adding an explicit image-capable plugin connection with visible provider/costs. The user was asked whether that should be the existing OpenRouter connection or a separate OpenAI API connection; no image provider/model has been activated.

## Qualified source foundation

`image-generation-contracts.ts` defines a separate image connection and a `generate_image` tool with bounded prompts, transparency choice and at most five selected attachment/generated-asset identities. It rejects credentials, endpoint URLs, model overrides and arbitrary reference URLs in agent arguments. The native private MCP catalog now preserves tool annotations; this tool is marked as a non-idempotent external operation.

`image-generation-transport.ts` makes one dispatch through an injected host credential and current-authorization guard. It waits for a durable dispatch callback, disallows redirects and provider fallback, bounds replies, imports inline raster bytes and distinguishes a rejected request from an uncertain result. It supports the [documented OpenRouter Image API](https://openrouter.ai/docs/guides/overview/multimodal/image-generation) and separate OpenAI API-key generation/editing. This adds no automatic fallback from ChatGPT to either paid connection. The transport checks signatures; final image decoding and normalization happen in the store.

`generated-images.ts` imports decoded PNGs using Windows encryption, binds every asset to its owner, request, conversation and native thread, checks content hashes, and refuses overwriting, symlinks/junctions and hard-linked asset files. Revocation after writing preserves encrypted bytes for inspected recovery while withholding the result. It performs no provider requests or automatic deletion.

The current source compiles and passes nineteen isolated checks at `source-check-1792365655597/evidence.json`. They include the existing private MCP authentication/cancellation checks and actual bundled Codex tool discovery without inference. Windows `safeStorage` and real Electron image decoding also pass a separate write/read across two processes under a new isolated profile at `windows-store-1792365579156/evidence.json`. It reopens a 640×360 generated fixture and rejects a wrong-conversation scope. This is real Windows encryption/reopen evidence, using generated fixture bytes and no production profile or AI image request.

The first isolated test harness omitted the desktop CommonJS package boundary and failed before tests executed; its evidence is retained at `source-check-1792365283183`. Later runs corrected the harness. Passing earlier source versions remain in their own directories.

Next work is the plugin manifest/assignment and protected connection controls, atomic operation journal and approval/cancellation integration, reference loading through existing permissions, inline image viewer/save/reference flows, recovery, and one provider-specific live image test after explicit connection configuration. Transport/store tests alone do not establish those behaviors.

## Reproducible source and probes

The read-only reference checkout is official `openai/codex` tag `rust-v0.163.0`, tag object `129b8ec7ee6f4511557a4856279f529025c25af4`, detached commit `83086188ae0614bd882818ff1aa23f3194962012`, under `.supabase/desktop-image-generation/codex-source-0163`.

Relevant pinned source:

- `codex-rs/core/src/tools/spec_plan.rs`: image tool availability requires the feature, image-capable model and eligible provider/authentication path; a Free account is excluded.
- `codex-rs/model-provider-info/src/lib.rs`: actor authorization is advertised by a non-empty `x-openai-actor-authorization` provider header with `requires_openai_auth=false`.
- `codex-rs/ext/image-generation/src/backend.rs`: requests use the active provider's `images/generations` or `images/edits` route and `x-codex-image-turn-id`.
- `codex-rs/ext/image-generation/src/tool.rs`: the tool uses `gpt-image-2`, emits native image items, saves generated bytes and returns a local output hint.
- `codex-rs/codex-api/src/endpoint/session.rs`: image POSTs use the provider's retry policy. The inspected image request construction has no per-tool-call idempotency header.

`scripts/desktop/probe-native-image-catalog.mjs` runs the actual delivered executable against generated database/token fixtures. The native ChatGPT backend is disabled. Every external fetch is replaced with a controlled response; no real credentials or inference are used.

| Probe | Saved directory suffix | Established result |
| --- | --- | --- |
| Current configuration, actual registry inspected | `catalog-1792363976989` | `image_gen.imagegen` is absent for both simulated provider configurations. |
| OpenAI display name only | `catalog-1792363911504` | Tool remains absent. |
| Actor-proxy fixture, registry inspected | `catalog-1792363961634` | Actual image tool is registered. Simulating an OpenRouter configuration does not establish a usable OpenRouter image backend. |
| Native image invocation with controlled local Images response | `catalog-1792364188479` | One image request, completed native image event, saved PNG and matching response/file hashes. |

The protocol probe uses a separate loopback server and deliberately bypasses the production gateway. It sends two controlled Responses requests and one controlled Images request, with zero live provider requests. The fixture PNG is generated locally by the artifact verification; it is not an AI-generated picture.

The observed Images body contains `prompt`, `background`, `model`, `quality` and `size`. It has the native turn ID but no `thread-id` or `x-codex-turn-metadata` headers. The saved native item contains the image's base64 string and a private path below that probe's own native home. The file hash is `ba4a800e4915592e9d86da3d35ac131e7f1b6055a4742e545c1c5e756a450df2`.

## Historical native-extension integration option

The following list described the native-extension option before the live subscription-sharing rejection. The implemented path below uses a host MCP plugin in the same Codex agent loop. It does not enable the actor-proxy option or substitute another authentication grant.

1. Add scoped image routes to the authenticated loopback gateway. Resolve the native image turn to one active owned thread, revalidate the connection and agent's current tool policy, and cancel upstream work when ownership or execution ends. The current gateway accepts only `/v1/responses`.
2. Use a private ephemeral actor-proxy credential to advertise the native tool. Keep real provider tokens in the host process, validate both local credentials and remove the local actor header before forwarding. Never forward a generated fixture credential to a provider.
3. Define image capability and policy explicitly. Chat only, Plan mode, restricted saved agents, children and revoked grants must not gain image operations by changing a configuration header. Unsupported connections need a clear unavailable state and no automatic paid fallback.
4. Persist an operation identity and uncertain outcome before dispatch. Native image requests identify a turn rather than an individual call, and provider retries can repeat a POST. Do not replay a completed or uncertain paid operation. Parallel calls and identical prompts need distinct operation identities.
5. Import saved results into owner-scoped durable artifacts with verified bytes, MIME type, size and path confinement. Bind previews/downloads to the correct conversation and child; preserve them through reopen. Do not expose arbitrary native-home paths as public links.
6. Bound native image events before persistence and display. Current native state retains raw base64, while the app-server transport rejects JSON lines above 16 MiB. The native image executor accepts up to 32 MiB of image bytes; enabling it without addressing transport and storage limits would fail on valid larger results.
7. Validate edit/reference image ownership and bounded payloads. Exercise malformed images, cancellation, revocation, quota/authentication errors, restart and uncertain outcomes with controlled tests before one live ChatGPT image request. Qualify generation and editing separately.

The next implementation should retain one native Codex agent loop with provider-specific image transport and capability rules. A second agent harness is not required by the evidence obtained here. The supported live connection and end-to-end saved-output behavior remain acceptance gates.


## Integrated image plugin — controlled source qualification

The selected implementation retains the actual Codex agent loop and exposes `tools.generate_image` through Agentopia's private host MCP connection. The bundled native `image_gen.imagegen` extension stays unavailable under the current subscription-sharing grant. The host plugin uses a separate explicitly selected OpenRouter or OpenAI API-key image connection. It starts disabled/unconfigured, does not change the chat connection, and does not fall back to paid generation automatically.

`image-generation` is a pinned bundled manifest with a reserved managed extension. Imported packages cannot select that runtime. Account enablement, an active agent assignment, the configured image connection, work mode and Default permissions or Full access are required. Named-agent tool restrictions apply before the image service is invoked. Every generation uses the existing inline external-tool review, including its exact prompt, references, provider/model and available usage pricing.

Migration0068 creates a service-only journal and transactionally claims an image operation with its tool activity. The request, owner, conversation, child thread, stable call identifier and argument/reference hashes are bound before a POST. Concurrent calls with the same identity produce one review and one dispatch. A completed call returns its receipt. An uncertain call blocks new automatic attempts in the same request. Definite rejection and confirmed pre-dispatch failure remain distinguishable from uncertain remote outcomes. Functions that mutate records are VOLATILE so PostgREST can execute their transactions.

OpenRouter capability checks read the official public image-model endpoint catalog before review. They choose a compatible endpoint, constrain routing to that endpoint with fallback disabled, honor reference counts and transparency, and omit optional defaults that endpoint does not advertise. References contain selected attachment bytes or already completed generated assets from the same conversation; URLs, arbitrary paths, model overrides and credentials are not accepted in agent arguments. OpenAI API keys are separate owner-scoped protected values; ChatGPT OAuth credentials are never substituted.

Full image bytes are decoded, normalized to PNG and encrypted below `attachments/generated/<owner>/<operation>.bin`, with account/request/conversation/native-thread bindings and a content hash. The store bounds reads from an opened file and checks for replacement, truncation or growth. The journal stores metadata and receipts; the agent receives a bounded thumbnail. Chat results appear outside collapsed activity with expand, Save and edit-reference controls. Edit prepares a draft without submitting it and preserves existing text; a dedicated child chat uses its separate draft. Save uses an explicit native destination and refuses to overwrite an existing file. An interrupted call can inspect an already stored image explicitly, without contacting the provider.

The image connection/key changes and explicit local-result recovery participate in the broker's backup-operation exclusion. Existing profile capture includes the nested generated assets. The original installed credentials, conversations, image draft, app image and schema have not been changed by this source work.

### Evidence and practical limits

- `.supabase/desktop-image-generation/source-check-1792366623001/evidence.json`: 34 passing checks, no failures. The source backend compiler passes. Tests use the real migration in an embedded PostgreSQL engine, exercise the actual ToolService inline decision path and named-agent denial, race duplicate calls, preserve uncertain outcomes, validate edit reference ownership and recover a stored result without a second POST. The actual bundled Codex executable discovers and calls the image host tool, receiving its saved result and thumbnail without model inference. Provider HTTP responses and image storage in those service tests are controlled.
- `.supabase/desktop-image-generation/ui-1792366607949/evidence.json`: five rendered Electron workflows for disabled-by-default connection settings, saving a separate key without losing the selected provider, explicit enable/save, images outside collapsed native activity, expand/save and preparing an edit while retaining existing text. The UI bridge is controlled. The displayed image is a locally created verification fixture, not AI-generated artwork.
- `.supabase/desktop-image-generation/windows-store-1792366467555/evidence.json`: actual Electron raster decoding and Windows safeStorage encryption, followed by an independent-process read/reopen and denial under the wrong conversation. The tested store and transport source hashes match current source. This test has its own profile and no production credentials.
- `.supabase/desktop-scheduled-shell/1792366363768/evidence.json`: five current-shell regression workflows retain sidebar agent switching, scheduled-chat navigation, editing/pause, suggestions and draft restoration.
- The profile archive self-test now includes a nested generated asset. Run it through WSL, where its file-opening safeguards are supported; direct Windows Python lacks `os.O_NOFOLLOW`. Its test data and archives are temporary, and the ordinary database is not accessed.

No live image generation or OpenRouter paid inference occurred. Two public, unauthenticated OpenRouter catalog reads checked the current model/endpoint shape. Current-source qualification is not installed acceptance. Remaining work includes the exact new packaged image, native Supabase/PostgREST migration and restart, real file Save behavior, parent/independent-child image context and revocation, then one generation and a separate reference edit through an explicitly configured supported provider. Broad desktop parity remains active.


### Frozen0.44.25/schema68 candidate

The new portable candidate is frozen at `.supabase/desktop-platform-release/candidate-04425`, image SHA-256 `2ff3e1192a00fd5d71ce352112a041ce63cd916e2f05fe6a644d2fac9f8908cf`. It shares7141 verified immutable resource files with the preceding frozen candidate and has independently compiled backend/frontend bytes. No installer has been produced or run.

Four workflows against the delivered interface (`.supabase/desktop-image-generation/shell-1792366874104/evidence.json`) show a completed image outside collapsed native activity, Save targeting the owned asset, edit references in the actual main composer, and a dedicated child's independent draft with its image reference. Returning to the main chat retains its own draft, and no chat/steering request is sent by Edit. The delivered Plugins page also requires an explicit image connection enable/save. These checks control the host bridge and stored fixture image; they do not prove a live provider generation or a Windows Save file write.

The first exact-image backend run retained271 passing checks and three failures in test-owned stand-ins that omitted the newly required `imageDefinitions` method. The corrected fixtures add an empty image catalog for their unconfigured connection and retain every existing broker, provenance, scheduler and restored-child assertion. The frozen application archive and all production data remain unchanged. Failed evidence is retained under `qualification-1792366809273`; a new qualification is running with explicit old/new fixture hashes.


### Exact-image and full native packaged results

The same frozen0.44.25 image passes274 exact-archive backend checks and19 existing delivered UI workflows. Three test-owned ToolService stand-ins were updated to expose an empty image catalog for their unconfigured connection; old/new hashes and unchanged assertion scope are recorded in `qualification-1792366918139/evidence.json`. The earlier failed qualification is retained.

The real executable then restored a fresh schema67 database snapshot into an owned disposable native Supabase/PostgreSQL runtime, applied migration0068, and passed its original-row/vault audit. Controlled coordination, goal/queue ordering, pause, Scheduled save/stop/read and cold recovery ran through the actual program. Image generation used the real native Codex turn, private MCP, ToolService, inline approval, Images transport, PostgreSQL operation record, Electron decoding and Windows encrypted asset store. Only external model/image HTTP responses were supplied by the test guard. No real image provider request was sent.

The first image completed and appeared in chat. A test inspection mistake (`tools.list` is not public IPC) stopped the driver after completion. Its confirmed request `d1dd6888-83a0-4492-87fd-5ce4905cbacb` was adopted from storage on continuation and never regenerated. A subsequent test-driver navigation correction exposes an edit started outside the composer by reopening the active conversation. These fixture failures and their screenshots/checkpoints are retained; they did not change the frozen app bytes.

The successful continuation (`.supabase/desktop-packaged-coordination/1792367138770/image-continuation-1792367527640/evidence.json`) performs a separately requested edit through the multipart Images endpoint with one owned generated reference, then stops an in-flight image request. Cancellation aborts the image operation and retains an uncertain journal state. Cold reopening preserves both completed PNGs with matching normalized hashes and the separate image configuration, retains the uncertain cancellation receipt, and sends no image request. The audit compares20358 original records across152 tables, reads190 vault values with the preserved encryption root, and verifies all68 migration checksums. The owned test runtime is removed; other distributions retain their previous states.

The completed assets both hash to `6d848007e3e015f0b48d8243337a4a9f4f6e11aa5055d88feef265898d85563d`, because both controlled image responses deliberately use the same locally generated640×360 fixture. This proves saving/reference/cancellation/recovery behavior and does not prove AI-generated artwork or the visual correctness of an edit. Full packaged receipt: `.supabase/desktop-platform-release/candidate-04425/full-packaged-acceptance.json`.

The snapshot helper now explicitly requires source schema67 and the rehearsal target68. The older helper's schema59 assertion stopped the first attempt before backup/import; the correction retains the strict schema precondition. The archive-policy check and its direct-Windows limitation are retained under `.supabase/desktop-image-generation/backup-policy-1792366720000`.

The ordinary app remains0.44.24/schema67. No installer was produced or run, no ordinary connection was enabled for image generation, and no paid OpenRouter inference occurred. Live generation/editing, native Save file output, independent-child image/revocation cases and ordinary upgrade acceptance remain open. The broader goal is active.


### Fresh-install correction, native Save and review revocation

An empty26/schema69 profile proves fresh first-agent creation after removing the legacy contact grant hook. The actual native image pipeline and Windows Save dialog pass with controlled responses. Connection revocation then exposed image-only workers missing from skill-package cancellation matching. Candidate26 is held;27 tracks its image host-plugin dependency. Exact27 passes280 checks and19 delivered workflows. The retained QA continuation cancels both connection/assignment reviews, rejects stale approvals, preserves completed images and cold-reopens their hashes and native export without generation replay. Its owned runtime is removed; ordinary24/67 remains unchanged. Live artwork, actual independent-child image context/revocation and full27 restore/installer/ordinary upgrade remain open. See [full evidence and limits](platform-release-0.44.27.md).


### Actual independent child image controls and restart recovery

28/schema69 now passes292 archived checks and the actual independent-child continuation after normal app/database restart. Steering reaches a replacement model response, the child edits the owned parent image through review and reports back, and separate drafts survive navigation. Further turns refuse unselected references, abort in-flight image transport, report cancellation, and stop on plugin revocation with stale approval refused. Cold reopen preserves images/reports/revocation without replay. Completed image work is adopted from saved receipts during driver recovery. The test runtime is removed. [Full evidence, fixture corrections and remaining gates](platform-release-0.44.28.md). Ordinary24/67 is unchanged; live artwork, presentation cleanup and release/upgrade qualification remain open.
