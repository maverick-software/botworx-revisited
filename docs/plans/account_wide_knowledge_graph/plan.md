# Account-Wide Knowledge Graph (GetZep) — Centralization Plan

Objective
- Build a single, account-scoped GetZep-backed knowledge graph that aggregates entities and relations from all conversations, documents, and connectors. The graph will be optionally consumable by all agents in the account and tightly cross-linked with episodic vectors (Pinecone) to maintain bidirectional correlation.

Scope
- In-scope: graph schema, ingestion, extraction, matching/merging, retrieval fusion with vectors, UI settings, backfill, metrics, and rollout.
- Out-of-scope (initial): cross-account sharing, advanced GNN training, non-text modalities.

Proposed File Structure
- `docs/plans/account_wide_knowledge_graph/`
  - `plan.md` (this file)
  - `wbs_checklist.md`
  - `research/`
    - `00_overview.md`
    - `01_schema_and_rls.md`
    - `02_getzep_service_api.md`
    - `03_extraction_and_salience.md`
    - `04_matching_and_optimal_placement.md`
    - `05_retrieval_and_fusion.md`
    - `06_ui_and_flags.md`
    - `07_backfill_and_rollout.md`
  - `implementation/`
    - `README.md`
  - `backups/` (temporary backup files during implementation)

High-Level Architecture
- Account Graph: single `account_graphs` row per account. Nodes/Edges live in `graph_nodes`/`graph_edges` with `graph_links` to vectors/messages/documents.
- Ingestion Pipelines: chat messages, document chunks, connectors → extraction (entities/relations) → salience scoring → candidate matching → upsert/merge → `graph_links` + vector metadata backlinks.
- Retrieval Fusion: vector search + concept extraction → graph neighborhood query → scoring fusion (vector similarity, graph confidence, recency) → context assembly.

Key Design Principles
- Idempotency: deterministic external_id and alias handling; safe reprocessing.
- Explainability: metrics surface nodes/edges used and scoring breakdowns.
- Safety: RLS by account; service-role writes only; audit-friendly logs.

Milestones (see WBS for details)
1. Schema & Types
2. Graph Service (GetZep)
3. Extraction & Importance Scoring
4. Matching & Optimal Placement
5. Ingestion Hooks
6. Retrieval & Fusion with Vectors
7. UI & Settings
8. Backfill & Rollout
9. QA & Documentation

Acceptance Criteria (abbreviated)
- New chats/docs produce nodes/edges with >90% idempotent behavior.
- Matching merges ≥80% of clear duplicates under default thresholds.
- Retrieval shows graph operations and improves hit rate for reference-style queries.
- Backfill completes with progress visibility; no RLS violations; no instability.

Constraints Acknowledged
- Follow `plan_and_execute.mdc` phases; keep files < 300 LOC where possible; backup before edits; use feature flags for rollout.


