# Live provider testing

The user requested this cost preference on October 17, 2026:

- Use ChatGPT OAuth for routine live model and agent verification.
- Use OpenRouter sparingly, when a change specifically requires verifying that connection or the user explicitly requests an OpenRouter check.
- Prefer local or simulated tests for provider adapters where they establish the required behavior. Reuse existing live evidence when it still applies.
- Do not replay completed or uncertain paid requests. Inspect saved request IDs and outcomes before deciding on further work.

These are testing preferences. Preserve OpenRouter support and the user's configured default models and connections.

The user requested that image generation remain disabled for now. Retain the configured OpenRouter connection so image generation can be enabled later. Do not enable image generation on the user's account as part of tests, migrations or routine updates without the user's explicit request.

# Delivery discipline

On October 31, 2026 the user assigned qualification and publication of compatible Sylvana 0.46.4 to this workflow. Do not leave the release pending on another chat. Continue applicable local tests, deployed-service checks and actual desktop verification when GitHub Actions is unavailable. Installer publication and remote CI availability must not stop ongoing web, desktop and provider fixes. Report their actual status without claiming unavailable checks passed, and preserve accounts, credentials, chats and data.

The user requested on October 24, 2026 that this work avoid overengineering.

- Tie each work slice to a specific user-visible outcome and define its acceptance checks before implementation. Keep the full parity goal intact while delivering it in usable increments.
- Extend existing product paths first. Add a new abstraction or dependency only when an identified requirement or reproduced failure needs it; explain why the existing path cannot serve it.
- Keep required account/data preservation, recovery, ownership and permission checks. Scale other verification to the actual change, reuse applicable evidence, and rerun only when changed behavior or a failure justifies it.
- Once the slice works and required checks pass, move toward packaging and installed verification. Record further optional cases for later work instead of indefinitely expanding the slice.
- Remove unused scaffolding introduced during the work. Report what the user can actually use, what has been demonstrated, and what remains uninstalled or unverified; test counts alone are not delivery.

# Attachment consent

Selecting attachments and sending a message authorizes those files, folders, or images as context for the selected AI connection. Do not add a separate native file-sharing approval dialog or repeat consent for saved attachment context on follow-up turns. Keep account ownership, sensitive-path exclusions, and explicit Chat only behavior enforced. Agent actions such as website uploads, file edits, and commands retain their own inline reviews.

# Agentopia update authorization

On October 19, 2026, the user explicitly authorized installing verified Agentopia 0.44.44 and all future Agentopia updates, and requested that routine update installation not require repeated approval. This is standing authorization to install and restart Agentopia as part of this work. Prepare and verify the update and a recoverable backup, preserve accounts, passwords, chats and data, and check the installed application afterward. Do not ask again merely because the Agentopia version changes. This authorization is specific to Agentopia maintenance; it does not authorize unrelated software, external messages or data sharing.

On October 21, 2026, the user explicitly reiterated permission to close and reopen Agentopia and instructed the agent not to ask the user to close it. Handle normal application closure and reopening directly during authorized maintenance. If the computer-control helper is unavailable, use a supported normal process-close mechanism, verify that the app exited, and preserve recovery before runtime resets or upgrades. Do not force termination while work or profile writes are active.

# Agentopia storage

The user requested on October 20, 2026 that the applicable Agentopia project items move to F: and that C: space be reclaimed whenever possible. Delete irrelevant old builds; do not transfer or archive them. Use F: for future Agentopia build, test, and artifact output. Remove obsolete build output when permitted and verified inactive; preserve account data, chats, active installations and recoverable upgrades. Verify relocated data before removing its source, retain working path redirects where existing tools need them, and report any incomplete relocation or cleanup accurately.
