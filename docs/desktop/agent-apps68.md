# Agent-specific app browser — installed 0.44.68

Agentopia 0.44.68 is installed and reopened normally. The ordinary F-drive profile passed saved-data/account and native agent-home/editor/picker acceptance. The exact retired C67 build was removed with verified rollback retained on F:.

Browse apps now opens one app browser over the agent editor, preserving unsaved instructions and procedures. Public, Personal and Composio tabs share the existing plugin catalogs. Public/personal selection uses an app list and inline detail pane rather than another stacked modal. Narrow layouts show one pane at a time. Imported packages still use their existing schema-review workflow. The agent view shows only that selected agent’s grant control and keeps account-wide enable, image-connection and credential-management controls in global Plugins. Existing connection settings remain reachable.

New Composio connections created here save the selected agent’s ID in their initial binding, before hosted OAuth/API-key collection or no-auth activation can make tools available. Existing global connections retain their scope. Per-agent assignment updates the current grant set inside the owner-bound write lock, preserving peers’ assignments. Shared all-agent bindings are labelled and their scope stays under global Plugins management. Lost acknowledgements reconcile saved state and do not automatically repeat the mutation.

A two-agent test exposed a runtime issue: changing one grant closed every Composio worker for the account, and peer grant-list changes invalidated still-permitted peer authority. The initial peer test also required correction of its in-memory database fixture so insert results referenced the newly inserted activity rather than a previous row. The corrected test reproduced the actual interruption on the old code. The service now compares each agent’s effective authority, and the broker invalidates only the affected agents for scoped connections; project/shared changes retain broader invalidation.

The corrected actual Codex test holds two agents at separate inline reviews through controlled ChatGPT and OpenRouter gateways. Revoking the first agent stops its request before any action executes. The peer keeps its worker and authority, its review is approved, its Composio action executes exactly once, and its result completes. Model and Composio HTTP responses are controlled; this establishes native-process coordination and host enforcement without claiming live Composio authentication or model quality.

The final package passes1046 archived-module checks with no failures or skipped cases. Twenty complete-application workflows verify existing directory, editor, model, memory, automation and draft behavior. Fifteen picker workflows verify the app browser, explicit grants, OAuth/API-key/no-auth payloads, shared access, lost acknowledgements, unchanged peer grants, narrow layout and clean metadata when only an app assignment changes. Eight queued-message/steering workflows pass against this exact renderer. The scopes overlap and are not added into one score.

The live ChatGPT Chrome reference app browser was opened, screenshotted and closed without adding or changing an app. It uses a searchable app list and detail pane. The candidate follows that interaction with the additional Public/Personal/Composio categories requested for Agentopia. The later ordinary68 native inspection confirms the saved-agent picker and account/history/document startup. Pixel-identical layouts remain unverified.

Only broker.js and composio-connections.js change in the backend. The broker outside its Composio block and the service outside reviewed connection/authority methods are verified unchanged. All other compiled modules and 7,240 non-UI supporting files are identical to accepted 67. Schema 70 and recovery capability12 remain unchanged. Prior recovery evidence is inherited only for these unchanged parts; an actual fresh 68 PostgreSQL restore and whole-application cold recovery have not been demonstrated.

No ordinary profile, account, password, history, permission, skill, automation or image setting was changed during this work. All build, fixture and candidate output stays on F:. Image generation remains disabled in the installed application. Full desktop/agent parity remains incomplete and the full goal stays active.

Delivery is complete. All1,808 saved rows across126 tables, two accounts,120 chats,410 messages,191 readable encrypted records, four agent profiles and two memories passed read-only checks. Native inspection opened the saved agent home, formatted editor and all three picker tabs, reviewed selected-agent-only access, and closed without changing grants or instructions. Protected metadata confirms fresh ChatGPT access, retained OpenRouter credential and disabled image generation with zero provider requests. Cleanup reclaimed2,567,430,682 program bytes. A fresh68 full restored-profile recovery, physical Windows reboot and real authenticated Composio action remain unverified. Continue the remaining parity scope.

Qualification: `F:/Agentopia/.supabase/desktop-agent-apps68-release/1792706032442/qualification.json`.

Candidate: `F:/Agentopia/.supabase/desktop-agent-apps68-release/1792706032442/package-proof.json`.

Archive: `F:/Agentopia/.supabase/desktop-agent-controls68/1792705766472/evidence.json`.

Full app: `F:/Agentopia/.supabase/desktop-agent-apps68-candidate/1792705665178/rendered-1792705723058/evidence.json`.

Picker: `F:/Agentopia/.supabase/desktop-agent-apps68/ui-1792705638711/evidence.json`.

Queue/steering: `F:/Agentopia-Acceptance/chat-acceptance-drafts/1792705760496/evidence.json`.

Delivery receipt: `F:/Agentopia/.supabase/desktop-agent-apps68-release/1792706032442/delivery-accepted.json`.

Ordinary native observations: `F:/Agentopia/.supabase/desktop-normal-maintenance/1792706799162/ordinary-ui-accepted.json`.
