#!/usr/bin/env node

/**
 * Check the schema of MCP tools in the database
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://txhscptzjrrudnqwavcb.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ Please set SUPABASE_SERVICE_ROLE_KEY environment variable');
  process.exit(1);
}

async function checkMCPToolSchema() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  console.log('🔍 Checking MCP Tool Schema for google_docs_create_document_from_text\n');

  try {
    // Find the tool in mcp_tools_cache
    const { data: tools, error } = await supabase
      .from('mcp_tools_cache')
      .select('*')
      .eq('tool_name', 'google_docs_create_document_from_text')
      .limit(1);

    if (error) {
      console.error('❌ Error fetching tool:', error);
      return;
    }

    if (!tools || tools.length === 0) {
      console.log('❌ Tool not found in cache');
      return;
    }

    const tool = tools[0];
    console.log('✅ Found tool in cache:\n');
    console.log('Tool ID:', tool.id);
    console.log('Connection ID:', tool.connection_id);
    console.log('Tool Name:', tool.tool_name);
    console.log('Last Updated:', tool.last_updated);
    
    console.log('\n📋 Original MCP Schema:');
    console.log(JSON.stringify(tool.tool_schema, null, 2));
    
    console.log('\n🔄 Converted OpenAI Schema:');
    console.log(JSON.stringify(tool.openai_schema, null, 2));

    // Check if the schema has all required fields
    const openaiSchema = tool.openai_schema;
    if (openaiSchema && openaiSchema.parameters) {
      console.log('\n📝 Parameter Analysis:');
      const params = openaiSchema.parameters;
      
      console.log('Properties defined:');
      if (params.properties) {
        Object.keys(params.properties).forEach(key => {
          const prop = params.properties[key];
          console.log(`  - ${key}: ${prop.type} ${prop.description ? `(${prop.description})` : ''}`);
        });
      }
      
      console.log('\nRequired fields:');
      if (params.required && params.required.length > 0) {
        params.required.forEach(field => {
          console.log(`  - ${field}`);
        });
      } else {
        console.log('  (No required fields specified)');
      }
    }

    // Check if we need to update the schema
    console.log('\n🔧 Schema Recommendations:');
    if (!openaiSchema.parameters.properties.text && !openaiSchema.parameters.properties.content) {
      console.log('⚠️  Missing text/content parameter - this is likely why Zapier is asking for the document content');
      console.log('    The tool should have a "text" or "content" parameter for the document body');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkMCPToolSchema();
