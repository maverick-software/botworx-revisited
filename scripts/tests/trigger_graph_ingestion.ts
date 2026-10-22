import 'dotenv/config';

async function triggerGraphIngestion() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL!;
  const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!;

  console.log('🚀 Triggering graph-ingestion edge function...\n');

  const url = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/graph-ingestion`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ trigger: 'manual' }),
  });

  if (res.ok) {
    const result = await res.json();
    console.log('✅ Edge function triggered successfully');
    console.log('   Processed:', result.processed || 0, 'items');
  } else {
    console.error('❌ Edge function failed:', res.status);
    const text = await res.text();
    console.error('   Response:', text);
  }
}

triggerGraphIngestion().catch(console.error);
