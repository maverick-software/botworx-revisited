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

async function checkChannelIntegrations() {
  console.log('\n=== Checking Channel Integrations ===\n');
  
  try {
    // 1. Check integrations table
    const { data: integrations, error: intError } = await supabase
      .from('integrations')
      .select('*')
      .eq('agent_classification', 'channel');
    
    if (intError) {
      console.error('Error fetching integrations:', intError);
    } else {
      console.log('Channel integrations in database:');
      if (integrations && integrations.length > 0) {
        integrations.forEach(int => {
          console.log(`  - ${int.name} (ID: ${int.id}, Active: ${int.is_active})`);
        });
      } else {
        console.log('  No channel integrations found in integrations table');
      }
    }
    
    // 2. Check service_providers table
    console.log('\n=== OAuth Providers ===\n');
    const { data: providers, error: provError } = await supabase
      .from('service_providers')
      .select('*');
    
    if (provError) {
      console.error('Error fetching OAuth providers:', provError);
    } else {
      console.log('OAuth providers in database:');
      if (providers && providers.length > 0) {
        providers.forEach(prov => {
          console.log(`  - ${prov.name} (Display: ${prov.display_name}, Active: ${prov.is_active})`);
        });
      } else {
        console.log('  No OAuth providers found');
      }
    }
    
    // 3. Check if there's a mismatch between provider names and integration names
    console.log('\n=== Name Matching Analysis ===\n');
    console.log('The AgentIntegrationsManager component tries to match:');
    console.log('  permission.connection.provider_name with integration.name');
    console.log('\nIf Gmail is stored as "gmail" in service_providers.name');
    console.log('but as "Gmail" in integrations.name, they won\'t match!');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkChannelIntegrations();