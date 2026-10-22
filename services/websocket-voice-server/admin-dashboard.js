/**
 * Admin Dashboard for WebSocket Voice Server
 * Accessible at: https://voice.gofragents.com/admin
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// Simple authentication - in production, use proper auth
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme123';

class AdminDashboard {
  constructor(wss, port = 3000) {
    this.wss = wss;
    this.port = port;
    this.startTime = Date.now();
    this.connectionHistory = [];
    this.maxHistoryLength = 100;
  }

  start() {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://${req.headers.host}`);
      
      // Handle authentication
      const auth = this.checkAuth(req);
      if (!auth.valid && url.pathname !== '/login') {
        this.sendLoginPage(res);
        return;
      }

      // Route requests
      if (url.pathname === '/') {
        this.sendDashboard(res, auth);
      } else if (url.pathname === '/api/stats') {
        this.sendStats(res);
      } else if (url.pathname === '/api/connections') {
        this.sendConnections(res);
      } else if (url.pathname === '/login') {
        this.handleLogin(req, res);
      } else if (url.pathname === '/logout') {
        this.handleLogout(res);
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    server.listen(this.port, () => {
      console.log(`Admin Dashboard running on http://localhost:${this.port}`);
      console.log(`Access at: https://voice.gofragents.com/admin`);
    });
  }

  checkAuth(req) {
    const authHeader = req.headers.cookie;
    if (!authHeader) return { valid: false };
    
    const match = authHeader.match(/auth=([^;]+)/);
    if (!match) return { valid: false };
    
    const decoded = Buffer.from(match[1], 'base64').toString();
    const [username, password] = decoded.split(':');
    
    return {
      valid: username === ADMIN_USERNAME && password === ADMIN_PASSWORD,
      username
    };
  }

  handleLogin(req, res) {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        const params = new URLSearchParams(body);
        const username = params.get('username');
        const password = params.get('password');
        
        if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
          const token = Buffer.from(`${username}:${password}`).toString('base64');
          res.writeHead(302, {
            'Set-Cookie': `auth=${token}; Path=/; HttpOnly; Max-Age=86400`,
            'Location': '/'
          });
          res.end();
        } else {
          this.sendLoginPage(res, 'Invalid credentials');
        }
      });
    } else {
      this.sendLoginPage(res);
    }
  }

  handleLogout(res) {
    res.writeHead(302, {
      'Set-Cookie': 'auth=; Path=/; HttpOnly; Max-Age=0',
      'Location': '/login'
    });
    res.end();
  }

  sendLoginPage(res, error = '') {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Admin Login - Voice Server</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    .login-card {
      background: white;
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      width: 100%;
      max-width: 400px;
    }
    h1 {
      margin-bottom: 30px;
      color: #333;
      text-align: center;
    }
    .error {
      background: #fee;
      color: #c33;
      padding: 10px;
      border-radius: 6px;
      margin-bottom: 20px;
      text-align: center;
    }
    input {
      width: 100%;
      padding: 12px;
      margin-bottom: 15px;
      border: 2px solid #e0e0e0;
      border-radius: 6px;
      font-size: 14px;
    }
    input:focus {
      outline: none;
      border-color: #667eea;
    }
    button {
      width: 100%;
      padding: 12px;
      background: #667eea;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 16px;
      cursor: pointer;
      font-weight: 600;
    }
    button:hover {
      background: #5568d3;
    }
  </style>
</head>
<body>
  <div class="login-card">
    <h1>🎤 Voice Server Admin</h1>
    ${error ? `<div class="error">${error}</div>` : ''}
    <form method="POST" action="/login">
      <input type="text" name="username" placeholder="Username" required autofocus>
      <input type="password" name="password" placeholder="Password" required>
      <button type="submit">Login</button>
    </form>
  </div>
</body>
</html>`;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  }

  sendDashboard(res, auth) {
    const stats = this.getStats();
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Admin Dashboard - Voice Server</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f5f5f7;
      padding: 20px;
    }
    .header {
      background: white;
      padding: 20px;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    h1 { color: #1d1d1f; }
    .logout-btn {
      padding: 8px 16px;
      background: #dc3545;
      color: white;
      text-decoration: none;
      border-radius: 6px;
      font-size: 14px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 20px;
    }
    .stat-card {
      background: white;
      padding: 24px;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .stat-label {
      color: #86868b;
      font-size: 14px;
      margin-bottom: 8px;
    }
    .stat-value {
      color: #1d1d1f;
      font-size: 32px;
      font-weight: 600;
    }
    .stat-value.green { color: #34c759; }
    .stat-value.blue { color: #007aff; }
    .stat-value.orange { color: #ff9500; }
    .table-card {
      background: white;
      padding: 24px;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th {
      text-align: left;
      padding: 12px;
      color: #86868b;
      font-size: 12px;
      text-transform: uppercase;
      border-bottom: 1px solid #e0e0e0;
    }
    td {
      padding: 12px;
      color: #1d1d1f;
      border-bottom: 1px solid #f5f5f7;
    }
    .status {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }
    .status.online { background: #d1f4e0; color: #0a7336; }
    .refresh-info {
      color: #86868b;
      font-size: 12px;
      margin-top: 10px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎤 Voice Server Dashboard</h1>
    <a href="/logout" class="logout-btn">Logout</a>
  </div>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-label">Status</div>
      <div class="stat-value green">${stats.status}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Active Connections</div>
      <div class="stat-value blue">${stats.activeConnections}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Uptime</div>
      <div class="stat-value orange">${stats.uptime}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Memory Usage</div>
      <div class="stat-value">${stats.memoryUsage}</div>
    </div>
  </div>

  <div class="table-card">
    <h2 style="margin-bottom: 20px;">Active Connections</h2>
    <table id="connections-table">
      <thead>
        <tr>
          <th>Status</th>
          <th>Connected At</th>
          <th>Duration</th>
        </tr>
      </thead>
      <tbody id="connections-body">
        <tr><td colspan="3" style="text-align: center; color: #86868b;">Loading...</td></tr>
      </tbody>
    </table>
    <div class="refresh-info">Auto-refreshes every 5 seconds</div>
  </div>

  <script>
    function formatDuration(ms) {
      const seconds = Math.floor(ms / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      if (hours > 0) return hours + 'h ' + (minutes % 60) + 'm';
      if (minutes > 0) return minutes + 'm ' + (seconds % 60) + 's';
      return seconds + 's';
    }

    async function updateStats() {
      try {
        const response = await fetch('/api/stats');
        const stats = await response.json();
        document.querySelector('.stat-value.blue').textContent = stats.activeConnections;
        document.querySelector('.stat-value.orange').textContent = stats.uptime;
      } catch (error) {
        console.error('Failed to update stats:', error);
      }
    }

    async function updateConnections() {
      try {
        const response = await fetch('/api/connections');
        const connections = await response.json();
        const tbody = document.getElementById('connections-body');
        
        if (connections.length === 0) {
          tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #86868b;">No active connections</td></tr>';
        } else {
          tbody.innerHTML = connections.map(conn => \`
            <tr>
              <td><span class="status online">●  Online</span></td>
              <td>\${new Date(conn.connectedAt).toLocaleString()}</td>
              <td>\${formatDuration(conn.duration)}</td>
            </tr>
          \`).join('');
        }
      } catch (error) {
        console.error('Failed to update connections:', error);
      }
    }

    // Initial load
    updateConnections();
    
    // Auto-refresh
    setInterval(() => {
      updateStats();
      updateConnections();
    }, 5000);
  </script>
</body>
</html>`;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  }

  sendStats(res) {
    const stats = this.getStats();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(stats));
  }

  sendConnections(res) {
    const connections = Array.from(this.wss.clients).map((client, index) => ({
      id: index,
      connectedAt: client._connectedAt || new Date(),
      duration: Date.now() - (client._connectedAt || Date.now())
    }));
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(connections));
  }

  getStats() {
    const uptime = Date.now() - this.startTime;
    const hours = Math.floor(uptime / 3600000);
    const minutes = Math.floor((uptime % 3600000) / 60000);
    
    return {
      status: 'Online',
      activeConnections: this.wss.clients.size,
      uptime: `${hours}h ${minutes}m`,
      memoryUsage: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`
    };
  }
}

module.exports = AdminDashboard;

