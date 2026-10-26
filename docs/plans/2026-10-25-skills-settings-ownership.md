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
| Selected application windows and optional skills for one conversation | Conversation controls; preview controls apply to their preview conversation |
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

Implementation and verification are in progress. This plan is not evidence that version 0.44.81 has been installed; the release completion record will identify the delivered package and preservation results.
