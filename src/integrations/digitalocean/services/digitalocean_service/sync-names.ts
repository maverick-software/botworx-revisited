/**
 * Service to sync droplet names from DigitalOcean API
 * Ensures consistency between DigitalOcean and Gofr Agents database
 */

import { supabase } from '../../lib/supabase.ts';
import { getDigitalOceanDroplet } from './droplets.ts';

export interface DropletNameSyncResult {
  droplet_id: number;
  old_name: string | null;
  new_name: string;
  synced: boolean;
  error?: string;
}

/**
 * Sync a single droplet's name from DigitalOcean API
 */
export async function syncDropletName(dropletId: number): Promise<DropletNameSyncResult> {
  try {
    console.log(`Syncing droplet name for ID: ${dropletId}`);
    
    // Get current record from database
    const { data: toolboxRecord, error: dbError } = await supabase
      .from('account_tool_environments')
      .select('id, name, do_droplet_name')
      .eq('do_droplet_id', dropletId)
      .single();

    if (dbError) {
      throw new Error(`Database error: ${dbError.message}`);
    }

    if (!toolboxRecord) {
      throw new Error(`No record found for droplet ID ${dropletId}`);
    }

    // Get actual droplet name from DigitalOcean
    const dropletInfo = await getDigitalOceanDroplet(dropletId);
    const actualName = dropletInfo.name;

    // Check if sync is needed
    if (toolboxRecord.do_droplet_name === actualName) {
      console.log(`Droplet ${dropletId} already synced: ${actualName}`);
      return {
        droplet_id: dropletId,
        old_name: toolboxRecord.do_droplet_name,
        new_name: actualName,
        synced: false // No sync needed
      };
    }

    // Update database with actual name
    const { error: updateError } = await supabase
      .from('account_tool_environments')
      .update({
        do_droplet_name: actualName,
        // Optionally update the display name too if they were the same
        name: toolboxRecord.name === toolboxRecord.do_droplet_name ? actualName : toolboxRecord.name
      })
      .eq('do_droplet_id', dropletId);

    if (updateError) {
      throw new Error(`Update error: ${updateError.message}`);
    }

    console.log(`✅ Synced droplet ${dropletId}: "${toolboxRecord.do_droplet_name}" → "${actualName}"`);
    
    return {
      droplet_id: dropletId,
      old_name: toolboxRecord.do_droplet_name,
      new_name: actualName,
      synced: true
    };

  } catch (error) {
    console.error(`❌ Failed to sync droplet ${dropletId}:`, error);
    return {
      droplet_id: dropletId,
      old_name: null,
      new_name: '',
      synced: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Sync all droplet names from DigitalOcean API
 */
export async function syncAllDropletNames(): Promise<DropletNameSyncResult[]> {
  console.log('🔄 Starting bulk droplet name sync...');
  
  try {
    // Get all toolboxes with droplet IDs
    const { data: toolboxes, error: dbError } = await supabase
      .from('account_tool_environments')
      .select('do_droplet_id')
      .not('do_droplet_id', 'is', null);

    if (dbError) {
      throw new Error(`Database error: ${dbError.message}`);
    }

    if (!toolboxes || toolboxes.length === 0) {
      console.log('No droplets found to sync');
      return [];
    }

    // Sync each droplet
    const results: DropletNameSyncResult[] = [];
    for (const toolbox of toolboxes) {
      if (toolbox.do_droplet_id) {
        const result = await syncDropletName(toolbox.do_droplet_id);
        results.push(result);
      }
    }

    const syncedCount = results.filter(r => r.synced).length;
    const errorCount = results.filter(r => r.error).length;
    
    console.log(`✅ Bulk sync complete: ${syncedCount} synced, ${errorCount} errors`);
    
    return results;

  } catch (error) {
    console.error('❌ Failed to sync droplet names:', error);
    throw error;
  }
} 