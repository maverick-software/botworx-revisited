#!/usr/bin/env node

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

console.log('Checking agent_integration_permissions table schema...\n');

async function checkSchema() {
  try {
    // Get table information
    const { data, error } = await supabase
      .from('agent_integration_permissions')
      .select('*')
      .limit(1);

    if (error) {
      console.error('Error:', error);
      return;
    }

    console.log('✅ Table exists!');
    
    if (data && data.length > 0) {
      console.log('\nColumn names in agent_integration_permissions:');
      Object.keys(data[0]).forEach(col => {
        console.log(`  - ${col}: ${typeof data[0][col]}`);
      });
    } else {
      console.log('\nNo data in table to check columns.');
      
      // Try to get column info directly
      const { data: columns, error: colError } = await supabase.rpc('get_table_columns', {
        table_name: 'agent_integration_permissions'
      }).catch(() => ({ data: null, error: 'RPC not available' }));
      
      if (columns) {
        console.log('\nColumns:', columns);
      }
    }
    
    // Check if we can query allowed_scopes
    console.log('\n\nChecking if allowed_scopes column exists...');
    const { data: allowedData, error: allowedError } = await supabase
      .from('agent_integration_permissions')
      .select('allowed_scopes')
      .limit(1);
      
    if (allowedError) {
      console.log('❌ allowed_scopes column NOT found:', allowedError.message);
    } else {
      console.log('✅ allowed_scopes column exists');
    }
    
    // Check if we can query granted_scopes
    console.log('\nChecking if granted_scopes column exists...');
    const { data: grantedData, error: grantedError } = await supabase
      .from('agent_integration_permissions')
      .select('granted_scopes')
      .limit(1);
      
    if (grantedError) {
      console.log('❌ granted_scopes column NOT found:', grantedError.message);
    } else {
      console.log('✅ granted_scopes column exists');
    }
    
  } catch (error) {
    console.error('Error checking schema:', error);
  }
}

checkSchema(); 