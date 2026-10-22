#!/usr/bin/env node

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

console.log('Gmail Operation Logs Viewer\n');

async function viewGmailLogs(agentId, limit = 10) {
  try {
    // Get operation logs
    const { data: logs, error } = await supabase
      .from('gmail_operation_logs')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching logs:', error);
      return;
    }

    if (!logs || logs.length === 0) {
      console.log('No Gmail operation logs found for this agent.');
      return;
    }

    console.log(`Found ${logs.length} Gmail operation logs:\n`);

    logs.forEach((log, index) => {
      console.log(`=== Log Entry ${index + 1} ===`);
      console.log(`Timestamp: ${new Date(log.created_at).toLocaleString()}`);
      console.log(`Operation: ${log.operation_type}`);
      console.log(`Status: ${log.status}`);
      console.log(`Execution Time: ${log.execution_time_ms}ms`);
      
      if (log.operation_params) {
        console.log('\nParameters:');
        console.log(JSON.stringify(log.operation_params, null, 2));
      }
      
      if (log.operation_result) {
        console.log('\nResult:');
        console.log(JSON.stringify(log.operation_result, null, 2));
      }
      
      if (log.error_message) {
        console.log('\n❌ ERROR:');
        console.log(log.error_message);
      }
      
      console.log('\n' + '-'.repeat(60) + '\n');
    });

    // Also check tool_execution_logs table
    console.log('\nChecking tool_execution_logs table...\n');
    
    const { data: toolLogs, error: toolError } = await supabase
      .from('tool_execution_logs')
      .select('*')
      .eq('agent_id', agentId)
      .eq('tool_provider', 'gmail')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!toolError && toolLogs && toolLogs.length > 0) {
      console.log(`Found ${toolLogs.length} tool execution logs:\n`);
      
      toolLogs.forEach((log, index) => {
        console.log(`=== Tool Log ${index + 1} ===`);
        console.log(`Timestamp: ${new Date(log.created_at).toLocaleString()}`);
        console.log(`Tool: ${log.tool_name}`);
        console.log(`Success: ${log.success}`);
        console.log(`Execution Time: ${log.execution_time_ms}ms`);
        
        if (log.parameters) {
          console.log('\nParameters:');
          console.log(JSON.stringify(log.parameters, null, 2));
        }
        
        if (log.result_data) {
          console.log('\nResult:');
          console.log(JSON.stringify(log.result_data, null, 2));
        }
        
        if (log.error_message) {
          console.log('\n❌ ERROR:');
          console.log(log.error_message);
        }
        
        console.log('\n' + '-'.repeat(60) + '\n');
      });
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

// Get agent ID from command line or use the one from previous tests
const agentId = process.argv[2] || '4850a064-3005-41a8-adf2-90053c877b2d';
const limit = parseInt(process.argv[3]) || 10;

console.log(`Viewing Gmail logs for agent: ${agentId}`);
console.log(`Limit: ${limit} entries\n`);

viewGmailLogs(agentId, limit); 