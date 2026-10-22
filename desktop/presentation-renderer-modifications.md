# Presentation renderer modifications

Agentopia bundles @aiden0z/pptx-renderer 1.4.0 under Apache-2.0. Its license,
third-party notices and component notices are distributed alongside this file.

Agentopia changes the renderer's default column-chart palette selection to keep
the original theme colors instead of applying its extra 0.88 darkening factor.
Explicit document colors and horizontal-bar behavior remain unchanged. The
change is applied during the build to an exact SHA-256-pinned module; the npm
package files remain unchanged. A native PowerPoint export of a generated deck
is retained with the visual comparison evidence.

Agentopia also converts explicit chart text from hundredths of a point to CSS
pixels, matching the upstream chart-default conversion and the surrounding slide
text. This covers axis labels, data labels, legends and chart titles that use
explicit text properties. Office number formats use the existing SSF dependency,
preserving currency symbols, decimal places, grouping and format sections. An
unsupported format falls back to the upstream formatter. The actual agent-created
deck and read-only native PowerPoint exports are retained as regression evidence.

For automatic horizontal-bar layouts, outside-end labels follow the bar endpoint.
The value axis respects reversed category order and its crossing setting, and
the automatic chart grid reserves space for its title and tick labels. Explicit
manual plot layouts and custom numeric crossings retain upstream placement.

The build-time patch is in presentation-renderer-patch.mjs. A dependency update
must requalify this patch against the new source and native exports.
