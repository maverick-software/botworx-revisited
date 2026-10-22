# Project instructions and shared files

Introduced in Agentopia Desktop 0.9.0. Projects now supply instructions and selected context to their chats through either ChatGPT or OpenRouter.

## Controls

Use the project’s options menu in the left sidebar and choose **Project settings**. Set a name, write instructions, and select project files or context folders. The workspace folder still controls folder navigation on the right; selecting that folder in Project files includes it in AI context.

Start **New chat in project** to use the saved configuration from the first message. The project name appears on the chat home and in the header. A composer badge opens its instructions and file selections for review. Updating the instructions affects subsequent messages in that project’s chats.

Project files are local references. Each submitted message reads their current contents within the existing text, image, folder, and size limits. The combined project and message selection is limited to 20 references. Credential paths, backend data, dependency directories, and application storage retain their exclusions. A missing or forgotten reference stops file sharing until it is removed from project settings or selected again.

## Sharing and history

- **Default permissions:** Sending includes the selected project sources without another sharing dialog. File changes and external tool operations retain their own reviews.
- **Selected files access** supplies the selected project/message files and permits read-only inspection.
- **Chat only** keeps project instructions, excludes all current and historical file content, and disables tools. The composer identifies excluded project files.
- **Plan mode** uses the same project instructions and permitted context with the existing read-only planning restrictions.

Each user message saves the project name, instructions, revision, applied project references, and supplied file contents. Its expandable project record shows which instructions applied at that time. Updating or removing a project keeps earlier saved messages. Removing a source from future project context does not remove its earlier attachment from the conversation; Chat only excludes attached history from subsequent provider requests.

A new chat and its project assignment are saved in one PostgreSQL transaction before provider inference starts. A changed project configuration or moved conversation during the sharing prompt stops the request, allowing the user to review it before sending again. Project settings reject outdated revisions rather than overwriting another edit. Moving a chat waits for its active response to finish or be cancelled.

File references are checked again after the sharing prompt, so forgetting a reference during review prevents it from being sent. Declining sharing or another pre-submission failure keeps the unsent draft in the composer; it does not leave an unsaved exchange in chat history.

Goals created in a project retain that project for their first conversation. Later turns use their conversation’s current project. All project reads and mutations check the Agentopia account; another user cannot read its instructions, use its local references, or move its chats.

## Verification and remaining work

The database workflow captures requests through both provider adapters and verifies first-turn instructions and sources, updated instructions, original snapshots, Chat only privacy, declined sharing, configuration and membership changes during review, request retries, account isolation, and goal membership. Inference in this workflow is controlled test data.

The desktop workflow creates and edits a project through its actual controls, selects files through the native picker, sends project messages, switches to Chat only, and reopens the saved context. The installer upgrade fixture checks project instructions, selected reference identifiers, and revision alongside the existing account, agent, conversation, and protected-tool credential checks.

Live provider verification is recorded separately by `scripts/desktop/test-live-project-context.mjs`. It uses the owner’s connections and a dedicated demo reference, checks the required project reply prefix, changes the file between providers, and verifies that each provider reads its current code. Its evidence distinguishes actual provider responses from controlled tests.

Version 0.24.0 adds project-only retrieval and project message search with conversation source previews. [Memory controls and limits](workspace-project-memory.md). Project sharing, global personal memory, retrieval from large document collections, and project-specific provider defaults remain further work. File previewing in the right pane continues to work independently of sending context to a provider.

Live installed verification passed in 0.9.0 with GPT-6.1 Sol and High thinking through both real connections. ChatGPT returned the first release code using the project’s required reply prefix. After the demo reference changed, OpenRouter returned its new code with the same prefix in the same conversation. All four messages and their original context records reopened. No inference response was simulated in this check. The demo project and conversation are retained for review.

Version 0.9.1 fixes scroll following when a restored workspace pane changes the chat width. The message viewport observes content and viewport size changes while following the conversation. Wheel, touch, keyboard, and scrollbar interaction can leave that following state so reading earlier messages is preserved. A down-arrow control returns to the latest message. The desktop regression restores the right pane, verifies the latest reply is in view, scrolls back with actual pointer input, resizes the window, and checks that the reading position is retained before returning to the latest reply.
