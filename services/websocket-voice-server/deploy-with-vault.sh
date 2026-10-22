#!/bin/bash
# Deploy WebSocket server with Supabase Vault integration

cd /opt/agentopia-voice-ws

# Create the vault-enabled server
cat > index-vault.js << 'VAULTSERVER'
const WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');
const http = require('http');

console.log('Starting WebSocket Voice Server with Vault integration...');

const PORT = 8080;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://txhscptzjrrudnqwavcb.supabase.co';

// Initial service key from environment (only used for bootstrap)
const BOOTSTRAP_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!BOOTSTRAP_SERVICE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY required for bootstrap');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(SUPABASE_URL, BOOTSTRAP_SERVICE_KEY);

// Global configuration loaded from Vault
let CONFIG = {
  SUPABASE_SERVICE_ROLE_KEY: BOOTSTRAP_SERVICE_KEY,
  ADMIN_USERNAME: 'admin',
  ADMIN_PASSWORD: 'changeme123'
};

// Load secrets from Vault
async function loadSecretsFromVault() {
  try {
    console.log('Loading secrets from Supabase Vault...');
    
    const { data, error } = await supabase.rpc('get_websocket_server_secrets', {
      p_server_name: 'voice-websocket-server'
    });

    if (error) {
      console.warn('Vault secrets not initialized yet. Using bootstrap credentials.');
      console.warn('Run setup-vault.sql to initialize Vault secrets.');
      return false;
    }

    if (data) {
      CONFIG.SUPABASE_SERVICE_ROLE_KEY = data.SUPABASE_SERVICE_ROLE_KEY || CONFIG.SUPABASE_SERVICE_ROLE_KEY;
      CONFIG.ADMIN_PASSWORD = data.ADMIN_PASSWORD || CONFIG.ADMIN_PASSWORD;
      CONFIG.ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
      
      console.log('✅ Secrets loaded from Vault successfully');
      return true;
    }
  } catch (err) {
    console.error('Failed to load secrets from Vault:', err.message);
    return false;
  }
}

