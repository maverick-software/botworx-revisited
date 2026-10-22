# DTMA SSH Integration and Command Execution Guide

## Overview

The DTMA (Droplet Tool Management Agent) service has been enhanced with comprehensive SSH command execution capabilities and diagnostic endpoints. This enables direct command execution on DigitalOcean droplets for MCP server management, system monitoring, and troubleshooting.

## New DTMA Endpoints

### SSH Command Execution

**Endpoint:** `POST /ssh/execute`
**Authentication:** Required (DTMA Bearer Token)
**Purpose:** Execute commands directly on the droplet

**Request Body:**
```json
{
  "command": "docker ps -a",
  "timeout": 30000
}
```

**Response:**
```json
{
  "success": true,
  "command": "docker ps -a",
  "stdout": "CONTAINER ID   IMAGE     COMMAND   CREATED   STATUS   PORTS   NAMES\n...",
  "stderr": "",
  "timestamp": "2025-01-20T10:30:00.000Z"
}
```

**Security Features:**
- Command safety validation to prevent dangerous operations
- Blocks patterns like `rm -rf /`, `shutdown`, `passwd root`, etc.
- Timeout protection (default 30 seconds)
- Authenticated access only

### MCP Server Management

**Endpoint:** `GET /mcp/status`
**Purpose:** Get status of all MCP servers using Docker labels

**Response:**
```json
{
  "success": true,
  "mcp_servers": "NAMES\t\t\tSTATUS\t\tPORTS\nreasoning-server\tUp 2 hours\t0.0.0.0:8080->8080/tcp",
  "timestamp": "2025-01-20T10:30:00.000Z"
}
```

### Diagnostic Endpoints

#### Docker Diagnostics
**Endpoint:** `GET /diagnostics/docker`
**Purpose:** Comprehensive Docker system information

**Response:**
```json
{
  "success": true,
  "diagnostics": {
    "docker_version": "Docker version 24.0.7, build afdd53b",
    "docker_info_success": true,
    "docker_info": {
      "ServerVersion": "24.0.7",
      "Containers": 5,
      "ContainersRunning": 3,
      "ContainersPaused": 0,
      "ContainersStopped": 2
    },
    "containers": "CONTAINER ID   IMAGE     COMMAND   CREATED   STATUS   PORTS   NAMES\n..."
  },
  "timestamp": "2025-01-20T10:30:00.000Z"
}
```

#### System Diagnostics
**Endpoint:** `GET /diagnostics/system`
**Purpose:** System health and resource monitoring

**Response:**
```json
{
  "success": true,
  "diagnostics": {
    "uptime": "up 2 days, 14:32, 1 user, load average: 0.15, 0.10, 0.08",
    "disk_usage": "Filesystem      Size  Used Avail Use% Mounted on\n/dev/vda1        25G  8.2G   16G  35% /",
    "memory_info": "               total        used        free      shared  buff/cache   available\nMem:           2.0Gi       1.2Gi       0.3Gi        45Mi       0.5Gi       0.6Gi",
    "top_processes": "USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND\n...",
    "dtma_port_status": "tcp6       0      0 :::30000             :::*                    LISTEN      1234/node",
    "environment": {
      "node_version": "v18.19.0",
      "platform": "linux",
      "arch": "x64",
      "pid": 1234
    }
  },
  "timestamp": "2025-01-20T10:30:00.000Z"
}
```

#### Logs Diagnostics
**Endpoint:** `GET /diagnostics/logs?lines=100`
**Purpose:** Retrieve service and container logs

**Response:**
```json
{
  "success": true,
  "logs": {
    "dtma_service": "Jan 20 10:30:00 droplet systemd[1]: Started DTMA service.\n...",
    "mcp_containers": "2025-01-20T10:30:00.000Z [INFO] MCP server started\n...",
    "application_logs": [
      "2025-01-20T10:30:00.000Z: DTMA diagnostics requested",
      "2025-01-20T10:30:00.000Z: Service version: 0.1.0",
      "2025-01-20T10:30:00.000Z: Service uptime: 7200 seconds"
    ]
  },
  "timestamp": "2025-01-20T10:30:00.000Z"
}
```

## Enhanced MCP Routes

The DTMA service now includes comprehensive MCP management routes:

