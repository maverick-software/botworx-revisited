const WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');
const http = require('http');

console.log('Starting WebSocket Voice Server with OpenAI Realtime API Proxy...');

const PORT = 8080;
const ADMIN_PORT = 8081;
const SUPABASE_URL = 'https://txhscptzjrrudnqwavcb.supabase.co';
const SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '');

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: { headers: { apikey: SERVICE_ROLE_KEY } }
});

let CONFIG = {
  ADMIN_PASSWORD: 'SecureAdminPass2025!',
  OPENAI_API_KEY: null
};

// Load secrets from Supabase Vault
async function loadSecretsFromVault() {
  try {
    const { data, error } = await supabase.rpc('get_websocket_server_secrets', { 
      p_server_name: 'voice-websocket-server' 
    });
    
    if (error) {
      console.error('❌ Vault load error:', error.message);
      return false;
    }
    
    if (data) {
      CONFIG.ADMIN_PASSWORD = data.ADMIN_PASSWORD;
      CONFIG.OPENAI_API_KEY = data.OPENAI_API_KEY;
      console.log('✅ Secrets loaded from Vault successfully');
      console.log('   - Admin password loaded:', !!CONFIG.ADMIN_PASSWORD);
      console.log('   - OpenAI API key loaded:', !!CONFIG.OPENAI_API_KEY);
      return true;
    }
    
    console.warn('⚠️ No data returned from vault');
    return false;
  } catch (err) {
    console.error('💥 Vault load exception:', err.message);
    return false;
  }
}

// Initialize server
async function initializeServer() {
  console.log('🔐 Loading secrets from Supabase Vault...');
  const vaultLoaded = await loadSecretsFromVault();
  
  if (!vaultLoaded || !CONFIG.OPENAI_API_KEY) {
    console.error('❌ Failed to load OpenAI API key from Vault - cannot start server');
    process.exit(1);
  }
  
  // Create WebSocket server
  const wss = new WebSocket.Server({ 
    port: PORT,
    clientTracking: true,
    perMessageDeflate: false
  });
  
  console.log('🎙️ WebSocket server listening on port', PORT);

  // Keepalive ping every 30 seconds
  setInterval(() => {
    wss.clients.forEach(ws => {
      if (ws.isAlive === false) {
        console.log('⚠️ Terminating inactive client connection');
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('connection', async (ws, req) => {
    const url = new URL(req.url, 'http://' + req.headers.host);
    const token = url.searchParams.get('token');
    const agentId = url.searchParams.get('agent_id');
    const voice = url.searchParams.get('voice') || 'alloy';
    const conversationId = url.searchParams.get('conversation_id');
    
    ws.isAlive = true;
    console.log('🔌 New client connection - Agent:', agentId, 'Voice:', voice);
    
    // Authenticate user
    if (!token) { 
      console.log('❌ No token provided');
      ws.close(4000, 'Missing token'); 
      return; 
    }
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) { 
      console.log('❌ Auth failed:', authError?.message); 
      ws.close(4001, 'Unauthorized'); 
      return; 
    }
    
    console.log('✅ User authenticated:', user.id);
    
    // Connect to OpenAI Realtime API
    const openaiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01', {
      headers: {
        'Authorization': 'Bearer ' + CONFIG.OPENAI_API_KEY,
        'OpenAI-Beta': 'realtime=v1'
      }
    });
    
    console.log('🔗 Connecting to OpenAI Realtime API...');
    
    // OpenAI connection opened
    openaiWs.on('open', () => {
      console.log('✅ Connected to OpenAI Realtime API');
      
      // Send session configuration
      openaiWs.send(JSON.stringify({
        type: 'session.update',
        session: {
          modalities: ['text', 'audio'],
          instructions: 'You are a helpful assistant.',
          voice: voice,
          input_audio_format: 'pcm16',
          output_audio_format: 'pcm16',
          input_audio_transcription: {
            model: 'whisper-1'
          },
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 200
          }
        }
      }));
      
      console.log('📤 Sent session configuration to OpenAI');
    });
    
    // OpenAI message received - forward to client
    openaiWs.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('📥 OpenAI → Client:', message.type);
        
        // Forward to client
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      } catch (err) {
        console.error('💥 Error forwarding OpenAI message:', err.message);
      }
    });
    
    // OpenAI error
    openaiWs.on('error', (err) => {
      console.error('💥 OpenAI WebSocket error:', err.message);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'error',
          error: { message: 'OpenAI connection error' }
        }));
      }
    });
    
    // OpenAI closed
    openaiWs.on('close', (code, reason) => {
      console.log('❌ OpenAI connection closed:', code, reason.toString());
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1011, 'OpenAI connection closed');
      }
    });
    
    // Client message received - forward to OpenAI
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('📥 Client → OpenAI:', message.type);
        
        // Forward to OpenAI
        if (openaiWs.readyState === WebSocket.OPEN) {
          openaiWs.send(data);
        }
      } catch (err) {
        console.log('📥 Binary data from client:', data.length, 'bytes');
        // Forward binary data to OpenAI
        if (openaiWs.readyState === WebSocket.OPEN) {
          openaiWs.send(data);
        }
      }
    });
    
    // Client pong
    ws.on('pong', () => {
      ws.isAlive = true;
    });
    
    // Client closed
    ws.on('close', (code, reason) => {
      console.log('❌ Client disconnected:', user.id, 'Code:', code, 'Reason:', reason.toString());
      if (openaiWs.readyState === WebSocket.OPEN) {
        openaiWs.close();
      }
    });
    
    // Client error
    ws.on('error', (err) => {
      console.error('💥 Client WebSocket error:', err.message, err.code);
    });
  });

  // Admin dashboard on port 8081
  const adminServer = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }
    
    // Health check
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        uptime: process.uptime(),
        connections: wss.clients.size,
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
      }));
      return;
    }
    
    // Admin dashboard
    if (req.url === '/' || req.url === '/admin') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
