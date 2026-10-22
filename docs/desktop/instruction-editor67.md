# Formatted agent instructions and assigned resources

Agentopia 0.44.67 now includes formatted instruction editing in the full-page agent editor. Headings, bold, italic, ordered and unordered lists, quotes, code and links produce Markdown for the existing agent-instruction contract. Tables and task checklists can be viewed and edited when they round-trip without changing their parsed meaning. A Markdown source view remains available. Merely opening the editor, switching views or saving name/description changes preserves the original instruction bytes. Rich instruction changes participate in the existing unsaved-change/discard controls.

The editor checks the parsed Markdown before using formatted mode. Embedded HTML, images, reference definitions and other unsupported constructs stay in source mode. A conversion that loses content is refused. Pasted HTML contributes its plain text; embedded scripts and remote image resources are not inserted. Links cannot execute JavaScript, and clicks inside the rich editor do not navigate externally. The checks verify no external requests in those scenarios. This establishes the tested input behavior, rather than a general security certification.

General now shows actual enabled app connections, their readiness, saved persistent skills and agent-memory navigation. Disabled connections are excluded. Clicking an assigned app or Browse apps opens that agent’s existing MCP configuration. This screen does not yet offer the full public/personal/Composio catalog inline. Add skill opens and focuses one new persistent skill in the real definition editor. Saving it uses the existing revision-checked agent-profile API and retains the agent’s tool policy. App/skill reads are scoped to the selected agent, and unsuccessful reads have a retry control.

Twenty complete-app workflows verify editor save/discard, model/provider retention, saved-agent preview, agent creation, directory/home behavior, narrow layouts, source-view metadata preservation, app readiness and persistent-skill creation. Eight focused instruction workflows check source preservation, supported conversion, real Markdown formatting, unsafe links, clipboard content and narrow layout. Eight queue/steering workflows verify preservation of drafts against the same frozen renderer. Coverage overlaps and is not added into one score. All use controlled inputs and make no live model requests.

The live Chrome reference editor was inspected and screenshotted without changing it. The installed ordinary Agentopia window was separately inspected: both Microsoft Learn connections appear, formatted/source view switching keeps Saved configuration, the app control opens the existing connection screen and Back returns to the saved agent home. No production agent metadata, skill, permission, schedule or instructions were changed during ordinary inspection. These UI checks do not re-prove long-running agent execution.

The app closed and reopened normally for installation. Fresh verified database and compressed profile recovery and the previous UI are retained on F:. All1,800 rows in126 tables, both accounts,119 chats,408 messages, four agent profiles, both private memories and191 readable protected vault records are preserved. Backend0.44.67, schema70, recovery capability12 and the installed backend archive are unchanged. All223 current UI files match the frozen build. Image generation remains disabled.

The dependency command initially ended with Windows EPERM while replacing npm’s internal lock file. Independent reconciliation confirms the eight added direct packages match their pinned installed and lock-file versions; all existing resolved package versions/integrities remain unchanged, and lifecycle scripts were disabled. The failed command is retained as a failure rather than represented as a successful installation. The compiled and tested renderer uses the verified dependency state.

Remaining work includes persistent agent files and upload execution, a full agent-scoped app chooser and inline app mentions, editable avatars/starters, the agent-building assistant, unsaved-definition preview, organization and external channels, and the remaining desktop/autonomy/recovery requirements. Full parity is unproven and the full goal remains active.

Frozen build: `F:/Agentopia/.supabase/desktop-instruction-editor67/1792703786952/proof.json`.

Delivery: `F:/Agentopia/.supabase/desktop-instruction-editor67/1792703786952/delivery-accepted.json`.

Installation: `F:/Agentopia/.supabase/desktop-instruction-editor67/1792703786952/installation-1792703888598/evidence.json`.

Full-app tests: `F:/Agentopia/.supabase/desktop-instruction-editor67/1792703786952/rendered-1792703865726/evidence.json`.

Focused instruction tests: `F:/Agentopia/.supabase/desktop-instruction-editor67/tests-1792703738163/evidence.json`.

Queue/steering tests: `F:/Agentopia-Acceptance/chat-acceptance-drafts/1792703872951/evidence.json`.
