# Desktop composer and voice

The composer follows the supplied desktop screenshots: an Add menu on the left, a visible permissions selector, compact agent selection, and model/thinking, microphone, voice, and send controls on the right. The same composer appears on the home screen and in saved conversations.

## Model and thinking

Open the model name beside the microphone. Choose ChatGPT or OpenRouter, search the current account's models, and select a thinking level with the slider. Auto leaves reasoning at the provider's default. Models that advertise effort choices supply the slider's levels; known OpenAI reasoning families retain the common Low/Medium/High choices when an older catalog omits their capability fields. Unsupported choices are rejected by the broker. OpenRouter effort choices come from its explicit per-model capabilities; mandatory reasoning models cannot offer Off. The picker includes catalog refresh and a link to AI connections. See [provider switching](provider-switching.md) for selection rules and test evidence.

The choice applies to the chat and does not rewrite the agent's configured default. New chats with the same agent retain your selected provider, model, and thinking level. Changing agents starts from the other agent's default. Each provider's last model and thinking choice is remembered separately for the signed-in user. The latest submitted options are saved with the conversation and each user message records the actual provider, model, effort, mode, and permissions. Reopening history restores the chat options. The reset control returns to the agent's model and Auto thinking.

Responses requests use `reasoning.effort` when explicitly selected while retaining `store: false`, streaming, and the account-specific model catalog. OpenRouter uses its documented reasoning object. See [OpenAI model/inference requirements](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference) and [OpenRouter reasoning options](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens).

## Permissions and file context

- **Chat only:** Blocks new attachments and removes file context from provider-bound conversation history. Previously saved attachments remain in the local history.
- **Default permissions:** Sending authorizes the attached files and selected project context. Follow-ups can use earlier snapshots without repeated sharing dialogs. File edits and agent actions retain their own reviews.
- **Selected files access:** Supplies the selected files and folders as read-only context, with external tools disabled.

These permissions govern context sharing and workspace tools. Default permissions enables reviewed text/code edits: each exact diff requires approval. Selected files access and Plan mode remain read-only. Shell execution remains further work. See [workspace tools](workspace-tools.md).

Choose **Add → Files and folders** to add a file or folder through Windows' native picker, or select an existing reference. The X beside a saved reference forgets it while keeping the file on disk and its saved snapshots in history. References belong to the signed-in Agentopia account and are protected in Windows application storage. A user cannot forge another account's reference ID. Text/code and PNG/JPEG/WebP are supported. PDF and Office extraction remain separate work and unsupported files receive an explicit error.

Folders include up to 100 text files, six directory levels, and a shared 160,000-character context budget. Hidden directories, credential/key files, dependency folders, application data, and service backups are excluded. Traversal checks real paths and skips symbolic links escaping the selected root. Oversized/binary files are skipped or rejected, and folder context records a skipped-entry notice. Images have a 2 MB per-image limit and a four-image limit per turn. Attached material is marked as untrusted reference content in the provider instructions.

Snapshots of the supplied text/images are stored with the user message in PostgreSQL. The saved message shows attachment names and permits inspection of supplied text. New chats clear active attachments. File snapshots remain readable in history if the original file is moved later; selecting a missing reference for a new request requires reattachment or removal.

## Plans and goals

**Add → Plan mode** displays a Plan chip and tells the agent to produce steps, assumptions, and questions while waiting for implementation approval. This is an inference behavior, separate from a tool permission grant.

**Add → Goal** accepts an objective and an explicit limit of 1–10 model turns. Save the goal for later or start immediately. The same pane lists saved goals across the user's agents; selecting one reopens its conversation and progress, including after an application restart. A running goal can continue through responses until the agent reports completion or reaches the limit. The goal strip displays the objective, state, turns used, and stop reason; it provides pause/resume and manual completion controls. An exhausted budget requires a new goal to authorize further work. A goal in Plan mode pauses after its plan so the owner can review it and turn Plan mode off before resuming.

Goals persist in PostgreSQL, are checked against the owning user and agent, and save their conversation. Pausing cancels an active response and preserves partial output. Closing, sign-out, and startup recovery stop or pause outstanding work. Completion is explicitly described as the agent's report; it does not assert external verification. Goals use the selected provider, project context, and enabled workspace/external tools under the same sharing and approval controls. They do not add background schedules.

## Local dictation and voice mode

The microphone records English dictation, transcribes it locally, and inserts the text into the composer for review. Stop recording with the microphone/confirmation control or cancel it. Recordings are bounded to under two minutes. Audio is encoded as mono 16 kHz PCM WAV and validated in the main process.

Whisper.cpp **v1.9.5** and the **base.en** model are bundled with their MIT licenses and a verified archive checksum. The model is unpacked into Agentopia's dedicated WSL environment on first use. The executable uses only Ubuntu's standard C runtime libraries; a separate Python package, API credential, FFmpeg installation, or compiler is not needed on the target computer. The build helper records the model revision and verifies the model's published content digest.

**Voice mode** offers hands-free conversation and tap-to-talk recording. In hands-free mode a pause sends the local transcription. Speaking again interrupts playback or cancels an active model response before sending another turn. The pane shows microphone activity, a model picker while paused, and controls for pause, read-aloud, speech playback, and ending the session. Settings → Voice selects a microphone, installed Windows voice, rate, silence interval, and sensitivity. [Controls, implementation and verification limits](hands-free-voice.md).

Microphone permission is granted only to the Agentopia window following its capture action; video and other origins are denied. Hands-free microphone capture stays on during the visible voice session. Tracks stop when the session is paused or closed, another settings pane takes over, the account changes, or the user signs out. Temporary Windows and Linux audio files are deleted after transcription or cancellation, and startup cleans up interrupted recordings. Audio stays on this computer; the resulting text is sent to the selected provider when the user sends it or stops a voice-mode recording. [ChatGPT token-sharing limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations) exclude audio/transcription endpoints from this authorization flow, which is why dictation uses local [Whisper.cpp](https://github.com/ggml-org/whisper.cpp).

## Verification

Automated tests cover reasoning payloads, model capabilities, immutable request options, owned file references, native approval cancellation, credential exclusions, folder limits, image conversion, WAV encoding/validation, conversation persistence, goal ownership, completion, budgets, plan pauses, and cancellation. Existing desktop account, history, provider, and recovery checks remain in the suite.

The UI workflow uses controlled AI responses and a native-dialog test handler, with real local database storage. Chromium's test microphone supplies a prerecorded public speech sample; the production recorder and bundled Whisper engine actually transcribe it. This tests the software path without capturing the owner's microphone. The production Windows speech process was also exercised successfully. Microphone hardware, selected audio devices, and installed Windows voices still depend on the computer's settings.

The owner's connected ChatGPT account also passed real model selection, High reasoning, selected-file context, plan output, and a one-turn goal. Provider responses in that live check were not simulated. The original ChatGPT Assistant and its earlier saved conversation are retained.
