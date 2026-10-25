# Hosted Composio acceptance

Outcome: let the user's Agentopia agents connect to hosted Composio through browser OAuth, without supplying a developer project key, then demonstrate an authorized Google editor action.

Use the existing per-agent MCP settings and OAuth executor. First inspect the real endpoint's unauthenticated challenge and public metadata through the installed network implementation and pinned MCP SDK. This makes no model/tool requests and does not register a client, create an account or use saved credentials. Record actual results, including any incompatibility, before changing product code.

Then test the existing connection path. Human sign-in/consent stays in the browser. A successful OAuth handshake alone does not establish Google authorization or editor operation. Require actual tool discovery, the requested authorized action and a readback of its result before marking that capability demonstrated. Preserve existing provider connections, owner isolation, accounts and data. Reuse applicable earlier tests and the installed146/complete147 recovery artifacts.
