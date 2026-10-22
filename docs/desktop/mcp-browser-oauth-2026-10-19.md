# MCP browser sign-in — source and packaged acceptance

Agentopia now has a source implementation for connecting an agent's remote MCP tools through browser OAuth. The same saved connection feeds RemoteTools, which supplies tools to both AI connections. A user can Connect, cancel a pending sign-in, reconnect, disconnect the local credential, and discover the authorized tools. A tool request never launches an interactive sign-in flow.

The immutable0.44.39 application now passes actual SQL/Broker/Codex execution, approved MCP operations, revocation and encrypted cold recovery using local services and controlled callbacks. The installer and fresh ordinary recovery are verified; installation and real third-party sign-in remain pending. Ordinary0.44.31 remains installed. The source-check sections below retain their original scope; [current packaged evidence](platform-release-0.44.39.md) records the additional acceptance and retained failures.

## Public format and protocol

The implementation follows the documented per-server `extensions["com.openai"].auth` location. It supports `oauth`, `mixed` and `none`, discovered endpoints, public provided client IDs, automatic dynamic registration, host-supplied client metadata document URLs, and base/default scope lists. An explicit empty default scope list requests no default scopes. Registration and scope declarations remain inside the reviewed plugin digest.

The vendored portable schemas are unchanged. Agentopia validates the supported OpenAI extension separately, then checks the portable server declaration against the pinned schema. Confidential client methods, endpoint overrides, OIDC-specific overrides, embedded secrets, and unknown settings produce explicit errors. Local-command MCP, executable hooks, registered app mappings, marketplace management and publisher signing remain separate unfinished capabilities. A provided native OAuth client must permit the loopback callback used by the desktop flow; server-specific registration requirements need live acceptance.

Primary references read for this work: [OpenAI MCP authentication configuration](https://developers.openai.com/plugins/build/plugins#configure-mcp-authentication), [OpenAI OAuth configuration fields](https://developers.openai.com/plugins/build/plugins#oauth-configuration-reference), [MCP authorization specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization).

## Credential and execution boundaries

The pinned MCP library performs resource/authorization-server discovery, registration, PKCE construction and issuer validation. Agentopia accepts a callback only on its own loopback listener with the expected random state; duplicate parameters and mismatched or missing advertised issuers cannot redeem a code. Each callback code and each refresh is submitted once. Concurrent reads share one refresh. The callback listener closes on success, failure, cancellation or expiry.

Access tokens, refresh tokens and client registration information use the existing Windows-encrypted credential store. They are bound to the local account, owning active agent, exact MCP address, protected address record, server identity and reviewed plugin digest. The database-facing adapter rechecks ownership and enabled connection/plugin/assignment state before reads and commits. Changes invalidate use of a prior grant. Failed settings validation does not erase a saved grant. Disconnect removes Agentopia's local grant; the settings message explains that access can also be revoked at the provider.

OAuth discovery is a separate network path from MCP tool traffic. It allows cross-origin discovery while checking and pinning resolved destinations, excluding private destinations for public servers, disabling redirects/cookies and limiting replies to 1 MB. Explicit loopback MCP servers can use loopback authorization endpoints. The existing MCP same-origin tool-request guard remains unchanged. Actual public HTTPS providers, DNS failure conditions and wider network environments still need acceptance.

## Checks and practical meaning

Twenty source checks use real local HTTP OAuth/MCP services and the pinned library. They exercise authorization and actual tool calls; restored credential reads and coalesced refresh; provided, dynamic and metadata-document registration; rejected state/issuer; cancellation; account/plugin changes; disabled assignments/connections; rejected refresh and single-use code exchange; explicit scopes; supported schema preservation and secret exclusion; redirect/response-size/private-address boundaries. The SQL-facing adapter and RemoteTools run unchanged, while their database records are controlled. These checks do not establish actual Supabase transaction behavior.

Seventeen existing regressions cover bearer-authenticated Streamable HTTP and legacy SSE, protected output/history across both providers, and public plugin import/normalization/path/skill compatibility. The initial regression controller accidentally selected the old shared build for the compatibility cases; its failures are retained. The corrected controller selects only the new isolated build. No shared build is replaced.

Nine settings checks use the actual McpSettings component, OAuth engine, Windows safeStorage and two complete disposable Electron launches. They verify Connect/Cancel, an issuer failure without a token exchange, connected status, real MCP discovery, absence of plaintext access/refresh tokens in the encrypted file, Disconnect, dark/narrow-light rendering and successful decryption/discovery after restart without another browser sign-in. Browser callbacks are generated by the local fixture. They do not exercise an external provider's consent screen or the full production Broker/Supabase/Codex workflow.

Retained UI setup failures include a launch unable to resolve the isolated build's dependencies, a missing connected-status label, and an inserted text encoding defect. The controller now binds the existing dependencies in its owned QA directory; the label/encoding were corrected. Failed attempts remain available alongside the successful records. Screenshots were inspected for readable text and wrapped controls.

Current source evidence is recorded under `C:/Users/charl/AgentopiaQA/mcp-oauth/` and settings evidence under `C:/Users/charl/AgentopiaQA/mcp-oauth-ui/`; the acceptance pointer in `.supabase/desktop-mcp-oauth/latest.json` identifies the exact successful records and source hashes. No production credential was added, removed or authorized, no ordinary chat was sent, and no paid AI request was made.

The immutable39 application has completed those SQL-backed plugin assignment, native tool review, revocation and cold-recovery gates. Ordinary installation and acceptance remain pending. A real supported service also needs a user-completed browser sign-in. Full desktop parity remains active and incomplete.