<!DOCTYPE html>
<html>
<head>
  <title>Agentopia Voice WebSocket Server</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 1200px; margin: 50px auto; padding: 20px; background: #f5f5f5; }
    .card { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h1 { color: #333; }
    .status { display: flex; gap: 20px; flex-wrap: wrap; }
    .metric { flex: 1; min-width: 200px; padding: 15px; background: #f0f7ff; border-left: 4px solid #0066cc; }
    .metric-value { font-size: 2em; font-weight: bold; color: #0066cc; }
    .metric-label { color: #666; margin-top: 5px; }
    .healthy { color: #00aa00; }
    button { background: #0066cc; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; }
    button:hover { background: #0052a3; }
  </style>
</head>
<body>
  <h1>🎙️ Agentopia Voice WebSocket Server</h1>
  
  <div class="card">
    <h2>Server Status</h2>
    <div id="status" class="status">
      <div class="metric">
        <div class="metric-value" id="health">Loading...</div>
        <div class="metric-label">Health Status</div>
      </div>
      <div class="metric">
        <div class="metric-value" id="connections">-</div>
        <div class="metric-label">Active Connections</div>
      </div>
      <div class="metric">
        <div class="metric-value" id="uptime">-</div>
        <div class="metric-label">Uptime (hours)</div>
      </div>
      <div class="metric">
        <div class="metric-value" id="memory">-</div>
        <div class="metric-label">Memory (MB)</div>
      </div>
    </div>
  </div>
  
  <div class="card">
    <h2>Actions</h2>
    <button onclick="refreshStatus()">🔄 Refresh Status</button>
    <button onclick="window.open('/health', '_blank')">📊 View Raw Health Data</button>
  </div>
  
  <script>
    async function refreshStatus() {
      try {
        const res = await fetch('/health');
        const data = await res.json();
        
        document.getElementById('health').innerHTML = '<span class="healthy">✅ HEALTHY</span>';
        document.getElementById('connections').textContent = data.connections;
        document.getElementById('uptime').textContent = (data.uptime / 3600).toFixed(2);
        document.getElementById('memory').textContent = (data.memory.heapUsed / 1024 / 1024).toFixed(2);
      } catch (err) {
        document.getElementById('health').innerHTML = '<span style="color: red;">❌ ERROR</span>';
        console.error('Failed to fetch status:', err);
      }
    }
    
    // Auto-refresh every 5 seconds
    setInterval(refreshStatus, 5000);
    refreshStatus();
  </script>
</body>
</html>
      `);
      return;
    }
    
    res.writeHead(404);
    res.end('Not Found');
  });
  
  adminServer.listen(ADMIN_PORT, () => {
    console.log('📊 Admin dashboard listening on port', ADMIN_PORT);
    console.log('   Visit http://voice.gofragents.com:8081 for dashboard');
  });
  
  console.log('✅ Server initialization complete');
}

// Start server
initializeServer().catch(err => {
  console.error('💥 Failed to start server:', err);
  process.exit(1);
});

