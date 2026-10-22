# Agentopia WebSocket Voice Server

Production-grade WebSocket server for real-time voice chat using OpenAI's Realtime API.

## Features

- **Real-time voice chat** with OpenAI `gpt-4o-realtime-preview-2024-10-01`
- **JWT authentication** via Supabase
- **Automatic transcript storage** to database
- **Low latency** (~500-800ms end-to-end)
- **Scalable** (1000+ concurrent connections)
- **Secure** (OpenAI API key from Supabase Vault)

## Architecture

```
Browser → WebSocket → DigitalOcean Server → OpenAI Realtime API
                    ↓
                 Supabase (Auth + Database)
```

## Requirements

- Node.js 20.x or higher
- Supabase account with service role key
- OpenAI API key (stored in Supabase Vault)

## Installation

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env with your configuration
nano .env
```

## Configuration

Edit `.env`:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
PORT=8080
NODE_ENV=production
LOG_LEVEL=info
MAX_CONNECTIONS=1000
CONNECTION_TIMEOUT=1800000
```

## Development

```bash
# Run in development mode (with auto-reload)
npm run watch

# Or run once
npm run dev
```

## Production Build

```bash
# Build TypeScript
npm run build

# Start production server
npm start
```

## Production Deployment (with PM2)

```bash
# Build
npm run build

# Start with PM2
pm2 start dist/index.js --name voice-ws-server

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

## Health Check

```bash
# Check server health
curl http://localhost:8081/health
```

Response:
```json
{
  "status": "healthy",
  "activeConnections": 42,
  "maxConnections": 1000,
  "uptime": 86400,
  "timestamp": "2025-10-24T..."
}
```

## WebSocket Connection

**URL Format:**
```
wss://voice.agentopia.ai?token=<jwt>&agent_id=<id>&conversation_id=<id>&voice=<voice>
```

**Parameters:**
- `token` (required): Supabase JWT token
- `agent_id` (required): Agent UUID
- `conversation_id` (optional): Existing conversation session ID
- `voice` (optional): OpenAI voice (default: "alloy")

**Available Voices:**
- `alloy`
- `ash`
- `ballad`
- `coral`
- `echo`
- `sage`
- `shimmer`
- `verse`

## WebSocket Events

### Client → Server

**Send Audio:**
```json
{
  "type": "input_audio_buffer.append",
  "audio": "<base64-pcm16>"
}
```

**Commit Audio:**
```json
{
  "type": "input_audio_buffer.commit"
}
```

### Server → Client

**Session Created:**
```json
{
  "type": "session.created",
  "session": { "id": "sess_..." }
}
```

**Audio Response:**
```json
{
  "type": "response.audio.delta",
  "delta": "<base64-pcm16>"
}
```

**Transcript:**
```json
{
  "type": "response.audio_transcript.delta",
  "delta": "Hello"
}
```

**Conversation Created:**
```json
{
  "type": "conversation.created",
  "conversation_id": "uuid"
}
```

## Logs

**Development:**
- `./logs/combined.log` - All logs
- `./logs/error.log` - Errors only
- Console output (colorized)

**Production:**
- `/var/log/websocket-voice-server/combined.log`
- `/var/log/websocket-voice-server/error.log`
- PM2 logs: `pm2 logs voice-ws-server`

## Monitoring

```bash
# View PM2 status
pm2 status

# View logs (live)
pm2 logs voice-ws-server

# Monitor resources
pm2 monit

# Health check
curl http://localhost:8081/health
```

## Troubleshooting

**"OpenAI API key not configured"**
- Ensure OpenAI API key is stored in Supabase Vault
- Check `system_api_keys` table has active OpenAI entry
- Verify `get_secret` RPC function exists

**"Unauthorized" (4001)**
- Token is invalid or expired
- User doesn't exist in Supabase

**"Missing token or agent_id" (4000)**
- Check query parameters in WebSocket URL

**Connection immediately closes**
- Check firewall allows port 8080 (or your PORT)
- Check Nginx configuration if using reverse proxy
- Check SSL certificate if using wss://

## Security

- ✅ JWT authentication required for all connections
- ✅ OpenAI API key never exposed (fetched from Vault at runtime)
- ✅ SSL/TLS encryption (wss://)
- ✅ No audio data stored on disk
- ✅ Row-level security on database operations

## Performance

**Single Droplet (s-1vcpu-1gb, $6/mo):**
- ~200-500 concurrent connections
- ~600-800ms latency
- 1 TB bandwidth included

**Scaling:**
- Add more droplets + load balancer
- 3x s-2vcpu-2gb droplets = 1500+ concurrent users

## License

Proprietary - Agentopia

## Support

For issues or questions, contact: support@agentopia.ai