- `POST /mcp/groups` - Deploy MCP server groups
- `DELETE /mcp/groups/:groupId` - Remove MCP server groups
- `GET /mcp/status` - Get all MCP groups and servers status
- `POST /mcp/servers/:instanceName/restart` - Restart specific MCP server

## Security Considerations

### Command Safety Validation

The SSH command execution includes built-in security validation that blocks dangerous patterns:

```typescript
const dangerousPatterns = [
  /rm\s+-rf\s+\//, // rm -rf /
  />\s*\/dev\/sd[a-z]/, // Write to disk devices
  /dd\s+.*of=\/dev/, // DD to devices
  /mkfs/, // Format filesystem
  /fdisk/, // Partition manipulation
  /shutdown|reboot|halt/, // System shutdown
  /passwd\s+root/, // Change root password
  /userdel|useradd.*-u\s*0/, // User manipulation with root
  /chmod.*777.*\//, // Dangerous permissions on root
  /\|\s*nc\s+.*-e/, // Netcat with execute
  /curl.*\|\s*sh/, // Pipe to shell
  /wget.*-O.*\|\s*sh/, // Download and execute
];
```

### Authentication

All new endpoints require DTMA Bearer Token authentication:
- `DTMA_BEARER_TOKEN` environment variable must be set
- Token validated via `authenticateDtmaRequest` middleware
- 401 Unauthorized returned for invalid/missing tokens

## Usage Examples

### Troubleshooting DTMA Service

1. **Check if DTMA is running:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://droplet-ip:30000/diagnostics/system
```

2. **Inspect Docker containers:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://droplet-ip:30000/diagnostics/docker
```

3. **View service logs:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://droplet-ip:30000/diagnostics/logs?lines=50"
```

### MCP Server Management

1. **Check MCP server status:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://droplet-ip:30000/mcp/status
```

2. **Execute Docker commands:**
```bash
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command": "docker logs reasoning-server --tail 20"}' \
  http://droplet-ip:30000/ssh/execute
```

3. **Restart MCP server:**
```bash
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  http://droplet-ip:30000/mcp/servers/reasoning-server/restart
```

## Integration with Frontend

The frontend DTMA console can now use these endpoints for:

1. **Real-time diagnostics** via the diagnostic endpoints
2. **Direct command execution** for troubleshooting
3. **MCP server management** without SSH key complexity
4. **Comprehensive logging** for debugging issues

## Deployment Notes

### Environment Variables Required

- `DTMA_BEARER_TOKEN` - Authentication token for API access
- `BACKEND_TO_DTMA_API_KEY` - API key for backend communication
- `AGENTOPIA_API_BASE_URL` - Base URL for Agentopia API

### Systemd Service

The DTMA service runs as a systemd service with:
- Automatic restart on failure
- Proper logging to journalctl
- Environment variable loading
- Graceful shutdown handling

### Docker Integration

DTMA now has full Docker integration:
- Container listing and management
- Log retrieval from containers
- MCP server lifecycle management
- Docker system diagnostics

## Troubleshooting Common Issues

### DTMA Service Not Responding

1. Check if service is running:
```bash
curl http://droplet-ip:30000/health
```

2. Check system diagnostics:
```bash
curl -H "Authorization: Bearer TOKEN" http://droplet-ip:30000/diagnostics/system
```

3. Review service logs:
```bash
curl -H "Authorization: Bearer TOKEN" http://droplet-ip:30000/diagnostics/logs
```

### MCP Servers Not Starting

1. Check Docker status:
```bash
curl -H "Authorization: Bearer TOKEN" http://droplet-ip:30000/diagnostics/docker
```

2. Review MCP server logs:
```bash
curl -X POST -H "Authorization: Bearer TOKEN" \
  -d '{"command": "docker logs mcp-server-name"}' \
  http://droplet-ip:30000/ssh/execute
```

### Authentication Issues

1. Verify DTMA_BEARER_TOKEN is set in environment
2. Check token format and validity
3. Ensure proper Authorization header format: `Bearer YOUR_TOKEN`

## Next Steps

1. **Frontend Integration** - Update DTMA console to use new endpoints
2. **Monitoring Integration** - Connect diagnostic endpoints to monitoring systems
3. **Automated Healing** - Use SSH execution for automatic problem resolution
4. **Enhanced Security** - Add role-based access control for different command types
5. **Logging Improvements** - Implement structured logging and log rotation

This enhancement provides the foundation for comprehensive droplet management and troubleshooting capabilities within the Agentopia ecosystem. 