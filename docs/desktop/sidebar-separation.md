# Chat sidebar separation

October 27, 2026. Sylvana 0.45.1 received the focused UI update `sidebar-separation-1`.

The new-chat sidebar previously shared the chat's `#181818` background, and the final desktop-surface rule removed its border. The sidebar now uses the reference screenshot's `#191c1d` background and a full-height, one-pixel `#2d3437` divider in the dark theme. The light theme retains its existing colors and gains the divider using its existing edge color. The change applies specifically to the chat sidebar, preserving other surfaces that use the shared sidebar color variable.

The production UI build passed. A generated-data check loaded the production UI in Electron at widths of 900, 1,365, and 1,917 pixels. It verified the exact sidebar, chat, and divider colors; an aligned boundary without gaps; keyboard resizing; collapse and restore; and the light theme. No model requests were sent. Comparison of all 17 script chunks established that only generated asset references changed; the compiled stylesheet differs by the two intended sidebar rules.

The prior installed UI was copied and verified under `F:/Sylvana/verification/sidebar-separation-20261027/previous-ui`. Installation verified all 223 UI files. The application archive, selected profile, and encrypted credential file remained unchanged during publication. Ordinary reopening restored the same account, sidebar width, and unsent draft. Native inspection confirmed the sidebar background and full-height divider in the installed new-chat view. The temporary duplicate UI on C: was removed after verifying the retained backup on F:.

Evidence is retained in that verification directory. This is a focused update to the installed 0.45.1 UI; the previously published full installer predates this visual adjustment. The source change is included in subsequent UI builds.
