#!/usr/bin/env node

/**
 * Test script to verify MCP tools discovery in chat function
 * This script will invoke the chat function and check if Zapier MCP tools are being discovered
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const SUPABASE_URL = 'https://txhscptzjrrudnqwavcb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4aHNjcHR6anJydWRucXdhdmNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ2MzI5NzYsImV4cCI6MjA1MDIwODk3Nn0.eTJhKxz5TdgGOJCIkJ6HjYLhKNJJGxGPGpZMJHQRGSU';

async function main() {
  console.log('🔍 Testing MCP Tools Discovery...\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  try {
    // Step 1: Find Angela's agent
    console.log('1. Finding Angela agent...');
    const { data: agents, error: agentsError } = await supabase
      .from('agents')
      .select('id, name, user_id')
      .ilike('name', '%angela%')
      .limit(5);

    if (agentsError) {
      console.error('❌ Error fetching agents:', agentsError);
      return;
    }

    console.log('📋 Found agents:', agents);
    
    if (!agents || agents.length === 0) {
      console.log('❌ No Angela agent found');
      return;
    }

    const angela = agents[0];
    console.log(`✅ Using agent: ${angela.name} (ID: ${angela.id})\n`);

    // Step 2: Check for MCP connections
    console.log('2. Checking MCP connections...');
    const { data: connections, error: connectionsError } = await supabase
      .from('agent_mcp_connections')
      .select('*')
      .eq('agent_id', angela.id);

    if (connectionsError) {
      console.error('❌ Error fetching MCP connections:', connectionsError);
      return;
    }

    console.log('🔗 MCP connections:', connections);

    if (!connections || connections.length === 0) {
      console.log('❌ No MCP connections found for Angela');
      return;
    }

    // Step 3: Check cached tools
    console.log('\n3. Checking cached MCP tools...');
    const { data: tools, error: toolsError } = await supabase
      .from('mcp_tools_cache')
      .select('*')
      .in('connection_id', connections.map(c => c.id));

    if (toolsError) {
      console.error('❌ Error fetching MCP tools:', toolsError);
      return;
    }

    console.log(`📦 Found ${tools?.length || 0} cached MCP tools:`);
    if (tools && tools.length > 0) {
      tools.forEach(tool => {
        console.log(`  - ${tool.tool_name}: ${tool.tool_schema?.description || 'No description'}`);
      });
    }

    // Step 4: Test the RPC function
    console.log('\n4. Testing get_agent_mcp_tools RPC...');
    const { data: rpcTools, error: rpcError } = await supabase
      .rpc('get_agent_mcp_tools', { p_agent_id: angela.id });

    if (rpcError) {
      console.error('❌ Error calling get_agent_mcp_tools RPC:', rpcError);
      return;
    }

    console.log(`🔧 RPC returned ${rpcTools?.length || 0} tools:`);
    if (rpcTools && rpcTools.length > 0) {
      rpcTools.forEach(tool => {
        console.log(`  - ${tool.tool_name} (${tool.connection_id})`);
        console.log(`    OpenAI Schema: ${tool.openai_schema?.name || 'Missing'}`);
      });
    }

    // Step 5: Test tools diagnostics endpoint
    console.log('\n5. Testing tools diagnostics endpoint...');
    try {
      const { data: diagnostics, error: diagError } = await supabase.functions.invoke('chat', {
        body: {
          path: '/tools/diagnostics',
          agent_id: angela.id,
          user_id: angela.user_id
        }
      });

      if (diagError) {
        console.error('❌ Error calling diagnostics:', diagError);
      } else {
        console.log('🔍 Diagnostics result:', JSON.stringify(diagnostics, null, 2));
      }
    } catch (error) {
      console.error('❌ Exception calling diagnostics:', error);
    }

    // Step 6: Test actual chat with tool awareness
    console.log('\n6. Testing chat with tool awareness...');
    try {
      const { data: chatResponse, error: chatError } = await supabase.functions.invoke('chat', {
        body: {
          message: {
            content: "What tools do you have access to? Can you create Google Documents?",
            role: 'user'
          },
          agent_id: angela.id,
          user_id: angela.user_id,
          conversation_id: 'test-' + Date.now()
        }
      });

      if (chatError) {
        console.error('❌ Error in chat:', chatError);
      } else {
        console.log('💬 Chat response:', JSON.stringify(chatResponse, null, 2));
      }
    } catch (error) {
      console.error('❌ Exception in chat:', error);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

main().catch(console.error);
