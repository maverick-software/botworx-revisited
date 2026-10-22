# Offline document and image authoring runtime

October 18, 2026. The installed 0.44.24 package includes the authoring libraries described here. Its exact delivered Codex command executor, Python, offline bootstrap and independent JavaScript readers now pass artifact creation/content checks. Agent-driven chat, broader visual fidelity and installed-app acceptance remain separate requirements.

## Behavior

Managed commands, interactive terminals and native Codex shell sessions use the existing bundled Python. The authoring bundle supplies python-docx, openpyxl, XlsxWriter, python-pptx, ReportLab, pypdf and Pillow, with their dependencies. This supports Word documents, spreadsheets, PowerPoint presentations, PDFs and image processing without first-launch package downloads. It does not provide an AI image-generation service.

The environment points Python at a small, hash-checked bootstrap. That bootstrap appends the bundled libraries after the project's own dependencies, so a project virtual environment can use its selected package versions. User-supplied Python paths and provider credentials are still removed before constructing the managed environment. The bundled tools remain protected against package installation; project dependencies belong in a local virtual environment.

The normal Python startup behavior loads this bootstrap. Explicit isolated interpreter options such as `-I` ignore environment paths; a script using those options must provide its dependencies explicitly. Spreadsheet writers do not recalculate arbitrary formulas. XlsxWriter can preserve a supplied cached result, which must be calculated and checked correctly before presenting it as a result.

Existing file, command and agent permission rules still govern execution. Library availability does not grant a new filesystem scope or authorize an external action.

## Reproducible resources

`desktop/artifact-runtime-pins.json` records eleven Windows/Python-compatible wheels with exact versions, official download URLs and SHA-256 fingerprints checked against PyPI metadata. Preparation verifies each archive before extraction, rejects unsafe or colliding paths and automatic wheel startup hooks, and preserves license notices. Wheel helper-script sources remain in their package layout; preparation does not execute them or install them on PATH.

The bundle contains 1,077 pinned files, including the Agentopia-owned bootstrap. Publication reconstructs expected file hashes from the pinned archives rather than trusting an editable staging manifest. The source runtime verifies these resources alongside the existing command tools. The desktop build verifies the prepared authoring bundle before compilation and packaging.

Commands:

```powershell
npm run desktop:prepare:artifacts
npm run desktop:verify:artifacts
npm run desktop:test:artifacts
```

The preparation command may download the pinned wheels during development. The verification command uses the prepared resources and committed source manifest without downloading packages. The installed 0.44.24 package contains the prepared resources; managed commands do not need first-use dependency downloads.

## Demonstrated behavior

The actual bundled Python creates five generated fixtures: a PNG, a Word document with a table and image, a spreadsheet with a formula and cached total, a presentation with images and speaker notes, and a two-page PDF with Unicode text. Word and presentation files reopen with their authoring libraries. Openpyxl independently checks the XlsxWriter spreadsheet's formula and cached value; pypdf independently checks the ReportLab PDF's text and page count.

The actual bundled Codex command executor also runs that authoring fixture without inference. Its generated files are retained under `.supabase/desktop-artifact-authoring/native-1792352851622/outputs`; `evidence.json` records the native command. A previous native run's four Office/PDF files pass the exact 0.44.19 JavaScript document reader, retaining the generated marker, spreadsheet formula and speaker notes. Evidence: `native-1792352758680/outputs/reader-evidence.json`. These readers use a different implementation from the Python authoring libraries.

The source command suite checks environment isolation, managed authoring, project dependency precedence, offline virtual environments, interactive sessions, descendant cancellation and actual native command execution. Eight checks pass at `.supabase/desktop-artifact-authoring/source-check-1792353069634/evidence.json`, including an explicit authoring-package import through the source-configured native environment. The earlier run is retained separately. Resource verification, backend compilation and source hashes are included in each record.

The exact delivered 0.44.24 bundle passes a new check at `.supabase/desktop-artifact-authoring/delivered-1792364116490/evidence.json`. `test-artifact-delivered-command.mjs` verifies the archive hash, uses the bundled native command executor with an isolated profile and minimal system PATH, verifies all seven authoring imports resolve below the delivered bundle before running the fixture, and invokes the delivered JavaScript reader on all four document files. It creates five files and recovers the marker, formula/cached value and presentation notes. No developer Python dependencies or provider credentials are supplied.

Poppler independently rendered both generated PDF pages at 100 DPI. Visual inspection found legible Unicode text, the expected table and image on page one, and the second-page marker without clipping. The renderer exited successfully while reporting missing optional font mappings; those warnings are retained in the visual inspection record. This is a simple generated layout, and Word/Excel/PowerPoint rendering has not been demonstrated.

The offline checks make zero live provider requests. They establish usable structures, delivered dependencies, content extraction and the inspected PDF layout.

## Ordinary installed chat acceptance

One submitted ChatGPT request in the ordinary installed 0.44.24 application created four new files in a selected generated project folder. The selected connection was `openai-oauth`, model `gpt-6.1-sol`, harness `codex` and bundled runtime 0.163.0. Request `95f57752-27a5-4a28-b1cb-259ab42812fa`, conversation `2b59042e-ee28-41ae-826e-0655ec808d95`, completed successfully. Do not replay it. The actual agent used Agentopia's scoped `write_file` and managed `run_command` tools through native Codex. The saved command result records exit code zero; the script and generated files remain in `docs/desktop/workspace-demo/artifacts-chat-1792364219213`.

`scripts/desktop/audit-artifact-chat.py` reads only this generated request from the actual production database. `verify-artifact-chat-output.mjs` checks its completed status, selected provider/harness, command outcome and response paths, then uses the delivered JavaScript reader and an independent standard-library XML inspector. The checks recover all four markers, the Word table, both presentation slides and notes, and spreadsheet inputs 10/20 with `SUM(B5:B6)` and cached value 30. Evidence is retained under `.supabase/desktop-artifact-authoring/chat-1792364219213`.

All four chat links open in the installed right-side workspace. The file tree refreshes to show the actual generated files. The PDF/Word panes display extracted text, the spreadsheet displays cached values and formula text, and the presentation navigates between two slides with their speaker notes. The interface identifies these as read-only extracted views. Independently rendered PDF output was visually inspected at 110 DPI with legible headings/table/checklist and no clipping. This establishes usable document creation, local links and content inspection; it does not establish full Office layout rendering or editing.

The first native picker attempt was unsubmitted and cleared by a normal app reopen, preserving the original image draft. The computer-use helper held stale window/accessibility state; resetting that helper exposed the actual native picker. A generated folder under protected `.supabase` storage was correctly refused, and the test then selected an ordinary generated project folder. No security rule was bypassed. There was one submitted human turn and zero OpenRouter requests.

A normal close and ordinary Explorer reopen preserves the completed result, four workspace tabs and selected Word content. The exact request, final message, native turn/items and all four output hashes match the pre-close checkpoint; one matching generated request remains, with no replay observed. `reopen-verification.json` records this check. The original conversation/image draft is then restored.

Broader Office visual inspection, editing, permission/cancellation cases and Windows/runtime reboot recovery remain acceptance requirements. Reuse the recorded completed request when checking reopening; do not send its prompt again.
