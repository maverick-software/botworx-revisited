import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixChannelPermissionsDisplay() {
  console.log('\n=== Fixing Agent Channel Permissions Display ===\n');
  
  try {
    // Execute the SQL to update the function
    const { error } = await supabase.rpc('query', {
      query: `
        -- Drop and recreate the function with better handling
        DROP FUNCTION IF EXISTS public.get_agent_integration_permissions(UUID);

        CREATE OR REPLACE FUNCTION public.get_agent_integration_permissions(p_agent_id UUID)
        RETURNS TABLE (
            permission_id UUID,
            agent_id UUID,
            connection_id UUID,
            connection_name TEXT,
            external_username TEXT,
            provider_name TEXT,
            provider_display_name TEXT,
            integration_name TEXT,
            allowed_scopes JSONB,
            is_active BOOLEAN,
            permission_level TEXT,
            granted_at TIMESTAMPTZ,
            granted_by_user_id UUID
        ) 
        LANGUAGE sql
        SECURITY DEFINER
        SET search_path = public
        STABLE
        AS $$
            SELECT 
                aop.id AS permission_id,
                aop.agent_id,
                uoc.id AS connection_id,
                COALESCE(uoc.connection_name, op.display_name || ' Connection') AS connection_name,
                uoc.external_username,
                op.name AS provider_name,
                op.display_name AS provider_display_name,
                op.display_name AS integration_name,
                aop.allowed_scopes,
                aop.is_active,
                aop.permission_level,
                aop.granted_at,
                aop.granted_by_user_id
            FROM agent_integration_permissions aop
            INNER JOIN user_oauth_connections uoc ON uoc.id = aop.user_oauth_connection_id
            INNER JOIN service_providers op ON op.id = uoc.oauth_provider_id
            WHERE aop.agent_id = p_agent_id
            AND aop.is_active = true
            AND uoc.connection_status = 'active'
            -- Check that the current user owns the agent OR has been granted permission to view it
            AND EXISTS (
                SELECT 1 FROM agents a 
                WHERE a.id = p_agent_id 
                AND (
                    a.user_id = auth.uid() 
                    OR a.created_by = auth.uid()
                    OR EXISTS (
                        SELECT 1 FROM team_agents ta
                        INNER JOIN user_team_memberships utm ON utm.team_id = ta.team_id
                        WHERE ta.agent_id = a.id AND utm.user_id = auth.uid()
                    )
                )
            )
            ORDER BY aop.granted_at DESC;
        $$;

        -- Grant execute permissions
        GRANT EXECUTE ON FUNCTION public.get_agent_integration_permissions(UUID) TO anon, authenticated;
      `
    });

    if (error) {
      console.error('Error updating function:', error);
      
      // If the query RPC doesn't exist, try a different approach
      console.log('\nTrying alternative approach...\n');
      
      // Test if the current function works
      const agentId = process.argv[2];
      if (agentId) {
        const { data, error: testError } = await supabase.rpc('get_agent_integration_permissions', {
          p_agent_id: agentId
        });
        
        if (testError) {
          console.error('Error testing function:', testError);
        } else {
          console.log('Current function returned:', data?.length || 0, 'permissions');
          if (data && data.length > 0) {
            console.log('\nPermissions found:');
            data.forEach(perm => {
              console.log(`  - ${perm.provider_display_name || perm.provider_name} (${perm.external_username})`);
            });
          }
        }
      } else {
        console.log('Provide an agent ID to test: node scripts/fix_channel_permissions_display.js <agent-id>');
      }
    } else {
      console.log('✅ Successfully updated get_agent_integration_permissions function');
      console.log('\nThe function now:');
      console.log('  - Returns integration_name for better display');
      console.log('  - Checks for active connections only');
      console.log('  - Handles team permissions properly');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

fixChannelPermissionsDisplay();