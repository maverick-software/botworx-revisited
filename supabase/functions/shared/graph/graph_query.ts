import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface GraphNeighborhoodResult {
  nodes: Array<{ id: string; label: string; kind: string; confidence: number }>;
  edges: Array<{ id: string; kind: string; src_node_id: string; dst_node_id: string; confidence: number }>;
}

/**
 * Simple 1–2 hop neighborhood query using local graph tables.
 * This is a DB-backed fallback while provider APIs are integrated.
 */
export async function queryNeighborhoodByConcepts(
  supabase: SupabaseClient,
  accountGraphId: string,
  concepts: string[],
  hopDepth: number = 1,
  limit: number = 50,
  confidenceThreshold: number = 0.5
): Promise<GraphNeighborhoodResult> {
  const cleanConcepts = (concepts || []).map((c) => String(c).trim()).filter(Boolean);
  if (cleanConcepts.length === 0) return { nodes: [], edges: [] };

  // Seed nodes by label match
  const orFilters = cleanConcepts.map((c) => `label.ilike.%${escapeLike(c)}%`).join(',');
  const { data: seedNodes } = await (supabase as any)
    .from('graph_nodes')
    .select('id,label,kind,confidence')
    .eq('account_graph_id', accountGraphId)
    .gte('confidence', confidenceThreshold)
    .or(orFilters)
    .limit(Math.min(limit, 50));

  const nodeIds = (seedNodes || []).map((n: any) => n.id);
  if (nodeIds.length === 0) return { nodes: [], edges: [] };

  // 1-hop edges
  const { data: edges1 } = await (supabase as any)
    .from('graph_edges')
    .select('id,kind,src_node_id,dst_node_id,confidence')
    .eq('account_graph_id', accountGraphId)
    .gte('confidence', confidenceThreshold)
    .or(nodeIds.map((id: string) => `src_node_id.eq.${id},dst_node_id.eq.${id}`).join(','))
    .limit(limit);

  if (hopDepth <= 1) return {
    nodes: (seedNodes || []) as any,
    edges: (edges1 || []) as any,
  };

  // 2-hop expansion: collect neighbor node ids from edges1
  const neighborIds = new Set<string>();
  for (const e of edges1 || []) {
    neighborIds.add(e.src_node_id);
    neighborIds.add(e.dst_node_id);
  }
  const secondIds = Array.from(neighborIds).filter((id) => !nodeIds.includes(id));
  let edges2: any[] = [];
  if (secondIds.length > 0) {
    const { data: e2 } = await (supabase as any)
      .from('graph_edges')
      .select('id,kind,src_node_id,dst_node_id,confidence')
      .eq('account_graph_id', accountGraphId)
      .gte('confidence', confidenceThreshold)
      .or(secondIds.map((id: string) => `src_node_id.eq.${id},dst_node_id.eq.${id}`).join(','))
      .limit(limit);
    edges2 = e2 || [];
  }

  return {
    nodes: (seedNodes || []) as any,
    edges: [ ...(edges1 || []), ...edges2 ] as any,
  };
}

function escapeLike(input: string): string {
  return input.replace(/%/g, '\\%').replace(/_/g, '\\_');
}


