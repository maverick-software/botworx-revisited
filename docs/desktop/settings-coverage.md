# Restoring the original settings — desktop 0.4.0

The first desktop interface omitted the original administration dashboard and most of the agent editor. Version 0.4.0 brings those controls into the desktop settings layout and saves configuration in the existing PostgreSQL/Supabase tables.

Version 0.5.0 additionally supplies composer-level model/reasoning selection, scoped file-sharing permissions, file context, plan mode, bounded goals, local Whisper dictation, and Windows spoken replies. These desktop voice controls operate separately from the original ElevenLabs integration setting. See [composer and voice behavior](composer-and-voice.md).

Open **Account → Settings → Agent settings → Configure** to edit an agent. The Agents page and chat options menu open the same editor. Settings has a searchable navigation pane; the agent editor has a separate searchable pane with all 14 original sections.

## Project and account settings

| Original interface | Desktop destination | Implemented behavior |
| --- | --- | --- |
| User profile modal | Account | Edit username, first/last names, company, title, and mobile number. Email remains the sign-in identity; email-change verification is not ported. |
| Admin user management | Administration | Existing creation, roles, suspension, reactivation, registration, and last-administrator protection. |
| Admin Settings → API Keys | System API keys | Save, replace, and remove OpenAI, Anthropic, Mistral AI, and Serper keys in Supabase Vault; return status without returning saved secrets. These keys configure original services; desktop inference still uses OpenRouter or a personal ChatGPT connection. |
| Admin Settings → Integrations | Integrations | Search/filter/add/edit/delete service providers; edit authorization, token, revocation, and discovery endpoints, scopes, PKCE, enabled state, public metadata, and credential placement. Preserve providers that have saved user connections by requiring disablement instead of deletion. |
| Personal integration connections | Tools & credentials | List existing connections; add/replace/revoke API credentials; select an enabled service provider. Store credentials in Vault. Existing OAuth records remain available for assignment; new third-party OAuth consent flows need their integration services. |
| Admin Settings → Stripe | Stripe billing | Store/replace/remove individual credentials in Vault, test the Stripe account, sync paginated subscription products into the existing billing-plan catalog, and show configuration status. Feature/limit fields of existing plans are retained. Connect authorization, checkout, and incoming webhooks require deployed billing services and registered callbacks. |
| System prompts | System prompts | Search, category filter, create/edit/delete, and active state. This preserves the shared prompt library; desktop chat takes instructions from the agent's Behavior pane. Library edits do not silently rewrite agent instructions. |
| New desktop controls | General, Appearance, AI connections, Data controls, Keyboard shortcuts | Retain message submission preferences, sidebar state, themes, text size, OpenRouter/ChatGPT connections, backups, diagnostics, archived chats, and keyboard shortcuts. |

Administrator sections are hidden from standard users, and their corresponding desktop operations enforce administrator authorization. A user can edit only their own profile and agents. Resource assignments verify ownership in the same database transaction as their changes.

## Agent settings

| Section | Restored controls | Desktop execution status |
| --- | --- | --- |
| General | Name, description, AI provider, model, instructions. | Used by chat. Original temperature and token-limit controls are not ported; provider restrictions need a separate implementation. |
| Identity | Name, personality/tone, personality type, purpose. | Name and personality are used by desktop chat. Purpose/type are saved configuration. Bundled avatars remain in use; uploaded avatar records are preserved. |
| Behavior | System instructions. | Sent with each desktop conversation. |
| Capabilities | Voice synthesis, web search, document creation, document reading, temporary chat links, and voice credential selection. | Saved in the original agent metadata. The desktop tool execution service is still required. |
| Memory | Conversation message limit, existing datastore assignments, account knowledge-graph preference. | The message limit changes the context sent to the provider while retaining the full saved history. Vector/graph retrieval requires its execution services. |
| Documents | Assign/unassign existing account library documents. | Assignments persist. Upload, extraction, and retrieval services are not ported. |
| Channels | Email, SMS, Slack, Discord, Telegram, WhatsApp permission switches. | Saved permission configuration; desktop messaging workers are required for execution. Adds missing channel columns without removing existing schema. |
| Sources | Grant/revoke read-only permissions for owned integration connections. | Permissions persist; integration execution services are required. |
| Team | Assign/unassign teams owned by the current user; keep selected teams' existing reporting relationships. | Assignments persist; team creation/reporting editor and collaboration execution remain separate work. |
| Contacts | None, all owned contacts, selected contacts. | Permission records persist. No-access clears viewing, contacting, editing, deletion, and export permissions. Desktop contact-tool execution is still required. Advanced imported policy types remain visible until explicitly replaced. |
| MCP | Add/remove named tool-server connections. | URLs, including embedded path/query credentials, are stored in Vault; only host/name/status return to the renderer. MCP discovery and execution are not ported. |
| Schedule | View existing tasks; add/edit/delete cron schedules and instructions with validated time zones. | New/edited schedules are paused. A background task service is required before execution. |
| Workflows | Original navigation and status. | The original editor marked this “coming soon”; no workflow editor/execution service is implemented. |
| Automations | Original navigation and status. | The original editor marked this “coming soon”; no automation editor/execution service is implemented. |

Workspace settings and account knowledge-service provisioning are separate original application areas. Their schema and records are preserved. This change restores the project dashboard and per-agent configuration; it does not implement every deferred application service.

## Protection and validation

- Existing migrations stay immutable. New migrations add the settings operations, correct a legacy revocation trigger that used an obsolete table name, and enforce complete revocation for no-access contact policies.
- The renderer receives credential status and public metadata. No operation returns system keys, personal API keys, Stripe secrets, or protected MCP URLs.
- Credential replacement and metadata changes are transactional. Unreferenced desktop-created replacement secrets are removed; historical imported secrets are retained.
- Revoking a personal API credential also disables its agent permissions. Other users' resources cannot be selected through forged desktop calls.
- Schedules are validated using the bundled cron parser and remain paused. Configuration controls do not claim that unavailable execution services are running.
- Drafts in different agent panes survive navigation and MCP/task-list refreshes. Closing with unsaved changes requires confirmation.

The desktop tests use disposable users, agents, provider records, prompts, and protected credentials in the local Supabase database. Stripe network responses are simulated for repeatability. Live provider and deployed billing workflows require the owner's credentials and corresponding services. Stripe product synchronization follows the documented [product listing](https://docs.stripe.com/api/products/list) and [response expansion](https://docs.stripe.com/api/expanding_objects) APIs.
