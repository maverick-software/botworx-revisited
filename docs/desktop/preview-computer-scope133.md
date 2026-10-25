# Next preview slice — shared-window Computer Use

The required user-visible outcome is that an unsaved agent can test Computer Use through Preview draft with the same explicitly shared windows, current permissions and purple indicators as an ordinary chat. This extends the existing tools and preview scope. It does not require another Computer Use runtime, a generic tool framework or a separate database schema.

## Current missing path

- `desktop/src/draft-preview-execution.ts` rejects selected windows and omits Computer Use definitions from its captured capabilities.
- `desktop/src/tool-execution-scope.ts` permits only the currently implemented preview families and expects workspace/plugin/remote namespaces. It must recognize the declared computer family without accepting arbitrary tools.
- The computer branch in `desktop/src/tool-service.ts` checks `conversation_sessions`. Preview requests use their separate conversation/request tables, so sharing the existing executor requires an explicit preview-authority branch. Retain the ordinary-chat checks.
- `desktop/ui/AgentDraftPreview.tsx` has no shared-window chooser. Reuse `ComputerControls`, keeping its actual selected-window IDs in the existing execution options and showing unavailable references after reopening.
- Stop, cancellation, revocation, changed account/policy and normal completion must finish the specific request's purple indicator and join any pending input. One preview must not stop another chat's unrelated work.

## Acceptance before installation

1. The actual preview picker shares only explicitly selected available windows. Chat only, non-admin access, disabled tools, stale IDs and a foreign creation/request cannot grant input. An interface-supplied object cannot forge the Broker-created execution scope.
2. The accepted snapshot includes only the selected window IDs and allowed computer definitions. Revalidate current account, creation/source, permissions and grants before every operation and immediately before input. Reopening never recreates a revoked window grant or repeats input.
3. Preview activity, reviews and duplicate-call receipts remain in the preview tables. Saved agents, normal requests/chats and normal tool receipts remain unchanged.
4. Default permissions review input. Full access uses the existing explicit grant. A declined or uncertain action is not retried, and duplicate call IDs cannot repeat input or change its arguments.
5. Reuse fresh snapshots, refs and the existing window identity/pixel checks. The purple monitor/cursor treatment appears before input and disappears on completion, cancellation and refusal. Preserve the protected-window and terminal/Run/authentication exclusions.
6. A generated actual packaged test covers preview input, policy and account changes, window revocation, Stop and ordinary-chat isolation with controlled replies. Then one new bounded OAuth task uses a scratch note; independently saved bytes prove the exact once-only append. Preserve all prior requests.
7. Run the checks affected by the changed modules, reuse applicable helper/indicator/recovery evidence, and deliver the verified slice through the existing recoverable update path. Keep browser, command and delegation preview families excluded until their separate paths are implemented.

Checkpoint133 supplies real file-and-reviewed-skill preview evidence, so that workflow needs rerunning only if the new changes affect it. Original scope and remaining work are recorded in [the goal table](goal-status76.md).
