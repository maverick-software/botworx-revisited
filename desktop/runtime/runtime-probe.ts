Deno.serve(() => new Response(JSON.stringify({
  status: 'ready',
  service: 'sylvana-native-runtime-probe',
}), { headers: { 'Content-Type': 'application/json' } }));
