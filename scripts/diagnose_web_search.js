const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function diagnoseWebSearch() {
  console.log('=== WEB SEARCH DIAGNOSTIC ===\n');
  
  try {
    // Check web search providers
    const { data: providers, error: providersError } = await supabase
      .from('web_search_providers')
      .select('*');
    
    if (providersError) {
      console.log('❌ Error fetching providers:', providersError.message);
    } else {
      console.log(`✅ Web Search Providers: ${providers?.length || 0}`);
      if (providers?.length > 0) {
        providers.forEach(p => {
          console.log(`  - ${p.display_name} (${p.name}): ${p.is_enabled ? 'Enabled' : 'Disabled'}`);
        });
      }
    }
    
    // Check user API keys
    const { data: keys, error: keysError } = await supabase
      .from('user_web_search_keys')
      .select('*');
    
    if (keysError) {
      console.log('❌ Error fetching user keys:', keysError.message);
    } else {
      console.log(`\n✅ User API Keys: ${keys?.length || 0}`);
      if (keys?.length > 0) {
        keys.forEach(k => {
          console.log(`  - ${k.key_name}: ${k.key_status}`);
        });
      }
    }
    
    // Check agent permissions
    const { data: permissions, error: permissionsError } = await supabase
      .from('agent_web_search_permissions')
      .select('*');
    
    if (permissionsError) {
      console.log('❌ Error fetching agent permissions:', permissionsError.message);
    } else {
      console.log(`\n✅ Agent Permissions: ${permissions?.length || 0}`);
      if (permissions?.length > 0) {
        permissions.forEach(p => {
          console.log(`  - Agent ${p.agent_id}: Active=${p.is_active}, Permissions=${JSON.stringify(p.permissions)}`);
        });
      }
    }
    
    // Test the validate_web_search_permissions function if we have data
    if (permissions?.length > 0) {
      const testPermission = permissions[0];
      console.log(`\n🔍 Testing validate_web_search_permissions for agent: ${testPermission.agent_id}`);
      
      const { data: hasPermission, error: validateError } = await supabase
        .rpc('validate_web_search_permissions', {
          p_agent_id: testPermission.agent_id,
          p_user_id: testPermission.user_id
        });
      
      if (validateError) {
        console.log('❌ Error validating permissions:', validateError.message);
      } else {
        console.log(`✅ Permission validation result: ${hasPermission}`);
      }
    }
    
    console.log('\n=== DIAGNOSIS COMPLETE ===');
    
  } catch (error) {
    console.error('❌ Diagnostic error:', error);
  }
}

// Run the diagnostic
diagnoseWebSearch()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  }); 