const WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');
const http = require('http');
const fs = require('fs');
const path = require('path');

console.log('Starting WebSocket Voice Server with OpenAI Realtime API Proxy...');

const PORT = 8080;
const ADMIN_PORT = 8081;
const SUPABASE_URL = 'https://txhscptzjrrudnqwavcb.supabase.co';
const SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '');

const BASE_DIR = '/opt/agentopia-voice-ws';

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

// Basic auth check
function checkAuth(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Basic ')) {
    return false;
  }
  const credentials = Buffer.from(auth.split(' ')[1], 'base64').toString();
  const [username, password] = credentials.split(':');
  return username === 'admin' && password === CONFIG.ADMIN_PASSWORD;
}

// Parse request body
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
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

  // Admin HTTP server
  const adminServer = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }
    
    // Health check (no auth required)
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
    
    // All other endpoints require auth
    if (!checkAuth(req)) {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Admin Access"' });
      res.end('Unauthorized');
      return;
    }
    
    // File API endpoints
    if (req.url.startsWith('/api/files')) {
      const urlPath = req.url.replace('/api/files', '');
      
      // List files
      if (req.method === 'GET' && urlPath === '') {
        try {
          const files = fs.readdirSync(BASE_DIR).map(name => {
            const fullPath = path.join(BASE_DIR, name);
            const stats = fs.statSync(fullPath);
            return {
              name,
              isDirectory: stats.isDirectory(),
              size: stats.size,
              modified: stats.mtime
            };
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ files }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }
      
      // Read file
      if (req.method === 'GET' && urlPath) {
        const filePath = path.join(BASE_DIR, urlPath.substring(1));
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ content }));
        } catch (err) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'File not found' }));
        }
        return;
      }
      
      // Create/Update file
      if (req.method === 'POST') {
        const body = await parseBody(req);
        const filePath = path.join(BASE_DIR, body.filename);
        try {
          fs.writeFileSync(filePath, body.content, 'utf8');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'File saved' }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }
      
      // Delete file
      if (req.method === 'DELETE' && urlPath) {
        const filePath = path.join(BASE_DIR, urlPath.substring(1));
        try {
          fs.unlinkSync(filePath);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'File deleted' }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }
    }
    
    // Restart server endpoint
    if (req.url === '/api/restart' && req.method === 'POST') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Restarting server...' }));
      setTimeout(() => process.exit(0), 1000); // PM2 will restart
      return;
    }
    
    // Dashboard HTML
    if (req.url === '/' || req.url === '/admin') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
