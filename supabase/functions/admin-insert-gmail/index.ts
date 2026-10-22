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
    // Create a Supabase client with service role key (bypasses RLS)
    const supabaseServiceRole = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Insert category
    const { data: category, error: categoryError } = await supabaseServiceRole
      .from('integration_categories')
      .insert([{
        name: 'Messaging & Communication',
        description: 'Communication and messaging platforms',
        icon_name: 'MessageSquare',
        display_order: 4,
        is_active: true
      }])
      .select()
      .single()

    if (categoryError && categoryError.code !== '23505') {
      console.error('Failed to insert category:', categoryError)
      throw categoryError
    }

    // Get category ID
    const { data: existingCategory } = await supabaseServiceRole
      .from('integration_categories')
      .select('id')
      .eq('name', 'Messaging & Communication')
      .single()

    if (!existingCategory) {
      throw new Error('Category not found')
    }

    // Insert Gmail integration
    const { data: gmail, error: gmailError } = await supabaseServiceRole
      .from('integrations')
      .insert([{
        category_id: existingCategory.id,
        name: 'Gmail',
        description: 'Send, receive, and manage Gmail emails with comprehensive tools for email automation',
        icon_name: 'MessageSquare',
        status: 'available',
        agent_classification: 'channel',
        is_popular: true,
        documentation_url: 'https://developers.google.com/gmail/api',
        display_order: 1,
        is_active: true,
        configuration_schema: {
          "send_email": {
            "description": "Send emails on behalf of the user",
            "required_scopes": ["gmail.send"],
            "permission_level": "write"
          },
          "read_emails": {
            "description": "Read user's emails",
            "required_scopes": ["gmail.readonly"],
            "permission_level": "read"
          }
        }
      }])
      .select()
      .single()

    if (gmailError && gmailError.code !== '23505') {
      console.error('Failed to insert Gmail:', gmailError)
      throw gmailError
    }

    // Insert some tool integrations too
    await supabaseServiceRole
      .from('integrations')
      .insert([
        {
          category_id: existingCategory.id,
          name: 'REST API',
          description: 'Connect to RESTful web services',
          icon_name: 'Globe',
          status: 'available',
          agent_classification: 'tool',
          is_popular: true,
          display_order: 2,
          is_active: true,
          configuration_schema: {}
        },
        {
          category_id: existingCategory.id,
          name: 'GraphQL',
          description: 'Query APIs with GraphQL',
          icon_name: 'Globe',
          status: 'available',
          agent_classification: 'tool',
          is_popular: true,
          display_order: 3,
          is_active: true,
          configuration_schema: {}
        }
      ])

    return new Response(
      JSON.stringify({ success: true, message: 'Gmail integration inserted successfully' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error inserting Gmail:', error)
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to insert Gmail integration'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
}) 