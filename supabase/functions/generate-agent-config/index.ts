import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { description } = await req.json()

    if (!description || typeof description !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'Description is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Get OpenAI API key from environment
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      throw new Error('OpenAI API key not configured')
    }

    // Generate agent configuration using OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an AI agent configuration generator. Based on the user's description, generate a complete agent configuration in JSON format.

The JSON must have exactly these fields:
{
  "name": "Agent Name (catchy, 2-3 words)",
  "purpose": "One-line summary of the agent's role",
  "description": "Detailed 2-3 sentence description of capabilities and personality",
  "theme": "professional | business-casual | futuristic | alien | animal | custom",
  "gender": "male | female | neutral",
  "hairColor": "Black | Brown | Blonde | Red | Gray | White | Blue | Purple | Green",
  "eyeColor": "Brown | Blue | Green | Hazel | Gray | Amber | Violet | Red",
  "mbtiType": "Four-letter MBTI type (e.g., INTJ, ENFP, ISFJ)",
  "customInstructions": "Detailed behavioral instructions for how the agent should act",
  "selectedTools": ["array", "of", "tool", "ids"]
}

Available tools: email, web_search, document_creation

Choose 1-3 relevant tools based on the agent's purpose. Be creative but accurate. Match personality to purpose.

Respond ONLY with the JSON object, no markdown or explanation.`
          },
          {
            role: 'user',
            content: description
          }
        ],
        temperature: 0.8,
        max_tokens: 1000,
        response_format: { type: "json_object" }
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('OpenAI API error:', errorText)
      
      // Parse error for better messaging
      try {
        const errorData = JSON.parse(errorText)
        if (errorData.error?.code === 'insufficient_quota') {
          throw new Error('OpenAI API quota exceeded. Please check your billing at platform.openai.com or use Manual Setup.')
        } else if (errorData.error?.message) {
          throw new Error(`OpenAI Error: ${errorData.error.message}`)
        }
      } catch (parseError) {
        // If parsing fails, use generic error
      }
      
      throw new Error(`OpenAI API failed: ${response.statusText}`)
    }

    const data = await response.json()
    const configText = data.choices[0]?.message?.content

    if (!configText) {
      throw new Error('No configuration generated')
    }

    // Parse the generated JSON
    const configuration = JSON.parse(configText)

    // Validate required fields
    if (!configuration.name || !configuration.purpose) {
      throw new Error('Invalid configuration generated')
    }

    // Return the generated configuration
    return new Response(
      JSON.stringify({ 
        success: true, 
        configuration,
        rawResponse: configText 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to generate configuration' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