<!DOCTYPE html>
<html>
<head>
  <title>Agentopia Voice WebSocket Server</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; }
    .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
    h1 { color: #333; margin-bottom: 20px; }
    .tabs { display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 2px solid #ddd; }
    .tab { padding: 10px 20px; cursor: pointer; background: #fff; border: none; border-bottom: 3px solid transparent; }
    .tab.active { border-bottom-color: #0066cc; color: #0066cc; font-weight: bold; }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    .card { background: white; padding: 20px; margin-bottom: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .status { display: flex; gap: 20px; flex-wrap: wrap; }
    .metric { flex: 1; min-width: 200px; padding: 15px; background: #f0f7ff; border-left: 4px solid #0066cc; border-radius: 4px; }
    .metric-value { font-size: 2em; font-weight: bold; color: #0066cc; }
    .metric-label { color: #666; margin-top: 5px; }
    .healthy { color: #00aa00; }
    button { background: #0066cc; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-size: 14px; }
    button:hover { background: #0052a3; }
    button.danger { background: #cc0000; }
    button.danger:hover { background: #a30000; }
    .file-list { list-style: none; }
    .file-item { padding: 12px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
    .file-item:hover { background: #f9f9f9; }
    .file-name { font-weight: bold; cursor: pointer; color: #0066cc; }
    .file-name:hover { text-decoration: underline; }
    .file-actions { display: flex; gap: 10px; }
    .file-actions button { padding: 6px 12px; font-size: 12px; }
    .editor { width: 100%; height: 500px; font-family: 'Courier New', monospace; font-size: 14px; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
    .editor-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 2px solid #ddd; }
    .editor-header h3 { color: #333; }
    .btn-group { display: flex; gap: 10px; }
    .hidden { display: none; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎙️ Agentopia Voice WebSocket Server</h1>
    
    <div class="tabs">
      <button class="tab active" onclick="switchTab('status')">Server Status</button>
      <button class="tab" onclick="switchTab('files')">File Manager</button>
    </div>
    
    <!-- Status Tab -->
    <div id="status" class="tab-content active">
      <div class="card">
        <h2>Server Status</h2>
        <div class="status">
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
        <div class="btn-group">
          <button onclick="refreshStatus()">🔄 Refresh Status</button>
          <button onclick="window.open('/health', '_blank')">📊 Raw Health Data</button>
          <button class="danger" onclick="restartServer()">🔄 Restart Server</button>
        </div>
      </div>
    </div>
    
    <!-- File Manager Tab -->
    <div id="files" class="tab-content">
      <div class="card">
        <div class="editor-header">
          <h2>Files in /opt/agentopia-voice-ws</h2>
          <button onclick="createNewFile()">➕ New File</button>
        </div>
        <ul id="fileList" class="file-list">
          <li>Loading files...</li>
        </ul>
      </div>
      
      <div id="editorCard" class="card hidden">
        <div class="editor-header">
          <h3 id="editorTitle">Edit File</h3>
          <div class="btn-group">
            <button onclick="saveFile()">💾 Save</button>
            <button onclick="closeEditor()">✖ Close</button>
          </div>
        </div>
        <textarea id="editor" class="editor"></textarea>
      </div>
    </div>
  </div>
  
  <script>
    let currentFile = null;
    
    // Tab switching
    function switchTab(tabName) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      event.target.classList.add('active');
      document.getElementById(tabName).classList.add('active');
      
      if (tabName === 'files') {
        loadFileList();
      }
    }
    
    // Status functions
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
    
    async function restartServer() {
      if (!confirm('Are you sure you want to restart the server?')) return;
      
      try {
        await fetch('/api/restart', { method: 'POST' });
        alert('Server is restarting... Refresh this page in 5 seconds.');
      } catch (err) {
        console.error('Restart failed:', err);
      }
    }
    
    // File manager functions
    async function loadFileList() {
      try {
        const res = await fetch('/api/files');
        const data = await res.json();
        
        const list = document.getElementById('fileList');
        list.innerHTML = '';
        
        data.files.forEach(file => {
          if (file.isDirectory) return; // Skip directories for now
          
          const li = document.createElement('li');
          li.className = 'file-item';
          li.innerHTML = \`
            <span class="file-name" onclick="openFile('\${file.name}')">\${file.name}</span>
            <div class="file-actions">
              <button onclick="openFile('\${file.name}')">✏️ Edit</button>
              <button class="danger" onclick="deleteFile('\${file.name}')">🗑️ Delete</button>
            </div>
          \`;
          list.appendChild(li);
        });
      } catch (err) {
        console.error('Failed to load files:', err);
        document.getElementById('fileList').innerHTML = '<li>Error loading files</li>';
      }
    }
    
    async function openFile(filename) {
      try {
        const res = await fetch('/api/files/' + filename);
        const data = await res.json();
        
        currentFile = filename;
        document.getElementById('editorTitle').textContent = 'Editing: ' + filename;
        document.getElementById('editor').value = data.content;
        document.getElementById('editorCard').classList.remove('hidden');
      } catch (err) {
        alert('Failed to load file: ' + err.message);
      }
    }
    
    async function saveFile() {
      if (!currentFile) return;
      
      const content = document.getElementById('editor').value;
      
      try {
        const res = await fetch('/api/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: currentFile, content })
        });
        
        const data = await res.json();
        
        if (data.success) {
          alert('File saved successfully!');
          loadFileList();
        } else {
          alert('Failed to save: ' + data.error);
        }
      } catch (err) {
        alert('Failed to save file: ' + err.message);
      }
    }
    
    async function deleteFile(filename) {
      if (!confirm('Are you sure you want to delete ' + filename + '?')) return;
      
      try {
        const res = await fetch('/api/files/' + filename, { method: 'DELETE' });
        const data = await res.json();
        
        if (data.success) {
          alert('File deleted successfully!');
          loadFileList();
          if (currentFile === filename) {
            closeEditor();
          }
        } else {
          alert('Failed to delete: ' + data.error);
        }
      } catch (err) {
        alert('Failed to delete file: ' + err.message);
      }
    }
    
    function createNewFile() {
      const filename = prompt('Enter filename:');
      if (!filename) return;
      
      currentFile = filename;
      document.getElementById('editorTitle').textContent = 'Creating: ' + filename;
      document.getElementById('editor').value = '';
      document.getElementById('editorCard').classList.remove('hidden');
    }
    
    function closeEditor() {
      currentFile = null;
      document.getElementById('editorCard').classList.add('hidden');
    }
    
    // Auto-refresh status every 5 seconds
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
    console.log('   Default login - Username: admin, Password:', CONFIG.ADMIN_PASSWORD);
  });
  
  console.log('✅ Server initialization complete');
}

// Start server
initializeServer().catch(err => {
  console.error('💥 Failed to start server:', err);
  process.exit(1);
});

