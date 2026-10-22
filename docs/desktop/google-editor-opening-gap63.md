# Direct Google editor opening — installed 0.44.63 gap

This is the initial gap analysis. Connected opening is now implemented in the frozen, uninstalled 0.44.64 candidate. See [the current implementation and acceptance record](google-editor64.md) for the verified source work and remaining release and live-service checks.

The installed 0.44.63 `ChatFiles.action` handler resolves the owned local file, but its `google` branch returns Google Drive home and manual upload instructions. It does not transfer the selected file, create a cloud document or open that document's editor. Direct connected opening remains incomplete.

The next implementation should connect this explicit file action to the current user's active Google Drive connection in Composio. Multiple eligible accounts need an account choice. The application should upload only the resolved, authorized file, preserve the local original, record the operation and returned cloud file ID, and open the verified editor URL in its browser workspace. Agent-initiated transfers must retain agent assignments and the existing tool-review rules; a model-supplied path or account ID cannot grant access.

Official documentation checked on October 22 supports several building blocks, with transport work still unresolved:

- Composio can authenticate provider requests server-side and offers an account-specific proxy path. Proxy execution requires its own scoped-key permission. The current session guide describes a JSON body, so it does not establish support for sending arbitrary Office-file bytes through that interface. [Composio proxy execution](https://docs.composio.dev/docs/extending-sessions/proxy-execute).
- Current Composio file handling requires explicit opt-in; automatic path/URL handling must not be assumed. A deliberately staged, selected-file transfer should be investigated instead of passing local paths to the remote service. [Composio changelog](https://docs.composio.dev/reference/changelog).
- Google Drive supports upload with target document-type metadata and resumable transfers. Conversion creates a Google Workspace file; pre-generated IDs do not provide duplicate prevention for those conversions. A lost conversion response therefore needs saved-operation inspection before another creation attempt. [Google Drive upload and conversion](https://developers.google.com/workspace/drive/api/guides/manage-uploads).

The proposed connection-aware route is an engineering inference from these documented building blocks. The exact Composio file-staging REST contract and current Google Drive upload tool schema still need verification before implementation. A valid per-user project key and authorized Drive account are required for real catalog, upload and editor verification; neither is currently available in the production setup. Keep keys in the protected setup field.

Acceptance must cover DOCX, XLSX and PPTX; correct account selection; real upload/editor opening; source-file preservation; repeated-click suppression; uncertain-response recovery without duplicate creation; revoked grants and changed accounts; and continued local preview/download/default-app behavior. Existing schedule and memory tests do not establish this integration.
