# Research: Backfill & Rollout

Backfill
- Detect existing GetZep datastores → create account_graphs
- Scan messages/documents in batches, run IE + matching, upsert
- Update Pinecone metadata with node/edge ids; create graph_links
- Progress table + resumable cursor

Rollout
- Flag gating 10% → 50% → 100%
- Dashboards: ingestion throughput, queue depth, error rate
- Alerts on backpressure and provider errors