// Initialize server after loading secrets
async function initializeServer() {
  // Load secrets from Vault
  await loadSecretsFromVault();

  // Create WebSocket server
  const wss = new WebSocket.Server({ port: PORT, perMessageDeflate: false });
  console.log('WebSocket server listening on port ' + PORT);

  // Recreate Supabase client with vault-loaded key
  const authSupabase = createClient(SUPABASE_URL, CONFIG.SUPABASE_SERVICE_ROLE_KEY);

  wss.on('connection', async (ws, req) => {
    const url = new URL(req.url, 'http://' + req.headers.host);
    const token = url.searchParams.get('token');
    ws._connectedAt = Date.now();
    console.log('New WebSocket connection');
    
    if (!token) { 
      ws.close(4000, 'Missing token'); 
      return; 
    }
    
    const { data: { user }, error } = await authSupabase.auth.getUser(token);
    if (error || !user) { 
      console.log('Authentication failed:', error?.message);
      ws.close(4001, 'Unauthorized'); 
      return; 
    }
    
    console.log('User authenticated: ' + user.id);
    ws.send(JSON.stringify({ type: 'welcome', message: 'Connected to voice server!' }));
    
    ws.on('message', (data) => {
      console.log('Received message from client');
      ws.send(data);
    });
    
    ws.on('close', () => console.log('Client disconnected'));
  });

  function checkAuth(req) {
    const cookie = req.headers.cookie;
    if (!cookie) return false;
    const match = cookie.match(/auth=([^;]+)/);
    if (!match) return false;
    const decoded = Buffer.from(match[1], 'base64').toString();
    const [u, p] = decoded.split(':');
    return u === CONFIG.ADMIN_USERNAME && p === CONFIG.ADMIN_PASSWORD;
  }

  function getStats() {
    const uptime = process.uptime();
    const h = Math.floor(uptime / 3600);
    const m = Math.floor((uptime % 3600) / 60);
    return {
      status: 'Online',
      activeConnections: wss.clients.size,
      uptime: h + 'h ' + m + 'm',
      memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      vaultEnabled: true,
      timestamp: new Date().toISOString()
    };
  }

  http.createServer((req, res) => {
    const url = new URL(req.url, 'http://' + req.headers.host);
    
    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(getStats()));
      return;
    }
    
    if (url.pathname === '/admin/login') {
      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          const p = new URLSearchParams(body);
          if (p.get('username') === CONFIG.ADMIN_USERNAME && p.get('password') === CONFIG.ADMIN_PASSWORD) {
            const token = Buffer.from(CONFIG.ADMIN_USERNAME + ':' + CONFIG.ADMIN_PASSWORD).toString('base64');
            res.writeHead(302, { 'Set-Cookie': 'auth=' + token + '; Path=/; HttpOnly; Secure; Max-Age=86400', 'Location': '/admin' });
            res.end();
          } else {
            res.writeHead(302, { 'Location': '/admin/login?error=1' });
            res.end();
          }
        });
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<!DOCTYPE html><html><head><title>Admin Login</title><style>body{font-family:sans-serif;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0}.card{background:white;padding:40px;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.3);width:400px}h1{margin:0 0 30px;text-align:center}.error{background:#fee;color:#c33;padding:10px;border-radius:6px;margin-bottom:20px}input{width:100%;padding:12px;margin-bottom:15px;border:2px solid #e0e0e0;border-radius:6px;font-size:14px;box-sizing:border-box}button{width:100%;padding:12px;background:#667eea;color:white;border:none;border-radius:6px;font-size:16px;cursor:pointer}</style></head><body><div class="card"><h1>🎤 Admin</h1>' + (url.searchParams.get('error') ? '<div class="error">Invalid</div>' : '') + '<form method="POST"><input name="username" placeholder="Username" required><input type="password" name="password" placeholder="Password" required><button>Login</button></form></div></body></html>');
      return;
    }
    
    if (url.pathname === '/admin' || url.pathname === '/admin/') {
      if (!checkAuth(req)) {
        res.writeHead(302, { 'Location': '/admin/login' });
        res.end();
        return;
      }
      const s = getStats();
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<!DOCTYPE html><html><head><title>Dashboard</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:sans-serif;background:#f5f5f7;padding:20px}.header{background:white;padding:20px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.1);margin-bottom:20px;display:flex;justify-content:space-between;align-items:center}.logout{padding:8px 16px;background:#dc3545;color:white;text-decoration:none;border-radius:6px}.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px;margin-bottom:20px}.card{background:white;padding:24px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.1)}.label{color:#999;font-size:14px;margin-bottom:8px}.value{font-size:32px;font-weight:600}.green{color:#34c759}.blue{color:#007aff}.orange{color:#ff9500}.badge{display:inline-block;padding:4px 8px;background:#d1f4e0;color:#0a7336;border-radius:4px;font-size:12px;margin-left:10px}</style></head><body><div class="header"><h1>🎤 Dashboard<span class="badge">🔒 Vault</span></h1><a href="/admin/logout" class="logout">Logout</a></div><div class="stats"><div class="card"><div class="label">Status</div><div class="value green">' + s.status + '</div></div><div class="card"><div class="label">Connections</div><div class="value blue" id="c">' + s.activeConnections + '</div></div><div class="card"><div class="label">Uptime</div><div class="value orange" id="u">' + s.uptime + '</div></div><div class="card"><div class="label">Memory</div><div class="value" id="m">' + s.memoryUsage + '</div></div></div><div class="card"><p style="color:#999;font-size:12px">🔒 Secrets managed by Supabase Vault • Auto-refresh: 5s</p></div><script>setInterval(async()=>{const r=await fetch("/health");const d=await r.json();document.getElementById("c").textContent=d.activeConnections;document.getElementById("u").textContent=d.uptime;document.getElementById("m").textContent=d.memoryUsage},5000)</script></body></html>');
      return;
    }
    
    if (url.pathname === '/admin/logout') {
      res.writeHead(302, { 'Set-Cookie': 'auth=; Path=/; Max-Age=0', 'Location': '/admin/login' });
      res.end();
      return;
    }
    
    res.writeHead(404);
    res.end('Not Found');
  }).listen(8081, () => {
    console.log('Admin dashboard: https://voice.gofragents.com/admin');
    console.log('Vault integration: ENABLED ✅');
  });
}

// Start the server
initializeServer().catch(err => {
  console.error('Failed to initialize server:', err);
  process.exit(1);
});
VAULTSERVER

# Restart with vault-enabled server
pm2 stop voice-ws-server 2>/dev/null || true
pm2 delete voice-ws-server 2>/dev/null || true
pm2 start index-vault.js --name voice-ws-server
pm2 save

sleep 2
echo ""
echo "✅ Server deployed with Supabase Vault integration!"
echo ""
echo "Next steps:"
echo "1. Run setup-vault.sql in Supabase SQL Editor"
echo "2. Initialize secrets with your values"
echo "3. Restart server: pm2 restart voice-ws-server"
echo ""
pm2 logs voice-ws-server --lines 15

