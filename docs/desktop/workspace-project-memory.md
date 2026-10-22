# Project memory and conversation sources

Updated October 16, 2026. Version 0.24.0 adds project-only recall and conversation sources to the sidebar workspace reader.

A project can supply relevant decisions from its other chats to either ChatGPT or OpenRouter. It uses saved message text in PostgreSQL. Changing providers keeps the current conversation and its selected thinking level; changing agents in the composer starts that agent's conversation within the same project.

## Turn project memory on or off

Open the project's options menu in the left sidebar, choose **Project settings**, then choose **Project-only memory** or **Off** under Memory. New projects created in the interface start with project-only memory. Projects that existed before this release retain memory off until you enable it.

The composer identifies project memory alongside the instructions and selected files. **Chat only** excludes project memory and its search/read tools for the submitted request. Project instructions still apply. **Off** prevents later requests from retrieving other project conversations. Turning it back on makes the project's saved chats available again.

The current conversation's own messages remain its history. Disabling memory does not erase earlier replies or their saved context. Start a new chat with memory off when you want a fresh conversation without that earlier context.

## Recall and inspect sources

When memory is enabled, a submitted request retrieves up to six relevant message excerpts from other chats currently in that project. A model that supports tools can search further and read a source message in pages. Models without tools still receive the initial relevant excerpts.

Saved user text and completed assistant text can supply context. Other accounts, other projects, archived conversations, raw attachments and tool outputs are excluded from retrieval. Ordinary saved messages may contain quotations or facts discussed earlier. Memory uses that saved text, rather than reopening the original attachment or rerunning a tool.

Expand **Project memory** on a message to see which excerpts were supplied. Search and read tool activity also retains its returned sources. Click a source or a citation in the reply to open the conversation preview in the right pane. The selected message is highlighted, with nearby saved messages for context. **Ctrl+F** searches the visible preview text. **Open conversation** opens the original chat and brings the cited message into view; the outgoing unsent draft remains saved.

Source tabs are read-only and keep their place across reload and restart. Removing a cited chat removes its unavailable tab from restored layouts. Existing source snapshots remain part of the messages where they were used. Conversation previews can display owned history after a project or its memory setting changes; that manual reading does not enable AI retrieval.

## Search a project

Choose **Search project chats** from the project's options menu. Enter search terms to find matching saved messages in that project, including text beyond a chat's title. All search terms must match; the English text-search dictionary also recognizes related word forms. Automatic recall uses broader ranked relevance to find useful context from ordinary questions.

Results offer **Preview source** and **Open conversation**. Manual search works with memory off because you can still read your own saved chats. Opening a preview, searching and navigating do not submit an AI request.

## Persistence and boundaries

The request, project configuration and initial source excerpts are saved in one database transaction before inference. Duplicate request identifiers return that original record. Later source changes do not rewrite the saved snapshot. Account, project and source access are checked again before supplying context and before subsequent provider rounds. A source moved, archived or deleted during a tool sequence prevents its use in another provider request. A request already sent to a provider has already received its supplied context.

This is project-only retrieval. Global personal memory, project sharing and retrieval from external knowledge stores remain separate work. The initial context is limited to six excerpts. Explicit search returns up to 20 results, and source reads page through longer messages with a bounded return size. The right preview displays up to five nearby messages and shortens individual messages above 100,000 characters; opening the conversation provides its complete saved history.

## Verification

The 114 automated checks and complete installed workflow passed. The focused UI workflow used one agent to record a decision and another to recall it in the same project, through both provider formats. Normal close and parent-only termination restored the source preview, unsent draft, provider choices and saved results without replay.

Separate live GPT-6.1 Sol requests with High thinking used the owner's actual ChatGPT and OpenRouter connections. ChatGPT recorded a generated decision in one conversation. Both providers then searched and read that original decision in another conversation, returned working citations and retained the shared history. A fresh OpenRouter chat with memory off excluded the code. Reload preserved the four-message recall conversation and source tab. The original records are retained in `.supabase/desktop-live-project-memory/evidence.json` with their build-proof digest.

[Inspect the project-memory implementation](../../desktop/src/project-memory.ts#L1-L10) · [Open the organization guide](workspace-organization.md) · [Browse desktop docs](./)

![Existing project MCP image](../../public/mcp-light.png)
