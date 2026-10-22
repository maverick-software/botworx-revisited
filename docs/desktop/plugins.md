# Plugins, connections, and agent tools

Subsequent source checkpoint: imported plugins now have a [reviewed update flow](plugin-updates.md) that preserves unchanged connections and their credentials. It requires migration 0058 and is not yet packaged or installed. The earlier release behavior below retains its original scope.

Updated October 16, 2026. Desktop 0.25.1.

## Public implementation research

OpenAI documents plugins as packages with a stable identity that group skills and MCP connections. Its current portable layout uses root `plugin.json`, root `mcp.json`, and optional `skills/`. OpenAI also documents a compatibility layout using `.codex-plugin/plugin.json`. See [Package your plugin](https://developers.openai.com/plugins/build/plugins).

The public [Agent Plugins manifest schema](https://agent-plugins.org/schemas/1.0.0/plugin.schema.json) and [MCP configuration schema](https://agent-plugins.org/schemas/1.0.0/mcp.schema.json) define the portable declarations. Agentopia vendors these 1.0.0 schemas and validates against the local copies; opening Plugins does not download replacement schemas. Their upstream source byte SHA-256 values at retrieval were:

- plugin.schema.json: `0a4aad95ce337878ad38802ebf0daa3fde76abe3f65400c86bcbb1ec0b3ab883`
- mcp.schema.json: `6539175bfcdf43085855183e86da40ea94b166547a72b47ae9a0a390516d3acb`

An MCP server supplies tools with input schemas and optional output schemas. OpenAI describes behavior annotations and structured results in its [Apps SDK reference](https://developers.openai.com/apps-sdk/reference). Those annotations describe the server's claims; authorization still belongs to the host and server.

Agentopia follows the public package/connection/tool separation. This is a supported subset of the portable format. It does not reproduce OpenAI's private directory, publisher review, infrastructure, or registered app identifiers.

## Using the Plugins page

Open **Plugins** from the workspace sidebar or activity rail. Each plugin shows its version, schema status, enabled state, and connection or assignment status. Search filters the installed list.

Open **Manage plugin** to:

- Enable or disable the plugin for the signed-in account.
- Choose which owned agents may use it.
- Supply a shared search credential, if signed in as an administrator.
- Discover and inspect a connection's tools, input schema, declared output schema, and behavior annotations.
- Inspect the installed package and its canonical SHA-256 digest.
- Remove an imported plugin and its connections. Saved conversation history remains.

Each chat retains its own tool selection in **Add → Tools & plugins**. Agent assignment, enabled state, model tool support, mode, and chat permissions all apply. Chat only blocks external tools. Plan mode retains web search and withholds arbitrary MCP calls. External operations continue to show arguments for approval even under Full access.

## Adding an MCP plugin

Select **Add plugin**. The importer accepts a JSON envelope containing two public documents:

```json
{
  "manifest": {
    "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
    "name": "microsoft-learn",
    "version": "1.0.0",
    "description": "Search Microsoft Learn documentation."
  },
  "mcp": {
    "$schema": "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
    "mcpServers": {
      "docs": {
        "type": "streamable-http",
        "url": "https://learn.microsoft.com/api/mcp"
      }
    }
  }
}
```

The importer can load this example. **Validate package** checks both documents and the host's support rules. Review the exact server addresses and package digest, then choose **Install reviewed plugin**. Editing the JSON clears the prior review. Installation saves a local package; it does not contact its servers. Enabling an agent assignment creates the declared connections. **Verify & discover tools** contacts those servers and checks the current catalog.

The host accepts one to ten named remote Streamable HTTP or legacy SSE servers. Remote addresses must use HTTPS; loopback HTTP supports a local development server. Query strings, embedded URL credentials, package headers, and variable substitution are rejected. The manifest requires a semantic version and description in addition to the portable schema's required identity fields.

Set an optional Bearer credential through **Connection settings**, which opens the agent's MCP pane. Credentials stay in Supabase Vault and are not returned with packages or catalogs. Imported connections remain bound to their reviewed server addresses. An endpoint change requires removing and reinstalling the reviewed package; token replacement retains the package.

Changing package versions currently uses explicit removal and reinstallation. Removal also removes that package's agent connection credentials. Review this consequence before upgrading a private plugin.

## Search plugins

Serper and Tavily are bundled search plugins. Their manifests declare `extensions.com.agentopia.adapter`, an Agentopia host extension. Only packaged adapters may use it; an imported manifest cannot provide executable code or choose arbitrary endpoints. The trusted adapters normalize results into the same agent-facing `tools.web_search` operation and source cards.

An administrator saves a search key in the plugin's connection pane. The shared credential is available for execution by authorized agents across local accounts; standard users see configuration status without retrieving the key. Removing a shared key affects all accounts. A plugin's enabled state and agent assignments belong to the signed-in account.

Assigning a search plugin to an agent selects that service and enables its existing Web search capability. It disables that agent's other search-plugin assignment. Turning the capability off still blocks search. Existing agents retain their prior Serper behavior until a search plugin is explicitly selected or disabled. An unavailable or disabled service produces an error; the host does not switch services automatically.

Tavily uses basic search with at most eight results and no generated answer. Its [published free plan](https://docs.tavily.com/documentation/api-credits) currently provides 1,000 credits monthly, with basic search costing one credit. A key and internet connection remain necessary. Serper uses the existing protected key slot, preserving prior installations. Search credential editing has moved out of the System API keys pane into Plugins; the compatibility broker actions remain for older service clients.

## Existing connections and validation

Existing per-agent MCP connections receive an owned plugin wrapper without replacing their Vault address, token, or original connection ID. These wrappers retain their original agent assignment. Their package identity validates against the portable manifest schema. Protected legacy endpoints are not exported into an `mcp.json`; their original connection validation still applies. New agent-MCP connections created through the older settings pane are wrapped on the next catalog refresh.

At discovery, the host compiles bounded input schemas and optional result schemas, rejects external schema references and duplicate tool names, and follows paginated MCP catalogs. A malformed catalog fails closed. Tool descriptions and results remain untrusted context.

Before execution, arguments must match the tool's current input schema. The host rechecks agent ownership, plugin and assignment state, protected connection identity, and the complete tool descriptor after approval. A changed connection, schema, annotation, or credential requires a new request and review. Declared structured results must match the output schema before being delivered as a successful result. A rejected result does not establish that an external operation had no side effects.

**Schema validated** describes structural validation and host support. It does not mean that Agentopia or OpenAI has reviewed the publisher, approved the server, or certified its returned information. Package digests detect a change to the stored reviewed declaration; they are not publisher signatures.

## Current boundaries

This release supports remote MCP packages and bundled search adapters. It rejects unsupported extensions instead of silently installing incomplete packages. It does not execute package skills, hooks, local MCP commands, installation scripts, arbitrary HTTP adapters, or imported UI widgets. OAuth-only servers still need an implemented authorization flow; an OpenAI app ID cannot be used as an Agentopia connection. API-key connections currently use the existing protected Bearer-token workflow. File/folder/ZIP import is implemented in a later, uninstalled source checkpoint; see [reviewed file import and qualification](plugin-file-import.md). A remote marketplace, signed publisher verification and in-place version updates remain future work.

The database stores packages, account-scoped enabled state, agent grants, and connection bindings. Direct anonymous and authenticated database clients cannot write those tables or invoke the service-only assignment/removal functions. Removal and assignment serialize through database transactions. Database recovery backups include the new records and their existing Vault-backed connection data.

## Verified behavior in 0.25.1

All 117 automated checks passed. Installed focused verification covered reviewed import, schema inspection, owned assignment, disabled/removal behavior, both controlled provider formats, cancellation, account boundaries, backup export, and forced-termination recovery. A new deterministic check held an earlier completed-message refresh until after a newer response started, and again until after a later response completed. The earlier refresh could not replace either newer reply; all eight messages and cancellation remained saved.

The normal installed application also used the owner’s real ChatGPT and OpenRouter connections with an imported `microsoft-learn-desktop` plugin. Both GPT-6.1 Sol requests used High thinking, approved exactly one Microsoft Learn documentation search, cited a returned source, and reopened the same four-message conversation. The test project has memory off and no attached files. This is live provider and MCP evidence, distinct from the controlled search adapter tests. Evidence is retained under `.supabase/desktop-live-plugins` and `.supabase/desktop-poc/plugin-system-*`.

The live test explicitly selected High. An earlier request at Ultra received HTTP 400 on this ChatGPT connection. Other reasoning levels require their own live checks. Serper and Tavily routing used controlled responses; a live general search check still requires a configured search key.

The chat display fix associates each asynchronous completed-message refresh with its originating turn. Starting a later manual or goal turn invalidates earlier refresh results, which prevents a saved older reply from replacing newer live text. It does not change database message contents or inference requests.

The final complete installed regression also passed on 0.25.1. It included the original settings, voice, attachment/document/editor, plan, terminal, file management, folder organization, browser/source navigation and project-memory workflows, followed by the new plugin and streaming tests and the ordinary permission/cancellation/restart/backup checks. Earlier failed runs remain in the private artifacts. The test harness now waits for actual imported-folder references, expects the current Plugins title, accepts either valid Chromium search ordinal after an anchor jump, and restores its temporary provider choice between workflows.

The final data audit verified both original accounts and password fingerprints, one administrator, retained earlier live conversations and tool results, six healthy native services, local Whisper readiness, all 31 applied migration byte checksums against source and installed resources, preserved original migration records, current build/resource hashes, and the new live plugin evidence. The normal application is left open with the Plugins page, implementation guide, and folder navigation.
