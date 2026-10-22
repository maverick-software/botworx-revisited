// Supabase Edge Function: change-email
// Handles user email changes by directly updating with Supabase's email confirmation flow

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    console.log('[change-email] Request received')
    
    // Get auth token from request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('[change-email] No authorization header found')
      throw new Error('No authorization header')
    }

    console.log('[change-email] Auth header present')

    // Extract the JWT token from the Authorization header
    const token = authHeader.replace('Bearer ', '')

    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    console.log('[change-email] Verifying user authentication...')

    // Verify user is authenticated using the JWT token
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    
    if (userError) {
      console.error('[change-email] Auth error:', userError)
      throw new Error(`Authentication failed: ${userError.message}`)
    }
    
    if (!user) {
      console.error('[change-email] No user found in token')
      throw new Error('Unauthorized - no user in token')
    }

    console.log('[change-email] User authenticated:', user.id)

    // Parse request body
    const { newEmail } = await req.json()
    
    if (!newEmail || typeof newEmail !== 'string') {
      throw new Error('New email is required')
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newEmail)) {
      throw new Error('Invalid email format')
    }

    // Store old email for audit log
    const oldEmail = user.email || ''

    // Check if new email is the same as current
    if (oldEmail.toLowerCase() === newEmail.toLowerCase()) {
      throw new Error('New email must be different from current email')
    }

    console.log(`[change-email] User ${user.id} requesting email change from ${oldEmail} to ${newEmail}`)

    // Check if new email is already in use
    const { data: existingUsers, error: checkError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (checkError) {
      console.error('[change-email] Error checking existing users:', checkError)
    } else {
      const emailExists = existingUsers.users.some(u => 
        u.email?.toLowerCase() === newEmail.toLowerCase() && u.id !== user.id
      )
      if (emailExists) {
        throw new Error('This email address is already in use by another account')
      }
    }

    // Update the user's email using admin API
    // This will trigger Supabase's built-in email confirmation flow
    console.log('[change-email] Updating user email with admin API...')
    
    const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { 
        email: newEmail,
        email_confirm: false, // This triggers the confirmation email
      }
    )

    if (updateError) {
      console.error('[change-email] Error updating email:', updateError)
      console.error('[change-email] Full error:', JSON.stringify(updateError, null, 2))
      
      // If the error is about email already in use, provide a clear message
      if (updateError.message?.includes('already') || updateError.code === 'email_exists') {
        throw new Error('This email address is already registered to another account')
      }
      
      throw new Error(`Failed to initiate email change: ${updateError.message || 'Unknown error'}`)
    }

    console.log('[change-email] Email update successful, confirmation email should be sent by Supabase')
    console.log('[change-email] Updated user email:', updateData?.user?.email)

    // Log the email change request
    const { error: auditError } = await supabaseAdmin
      .from('email_change_audit_log')
      .insert({
        user_id: user.id,
        old_email: oldEmail,
        new_email: newEmail,
        ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
        user_agent: req.headers.get('user-agent'),
        change_method: 'user_initiated',
        notes: 'Email change initiated via admin API - Supabase should send confirmation email'
      })

    if (auditError) {
      console.error('[change-email] Error logging audit:', auditError)
      // Don't fail the request if audit logging fails
    }

    console.log(`[change-email] Email change process completed for ${newEmail}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email update submitted. If email confirmations are enabled, you will receive a verification email.',
        newEmail: newEmail,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error: any) {
    console.error('[change-email] Error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to change email'
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
