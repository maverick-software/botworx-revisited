#!/bin/bash
# Deploy the admin dashboard to the server

cd /opt/agentopia-voice-ws

# Update the main server file to include dashboard
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

// Track connections
wss.on('connection', async (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get('token');
  
  ws._connectedAt = Date.now();
  console.log('New WebSocket connection');
  
  if (!token) {
    ws.close(4000, 'Missing token');
    return;
  }

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    ws.close(4001, 'Unauthorized');
    return;
  }

  console.log(`User authenticated: ${user.id}`);
  
  ws.on('message', (data) => {
    console.log('Received message from client');
    ws.send(JSON.stringify({ type: 'echo', data: 'Server received your message' }));
  });
  
  ws.on('close', () => {
    console.log('Client disconnected');
  });
  
  ws.send(JSON.stringify({ type: 'welcome', message: 'Connected to WebSocket server' }));
});

// Admin Dashboard & Health Check Server
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme123';

function checkAuth(req) {
  const authHeader = req.headers.cookie;
  if (!authHeader) return false;
  const match = authHeader.match(/auth=([^;]+)/);
  if (!match) return false;
  const decoded = Buffer.from(match[1], 'base64').toString();
  const [username, password] = decoded.split(':');
  return username === ADMIN_USERNAME && password === ADMIN_PASSWORD;
}

function getStats() {
  const uptime = process.uptime();
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  return {
    status: 'Online',
    activeConnections: wss.clients.size,
    uptime: `${hours}h ${minutes}m`,
    memoryUsage: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
    timestamp: new Date().toISOString()
  };
}

const httpServer = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  
  // Health endpoint (public)
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(getStats()));
    return;
  }
  
  // Admin login page
  if (url.pathname === '/admin/login') {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        const params = new URLSearchParams(body);
        if (params.get('username') === ADMIN_USERNAME && params.get('password') === ADMIN_PASSWORD) {
          const token = Buffer.from(`${ADMIN_USERNAME}:${ADMIN_PASSWORD}`).toString('base64');
          res.writeHead(302, {
            'Set-Cookie': `auth=${token}; Path=/; HttpOnly; Max-Age=86400`,
            'Location': '/admin'
          });
          res.end();
        } else {
          res.writeHead(302, { 'Location': '/admin/login?error=1' });
          res.end();
        }
      });
      return;
    }
    
    const error = url.searchParams.get('error');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!DOCTYPE html>
<html><head><title>Admin Login</title><style>
body{font-family:sans-serif;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0}
.card{background:white;padding:40px;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.3);width:400px}
h1{margin:0 0 30px;color:#333;text-align:center}
.error{background:#fee;color:#c33;padding:10px;border-radius:6px;margin-bottom:20px;text-align:center}
input{width:100%;padding:12px;margin-bottom:15px;border:2px solid #e0e0e0;border-radius:6px;font-size:14px;box-sizing:border-box}
button{width:100%;padding:12px;background:#667eea;color:white;border:none;border-radius:6px;font-size:16px;cursor:pointer;font-weight:600}
button:hover{background:#5568d3}
</style></head><body>
<div class="card">
<h1>🎤 Voice Server Admin</h1>
${error ? '<div class="error">Invalid credentials</div>' : ''}
<form method="POST"><input type="text" name="username" placeholder="Username" required autofocus>
<input type="password" name="password" placeholder="Password" required>
<button type="submit">Login</button></form>
</div></body></html>`);
    return;
  }
  
  // Admin dashboard (protected)
  if (url.pathname === '/admin' || url.pathname === '/admin/') {
    if (!checkAuth(req)) {
      res.writeHead(302, { 'Location': '/admin/login' });
      res.end();
      return;
    }
    
    const stats = getStats();
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!DOCTYPE html>
<html><head><title>Admin Dashboard</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f7;padding:20px}
.header{background:white;padding:20px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.1);margin-bottom:20px;display:flex;justify-content:space-between;align-items:center}
.logout{padding:8px 16px;background:#dc3545;color:white;text-decoration:none;border-radius:6px;font-size:14px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:20px;margin-bottom:20px}
.card{background:white;padding:24px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.1)}
.label{color:#86868b;font-size:14px;margin-bottom:8px}
.value{color:#1d1d1f;font-size:32px;font-weight:600}
.green{color:#34c759}.blue{color:#007aff}.orange{color:#ff9500}
table{width:100%;border-collapse:collapse}
th{text-align:left;padding:12px;color:#86868b;font-size:12px;text-transform:uppercase;border-bottom:1px solid #e0e0e0}
td{padding:12px;color:#1d1d1f;border-bottom:1px solid #f5f5f7}
.status{display:inline-block;padding:4px 12px;border-radius:12px;font-size:12px;font-weight:500;background:#d1f4e0;color:#0a7336}
</style></head><body>
<div class="header"><h1>🎤 Voice Server Dashboard</h1><a href="/admin/logout" class="logout">Logout</a></div>
<div class="stats">
<div class="card"><div class="label">Status</div><div class="value green">${stats.status}</div></div>
<div class="card"><div class="label">Active Connections</div><div class="value blue" id="connections">${stats.activeConnections}</div></div>
<div class="card"><div class="label">Uptime</div><div class="value orange" id="uptime">${stats.uptime}</div></div>
<div class="card"><div class="label">Memory</div><div class="value" id="memory">${stats.memoryUsage}</div></div>
</div>
<div class="card"><h2 style="margin-bottom:20px">Active Connections</h2>
<table><thead><tr><th>Status</th><th>Count</th></tr></thead>
<tbody><tr><td><span class="status">● Online</span></td><td id="conn-count">${stats.activeConnections}</td></tr></tbody></table>
<p style="color:#86868b;font-size:12px;margin-top:10px">Auto-refreshes every 5 seconds</p></div>
<script>
setInterval(async()=>{
const r=await fetch('/health');
const d=await r.json();
document.getElementById('connections').textContent=d.activeConnections;
document.getElementById('uptime').textContent=d.uptime;
document.getElementById('memory').textContent=d.memoryUsage;
document.getElementById('conn-count').textContent=d.activeConnections;
},5000);
</script></body></html>`);
    return;
  }
  
  // Logout
  if (url.pathname === '/admin/logout') {
    res.writeHead(302, {
      'Set-Cookie': 'auth=; Path=/; HttpOnly; Max-Age=0',
      'Location': '/admin/login'
    });
    res.end();
    return;
  }
  
  res.writeHead(404);
  res.end('Not Found');
});

httpServer.listen(8081, () => {
  console.log('HTTP server (health + admin) listening on port 8081');
  console.log('Admin dashboard: https://voice.gofragents.com/admin');
  console.log(`Default login: ${ADMIN_USERNAME} / ${ADMIN_PASSWORD}`);
});
SERVERCODE

# Restart the server
pm2 restart voice-ws-server

# Wait a moment
sleep 2

# Test
echo ""
echo "✅ Dashboard deployed!"
echo ""
echo "Access at: https://voice.gofragents.com/admin"
echo "Default credentials: admin / changeme123"
echo ""
echo "IMPORTANT: Change the default password in .env file:"
echo "  ADMIN_USERNAME=yourusername"
echo "  ADMIN_PASSWORD=yourpassword"
echo ""

pm2 logs voice-ws-server --lines 10

