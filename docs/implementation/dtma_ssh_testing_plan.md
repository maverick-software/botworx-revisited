# DTMA SSH Integration Testing Plan

## Overview
This document provides a comprehensive testing strategy for the newly implemented DTMA SSH integration and command execution capabilities.

## Testing Environment Setup

### Prerequisites
- Active DigitalOcean droplet with DTMA service running
- Valid DTMA Bearer Token configured
- cURL or HTTP client for testing

### Environment Variables
```bash
export DTMA_BEARER_TOKEN="your-dtma-token"
export DROPLET_IP="147.182.160.136"
export DTMA_PORT="30000"
export DTMA_BASE_URL="http://${DROPLET_IP}:${DTMA_PORT}"
```

## Testing Checklist

### Phase 1: Basic Connectivity (15 min)
- [ ] Test droplet accessibility
- [ ] Verify DTMA service running on port 30000
- [ ] Test health endpoint
- [ ] Validate authentication

### Phase 2: SSH Command Execution (30 min)
- [ ] Test safe commands (whoami, pwd, docker ps)
- [ ] Test security validation (dangerous commands blocked)
- [ ] Test timeout functionality
- [ ] Test output handling (stdout/stderr)

### Phase 3: Diagnostic Endpoints (20 min)
- [ ] Test Docker diagnostics
- [ ] Test system diagnostics  
- [ ] Test logs diagnostics

### Phase 4: Error Handling (15 min)
- [ ] Test unauthorized access
- [ ] Test malformed requests
- [ ] Test command failures

## Test Commands

### Basic Connectivity Tests
```bash
# Test health endpoint
curl -v http://${DROPLET_IP}:${DTMA_PORT}/health

# Test authenticated status
curl -H "Authorization: Bearer ${DTMA_BEARER_TOKEN}" \
  http://${DROPLET_IP}:${DTMA_PORT}/status
```

### SSH Command Tests
```bash
# Test basic safe command
curl -X POST -H "Authorization: Bearer ${DTMA_BEARER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"command": "whoami"}' \
  http://${DROPLET_IP}:${DTMA_PORT}/ssh/execute

# Test Docker command
curl -X POST -H "Authorization: Bearer ${DTMA_BEARER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"command": "docker ps"}' \
  http://${DROPLET_IP}:${DTMA_PORT}/ssh/execute

# Test blocked dangerous command (should return 403)
curl -X POST -H "Authorization: Bearer ${DTMA_BEARER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"command": "rm -rf /"}' \
  http://${DROPLET_IP}:${DTMA_PORT}/ssh/execute
```

### Diagnostic Tests
```bash
# Test Docker diagnostics
curl -H "Authorization: Bearer ${DTMA_BEARER_TOKEN}" \
  http://${DROPLET_IP}:${DTMA_PORT}/diagnostics/docker

# Test system diagnostics
curl -H "Authorization: Bearer ${DTMA_BEARER_TOKEN}" \
  http://${DROPLET_IP}:${DTMA_PORT}/diagnostics/system

# Test logs diagnostics
curl -H "Authorization: Bearer ${DTMA_BEARER_TOKEN}" \
  "http://${DROPLET_IP}:${DTMA_PORT}/diagnostics/logs?lines=20"
```

## Expected Results

### Success Responses
- Health endpoint: `200 OK`
- SSH safe commands: `200` with stdout/stderr
- Dangerous commands: `403 Forbidden` 
- Diagnostic endpoints: `200` with system data

### Error Responses
- No auth token: `401 Unauthorized`
- Invalid command: `400 Bad Request`
- Command failure: `500` with error details

## Troubleshooting

### Common Issues
1. **Connection Refused**: Check DTMA service status
2. **401 Unauthorized**: Verify Bearer token
3. **Command Timeout**: Increase timeout parameter
4. **Docker Errors**: Ensure Docker is running

### Debug Commands
```bash
# Check service status
systemctl status dtma

# View logs
journalctl -u dtma -f

# Test port
nc -zv ${DROPLET_IP} 30000
```

## Next Steps

On successful testing:
- Document performance observations
- Proceed with frontend integration
- Implement production monitoring

On test failures:
- Document failing tests
- Create bug reports with logs
- Fix issues and re-test 