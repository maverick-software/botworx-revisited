# Actual streaming controls — installed 0.44.63

Three saved agents started distinct invoice tasks through the installed 0.44.63 Codex harness, an isolated QA profile and its real PostgreSQL database. Each agent had its own role and procedure. Provider response bytes were observed as they arrived and forwarded without deliberate holds or generated responses. Fourteen local guard/stream-observer checks passed before live dispatch.

All three provider streams were open together. The first chat was stopped through its actual composer after visible text arrived. Its request became cancelled in about 0.17 seconds, and its HTTP stream was aborted before a provider completion event. Its partial table remained visible after reopening. The other chats continued independently.

The second chat was steered through its composer to replace the invoice unit price. Acknowledgement took about 0.45 seconds. The original stream was interrupted, and the revised instruction reached the next actual model request on the same native thread and turn. Its final subtotal was 14168, matching 160 line quantities at the revised 1.10 unit price.

The third chat completed every row of its 120-line invoice. A separate read-only audit of the saved public final message verified the quantity, price, line amount and cumulative amount on all 120 rows, with no mismatches. Its subtotal was 9075. Enter in its composer queued a shipping adjustment while the original response was running. The follow-up returned 9079.50 on the same native thread and a new turn. The revised price from the second chat did not affect this invoice.

The stopped chat's unsent draft remained intact while the others finished. Full cold reopening retained the stopped partial response, revised answer, completed invoice, queued result, native references, agent profiles and draft. The queue was empty, and no model request was replayed. Generated agents and chats were retired/archived after acceptance. The test used five successful ChatGPT Responses requests, zero OpenRouter requests, no image requests and no external tool calls.

The final original-store ciphertext comparison failed because the ordinary app's encrypted file changed during the test. The original failed evidence is retained. A separate read-only comparison established that only the local sign-in session changed: the owner stayed the same and its issue/expiry times advanced. Every non-session value, including provider credentials and preferences, was identical. This is consistent with ordinary session renewal. The ordinary process stayed running, the comparison wrote no source data, and temporary QA access was removed. The completed model requests were accepted from saved evidence without replay.

This is bounded evidence for client-visible concurrent streams and controls over roughly a minute of generated invoice work. Longer mixed-tool workloads, prolonged unattended use, network interruptions, fresh reference-app visual comparison and Windows reboot behavior remain open. The full parity/workspace-agent goal remains active.

Actual requests: stopped `6a45a8c5-4f93-4e14-9bc0-4bf2ac648dc6`; steered `18d887bd-3cb3-458f-ac04-af0aa8653461`; independent invoice `9f77c03f-30e2-4a77-976b-a7bfadf16fd1`; queued adjustment `f78ae720-ef75-42cc-853b-c646c5af28c2`. Preserve them and do not resubmit their completed or uncertain work.

Acceptance: `F:/Agentopia/.supabase/desktop-live-streaming63/1792636247014/final-acceptance.json`.

Preservation comparison: `primary-settings-comparison.json` in that directory. Invoice audit: `invoice-content-audit.json`. Captures include `actual-streaming-before-stop.png`, `streaming-steered-result.png` and `cold-stopped-partial-and-draft.png`.
