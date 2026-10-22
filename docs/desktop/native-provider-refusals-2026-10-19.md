# Selected connection survives native provider refusals

The exact frozen0.44.35 backend is loaded in a separate Electron host with an in-memory database, generated native homes and dummy credentials. The actual pinned Codex executable calls its real Agentopia inference gateway. The host supplies local HTTP error responses instead of contacting OpenAI or OpenRouter. This tests native connection retention and failure propagation without consuming either provider's allowance or touching the ordinary profile, database, installer or fresh recovery checkpoint.

All six cases pass:

| Case | Actual native result | Controlled upstream attempts |
| --- | --- | --- |
| ChatGPT usage limit, HTTP429 | Turn fails and keeps ChatGPT/model selection | 1 |
| Explicit ChatGPT retry after that limit | New turn succeeds in the same native thread and conversation | 1 |
| ChatGPT expired credential, HTTP401 | Turn fails with the reconnect message and retains ChatGPT | 6 |
| ChatGPT model refusal, HTTP403 | Turn fails with the access message and retains ChatGPT | 6 |
| ChatGPT credential unavailable | Turn fails; no request reaches either upstream connection | 0 |
| Explicitly selected OpenRouter without credits, HTTP402 | Turn fails with the credits message and retains OpenRouter | 6 |

Every credential, catalog and upstream observation matches the case's explicitly selected provider. Saved context retains the chosen provider/model. The explicit retry preserves its native thread and uses a different turn ID. Private upstream diagnostic text and dummy key strings are absent from the saved native result/error. The isolated harness closes and retains no workers.

Five additional tests run against the same archived backend verify default preference and per-account persistence, opt-out behavior, preservation of existing drafts/attachments, catalog failure without loading a paid alternate provider, and retention of a recorded ChatGPT authorization issue without fetching another catalog. Their observed command-output summary is retained separately; the successful tests are not replayed merely to create that summary.

Acceptance is `C:/Users/charl/AgentopiaQA/provider-refusals/1792393494060/acceptance.json`. It binds the native evidence, exact tested code, default-preference summary and test-source snapshots. `.supabase/desktop-provider-refusals/latest.json` points to that receipt by SHA256. The installer archive remains `fa5b2c39987b4877ac4e02f874a2ccd24a5cbcf9e7420a2f8dfc75151643dafe`.

Setup failures are retained. The first launch used Node, which could not resolve the packaged Electron module. The isolated Electron host then needed raw archive reads enabled before extraction. Both stopped before native work. A separate default-test command needed an absolute preload path and stopped before running tests. Correcting those test-host details changes no product source or frozen payload.

These results establish the behavior of the actual native harness and gateway under supplied errors, plus the tested default-selection functions. They do not demonstrate ordinary UI banners, physical account disconnection, real provider quotas or every OpenRouter model. The six-attempt refusal cases are recorded explicitly; this is not a no-retry claim. The underlying native error wording can include technical status/loopback details and remains a future presentation concern. The existing35 installation question is still pending; ordinary31 and its fresh recovery remain unchanged.
