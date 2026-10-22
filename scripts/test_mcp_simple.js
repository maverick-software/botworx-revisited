/**
 * Simple test script to check MCP tools discovery
 */

console.log('🔍 Testing MCP Tools Discovery...\n');

// Test using fetch instead of Supabase client
async function testMCPDiscovery() {
  const SUPABASE_URL = 'https://txhscptzjrrudnqwavcb.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4aHNjcHR6anJydWRucXdhdmNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ2MzI5NzYsImV4cCI6MjA1MDIwODk3Nn0.eTJhKxz5TdgGOJCIkJ6HjYLhKNJJGxGPGpZMJHQRGSU';

  try {
    // Step 1: Find Angela agent
    console.log('1. Finding Angela agent...');
    const agentsResponse = await fetch(`${SUPABASE_URL}/rest/v1/agents?name=ilike.*angela*&limit=5`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!agentsResponse.ok) {
      console.error('❌ Error fetching agents:', agentsResponse.status, agentsResponse.statusText);
      return;
    }

    const agents = await agentsResponse.json();
    console.log('📋 Found agents:', agents);

    if (!agents || agents.length === 0) {
      console.log('❌ No Angela agent found');
      return;
    }

    const angela = agents[0];
    console.log(`✅ Using agent: ${angela.name} (ID: ${angela.id})\n`);

    // Step 2: Check MCP connections
    console.log('2. Checking MCP connections...');
    const connectionsResponse = await fetch(`${SUPABASE_URL}/rest/v1/agent_mcp_connections?agent_id=eq.${angela.id}`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!connectionsResponse.ok) {
      console.error('❌ Error fetching MCP connections:', connectionsResponse.status, connectionsResponse.statusText);
      return;
    }

    const connections = await connectionsResponse.json();
    console.log('🔗 MCP connections:', connections);

    if (!connections || connections.length === 0) {
      console.log('❌ No MCP connections found for Angela');
      return;
    }

    // Step 3: Check cached tools
    console.log('\n3. Checking cached MCP tools...');
    const connectionIds = connections.map(c => c.id).join(',');
    const toolsResponse = await fetch(`${SUPABASE_URL}/rest/v1/mcp_tools_cache?connection_id=in.(${connectionIds})`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!toolsResponse.ok) {
      console.error('❌ Error fetching MCP tools:', toolsResponse.status, toolsResponse.statusText);
      return;
    }

    const tools = await toolsResponse.json();
    console.log(`📦 Found ${tools?.length || 0} cached MCP tools:`);
    if (tools && tools.length > 0) {
      tools.forEach(tool => {
        console.log(`  - ${tool.tool_name}: ${tool.tool_schema?.description || 'No description'}`);
      });
    }

    // Step 4: Test tools diagnostics endpoint
    console.log('\n4. Testing tools diagnostics endpoint...');
    const diagnosticsUrl = `${SUPABASE_URL}/functions/v1/chat/tools/diagnostics?agent_id=${angela.id}&user_id=${angela.user_id}`;
    console.log('Diagnostics URL:', diagnosticsUrl);
    
    const diagnosticsResponse = await fetch(diagnosticsUrl, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Diagnostics response status:', diagnosticsResponse.status);
    
    if (diagnosticsResponse.ok) {
      const diagnostics = await diagnosticsResponse.json();
      console.log('🔍 Diagnostics result:', JSON.stringify(diagnostics, null, 2));
    } else {
      const errorText = await diagnosticsResponse.text();
      console.error('❌ Diagnostics error:', errorText);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testMCPDiscovery();
