# Live Composio account verification and requested pause

October 24, 2026, America/Los_Angeles. Agentopia 0.44.78/schema84 remains installed. The user completed Composio browser sign-in and enabled both assistant agents. The installed interface shows the connected account and both assignments. The local OAuth connection and authenticated MCP calls now work through ChatGPT Assistant. The user requested a pause after this connection works; the broader parity goal remains incomplete and is being paused at this boundary.

## Test and result

A new ordinary-profile chat used ChatGPT OAuth, GPT-6.1 Sol, High thinking and the actual Codex 0.163.0 harness. The request was limited to Composio discovery and account-listing operations. It prohibited new app authorization, file-content reads, changes to external data, terminal commands and other services. No OpenRouter request was made.

The first chat request completed without a tool call because its saved options contained an explicit empty plugin selection. The database confirms that Composio was assigned to the agent, while this chat selected no external tools. This is the existing per-chat selection behavior. Selecting **Add → Composio** adds the connection to the composer and the next request. No permission setting, source code, account record or authentication grant was changed by automation to resolve that selection.

The second request selected only Composio. Its actual saved records show:

- `mcp_search` completed with an eleven-tool catalog and zero discovery errors. The first page contains ten tool schemas.
- `COMPOSIO_SEARCH_TOOLS` completed with `successful: true`, `data.success: true`, no service error and MCP `isError: false`.
- `COMPOSIO_MANAGE_CONNECTIONS` completed with `successful: true`, no service error and MCP `isError: false`. The native call arguments specify `action: list` for all eight requested app types.

The eight types were Airtable, Discord, GitHub, Gmail, Google Calendar, Google Drive, Google Sheets and Supabase. Each returned an empty account list. Search also reported no active connection for each. These are the eight types checked; this does not establish that every app supported by Composio has been enumerated.

The connection-management service labels the eight empty results `initiated` and reports eight initiated connections in its summary, despite all eight submitted actions being `list`. No connect action, authorization-link navigation or downstream app operation was submitted by this test. The meaning of that service status remains unverified. The agent reported this limitation and stopped. Do not interpret the label as successful Google or other app authorization, or claim that the external service made no internal state change.

Both chat requests are terminal and completed. The ordinary interface visibly reports the authenticated success. An independent read-only PostgreSQL query checks the native arguments, exact selected connection, terminal request statuses and saved tool results. Its sanitized receipt retains result hashes, app types, statuses and argument shapes; it excludes token values, email addresses, account identifiers and raw account data. The verification did not restart the app, replay work or change the installed package. Two new chat requests were made; an exact count of upstream model responses was not audited.

## What remains open

This establishes real Composio OAuth onboarding, authenticated discovery and account-list access in the installed app through ChatGPT OAuth. Real token refresh, a corresponding OpenRouter call, and reads or writes inside an authorized downstream app remain unverified. The checked Google connections have no accounts, so this test could not read Google files. The separate **Open in Google editor** workflow still uses the legacy API-key/REST path and has not been migrated. Those remaining tasks and the wider desktop parity work are left for a future user-requested resume.

The implementation and installed release were already committed and pushed as `4dc9b16` and `9ce90b3`. This follow-up changes documentation only. Private evidence: `.supabase/desktop-composio165/evidence.json`; ordinary chat `7b9cca76-a7bd-4a7d-b88a-817c687b8df4`. The earlier failed selection is retained in that same chat, followed by the successful selected-connection request.
