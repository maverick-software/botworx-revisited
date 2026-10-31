import WebSocket from 'ws';
import { readFileSync } from 'node:fs';
const { env } = JSON.parse(readFileSync(process.argv[2], 'utf8'));
console.log('Service credential is JWT:', env.SERVICE_ROLE_KEY.split('.').length === 3);
const socket = new WebSocket(env.API_URL.replace('http', 'ws') + '/realtime/v1/websocket?apikey=' + env.ANON_KEY + '&vsn=1.0.0');
const timeout = setTimeout(() => { console.log('No reply before timeout'); socket.terminate(); }, 10000);
socket.on('open', () => {
  console.log('WebSocket opened');
  socket.send(JSON.stringify({ topic: 'realtime:native-probe', event: 'phx_join', ref: '1', payload: {
    config: { broadcast: { self: false }, presence: { key: '' }, postgres_changes: [
      { event: '*', schema: 'public', table: 'sylvana_runtime_probe' },
    ] },
    access_token: env.SERVICE_ROLE_KEY,
  } }));
});
socket.on('message', data => {
  const message = JSON.parse(data.toString());
  console.log('Reply:', JSON.stringify({ event: message.event, payload: message.payload }));
  if (message.event === 'system') { clearTimeout(timeout); socket.close(); }
});
socket.on('error', error => console.log('Connection error:', error.message));
socket.on('close', (code, reason) => { clearTimeout(timeout); console.log('Closed:', code, reason.toString()); });
