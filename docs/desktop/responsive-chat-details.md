# Responsive chat details

October 20, 2026. The responsive correction is built and tested; installed acceptance is pending normal application closure.

The Chat/Changes/Sources card previously used a 1200-pixel window breakpoint, and a saved open choice overrode that breakpoint. It could therefore remain docked while the left sidebar and card consumed the space needed by the conversation.

The new hook measures the conversation columns after the left navigation. Details dock when at least 1120 pixels remain. Below that size, the card closes automatically, including when the account's saved roomy-layout choice is open. The header button opens it temporarily as an overlay, leaving the conversation and composer widths unchanged. Returning to a roomy layout restores the saved roomy-layout choice. Resizing the navigation sidebar also triggers measurement. Temporary narrow-layout visibility does not replace the saved preference.

The staged UI is rebuilt from the accepted recovery-bootstrap-15 source with only ChatContext.tsx, chat-context.css and the already accepted transcript scrollbar rule in style.css overlaid. Unfinished recovery/backend changes are excluded. The installed backend archive, provider harnesses, agent execution and database schema are preserved.

Evidence is under `.supabase/desktop-responsive-context/1792523211088`. Exact staged assets passed 13 chat-details workflows at 1600, 1440, 1362, 1280 and 850 pixels, including sidebar resizing, explicit hidden/open preferences, reloads, document/review actions and draft preservation. Five additional transcript workflows passed startup position, older-message reading during streaming, author labels and jump-to-latest behavior. These use the actual interface with a controlled local bridge and generated conversations; they make no model requests.

The current Windows Computer Use helper fails before starting its JavaScript kernel with `failed to write kernel assets: The system cannot find the path specified. (os error 3)`. Reset and documented retry did not recover it. The user's supplied ChatGPT Desktop screenshots establish the requested appearance; a fresh live comparison and ordinary production-window acceptance remain pending. Agentopia was still open when the verified update was prepared. The user has been asked to close it normally; standing install authorization already applies.

The installer script refuses an open application, verifies all currently accepted resource hashes, captures and independently verifies a fresh compressed private profile, compares all 126 saved tables around the UI swap, and retains the old UI for rollback. It records native acceptance separately instead of treating controlled-interface checks as production-window verification.
