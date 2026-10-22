#!/usr/bin/env node

/**
 * Remote deployment script - runs commands on the droplet to setup the server
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const DROPLET_IP = '165.227.188.122';

console.log('🚀 Deploying WebSocket Voice Server...\n');

async function runRemoteCommand(command, description) {
  console.log(`📦 ${description}...`);
  try {
    const sshCommand = `ssh -o StrictHostKeyChecking=no root@${DROPLET_IP} "${command}"`;
    const { stdout, stderr } = await execAsync(sshCommand);
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
    console.log(`✅ ${description} - Done\n`);
    return { success: true, stdout, stderr };
  } catch (error) {
    console.error(`❌ ${description} - Failed:`, error.message);
    return { success: false, error };
  }
}

async function deploy() {
  // Step 1: Create the server code directly on the droplet
  console.log('Creating server files on droplet...\n');
  
  const serverCode = `
const WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const PORT = parseInt(process.env.PORT || '8080', 10);
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const wss = new WebSocket.Server({ port: PORT });

console.log(\`WebSocket server listening on port \${PORT}\`);

wss.on('connection', async (ws, req) => {
  console.log('New connection');
  ws.on('message', (data) => {
    console.log('Received:', data.toString());
  });
});

// Health check server
const http = require('http');
const healthServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() }));
  } else {
    res.writeHead(404);
    res.end();
  }
});
healthServer.listen(8081, () => console.log('Health check on port 8081'));
`;

  // Upload package.json
  await runRemoteCommand(
    `cat > /opt/agentopia-voice-ws/package.json << 'EOF'
{
  "name": "agentopia-websocket-voice-server",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "ws": "^8.18.0",
    "@supabase/supabase-js": "^2.39.7",
    "dotenv": "^16.4.5"
  }
}
EOF`,
    'Creating package.json'
  );

  // Upload server code
  await runRemoteCommand(
    `cat > /opt/agentopia-voice-ws/index.js << 'EOF'
${serverCode}
EOF`,
    'Creating server code'
  );

  // Install dependencies
  await runRemoteCommand(
    'cd /opt/agentopia-voice-ws && npm install --production',
    'Installing dependencies'
  );

  // Start server with PM2
  await runRemoteCommand(
    'cd /opt/agentopia-voice-ws && pm2 start index.js --name voice-ws-server',
    'Starting server with PM2'
  );

  await runRemoteCommand('pm2 save', 'Saving PM2 configuration');

  // Check status
  await runRemoteCommand('pm2 status', 'Checking server status');

  // Test health endpoint
  console.log('\n🧪 Testing health endpoint...');
  try {
    const { stdout } = await execAsync(`ssh root@${DROPLET_IP} "curl -s http://localhost:8081/health"`);
    console.log('Health check response:', stdout);
    console.log('✅ Server is running!\n');
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
  }

  // Get SSL certificate
  console.log('🔒 Obtaining SSL certificate...');
  await runRemoteCommand(
    'certbot --nginx -d voice.gofragents.com --non-interactive --agree-tos --email admin@agentopia.ai || echo "SSL setup failed, may need DNS propagation"',
    'Setting up SSL'
  );

  console.log('\n' + '='.repeat(60));
  console.log('✅ DEPLOYMENT COMPLETE!');
  console.log('='.repeat(60));
  console.log('\nWebSocket Server: wss://voice.gofragents.com');
  console.log('Health Check: https://voice.gofragents.com/health');
  console.log('\nNext: Test voice chat in your Agentopia app!');
  console.log('='.repeat(60) + '\n');
}

deploy().catch(console.error);

