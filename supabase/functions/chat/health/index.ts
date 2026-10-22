const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate OpenAI API key
    const openaiKey = Deno.env.get('OPENAI_API_KEY')?.trim();
    if (!openaiKey) {
      throw new Error('OpenAI API key not configured');
    }

    if (!openaiKey.startsWith('sk-')) {
      throw new Error('Invalid OpenAI API key format');
    }

    // Test OpenAI API connection with a simpler models endpoint
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('OpenAI API response error:', {
        status: response.status,
        statusText: response.statusText,
        error
      });
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
    }

    return new Response(
      JSON.stringify({ 
        status: 'healthy',
        timestamp: new Date().toISOString()
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        },
      }
    );
  } catch (error) {
    console.error('Health check error:', {
      error,
      message: error.message,
      name: error.name,
      stack: error.stack
    });

    return new Response(
      JSON.stringify({ 
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        status: 503,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        },
      }
    );
  }
});