import type { SupabaseClient } from '@supabase/supabase-js';
import { GetZepService } from './getzep_service';

export class GraphServiceFactory {
  /**
   * Resolve a Graph service instance for the given account_graphs.id
   * - Reads `account_graphs` to obtain `connection_id` and `user_id`
   * - Decrypts API key from `user_integration_credentials.vault_access_token_id` via `vault_decrypt`
   */
  static async createGetZepService(
    accountGraphId: string,
    supabase: SupabaseClient
  ): Promise<GetZepService | null> {
    const { data: ag, error: agErr } = await (supabase as any)
      .from('account_graphs')
      .select('id, user_id, connection_id, provider, settings')
      .eq('id', accountGraphId)
      .maybeSingle();
    if (agErr || !ag) return null;

    if (!ag.connection_id) return null;
    const { data: conn, error: connErr } = await (supabase as any)
      .from('user_integration_credentials')
      .select('vault_access_token_id, connection_metadata')
      .eq('id', ag.connection_id)
      .eq('user_id', ag.user_id)
      .maybeSingle();
    if (connErr || !conn?.vault_access_token_id) return null;

    const { data: decrypted, error: decErr } = await (supabase as any)
      .rpc('vault_decrypt', { vault_id: conn.vault_access_token_id });
    if (decErr || !decrypted) return null;

    const apiKey: string = decrypted as string;
    const meta = (conn as any)?.connection_metadata || {};
    const opts = {
      projectId: meta.project_id || undefined,
      accountId: meta.account_id || undefined,
    } as any;
    return new GetZepService(apiKey, opts);
  }
}


