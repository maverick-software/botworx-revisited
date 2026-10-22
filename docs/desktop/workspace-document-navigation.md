# Document navigation

Version 0.21.0 connects the right workspace's documents, images, folders and breadcrumbs. PostgreSQL and Supabase continue to store the existing accounts, conversations and operation history.

[Open the organization guide](workspace-organization.md) · [Browse desktop docs](./) · [Jump to navigation controls](#navigation-controls)

| Link | Result |
| --- | --- |
| Markdown or another supported local file | Opens a workspace tab |
| Folder | Opens a directory tab |
| Document section | Scrolls to and focuses its heading |
| Website | Opens the isolated browser |
| Image in an assistant reply | Opens the image in a workspace tab |

## Navigation controls

Click a directory breadcrumb to list its immediate children. **Open this folder** opens its directory view; a sibling file opens its file tab. Directory views have their own filename filter and refresh control. They show the existing first-200-supported-entry limit; opening a nested folder browses that folder independently. The folder tree remains available beside the preview.

Markdown supports tables, disabled task checkboxes, local image previews and section links. A repeated heading receives a numeric suffix for its later sections. Saved section links reopen with the document. A missing section produces an in-document notice. Refresh preserves the current reading position instead of reapplying the last section link.

Document-relative links, parent paths within an opened grant, root-relative links and local Windows/file URLs resolve in the trusted application process. Encoded spaces, Unicode filenames and section names are supported. A file selected on its own grants access to that file; linked siblings require an already opened folder or their own existing grant. Links cannot create new grants. Hidden/credential files, application storage, linked paths and other accounts' references retain the existing exclusions. Unsupported targets show an error and do not launch a program.

Website links use the existing HTTPS/local-development browser policy. Remote image references offer a browser link and do not load automatically into the local document preview. Raw HTML and scripts are not executed by Markdown. Interactive HTML remains in its separate isolated canvas.

## Local images

PNG, JPEG and WebP previews use the existing two-megabyte file limit. Images load near the visible document area. Duplicate references share a read. One renderer-wide queue allows up to four active inline image reads across tab changes; queued reads are removed when their document closes. Each document retains up to 32 image references and approximately 16 MB of image file data. A limit or decoding error stays visible beside the image placeholder. Refresh rereads the current files; clicking an image opens its own preview tab.

This existing project image demonstrates a relative local image reference:

![Existing project MCP image](../../public/mcp-light.png)

## Drafts, privacy and recovery

Navigation flushes protected editor drafts before switching views and leaves their files unchanged. Browsing and rendering images do not attach their contents to a model or change provider/model choices. Chat-output file links use the selected workspace as their base; they open through the same account grants. Directory tabs and section bookmarks use the existing Windows-protected per-account pane storage. Confirmed file/folder moves relocate their saved paths, and recoverable removal closes affected tabs. This release adds no database migration.

Actual Windows files, native image decoding, Unicode/section links, breadcrumbs, directory persistence, image refresh, image read limits and a controlled assistant reply are exercised in the desktop workflow. Provider inference in regression is supplied by test fixtures. Source/installed close and interruption results are recorded in [implementation status](implementation-status.md). Broader desktop parity remains active in the [backlog](parity-backlog.md).
