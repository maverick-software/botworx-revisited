#!/bin/bash
# Quick deployment script to run on the droplet

cd /opt/agentopia-voice-ws

# Create a minimal working server
cat > index.js << 'SERVERCODE'
const WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');
const http = require('http');
require('dotenv').config();

const PORT = parseInt(process.env.PORT || '8080', 10);
const wss = new WebSocket.Server({ port: PORT, perMessageDeflate: false });

console.log(`WebSocket server listening on port ${PORT}`);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

wss.on('connection', async (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get('token');
  
  console.log('New WebSocket connection');
  
  if (!token) {
    ws.close(4000, 'Missing token');
    return;
  }

  // Verify token with Supabase
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    ws.close(4001, 'Unauthorized');
    return;
  }

  console.log(`User authenticated: ${user.id}`);
  
  ws.on('message', (data) => {
    console.log('Received message from client');
    // Echo back for now
    ws.send(JSON.stringify({ type: 'echo', data: 'Server received your message' }));
  });
  
  ws.on('close', () => {
    console.log('Client disconnected');
  });
  
  // Send welcome message
  ws.send(JSON.stringify({ type: 'welcome', message: 'Connected to WebSocket server' }));
});

// Health check server
const healthServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      activeConnections: wss.clients.size,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

healthServer.listen(8081, () => {
  console.log('Health check server listening on port 8081');
});
SERVERCODE

# Create package.json
cat > package.json << 'PKGJSON'
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
PKGJSON

# Install dependencies
echo "Installing dependencies..."
npm install --production

# Stop existing PM2 process if running
pm2 stop voice-ws-server 2>/dev/null || true
pm2 delete voice-ws-server 2>/dev/null || true

# Start server with PM2
echo "Starting server..."
pm2 start index.js --name voice-ws-server
pm2 save

# Show status
echo ""
echo "==================================="
echo "Server Status:"
pm2 status

echo ""
echo "Testing health endpoint..."
sleep 2
curl http://localhost:8081/health

echo ""
echo "==================================="
echo "Server deployed successfully!"
echo "==================================="

