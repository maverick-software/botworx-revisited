# Skills page and settings ownership

The requested outcome is an independent Skills page, reached from the book icon in the main rail, with the same catalog layout as Plugins. Account settings belong in global Settings or the account libraries; persistent agent configuration belongs in the agent editor; conversation selections belong in the conversation.

## Source audit

Audited the native desktop at `dcb329fa4c7b0658b32d91f8ac997f54d0d0e019`. The visible desktop navigation already omits Stripe billing, Integrations, System API keys, Chat tools, Tools & Credentials, and the duplicate Settings skills form. Old internal identifiers redirect to their current destinations and remain for compatibility. The separate web administrator application still contains Stripe administration; this update concerns the native desktop and does not remove that separate product path.

The Skills route already exists, but it shares the Plugins “Customize” sidebar and installed-plugin list. Its catalog also uses a different card layout. This makes the existing route appear subordinate to Plugins.

## Ownership decisions

| Setting or action | Owner and destination |
| --- | --- |
| Theme, notifications, account, voice, shortcuts, usage, data controls, browser preferences | Global Settings |
| Provider connections and defaults | Global AI connections; individual agent model choices remain in Agents |
| Saved credential inspection, replacement, reconnection and removal | Global Credentials, with existing account/administrator checks |
| Plugin installation, account enablement and service authentication | Plugins, including Integrated and Composio tabs |
| Account skill package creation, editing, import, export and enablement | Independent Skills library |
| Agent instructions, behavior, memory policy, delegation policy, documents and automation | Agent editor |
| Plugin and reusable skill assignments to one agent | That agent's capabilities/behavior editor |
| Persistent skill text owned by an agent | That agent's Behavior editor; library may display it and link to the owner |
| Windows command authorization for the account | Global Permissions; previews may display status and link to it |
| Inventory and revocation of account chat-pair grants | Global Permissions |
| Computer use permissions | Global Computer use settings from version 82; individual agents retain their Computer plugin capability. Earlier temporary window chips remain removable for compatibility. |
| Optional skills for one conversation | Conversation controls; preview controls apply to their preview conversation |
| Installation users and administrator roles | Global Administration, labeled Installation administration |

The legacy Composio “all my active agents” value is an account-wide default with established stored semantics. Preserve it and existing grants; individual agent assignment edits should use the agent editor. Account service authentication remains in Plugins.

## Implementation stages and acceptance

1. Separate the Plugins and Skills sidebars, retain the main rail destinations, and reuse the actual Plugins header and compact catalog row styling. Preserve existing skill bytes, resources, revisions, retained drafts, import/export, and selected-workspace discovery boundaries.
2. Correct misplaced and duplicate editors. Open application-window sharing directly from the composer. Remove account-wide grant revocation from individual agents, replace account command authorization in previews with status and global navigation, and retain one saved-agent instructions editor in Behavior. Move individual plugin/skill assignment editing to Agents before removing the library checkboxes.
3. Run the desktop type checks and controlled Electron checks using the real UI components and isolated state. Verify independent navigation, matching layout, skill editing and draft protection, single-agent assignment boundaries, and the global/agent/conversation destinations. These checks must not contact live providers or change production permission settings.
4. Build version 0.44.81 over the accepted installed 0.44.80 package. Schema stays 88; database migrations, main-process runtime, credentials, provider adapters, dependencies and historical SQL must remain byte-identical. Qualify the actual package against the existing isolated acceptance profile, including upgrade backup and restart checks.
5. Take a fresh production baseline and recoverable application backup, normally close Agentopia, install the verified update, reopen normally, compare all original database rows and protected credential values, and inspect the installed Skills, Plugins and Settings pages. Record the actual evidence paths and any limits in the completion record.

No stored records or grants are deleted by this UI ownership correction. Compatibility redirects and retained draft parsing remain where they protect saved user state. Further verification is driven by a changed behavior or a failed check; unchanged backend functionality reuses the applicable accepted 0.44.80 evidence.

## Delivery status

Delivered and inspected in the normal installed Agentopia 0.44.81 application. Skills has its own sidebar and main-rail book destination, with the same compact catalog layout as Plugins. The installed library contains all 229 existing entries. Selecting a skill brings its readable instructions and resource selector directly into view; the account skill editor and retained drafts remain available.

Global Settings was inspected directly. The obsolete desktop forms are absent. Global Permissions contains account command authorization and the account-wide chat-grant inventory. The saved agent editor was inspected in General, Behavior and Permissions: instructions have one editor in Behavior, reusable skill access belongs to that agent, and the Permissions section contains agent policy controls. No agent field, assignment or credential was edited during installed inspection.

Both desktop TypeScript projects passed. Controlled interface checks covered independent navigation, matching catalog layout, draft recovery, a 229-entry catalog with a real viewport assertion, account versus agent ownership, and preview prompt retention. The actual packaged 80-to-81 upgrade and cold restart passed; a subsequent narrow account-reset correction passed fresh backup, warm and cold checks with the unchanged backend. The installed application then passed a fresh production comparison across all 144 application tables: all 3,830 original records were retained, including both accounts, 123 chats and 430 messages. All 191 Vault records remained readable.

The original update renewed the existing Composio identity token. Both RSA signatures and the unchanged account, client, issuer, permissions and grant were verified before accepting the renewal. The final renderer repair retained all 112 protected entries and both AI provider connections exactly. Image generation remains disabled. Public signing keys were fetched without credential headers; copied tokens were never refreshed.

The final selected-skill scrolling correction was installed through the existing renderer-only maintenance approach, with a fresh logical snapshot, a verified private-profile archive, a verified UI rollback, normal closure and reopening, full resource checks, and another complete saved-row and credential comparison. The executable, backend archive, runtime, database schema and dependencies remained unchanged. This is recorded explicitly as an installed renderer repair; the earlier Squirrel installer contains the preceding renderer.

Final proof: [renderer repair package proof](F:/Agentopia/.supabase/desktop-skills-viewport81/1792992263401/package-proof.json). Delivery and preservation evidence: [completion record](F:/Agentopia/.supabase/desktop-skills-viewport81/1792992263401/installation-1792992326079/completion.json). The completion record links the original update qualification, recoverable backups, strict comparisons and installed interface observations. Earlier failed verification attempts and their narrowly scoped validator corrections remain preserved in the update evidence.

Separate web administrator billing code remains outside this native desktop cleanup. Compatibility identifiers and retained draft parsing remain to protect saved navigation and draft recovery. Live Gmail, QuickBooks and model actions were not needed for this interface change; unchanged provider and runtime behavior reuses the accepted earlier verification.
