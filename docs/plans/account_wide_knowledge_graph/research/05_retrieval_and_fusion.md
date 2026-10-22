# Research: Retrieval & Fusion

Flow
1) Extract concepts from user message
2) Graph query: neighborhood by concepts (hopDepth H, limit L, confidence ≥ C)
3) Vector search: Pinecone per-agent datastore(s)
4) Fusion score: final = w_vec*sim + w_graph*conf + w_recency
5) Build context sections: nodes, edges, vector chunks with backrefs

Metrics
- nodes_used, edges_used, fusion_weights, timings, cache hits

UI
- Process modal: Graph Operations panel listing nodes/edges and links to vectors
