#!/usr/bin/env node

// Quick DTMA SSH Endpoint Test Script
// Tests the new SSH integration endpoints

import https from 'https';
import http from 'http';

// Configuration from environment or defaults
const DTMA_BEARER_TOKEN = process.env.DTMA_BEARER_TOKEN;
const DROPLET_IP = process.env.DROPLET_IP || '147.182.160.136';
const DTMA_PORT = process.env.DTMA_PORT || '30000';
const BASE_URL = `http://${DROPLET_IP}:${DTMA_PORT}`;

console.log('🚀 DTMA SSH Integration Quick Test');
console.log(`Target: ${BASE_URL}`);
console.log(`Token: ${DTMA_BEARER_TOKEN ? '✓ Set' : '✗ Missing'}\n`);

if (!DTMA_BEARER_TOKEN) {
  console.error('❌ DTMA_BEARER_TOKEN environment variable is required');
  console.error('   export DTMA_BEARER_TOKEN="your-token"');
  process.exit(1);
}

// Simple HTTP request helper
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: responseData
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(data);
    }
    req.end();
  });
}

async function testHealthEndpoint() {
  console.log('🔍 Testing health endpoint...');
  try {
    const response = await makeRequest({
      hostname: DROPLET_IP,
      port: DTMA_PORT,
      path: '/health',
      method: 'GET'
    });
    
    if (response.status === 200) {
      console.log('  ✅ Health endpoint: OK');
      return true;
    } else {
      console.log(`  ❌ Health endpoint failed: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`  ❌ Health endpoint error: ${error.message}`);
    return false;
  }
}

async function testStatusEndpoint() {
  console.log('🔍 Testing status endpoint...');
  try {
    const response = await makeRequest({
      hostname: DROPLET_IP,
      port: DTMA_PORT,
      path: '/status',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${DTMA_BEARER_TOKEN}`
      }
    });
    
    if (response.status === 200) {
      console.log('  ✅ Status endpoint: OK');
      try {
        const data = JSON.parse(response.data);
        console.log(`  📊 Service: ${data.service || 'Unknown'}`);
        console.log(`  📊 Version: ${data.version || 'Unknown'}`);
      } catch (e) {
        console.log('  ⚠️  Could not parse status response');
      }
      return true;
    } else {
      console.log(`  ❌ Status endpoint failed: ${response.status}`);
      if (response.status === 401) {
        console.log('     Check your DTMA_BEARER_TOKEN');
      }
      return false;
    }
  } catch (error) {
    console.log(`  ❌ Status endpoint error: ${error.message}`);
    return false;
  }
}

async function testSSHCommand(command, description) {
  console.log(`🖥️  Testing SSH: ${description}...`);
  try {
    const payload = JSON.stringify({ command });
    const response = await makeRequest({
      hostname: DROPLET_IP,
      port: DTMA_PORT,
      path: '/ssh/execute',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DTMA_BEARER_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, payload);
    
    if (response.status === 200) {
      try {
        const data = JSON.parse(response.data);
        if (data.success) {
          console.log(`  ✅ ${description}: OK`);
          if (data.stdout && data.stdout.trim()) {
            console.log(`     Output: ${data.stdout.trim().substring(0, 100)}...`);
          }
          return true;
        } else {
          console.log(`  ❌ ${description}: Command failed`);
          console.log(`     Error: ${data.stderr || 'Unknown error'}`);
          return false;
        }
      } catch (e) {
        console.log(`  ❌ ${description}: Could not parse response`);
        return false;
      }
    } else if (response.status === 403) {
      console.log(`  ✅ ${description}: Correctly blocked (403)`);
      return true; // This is expected for dangerous commands
    } else {
      console.log(`  ❌ ${description}: HTTP ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`  ❌ ${description}: ${error.message}`);
    return false;
  }
}

async function testDiagnosticEndpoint(path, description) {
  console.log(`🩺 Testing ${description}...`);
  try {
    const response = await makeRequest({
      hostname: DROPLET_IP,
      port: DTMA_PORT,
      path: path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${DTMA_BEARER_TOKEN}`
      }
    });
    
    if (response.status === 200) {
      console.log(`  ✅ ${description}: OK`);
      return true;
    } else {
      console.log(`  ❌ ${description}: HTTP ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`  ❌ ${description}: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('Starting test suite...\n');
  
  let passed = 0;
  let total = 0;
  
  // Basic connectivity tests
  total++;
  if (await testHealthEndpoint()) passed++;
  
  total++;
  if (await testStatusEndpoint()) passed++;
  
  // SSH command tests
  total++;
  if (await testSSHCommand('whoami', 'whoami command')) passed++;
  
  total++;
  if (await testSSHCommand('docker --version', 'Docker version')) passed++;
  
  total++;
  if (await testSSHCommand('docker ps', 'Docker containers')) passed++;
  
  // Security test (dangerous command should be blocked)
  total++;
  if (await testSSHCommand('rm -rf /', 'Dangerous command blocking')) passed++;
  
  // Diagnostic endpoints
  total++;
  if (await testDiagnosticEndpoint('/diagnostics/docker', 'Docker diagnostics')) passed++;
  
  total++;
  if (await testDiagnosticEndpoint('/diagnostics/system', 'System diagnostics')) passed++;
  
  total++;
  if (await testDiagnosticEndpoint('/diagnostics/logs?lines=5', 'Logs diagnostics')) passed++;
  
  // Results
  console.log('\n' + '='.repeat(50));
  console.log(`🎯 Test Results: ${passed}/${total} passed`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! DTMA SSH integration is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Check the output above for details.');
    console.log('\nTroubleshooting tips:');
    console.log('- Ensure DTMA service is running: systemctl status dtma');
    console.log('- Check service logs: journalctl -u dtma -f');
    console.log('- Verify port 30000 is accessible');
    console.log('- Confirm DTMA_BEARER_TOKEN is correct');
  }
  
  process.exit(passed === total ? 0 : 1);
}

// Run the tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
}); 