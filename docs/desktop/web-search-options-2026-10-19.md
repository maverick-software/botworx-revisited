# Web search through the native harness and plugins

Agentopia currently starts Codex with native `web_search="disabled"`. Its existing host search plugins use Serper or Tavily credentials. The browser and generic MCP tools remain separate paths. The user's preference to avoid additional paid services prompted verification of native search and a keyless public MCP option.

## Actual bundled Codex probe

Official [Codex search documentation](https://learn.chatgpt.com/docs/web-search#configure-local-web-search) describes cached and live hosted search, and a separate standalone-search capability for custom providers. The [Sign in with ChatGPT app-server integration](https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server) documents the custom Responses route used by Agentopia. It explicitly treats the bundled model list as a catalog, with actual completed requests establishing model access. Those documents do not establish this application's entitlement to hosted search.

The pinned Codex0.163.0 executable and model catalog were hash checked. Three isolated actual app-server runs used a local controlled Responses endpoint and a fresh native home, with commands, apps and subagents disabled and no production credentials. Their outcomes are:

| Setting | Actual outgoing hosted search tool | Actual completed native item |
| --- | --- | --- |
| disabled | Absent | None |
| cached | `web_search`, `external_web_access:false` | `webSearch` with the supplied controlled query/action |
| live | `web_search`, `external_web_access:true` | `webSearch` with the supplied controlled query/action |

This proves the runtime's inline hosted-search transport and native event conversion through a custom Responses provider, with the standalone capability false. The provider responses were controlled; no internet search or real inference occurred in this probe. Evidence: `.supabase/desktop-native-search/1792376542327/evidence.json`.

A read-only physical authorization inspection initially found the saved access token expired and made no renewal attempt, model request or canonical credential write. Evidence: `.supabase/desktop-workspace-agents/authorization/1792376603781/evidence.json`. The subsequent ordinary ChatGPT request below succeeds through the application's normal connection path. Hosted native search eligibility remains unverified. The current native-search configuration remains unchanged. Enabling it also requires agent/permission controls and rendering its native search activity; those are still acceptance work.

## Prepared keyless Exa plugin

Exa documents a [public MCP endpoint requiring no API key](https://exa.ai/mcp). A reviewed Agentopia package now declares exactly `https://mcp.exa.ai/mcp`, uses the pinned Agent Plugins manifest/MCP schemas and contains no scripts, hooks, credentials or local commands. It passes both ZIP and JSON import validation.

The existing Agentopia MCP client discovered `web_search_exa` and `web_fetch_exa` without authentication. The actual RemoteTools host code, using an isolated owned agent/plugin/connection fixture, validated the remote descriptor, created the normal query review and completed one real documentation search. The returned results include three source records from official OpenAI documentation. The result was re-audited from saved bytes without repeating the query; URLs embedded in documentation examples are excluded from that source count. No ChatGPT/OpenRouter request was made.

The delivered0.44.24 archive was independently hash verified, and its actual compiled plugin importer accepted both copies of the package with the same digest. This establishes compatibility with the currently installed import code. That first host test used an in-memory configuration; the subsequent ordinary acceptance below exercises the actual installed chat.

Artifacts are at `D:/Users/charl/Documents/ChatGPT/Internal Project - Agentopia/Agentopia Plugins/Exa Web Search/`: `exa-web-search.zip`, `exa-web-search.agentopia.json` and README instructions. Package digest: `525a2e8bfc0fd31e67d99c44c05ac76583b0fbf48acf8d565f822b020f69feb2`. ZIP SHA-256: `e1d8bd3108a94a837fbda11354e9a1876d702a06dee2164084d45f03671e1e36`.

Preparation/catalog evidence: `.supabase/desktop-native-search/exa-1792376718017/evidence.json`. Actual host search: `exa-live-1792376763070/evidence.json` and `exa-live-search-ledger.json`. The delivered-code importer and saved-result source audit are under `exa-delivered-1792376829090`; `latest.json` points to the combined acceptance record. The first preparation attempt supplied the wrong kind argument to the import helper and failed before contacting Exa; that attempt remains retained.

The package can be imported through Plugins → Add plugin → Open plugin file, then reviewed and assigned to an agent. Queries and fetched page addresses go to Exa. Anonymous rate limits and service availability apply. No unlimited quota or availability guarantee is asserted. The generic MCP path is shared by ChatGPT and OpenRouter; model choice and inference costs remain with the selected connection.

Tavily is another existing option: its [official pricing documentation](https://docs.tavily.com/documentation/api-credits) currently lists 1,000 free monthly credits without a card, with a basic search costing one credit. It requires an account/key. No signup, key change or paid plan was performed.

## Ordinary installed chat acceptance

Through the actual 0.44.24 Windows interface, the reviewed package is imported, saved and assigned only to Native Codex Assistant. Verify & discover reports both actual remote tools and validates their schemas. A new chat selects only that MCP connection and retains the default ChatGPT GPT-6.1 Sol High model. No attachment, local file, command, browser tool or subagent is supplied to the model.

Exactly one real ChatGPT OAuth request completes through bundled Codex 0.163.0. The agent discovers the current schemas, including required query and objective fields, performs one Exa search with at most three results, reads one returned official documentation page and answers with an official citation. The four completed host receipts comprise two discovery calls, one search and one page fetch. The citation opens the actual right browser pane and follows the official redirect to the loaded ChatGPT Learn configuration page, alongside folder navigation. The initial blank loading observation is retained; the later page content establishes successful navigation.

Read-only physical PostgreSQL inspection binds request `10e6c0e2-d79e-404f-8a3c-9ff0ea5034d2` to its saved ChatGPT options, actual native thread/turn, tools and completed answer. The two accounts and password fingerprint match the baseline. The single new conversation and two messages explain the increase to 106 conversations and 362 messages. The original conversation's unsent pasted-image draft remains visible. No OpenRouter request or paid search key is used; completed work must not be replayed.

Evidence: `.supabase/desktop-native-search/ordinary-1792377323235/evidence.json`, saved source captures and `citation-ui.json`. The recorded dispatch ledger is finalized as completed. The installed executable, frozen30 candidate and installer remain unchanged.

A fresh in-app backup and normally closed profile/cold-disk capture now include the plugin and completed search. The five logical files, 3,521 ordinary-profile files, 3,051 secondary-profile files and 5,812,256,768-byte disk are verified. An offline archive audit preserves the plugin assignment, completed search/answer/native identities, password records and the prior vision PNG/answer without starting SQL or sending requests. Actual Explorer reopening retains the signed-in account, selected plugin, saved result and original unsent image draft; physical counts remain unchanged and no requests or goals are running. Recovery evidence is `ordinary-1792377323235/recovery-evidence.json`. The earlier backup is retained, and the new pointer is `candidate-04430/upgrade-backup-after-exa.json`.

After reopening, the actual Scheduled home and expanded task editor are inspected against the supplied reference: separate sidebar, New task, Upcoming, six suggestions, repeat/time, notifications, new-chat switch and Runs in. The editor is cancelled without creating a task. This verifies those ordinary controls' presentation and navigation; saved task execution and native notifications retain their separate acceptance scope. Broader browser/folder/canvas workflows, plugin revocation and native hosted-search entitlement remain open.
