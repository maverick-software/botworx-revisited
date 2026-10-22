// Script to check DTMA status with Netlify vs. direct Supabase connection
// This helps diagnose configuration issues with the Agent Tool Infrastructure

import dotenv from 'dotenv';
import { createRequire } from 'module';
import axios from 'axios';
const require = createRequire(import.meta.url);
const fs = require('fs').promises;

// Load environment variables
dotenv.config();

// Get the agent ID from command line argument
const agentId = process.argv[2];

if (!agentId) {
  console.error('Please provide an agent ID as a command line argument');
  console.error('Usage: node scripts/check-netlify-dtma-status.js <agent-id>');
  process.exit(1);
}

async function checkDtmaStatus() {
  try {
    console.log(`Checking DTMA status for agent: ${agentId}`);
    
    // Read the droplet info JSON
    let dropletInfo = null;
    try {
      const content = await fs.readFile('./offline-droplet-info.json', 'utf8');
      dropletInfo = JSON.parse(content);
      console.log('\n=== Droplet Information ===');
      console.log(`Droplet ID: ${dropletInfo.droplet_id}`);
      console.log(`IP Address: ${dropletInfo.ip_address}`);
      console.log(`Status: ${dropletInfo.status || 'unknown'}`);
    } catch (err) {
      console.warn('Could not read droplet info file. You may need to provide IP manually.');
    }
    
    // If we don't have a droplet IP, ask the user
    if (!dropletInfo?.ip_address) {
      console.error('\nError: No IP address found in droplet info file');
      console.error('Please specify the droplet IP address manually:');
      console.error('node scripts/check-netlify-dtma-status.js <agent-id> <ip-address>');
      process.exit(1);
    }
    
    // Try to connect to the DTMA status endpoint
    const dtmaAuthToken = process.env.DTMA_AUTH_TOKEN;
    if (!dtmaAuthToken) {
      console.warn('\nWarning: DTMA_AUTH_TOKEN not found in .env file');
      console.warn('The connection test will continue but authentication will fail');
    }
    
    try {
      const statusUrl = `https://${dropletInfo.ip_address}:30000/status`;
      console.log(`\nConnecting to DTMA API: ${statusUrl}`);
      
      const response = await axios.get(statusUrl, {
        headers: dtmaAuthToken ? {
          'Authorization': `Bearer ${dtmaAuthToken}`
        } : {},
        httpsAgent: new (require('https')).Agent({
          rejectUnauthorized: false // For self-signed certificates in test
        }),
        timeout: 5000
      });
      
      console.log('\n=== DTMA Status ===');
      console.log(`Status code: ${response.status}`);
      console.log(`Agent ID: ${response.data.agent_id || 'Not configured'}`);
      console.log(`Version: ${response.data.version || 'unknown'}`);
      console.log(`Uptime: ${response.data.uptime || 'unknown'}`);
      
      // Check API configuration
      if (response.data.api_config) {
        console.log('\n=== API Configuration ===');
        console.log(`Base URL: ${response.data.api_config.base_url || 'Not configured'}`);
        
        // Verify if it's using direct Supabase URL
        const baseUrl = response.data.api_config.base_url || '';
        if (baseUrl.includes('supabase.co/functions/v1')) {
          console.log('✅ DTMA is configured to use Supabase Edge Functions directly');
        } else if (baseUrl.includes('netlify')) {
          console.log('⚠️ DTMA is configured to use Netlify, which adds an extra hop');
          console.log('   Consider changing to direct Supabase URL for better performance');
        } else {
          console.log('❓ Unknown API configuration');
        }
      }
      
      // Try a test heartbeat
      try {
        console.log('\n=== Testing Heartbeat ===');
        const heartbeatUrl = `https://${dropletInfo.ip_address}:30000/test-heartbeat`;
        
        const heartbeatResponse = await axios.get(heartbeatUrl, {
          headers: dtmaAuthToken ? {
            'Authorization': `Bearer ${dtmaAuthToken}`
          } : {},
          httpsAgent: new (require('https')).Agent({
            rejectUnauthorized: false
          }),
          timeout: 5000
        });
        
        console.log(`Status code: ${heartbeatResponse.status}`);
        if (heartbeatResponse.data.success) {
          console.log('✅ Heartbeat test successful');
          console.log(`Target: ${heartbeatResponse.data.target || 'unknown'}`);
        } else {
          console.log('❌ Heartbeat test failed');
          console.log(heartbeatResponse.data);
        }
      } catch (hbError) {
        console.error('❌ Error testing heartbeat:');
        if (hbError.response) {
          console.error(`Status: ${hbError.response.status}`);
          console.error(hbError.response.data);
        } else {
          console.error(hbError.message);
        }
      }
      
    } catch (apiError) {
      console.error('\n❌ Error connecting to DTMA API:');
      if (apiError.response) {
        console.error(`Status: ${apiError.response.status}`);
        console.error(apiError.response.data);
      } else if (apiError.code === 'ECONNREFUSED') {
        console.error('Connection refused. The DTMA service may not be running.');
        console.error('Try SSH into the droplet and check: sudo systemctl status dtma');
      } else {
        console.error(apiError.message);
      }
      
      console.log('\nTroubleshooting tips:');
      console.log('1. Verify the droplet is running');
      console.log('2. Check if the DTMA service is active: ssh ubuntu@<ip> "sudo systemctl status dtma"');
      console.log('3. Check DTMA logs: ssh ubuntu@<ip> "sudo journalctl -u dtma -n 50"');
      console.log('4. Check bootstrap logs: ssh ubuntu@<ip> "cat /var/log/dtma-bootstrap.log"');
    }
    
  } catch (error) {
    console.error('Error in status check script:', error);
  }
}

// Run the check
checkDtmaStatus(); 