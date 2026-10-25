# Computer Use investigation, gap analysis and repair plan

October 24, 2026, Pacific time. This review addresses the supplied screenshot in which Agentopia's assistant says that Computer Use cannot run because `node_repl` is unavailable.

## Finding

The imported Computer Use skill describes Codex Desktop's JavaScript runtime and `@oai/sky` API. Agentopia executes Windows control through its own existing `computer_windows`, `computer_snapshot`, click, key, type, scroll and drag tools. Before checkpoint155, the harness supplied the adaptation instructions only when a window was already shared. In a chat with no shared windows, the model could read the imported skill, see its runtime requirement and report that requirement instead of explaining how to enable the available Agentopia path.

The composer also lacked a direct window-sharing entry. Those two gaps combined into the reported failure: the assistant gave an internal dependency explanation and the user had no clear route from the message composer to the existing picker. Full access alone does not select a window.

The parallel parity work repaired both gaps in commit `d85984a7183c109ccf137ee02258b456fb68ed4f`, then delivered the same compiled harness in installed **0.44.77**. This review independently verified that installation. No additional execution framework, Node REPL dependency or runtime replacement is needed for the reported case.

## Gap analysis

| Area | Reported or inspected gap | Resolution and acceptance |
| --- | --- | --- |
| Skill/runtime compatibility | Imported instructions name an API unavailable inside Agentopia. | Existing shared-window guidance maps the operations to Agentopia's actual host tools and preserves the skill's observation and safety workflow. The installed harness contains this mapping. |
| No-window diagnosis | Adaptation instructions were missing when computer tools were absent. | Guidance now distinguishes missing window sharing, account access, permission mode and agent-policy/runtime limits. It does not claim that installing the Codex runtime is required. |
| Sharing discovery | The composer did not expose the existing sharing picker directly. | **+ / Add to chat > Application windows** opens the chat-scoped picker. This review observed the entry and loaded picker in the ordinary installed app. Opening it creates no grant or model request. |
| Permission behavior | Full access could be mistaken for a shared window; older documentation said it still reviewed every input. | Full access runs enabled input automatically inside explicitly shared windows. Default permissions review input. Chat only/Selected files and restricted policies continue to limit access; Plan mode withholds input tools. |
| Window availability | A minimized window cannot be captured reliably. | The installed picker explains **Restore this window before sharing it**. The retained scratch Notepad is currently minimized and is correctly disabled. No setting or window grant was changed to work around that condition. |
| Verification | Successful text alone would not establish actual control. | The retained real OAuth test includes completed snapshot/click/key/type receipts, one exact append, independent accessibility and saved-byte readback, and cold reopening without replay. |
| Documentation | The main Computer Use page described the old menu name and old Full access review rule. | Updated its current usage instructions and linked this report while retaining historical qualification evidence. |

## Repair plan and execution

1. **Reproduce the guidance gap.** Inspect the imported skill, the tool-enablement conditions and the native developer instructions. The existing regression failed against the pre-repair build; the supplied screenshot and saved ordinary chat establish the user-visible failure.
2. **Extend the existing host path.** Supply truthful guidance before sharing as well as after sharing, and restore a composer entry to the existing picker. Checkpoint155 implements this; the same harness is present in installed77.
3. **Keep scope and permission boundaries.** Retain selected-window grants, account and agent restrictions, observation identifiers, uncertain-input handling, Stop and restart revocation. No broad desktop grant or command-based fallback is added.
4. **Verify behavior before delivery.** Reuse the completed four native-guidance cases, 30 composer cases and two real OAuth requests. Independently confirm actual control and cold no-replay. These checks are complete; their saved request IDs are listed below.
5. **Verify the delivered app and correct the guide.** Hash the installed archive and harness, inspect the current Add entry and loaded picker, return to the original chat, and update the stale usage instructions. This review completed those checks without a build, restart, new grant or AI request.

## Evidence and limits

The installed archive hash is `d9b87183d8283e5037bb82df46911e1f031f2b37da154313097b45cfa5b379f6`, matching the verified 0.44.77 release. Its compiled `codex-harness.js` hash is `18496ce3aefc56eaf0911c2f2bb20fd82c3de6fc17d94f49c9f5a74b2286d2f0`, identical to the successful checkpoint155 live test.

The exact original prompt, **Use computer use to control the computer**, completed as request `888711a7-4983-456e-8d5a-270c6dbbd4ad`. It gave the Application windows sharing instructions and issued no computer input. Follow-up `6aa70a24-32a1-4680-b121-337cd584565b` used the reviewed imported skill and selected Notepad grant. Its window listing, screenshot, click, key and text operations all completed; text was sent once. Independent readback and saved UTF-8 bytes matched the original seed plus the requested Unicode suffix. The two requests used 11 real ChatGPT OAuth responses and no new OpenRouter responses.

The original live runner stopped after the completed actions because it rejected four recovered read-only skill-file range errors. That failed gate remains retained. The independent verifier checked the failed assertion, successful computer receipts, corrected required file reads and actual note bytes, then cold-opened the same QA profile without another model request or input. This review inspected those outcomes and did not replay either request or restart the retired QA runtime.

Ordinary77 installation evidence separately verifies recoverable update, both accounts/passwords/roles, 122 chats, 422 messages, all 137 application tables and 109 protected settings, including both AI connections. This review did not read credentials or change the ordinary profile's settings. Native inspection returned to the original chat with an empty composer and no shared-window grant.

This establishes the reported missing-runtime/sharing failure and the tested Notepad workflow. Wider applications, monitor/scaling combinations and new live OpenRouter onboarding remain additional coverage. Computer Use remains scoped to shared application windows; it does not automatically grant access to the entire desktop or protected applications. Existing historical assistant replies remain unchanged; corrected guidance applies to subsequent messages.

Evidence pointers relative to `F:/Agentopia`:

- Independent review: `.supabase/desktop-computer-use-review-20261024/evidence.json`.
- Repair and regression: `.supabase/desktop-computer-guidance155/checkpoint155.json` and `1792891539288/proof.json` in that directory.
- Live outcomes: `.supabase/desktop-computer-guidance155/accepted-current.json`, which identifies the independent retained-outcome verifier.
- Current delivery: `.supabase/desktop-computer-repair76/installed-current.json` and `.supabase/desktop-release77/current.json`.

## Use it now

Open the target application and restore its window if minimized. In Agentopia choose **+ > Application windows**, select the intended window and choose **Share selected windows**. Return to the chat and send the task. Default permissions review inputs; Full access runs permitted input automatically within the shared window. Use **Stop computer use** to revoke access.
