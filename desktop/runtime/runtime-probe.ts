Deno.serve(() => new Response(JSON.stringify({
  status: 'ready',
  service: 'agentopia-native-runtime-probe',
}), { headers: { 'Content-Type': 'application/json' } }));
