# Workspace tools and reviewed edits — 0.6.0

Agents can now inspect selected local text/code files, propose changes, wait for a review decision, and continue the conversation with the actual result. The same workflow runs through the user's ChatGPT connection or the shared OpenRouter connection.

## Using the interface

1. Choose **Add → Files and folders** and select a working folder or individual text/code file.
2. Choose **Default permissions** and ask the agent to inspect or change a file. Approve sending the selected context when prompted.
3. Review the proposed diff in the conversation. **Approve and apply** saves it; **Deny change** leaves the file alone and disables further write proposals for that response.

Completed activities remain in history. Expand an edit to inspect the saved diff and use **Undo change** after the response finishes. Undo checks the current file against the saved change and stops if newer work would be overwritten. Undoing a newly created file removes that one file. File contents before and after each proposed edit are retained with the private conversation in PostgreSQL.

**Chat only** excludes supplied file context and workspace tools. **Selected files access** permits reading selected context without repeated sharing prompts and exposes read-only workspace tools. **Plan mode** permits inspection but never enables writing. **Default permissions** permits read tools after sharing approval and proposes writes that always require a separate review decision. A permission selection alone cannot apply an edit.

The activity panel shows reads, directory listings, pending approvals, applied changes, denial, errors, cancellation, and undo. Pending review brings the conversation forward if voice mode is open. Selecting Stop cancels a pending approval without applying it. Sign-out suppresses further private response and tool events, and restarting marks unfinished operations interrupted; approvals do not survive a restart.

## Execution and storage

The trusted application process exposes three functions: `list_files`, `read_file`, and `write_file`. Each receives an owned reference ID and a relative path within that selection. A read returns UTF-8 contents and a SHA-256 fingerprint. A write must supply that exact fingerprint, or null only for a new file. The application rechecks the path and fingerprint after approval and immediately before saving. A stale proposal produces an error while retaining the newer contents.

Paths outside the selected root, parent traversal, alternate streams, links, known credential files, hidden/service/dependency directories, and application credential/runtime storage are excluded. Tools accept supported text/code files up to 160,000 characters and 256 KB. Parent directories must already exist. Existing line endings are retained for a reviewed replacement. New files use an exclusive creation operation. Changes to the same target are serialized inside Agentopia.

Migration `0013-workspace-tools.sql` adds private tool records with read-only owner policies for authenticated database clients. Only the trusted service can change them. Request, conversation, and assistant-message references keep activity tied to the existing chat lifecycle. Tool results are marked as untrusted reference data when reused in history and are excluded from provider-bound history under Chat only. Same-provider continuation preserves the provider's required reasoning and tool-call structures without exposing reasoning payloads in the renderer.

Each user response is limited to nine model rounds and 24 tool calls. A goal can use those rounds within one goal turn. Sharing approval and edit approval are separate because one authorizes sending context and the other authorizes a concrete disk change. Edit approvals expire after 15 minutes. Network requests retain their five-minute bound; reading a pending diff does not consume that network deadline.

## Provider compatibility

ChatGPT function definitions are grouped in a `workspace` namespace. Inference retains streaming and disabled remote response storage and sends the required tool results and response items in the next request. This follows the [Sign in with ChatGPT tool requirements](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations), [function namespace format](https://developers.openai.com/api/docs/guides/function-calling#namespaces), and [reasoning continuation guidance](https://developers.openai.com/api/docs/guides/reasoning).

OpenRouter uses its compatible function-call messages and preserves reasoning details between rounds. The client executes returned calls sequentially. Requests require support for the supplied parameters and omit `parallel_tool_calls`, which the demonstrated GPT-6.1 endpoints do not advertise. Models that explicitly lack tool support continue to receive supplied context for text analysis without tool definitions. Legacy model caches refresh their capabilities when a workspace is selected. See [OpenRouter tool calling](https://openrouter.ai/docs/guides/features/tool-calling), [reasoning preservation](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens#preserving-reasoning), and [parameter-aware routing](https://openrouter.ai/docs/guides/routing/provider-selection).

The live tests found two compatibility gaps and established their fixes:

- ChatGPT sent completed function items during the stream and an empty output array in its terminal event. Replacing the earlier items with the empty array discarded the call. The parser now retains those completed streamed items; a regression test uses that exact event pattern.
- OpenRouter rejected a tool request while strict routing required an unadvertised parallel-call parameter. Removing that parameter allowed the same default model to complete its read/edit workflow. Tool execution remains sequential in the client.

## Verification and remaining work

All 28 automated tests pass. The automated suite covers path boundaries, linked and sensitive files, current-file fingerprints, changes during review, UTF-8 files and line endings, creation, undo, owner-only review, database read policies, cancellation, sign-out privacy, model capabilities, both provider wire formats, and the streamed-output regression. The UI workflow verifies actual file operations and review controls with controlled provider calls.

`scripts/desktop/test-live-workspace-tools.mjs` uses the normal profile's real saved connections and a new demo folder under `docs/desktop/workspace-demo/`. ChatGPT and OpenRouter each inspect the file and append only their requested line after the automation checks and approves the displayed diff. It verifies the actual file contents, saved activities, and reopened history. No inference replies are mocked. Evidence, including provider/model choices and tool statuses, is under `.supabase/desktop-live-workspace-tools/`. `AGENTOPIA_TOOLS_RESUME=1` resumes an incomplete verification without repeating already completed edits; the file must still match the last verified contents.

This adds working local file tools. Shell commands, unrestricted full access, directory creation/deletion, MCP execution, project organization, and continuous voice remain separate parts of the active desktop-parity goal. The interface does not claim those capabilities.

## Installed verification record

The actual Windows 0.6.0 installer completed successfully and retained the upgrade fixture account, agent instructions, and saved conversation; the fixture was removed afterward. The installed UI suite passed all existing settings, provider switching, voice, goals, history, recovery, and backup checks, plus file approval, denial, undo, conflict preservation, cancellation, forgetting references, and restoring a pending review after forced process termination. The stale review could not be approved after restart, and the file remained unchanged.

The normal installed profile then passed a fresh, unsimulated two-provider workspace workflow with GPT-6.1 Sol and High thinking. Both providers completed a read and an approved write in one conversation. The two replies, four messages, tool activity, diffs, and resulting file contents were reopened and checked.
