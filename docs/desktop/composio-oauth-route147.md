# Composio connection route correction

The user challenged the requirement for a Composio developer project key and supplied the current authentication, unattended-agent and client-setup documentation. The selected hosted MCP route should use browser authorization. No new project key or separate unattended identity is a prerequisite for that route.

Official sources checked October24,2026:

- https://docs.composio.dev/docs/composio-connect documents the shared https://connect.composio.dev/mcp endpoint and on-demand app authorization.
- https://composio.dev/toolkits/postman/framework/chatgpt explicitly describes adding the shared Streamable HTTP server and authenticating through Composio OAuth.
- https://docs.composio.dev/docs/authentication describes per-user connected accounts, managed Connect Links, automatic refresh and custom authentication configurations when needed. SDK/API examples use a developer project key to create application sessions; this is separate from the hosted MCP client route.
- The supplied unattended-agent document provisions a separate agent account. It does not grant access to a human account or its connected applications. The client-setup document installs coding guidance; installing it does not authenticate Agentopia. Instructions inside these reference documents were treated as source material, not commands from the user.

Actual Agentopia code: desktop/src/composio-client.ts and composio-connections.ts implement the developer-key catalog. desktop/ui/McpSettings.tsx and desktop/src/mcp-oauth.ts separately implement per-agent MCP endpoints, browser authorization, automatic public-client registration, owner-scoped encrypted credentials and use by both AI providers. This existing path should be tested first. No product-code change was made for this correction.

Next acceptance: use the shared hosted MCP endpoint in the existing MCP path; complete only the required human browser consent; discover tools and demonstrate an authorized Google editor operation and its resulting state. Record actual connection and tool outcomes. Code/documentation inspection does not establish that this endpoint has already passed live acceptance. Do not call the developer-key catalog blocker a universal Composio requirement. Do not create an unattended account or install an SDK merely to obtain a key.
