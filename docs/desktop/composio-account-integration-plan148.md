# Composio account integration: local MCP gap analysis and implementation plan

Revised October 24, 2026 after the user clarified that Agentopia runs locally. This replaces the earlier hosted Platform-session recommendation. No Supabase cloud project or Agentopia-hosted backend is required for the chosen route. The former removed-project finding in [audit151](composio-backend-boundary151.md) is historical and is no longer a prerequisite.

## Intended user experience

**Plugins → Composio → Connect Composio → browser sign-in → choose agent access → use connected apps.** The local Electron broker connects directly to `https://connect.composio.dev/mcp`. Composio operates the remote service; Agentopia runs its client and stores the user's credentials locally. Users authorize individual apps through links returned by Composio when needed. The account connection and each upstream app's authorization are separate states.

Composio's [Connect documentation](https://docs.composio.dev/docs/composio-connect) describes this shared MCP endpoint for existing compatible clients, with discovery, connection management and execution tools. Agentopia already supplies an MCP client and a local browser OAuth implementation. Each local Agentopia account must keep its own connection, with access granted explicitly to its agents.

The earlier plan chose the [Platform session API](https://docs.composio.dev/docs/sessions-via-mcp), which creates application-managed sessions using developer credentials. Keeping a vendor-wide project key out of distributed desktop binaries would require a trusted application service for that design. That requirement does not apply to a user's own OAuth connection. Platform sessions remain a possible future option only if a concrete requirement needs application-managed projects, centrally restricted toolkits or centralized administration. Do not add that service for the current local connection.

## Verified gaps

| Area | Existing implementation | Required local change |
| --- | --- | --- |
| Onboarding | `ComposioPage.tsx` gates its REST catalog on a configured project key; the card reads that same status. | Offer browser OAuth as the default Composio connection. Keep existing developer-key connections available while they contain saved accounts or upload journals. |
| Transport | `mcp-client.ts` already initializes, lists and calls remote MCP tools. `remote-tools.ts` has a separate legacy Composio REST branch. | Reuse the generic MCP executor for the shared endpoint. No extra agent loop, SDK provider framework or remote proxy is needed. |
| OAuth | `mcp-oauth.ts` already performs protected-resource discovery, PKCE sign-in, local callback handling, refresh, cancellation and owner checks. Installed154 fixed the public-host network defect; installed77 retains it. | Add the Composio declaration/configuration to this path and verify real sign-in. Public discovery success alone does not prove authorization or refresh. |
| Account and agent ownership | `mcp-oauth-scope.ts` currently keys saved grants by owner, agent and connection; draft creation grants have their own scope. | Make the reusable Composio connection belong to the local user, with explicit agent assignments. Extend the existing target/scope checks narrowly; do not silently reuse one agent's credential for another. |
| Discovery | Generic searches filter tool names/descriptions by the user's query in `remote-tools.ts`. | Ensure a query such as “Google Drive” can reach Composio's discovery tool even when the gateway tool name lacks those words. Restrict this behavior to the declared connector. |
| Execution and permissions | The existing executor validates schemas, reviews arguments and rechecks current authority. | Preserve those checks, disconnect invalidation and Chat only/Default/Full access. Show enough nested-operation information to review real app actions; assess remote scripting tools explicitly before exposing them. |
| Sign-in continuation | Some authorization-required results become generic failures. | Display returned app sign-in links and distinguish cancellation, pending authorization, expiry and reconnect. Confirm connection state before continuation. Preserve uncertain writes without automatic replay. |
| Google editor transfers | `google-documents.ts` depends on REST connections and file staging, with a durable anti-duplicate upload journal. | Inspect the actual MCP file/tool contracts and adapt the existing workflow separately. Connecting MCP does not by itself migrate Office upload/conversion. |
| Recovery | Local protected settings and the local database already preserve connection metadata and credentials. | Preserve owner bindings and reconnect states across reopen/upgrade. Retain old REST journals under their original project/account identity. |

These findings come from `desktop/ui/ComposioPage.tsx`, `ComposioConnectionCard.tsx`, `desktop/src/mcp-oauth.ts`, `mcp-oauth-scope.ts`, `mcp-oauth-connections.ts`, `remote-tools.ts`, the earlier connection/editor audit and installed154/77 receipts. Existing generic grants are per agent: a reusable owner-level grant is still implementation work.

## Ordered implementation and acceptance

1. **Connect locally through the existing OAuth client.** Add a declared Composio MCP configuration and the default Connect action. Reuse encrypted storage, callback handling and refresh. Extend ownership only as needed for one connection per local user and explicit agent assignments. Acceptance: actual sign-in succeeds without a project key; switching accounts during sign-in cannot attach the result to the wrong owner; cancellation and disconnect invalidate access.
2. **Use the existing tools in chat.** Route discovery and execution through the generic MCP transport, retaining agent/access checks and argument review. Add focused tests for gateway discovery, foreign owners, unassigned agents, revoked grants and connection changes during review. Acceptance: a harmless authenticated read returns the intended account's real data; Chat only supplies no tools. Exercise both existing AI connections with bounded tasks after this path works.
3. **Verify persistence and install the slice.** Reopen normally and verify the same owner's connection, refresh/reconnect behavior and zero replay of writes. Preserve existing accounts, passwords, chats, provider settings and REST connections. Package and inspect the ordinary app before describing local Composio onboarding as delivered.
4. **Adapt Google editor transfers using discovered contracts.** Preserve selected account, source-byte hashes and the existing pre-create/uncertain-result journal. Separately demonstrate content readback and Office upload/conversion/opening. Record any missing upstream operation before adding a fallback. Acceptance: the expected file opens in the intended account; an uncertain create is inspected without duplication.

## Current status and limits

The first local path is implemented and source-qualified in [implementation161](local-composio-mcp161.md): default OAuth onboarding, a separate owner grant, explicit agent assignments, gateway discovery, owned draft reuse and the narrow PostgreSQL readiness change. Protocol/permission, rendered interface, retained API-key interface and actual rollback-only PostgreSQL checks pass. The ordinary installation remains77; the source is awaiting its recoverable package and installed verification.

Real Composio client registration, user consent, token exchange/refresh and authenticated app operations remain unverified. Google editor transfer migration remains unimplemented. No hosted deployment, project creation or credential provisioning is needed. The user completes browser consent when the concrete installed connection flow is ready; credentials must never be pasted into chat.
