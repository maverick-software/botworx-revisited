# Provider switching in the desktop composer

Updated October 15, 2026. This extends the chat, file context, plan, goal, and local voice controls introduced in 0.5.0.

## What changes in 0.5.1

The model picker keeps ChatGPT and OpenRouter in the same composer. Selecting a connected provider chooses a valid remembered model, the equivalent OpenAI model when available, the administrator's configured OpenRouter default, or the first available model. The choice is visible before a request is sent. No provider is changed automatically when a request fails.

Each Agentopia account remembers a model and thinking level separately for each provider in Windows-protected local storage. A switch restores that provider's previous choice. A thinking level carries over to another model only when that model advertises support; otherwise the choice becomes Auto. New chats with the same agent retain the selected provider and thinking level. Changing agents loads the other agent's defaults, and Reset restores the current agent's defaults. Reopening a saved conversation restores its submitted choices.

The picker loads readable model names, supports searching large catalogs, provides a manual catalog refresh, identifies connections that need setup, and links directly to AI connections. Its usage caption follows the selected provider. New agents start with an available configured provider. Administrators can change the shared OpenRouter default without re-entering its saved key.

OpenRouter's published per-model reasoning allowlist controls thinking choices. Models with mandatory reasoning cannot offer Off. Image and video generators without text output are excluded from the chat catalog. Models explicitly declaring text-only input reject attached images before creating a request; the user can choose an image-capable model or select Chat only permissions. Unknown input capabilities are left to provider validation. See [OpenRouter reasoning capabilities](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens) and [model catalog fields](https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties).

Both adapters receive the saved local conversation. Image attachments are translated to each API's format, and Chat only continues to exclude file snapshots after a provider switch. Agent defaults and account roles stay unchanged. Credit, authentication, permission, and usage failures provide actionable messages without exposing the provider's raw error text or credentials. Interrupted streams retain their partial text and failed status.

Choosing an already registered file in the native picker now attaches it again. Cancelling the picker adds no attachments. The previous behavior returned the full file library without identifying the selected items, which caused the interface to attach only newly registered paths.

## Verification

The Windows 0.5.1 installer was built and installed successfully. All 22 automated tests passed. The installed UI suite passed, including a 1,000×700 model picker, existing-file reattachment, default-model changes without re-entering credentials, local Whisper, goals, permissions, and forced-termination recovery. An actual upgrade retained a disposable account, agent instructions, and completed conversation; that fixture was then removed.

The installed 0.5.1 application also completed the live ChatGPT → OpenRouter → ChatGPT check with `gpt-6.1-sol` / `openai/gpt-6.1-sol` and High thinking. All three real replies recalled the same marker and all six messages reopened. Final verification retained the two original accounts and passwords, one administrator, twelve migrations, the earlier live chats and attached-file plan, and the new provider-switch conversation. All six required Supabase services were healthy and local Whisper remained ready. Docker and the unrelated Ubuntu distribution were stopped.

- `desktop/tests/provider-switch.test.cjs` uses the real local Supabase database and controlled provider streams. It crosses ChatGPT → OpenRouter → ChatGPT in one conversation with image/text history and High thinking, verifies the agent default stays unchanged, rejects image-incompatible models, checks Chat only, and tests credit failure, interrupted persistence, no automatic fallback, per-user model preferences, and administrator credential controls.
- `scripts/desktop/provider-switch-workflow.mjs` exercises the real Electron interface with controlled OAuth and inference responses. It checks connection guidance, authorization, model/thinking selection, history continuity, the usage caption, and restoring both providers' choices after reloading the interface.
- `scripts/desktop/test-live-provider-switch.mjs` uses the normal Windows profile and its actual saved connections. It sends three messages through ChatGPT, the configured OpenRouter default, and ChatGPT again, verifies a newly generated marker is recalled, and reopens all six saved messages. It records provider/model/effort and message counts without recording tokens or API keys. Evidence is written under `.supabase/desktop-live-provider-switch/`.

Live authorization is separate from controlled-response tests. These checks establish provider substitution for the demonstrated text workflow. File writing, shell execution, plugin tools, continuous real-time speech, and pixel-perfect parity with every ChatGPT/Codex desktop surface remain further work.
