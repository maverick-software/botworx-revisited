# Agent tools and plugins

Introduced in Agentopia Desktop 0.8.0. PostgreSQL and Supabase remain the data and permission system.

## Configure and choose tools

Plugins & connections now lists each agent’s configured external tools. Configure tools opens that agent’s MCP settings. The same editor remains available through the full account settings dashboard and the agent’s menu.

An MCP connection accepts a protected server address and an optional Bearer access token. Remote addresses use HTTPS; a local development server can use HTTP on localhost or a loopback address. The address and token stay in Supabase Vault. Editing a connection can retain its saved address and token without displaying them. Token replacement and removal update protected storage transactionally. Removing a connection also removes its application-managed token.

Discover tools connects to the server and displays its current tool names, descriptions, and argument schemas. A configured address is shown as Configured; successful discovery establishes that the server is reachable and can supply tools. The Enabled switch controls whether the agent can use that connection.

The chat composer’s Add → Tools & plugins pane selects connections for that chat. Use agent defaults restores the agent’s enabled, configured sources. Source selection is saved with each request and conversation, follows a provider switch, and resets to the new agent’s defaults when changing agents.

Version 0.25.0 manages Serper and Tavily through Plugins. Open a search plugin, save its shared key as an administrator, and assign it to an agent. The original Web search capability and per-chat selection remain access controls. A missing key is shown as setup required. The host never silently substitutes another search service. See the current [plugin contract and controls](plugins.md).

## Calls, approvals, and history

Agents discover MCP tools through a tool-search function, reading each server’s actual schema before requesting an operation. The catalog can be searched and paginated without placing all its schemas in every model request. The client supports Streamable HTTP and the legacy HTTP/SSE transport, using the pinned official MCP TypeScript client.

Before an external operation, the conversation shows the connection, tool, and reviewed arguments. Approve tool call starts the operation; Deny tool call leaves it unexecuted. A declined operation is blocked from repeating during that response. External tools have no generic Undo control because their effects depend on the server. Search calls similarly show the query and chosen plugin before it goes to the selected service. Search results include source cards that open in the workspace browser.

The broker validates ownership, current enablement, and argument schemas. After review it checks that the connection, credential, and tool schema still match. It checks authorization again immediately before the actual tool call. Server descriptions, read-only annotations, and result content are untrusted; they do not bypass the user’s approval.

| Chat setting | Tool behavior |
|---|---|
| Chat only | No agent tool calls or file context. |
| Default permissions | Selected-file inspection, reviewed file changes, configured search, and reviewed MCP operations. |
| Selected files access | Read selected workspace files; external tools are disabled. |
| Plan mode | File inspection and configured search remain available under Default permissions. MCP operations and file changes are withheld. |

Both ChatGPT and OpenRouter use the same local execution and review service. Each adapter keeps its required request format and tool continuation. Provider credentials are fetched again between rounds, allowing renewal during a long review. The selected model must support function calling. Tool discovery, reviewed parameters, results, and failures are owner-protected records in PostgreSQL and reopen with the conversation. Long histories retain the newest confirmed tool results within their context budget; the configured history window is applied before that budget is allocated.

Stopping a response cancels pending approval and the local network request. A remote operation that already started may have completed; the saved activity explains that the external service must be checked before retrying. Restarted approvals become interrupted and cannot be replayed. Goals pause after failed or interrupted requests.

## Delivery boundaries

MCP servers using public access, protected URL credentials, or a Bearer token can execute. A separate MCP OAuth login flow, local process/stdio servers, resource/prompt browsing, rich binary results, and background subscriptions remain further parity work. Servers requiring additional input or authorization return an actionable failure. This release does not claim those flows are complete.

Configure the server’s final endpoint address. The current guarded transport rejects redirects, including same-origin redirects for a missing trailing slash; redirect compatibility remains further work.

Legacy integration credentials, messaging channels, knowledge services, commands/full access, and continuous voice retain the separate work recorded in the parity backlog. An MCP server can expose integration tools now; that does not activate each legacy Agentopia service adapter.

## Verification

Automated checks exercise real HTTP MCP discovery and authenticated execution through both inference adapters. They verify the unchanged server before approval, cross-account denial, saved receipts, token rotation and cleanup, revocation, argument validation, permission/plan/model restrictions, cancellation before and after a remote operation starts, renewed inference credentials after review, and reviewed web searches. Inference and Serper responses in these tests are controlled fixtures; MCP traffic and database state are real.

The desktop workflow configures, discovers, rotates, selects, approves, denies, cancels, disables, and reopens tools through the actual interface. Forced termination preserves a pending external review and rejects its stale approval after restart, while its real HTTP server receives no operation. The workspace regression also delays saved-state loading to verify that an Open click is retained. Interactive canvases keep their state when changing tabs.

Live provider evidence is recorded separately by `scripts/desktop/test-live-external-tools.mjs`. It uses the owner’s real connections and Microsoft Learn’s public MCP server, approves only the specified documentation-search operation, and reopens the saved conversation. General Serper search requires an administrator-provided key; simulated search results do not prove live search access.

Implementation references: [MCP client connections](https://ts.sdk.modelcontextprotocol.io/v2/clients/connect.html), [MCP tools and user controls](https://modelcontextprotocol.io/specification/2026-07-28/server/tools), [Microsoft Learn endpoint and tools](https://learn.microsoft.com/en-us/training/support/mcp-developer-reference), and [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling).

The isolated transport checks also cover a real legacy HTTP/SSE server, including Bearer authentication on discovery and execution. The full automated suite contains 35 checks after adding external-tool execution, transport, redaction, and recent-history coverage. Microsoft Learn’s real public endpoint was independently connected and returned documentation-search results through the production client. Live model-driven evidence is reported separately.

Version 0.8.1 accepts both the chat-selection form `mcp:<connection UUID>` and a bare UUID in model tool arguments, while retaining the same selected-source and owner checks. Configured-source instructions now show the bare connection identifier so the model can copy it directly. This was identified during the first live ChatGPT check, before any external operation was requested, and added to the execution regression test.

Live installed verification completed in 0.8.1: real GPT-6.1 Sol requests through ChatGPT and OpenRouter each invoked an approved Microsoft Learn documentation search. Each reply cited a source returned by that tool. The same conversation retained all four messages and its tool receipts after reopening. No inference or MCP result was simulated. This establishes live execution for these connected accounts and this public server; it does not establish access to servers needing a separate OAuth flow.
