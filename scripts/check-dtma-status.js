// Check DTMA Status Script
// This script checks the status of a deployed DTMA agent on a droplet

import dotenv from 'dotenv';
import axios from 'axios';

// Load environment variables
dotenv.config();

// Get IP address from command line argument or environment variable
const dropletIp = process.argv[2] || process.env.DROPLET_IP;
const dtmaAuthToken = process.env.DTMA_AUTH_TOKEN;
const dtmaPort = process.env.PORT || 30000;

if (!dropletIp) {
  console.error('ERROR: Droplet IP address is required. Provide as command line argument or DROPLET_IP environment variable.');
  process.exit(1);
}

if (!dtmaAuthToken) {
  console.warn('WARNING: DTMA_AUTH_TOKEN not provided. Authenticated endpoints will not be accessible.');
}

// Base URL for DTMA API
const dtmaBaseUrl = `http://${dropletIp}:${dtmaPort}`;

async function checkDtmaHealth() {
  try {
    console.log(`Checking DTMA health at ${dtmaBaseUrl}/health...`);
    const response = await axios.get(`${dtmaBaseUrl}/health`, { timeout: 5000 });
    console.log('Health check response:', response.data);
    return true;
  } catch (error) {
    console.error('Health check failed:');
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    } else if (error.request) {
      console.error('No response received. DTMA might not be running or port might be blocked.');
    } else {
      console.error('Error:', error.message);
    }
    return false;
  }
}

async function listTools() {
  if (!dtmaAuthToken) {
    console.error('Cannot list tools: DTMA_AUTH_TOKEN not provided');
    return;
  }
  
  try {
    console.log(`Listing tools at ${dtmaBaseUrl}/tools...`);
    const response = await axios.get(`${dtmaBaseUrl}/tools`, {
      headers: {
        'Authorization': `Bearer ${dtmaAuthToken}`
      },
      timeout: 5000
    });
    
    console.log('Tools list:');
    if (response.data && Array.isArray(response.data)) {
      if (response.data.length === 0) {
        console.log('No tools deployed yet.');
      } else {
        response.data.forEach((tool, index) => {
          console.log(`Tool ${index + 1}:`);
          console.log(`  ID: ${tool.id}`);
          console.log(`  Name: ${tool.name}`);
          console.log(`  Status: ${tool.status}`);
          if (tool.ports && tool.ports.length > 0) {
            console.log('  Ports:');
            tool.ports.forEach(port => {
              console.log(`    ${port.private_port} -> ${port.public_port} (${port.type})`);
            });
          }
          console.log('---');
        });
      }
    } else {
      console.log('Unexpected response format:', response.data);
    }
  } catch (error) {
    console.error('Error listing tools:');
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    } else if (error.request) {
      console.error('No response received');
    } else {
      console.error('Error:', error.message);
    }
  }
}

async function getSystemStatus() {
  if (!dtmaAuthToken) {
    console.error('Cannot get system status: DTMA_AUTH_TOKEN not provided');
    return;
  }
  
  try {
    console.log(`Getting system status at ${dtmaBaseUrl}/status...`);
    const response = await axios.get(`${dtmaBaseUrl}/status`, {
      headers: {
        'Authorization': `Bearer ${dtmaAuthToken}`
      },
      timeout: 5000
    });
    
    console.log('System Status:');
    if (response.data) {
      const status = response.data;
      
      if (status.cpu_load_percent) {
        console.log(`CPU Load: ${status.cpu_load_percent.toFixed(2)}%`);
      }
      
      if (status.memory) {
        const totalMB = Math.round(status.memory.total_bytes / (1024 * 1024));
        const usedMB = Math.round(status.memory.used_bytes / (1024 * 1024));
        const freeMB = Math.round(status.memory.free_bytes / (1024 * 1024));
        console.log(`Memory: ${usedMB}MB used / ${totalMB}MB total (${freeMB}MB free)`);
      }
      
      if (status.disk) {
        const totalGB = Math.round(status.disk.total_bytes / (1024 * 1024 * 1024) * 10) / 10;
        const usedGB = Math.round(status.disk.used_bytes / (1024 * 1024 * 1024) * 10) / 10;
        const freeGB = Math.round(status.disk.free_bytes / (1024 * 1024 * 1024) * 10) / 10;
        console.log(`Disk (${status.disk.mount}): ${usedGB}GB used / ${totalGB}GB total (${freeGB}GB free)`);
      }
    } else {
      console.log('No status data returned');
    }
  } catch (error) {
    console.error('Error getting system status:');
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    } else if (error.request) {
      console.error('No response received');
    } else {
      console.error('Error:', error.message);
    }
  }
}

async function main() {
  console.log(`Checking DTMA status on droplet at ${dropletIp}:${dtmaPort}...`);
  
  const isHealthy = await checkDtmaHealth();
  
  if (isHealthy) {
    console.log('\nDTMA is healthy! Checking additional information...\n');
    
    // Get system status
    await getSystemStatus();
    
    console.log('\n');
    
    // List tools
    await listTools();
  } else {
    console.log('\nDTMA health check failed. Please verify:');
    console.log('1. The droplet is running');
    console.log('2. The DTMA service is active (systemctl status dtma)');
    console.log('3. Port 30000 is open and accessible');
    console.log('4. The IP address is correct');
  }
}

// Run the main function
main(); 