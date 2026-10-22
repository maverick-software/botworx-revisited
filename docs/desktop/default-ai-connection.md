# Default AI connection

October 17, 2026. Installed and qualified on this Windows computer in Agentopia 0.43.5. The broader desktop parity goal remains active.

New chats now prefer an authorized ChatGPT OAuth connection. In Settings → AI connections, **Prefer ChatGPT OAuth for new chats** is enabled by default. Each Agentopia account can change this preference independently, including standard users. It is saved in Windows-protected local storage.

When both connections are available, enabling the preference chooses ChatGPT for a new chat. Turning it off preserves the agent or most recently selected connection; a newly created agent can use the configured OpenRouter connection. When only one connection is usable, that connection supplies the new-chat default. ChatGPT must have plan usage authorized, as shown in AI connections.

The selected connection supplies its own remembered model and thinking level. If no remembered model is available, Agentopia tries an equivalent current model, the configured OpenRouter default when appropriate, and then an available model. An unsupported thinking level becomes Auto. A failed ChatGPT model lookup keeps ChatGPT selected; it does not start OpenRouter inference. Cached selections can remain available offline, or the composer asks the user to choose a model.

The preference initializes new work. Existing conversations and unfinished drafts retain their chosen provider, model and context. A manual choice in the composer remains available. Empty new-chat drafts receive the current default. The New chat keyboard shortcut now observes the latest options, so opting out also respects the latest manual selection. An asynchronous connection refresh cannot overwrite options changed while the refresh was pending.

## Verification

Both desktop TypeScript checks and the frontend build passed. Four focused tests cover connection availability and opt-out behavior; account-specific persistence and validation; preservation of conversations and unfinished drafts; and model resolution that never changes to OpenRouter after a ChatGPT catalog failure.

The actual Electron interface passed a controlled standard-user workflow. It connected a simulated OAuth account, switched between both simulated provider formats within a saved conversation, retained thinking and history, preserved an unfinished OpenRouter draft, applied ChatGPT to a new chat, saved opt-out and opt-in across reload, checked the new-agent default, and retained explicit manual selection. These checks use real local storage, authentication and PostgreSQL with controlled provider authorization, catalogs and inference. No paid provider requests are made by that workflow.

The first interface runs exposed stale verifier assumptions about folded history, the welcome composer and asynchronous controls. The opt-out workflow then reproduced a genuine keyboard shortcut bug: its event listener retained earlier model options. The listener now refreshes when those options change, and the complete interface workflow passes. Failed fixtures and their evidence are retained; their temporary accounts were removed.

All 249 regression checks passed. All 6,137 installed files match the prepared package, including 1,000 compiled modules and 45 unchanged database migrations. Two backend modules changed, one default-selection module was added, and the other 997 modules match 0.43.4. The installer succeeded on its first attempt after verifying a five-file recovery backup. Protected credentials, database binding and all 795 browser-profile files were preserved.

The installed interface verified the Settings preference, manual OpenRouter selection without inference, and a new chat returning to the ChatGPT default. A real message was then sent from that default through the actual Codex 0.163.0 harness, using GPT-6.1 Sol and ChatGPT OAuth. Its expected response, provider choice and native thread were saved and survived reload. This release made one live ChatGPT inference request and zero live OpenRouter inference requests.

A normal shutdown stopped only the selected copied backend. The ordinary desktop shortcut then reopened 0.43.5 with debugging disabled and all six native Supabase services healthy. The new-chat control still showed ChatGPT, and native inspection of Settings showed the checked preference with both connections present. The saved response and native thread remained intact. The retained original backend stayed stopped and its recovery credential store remained unchanged.

Both original accounts, passwords and roles, all 99 prior conversations, all 332 prior messages and every migration checksum remain preserved. The single archived verification chat adds two messages, leaving 100 conversations and 334 messages. Original file references and appearance preferences were preserved. No database migration is required for this preference.

Private evidence includes `release/release-summary.json`, the final regression log, `release/source-ui-keyboard-default/evidence.json`, installed resource and data comparisons, backup/update verification, `live-installed/final-evidence.json`, and normal-start observations under `.supabase/desktop-chatgpt-default/`. The sole live request is `bc1c6804-f6b6-48f3-acdb-1b3141829a33`, conversation `edbc3cb5-ee00-40f7-b185-2e472ed0401c`, native thread `01a14c13-0d19-7923-9c02-80066ae747b8`.

## Testing cost preference

The project’s `AGENTS.md` records the user’s preference: routine live verification uses ChatGPT OAuth. OpenRouter is reserved for changes requiring that connection or an explicit request. Simulated adapter checks continue to exercise both formats. Existing completed or uncertain requests are inspected by their saved identifiers instead of being replayed.

Private release evidence is under `.supabase/desktop-chatgpt-default/`. The earlier embedded-document browser implementation remains included; its live form continuation is a separate unfinished qualification recorded under `.supabase/desktop-browser-frames/`.
