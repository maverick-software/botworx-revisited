# Read-only protected Composio policy capture after installation

Finish the initial installed row and credential audit before opening Composio. The existing qualified controller hashes and empty service policy remain unchanged for that first audit.

After normal installed Plugins browsing, run `node scripts/desktop/capture-protected-composio-policy80.mjs` from F:/Agentopia. This standalone helper checks the installed80 image and qualified package proof, snapshots credentials.bin and Local State into an ACL-protected F directory, and decrypts only inside a disposable Electron encryption helper. It never starts the product backend, refreshes copied OAuth tokens, calls a provider or writes the normal profile.

The projection verifies the current Agentopia owner, exact stored Composio grant authority, the candidate compiled catalog file hash and catalog revision, every cached service's published name/counts, and private account selection consistency. Connected-account IDs, aliases and credentials stay inside helper memory. Output policy contains only the Agentopia owner needed by the row comparator, catalog revision and public service slugs/titles. Evidence records encrypted-source hashes and explicitly names protected normal-app metadata as its provenance.

Only a complete cache covering every exact compiled catalog service writes the existing composio-service-policy80.json. Partial or absent cache produces a protected report, prints aggregate progress, and leaves the existing policy untouched. Do not use that partial report to authorize inherited grants or the composio-services-v1 receipt; assess the observed incomplete case separately. A public catalog revision different from the candidate compiled snapshot is refused.

The new helper does not alter any qualified comparator, writer or delivery controller. Controlled tests run with `node --test scripts/desktop/test-protected-composio-projection80.cjs`; they use synthetic stores and never decrypt or read the normal profile. Perform the real read-only capture only after the installed UI has produced metadata.
