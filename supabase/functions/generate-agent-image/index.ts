import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import OpenAI from 'https://deno.land/x/openai@v4.28.0/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Get user from JWT token
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      throw new Error('Invalid or expired token')
    }

    // Parse request body
    const { agentId, agentName, prompt: userPrompt, theme, gender, hairColor, eyeColor, customInstructions } = await req.json()

    // Use agentName if agentId is not provided (for agent creation flow)
    const identifier = agentId || agentName
    if (!identifier) {
      throw new Error('Agent ID or Agent Name is required')
    }

    if (!userPrompt && !theme) {
      throw new Error('Prompt or theme is required')
    }

    // Generate prompt from theme and attributes if no userPrompt provided
    let prompt = userPrompt
    if (!prompt && theme) {
      // Build prompt from theme and physical attributes
      const themePrompts = {
        'professional': 'Professional business portrait, confident and approachable',
        'business-casual': 'Business casual portrait, smart and friendly',
        'futuristic': 'Futuristic sci-fi character, high-tech aesthetic',
        'alien': 'Otherworldly alien character with unique features',
        'animal': 'Anthropomorphic animal character, friendly and intelligent',
        'custom': customInstructions || 'Creative character portrait'
      }
      
      let basePrompt = themePrompts[theme] || 'Professional portrait'
      
      // Add physical attributes if provided
      const attributes = []
      if (gender) attributes.push(`${gender} character`)
      if (hairColor) attributes.push(`${hairColor.toLowerCase()} hair`)
      if (eyeColor) attributes.push(`${eyeColor.toLowerCase()} eyes`)
      
      if (attributes.length > 0) {
        basePrompt += `, ${attributes.join(', ')}`
      }
      
      // Add quality modifiers
      prompt = `${basePrompt}, high quality digital art, professional lighting, detailed, 4K resolution, portrait style`
    }

    console.log('Generated image prompt:', prompt)

    // Generate image using OpenAI SDK with gpt-image-1 model
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured')
    }

    const openai = new OpenAI({
      apiKey: openaiApiKey,
    })

    const result = await openai.images.generate({
      model: "gpt-image-1",
      prompt: prompt,
      size: "1024x1024",
      quality: "high"
    })

    console.log('OpenAI response structure:', JSON.stringify(result, null, 2))

    // Extract base64 image data from the response
    if (!result.data || result.data.length === 0) {
      throw new Error('No image generated in response')
    }

    const imageBase64 = result.data[0].b64_json
    if (!imageBase64) {
      console.error('No b64_json in response:', result.data[0])
      throw new Error('Failed to generate image - no base64 data received')
    }

    console.log('Generated image base64 length:', imageBase64.length)

    // Convert base64 to blob and upload to Media Library system
    const imageBuffer = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0))
    const timestamp = Date.now()
    const fileName = `avatar-${identifier}-${timestamp}.png`
    const storagePath = `${user.id}/avatars/${fileName}`
    
    // Upload to media-library bucket (existing system)
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('media-library')
      .upload(storagePath, imageBuffer, {
        contentType: 'image/png',
        upsert: true // Allow overwriting existing files
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      throw new Error(`Failed to upload image: ${uploadError.message}`)
    }

    // Create entry in media_library table for proper tracking
    const { data: mediaEntry, error: mediaError } = await supabase
      .from('media_library')
      .insert({
        user_id: user.id,
        file_name: fileName,
        display_name: `Avatar for Agent ${identifier}`,
        file_type: 'image/png',
        file_size: imageBuffer.length,
        file_extension: 'png',
        storage_bucket: 'media-library',
        storage_path: storagePath,
        category: 'avatars',
        description: `AI-generated avatar created with prompt: ${prompt}`,
        tags: ['avatar', 'ai-generated', 'agent'],
        processing_status: 'completed'
      })
      .select()
      .single()

    if (mediaError) {
      console.error('Media library entry creation error:', mediaError)
      // Continue anyway - the file is uploaded, just not tracked in media library
    }

    // Get the public URL for the uploaded image
    const { data: { publicUrl } } = supabase.storage
      .from('media-library')
      .getPublicUrl(storagePath)

    console.log('Generated and uploaded image URL:', publicUrl)

    return new Response(
      JSON.stringify({
        success: true,
        imageUrl: publicUrl, // Always return the actual public URL
        mediaLibraryId: mediaEntry?.id,
        storagePath: storagePath,
        fileName: fileName
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error in generate-agent-image function:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})