// Edge Function: Temporary Chat Events (Server-Sent Events)
// Description: Real-time message streaming for anonymous temporary chat users
// Authentication: Anonymous access with session token validation

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Cache-Control',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

interface SSEMessage {
  type: 'connected' | 'message' | 'heartbeat' | 'session_ended' | 'error'
  data?: any
  timestamp: string
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Only allow GET requests for SSE
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { 
      status: 405, 
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' } 
    })
  }

  try {
    const url = new URL(req.url)
    const sessionToken = url.searchParams.get('session_token')
    
    if (!sessionToken) {
      return new Response('Missing session_token parameter', { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      })
    }

    console.log(`[temporary-chat-events] Starting SSE for session: ${sessionToken.substring(0, 8)}...`)

    // Initialize Supabase client with service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Validate session before starting SSE stream
    const { data: sessionData, error: validationError } = await supabase.rpc('validate_temp_chat_session', {
      p_session_token: sessionToken
    })

    if (validationError || !sessionData?.[0]?.is_valid) {
      console.log(`[temporary-chat-events] Invalid session token: ${sessionToken.substring(0, 8)}...`)
      return new Response('Invalid or expired session', { 
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      })
    }

    const session = sessionData[0]
    console.log(`[temporary-chat-events] Valid session found for conversation: ${session.conversation_id}`)

    // Create SSE stream
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder()
        let isConnected = true
        let heartbeatInterval: number | null = null

        // Helper function to send SSE message
        const sendSSE = (message: SSEMessage) => {
          if (!isConnected) return
          
          try {
            const sseData = `data: ${JSON.stringify(message)}\n\n`
            controller.enqueue(encoder.encode(sseData))
          } catch (error) {
            console.error('[temporary-chat-events] Error sending SSE message:', error)
            cleanup()
          }
        }

        // Send initial connection event
        sendSSE({
          type: 'connected',
          data: {
            session_id: session.session_id,
            conversation_id: session.conversation_id,
            agent_name: session.agent_name,
            max_messages: session.max_messages_per_session,
            current_messages: session.current_message_count
          },
          timestamp: new Date().toISOString()
        })

        // Set up Supabase real-time subscription for chat messages
        const channel = supabase
          .channel(`temp-chat-${session.conversation_id}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'chat_messages_v2',
              filter: `conversation_id=eq.${session.conversation_id}`,
            },
            (payload) => {
              console.log(`[temporary-chat-events] New message received:`, payload.new.id)
              const message = payload.new
              
              sendSSE({
                type: 'message',
                data: {
                  id: message.id,
                  role: message.role,
                  content: typeof message.content === 'string' ? message.content : message.content?.text || '',
                  timestamp: message.created_at,
                  conversation_id: message.conversation_id
                },
                timestamp: new Date().toISOString()
              })
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'temporary_chat_sessions',
              filter: `id=eq.${session.session_id}`,
            },
            (payload) => {
              console.log(`[temporary-chat-events] Session updated:`, payload.new.status)
              const updatedSession = payload.new
              
              // Notify if session ended
              if (updatedSession.status !== 'active') {
                sendSSE({
                  type: 'session_ended',
                  data: {
                    session_id: updatedSession.id,
                    status: updatedSession.status,
                    end_reason: updatedSession.end_reason,
                    ended_at: updatedSession.ended_at
                  },
                  timestamp: new Date().toISOString()
                })
                
                // Close connection after session ends
                setTimeout(() => cleanup(), 1000)
              }
            }
          )
          .subscribe((status, err) => {
            if (status === 'SUBSCRIBED') {
              console.log(`[temporary-chat-events] ✅ Subscribed to conversation ${session.conversation_id}`)
            } else if (status === 'CHANNEL_ERROR') {
              console.warn(`[temporary-chat-events] 🔄 Connection interrupted, auto-reconnecting...`)
              sendSSE({
                type: 'error',
                data: { message: 'Connection interrupted, reconnecting...' },
                timestamp: new Date().toISOString()
              })
            } else if (status === 'CLOSED') {
              console.info(`[temporary-chat-events] 📪 Subscription closed`)
              cleanup()
            } else if (status === 'TIMED_OUT') {
              console.warn(`[temporary-chat-events] ⏱️ Subscription timed out, reconnecting...`)
              sendSSE({
                type: 'error',
                data: { message: 'Connection timed out, reconnecting...' },
                timestamp: new Date().toISOString()
              })
            }
            
            if (err) {
              console.error(`[temporary-chat-events] Subscription error:`, err)
              sendSSE({
                type: 'error',
                data: { message: 'Subscription error', details: err.message },
                timestamp: new Date().toISOString()
              })
            }
          })

        // Set up heartbeat to keep connection alive
        heartbeatInterval = setInterval(() => {
          if (!isConnected) return
          
          sendSSE({
            type: 'heartbeat',
            timestamp: new Date().toISOString()
          })
        }, 30000) // 30 second heartbeat

        // Cleanup function
        const cleanup = () => {
          if (!isConnected) return
          isConnected = false
          
          console.log(`[temporary-chat-events] Cleaning up connection for session: ${sessionToken.substring(0, 8)}...`)
          
          if (heartbeatInterval) {
            clearInterval(heartbeatInterval)
            heartbeatInterval = null
          }
          
          try {
            supabase.removeChannel(channel)
            controller.close()
          } catch (error) {
            console.error('[temporary-chat-events] Cleanup error:', error)
          }
        }

        // Handle client disconnect
        req.signal?.addEventListener('abort', () => {
          console.log(`[temporary-chat-events] Client disconnected: ${sessionToken.substring(0, 8)}...`)
          cleanup()
        })

        // Auto-cleanup after 2 hours (safety measure)
        setTimeout(() => {
          console.log(`[temporary-chat-events] Auto-cleanup after 2 hours: ${sessionToken.substring(0, 8)}...`)
          cleanup()
        }, 2 * 60 * 60 * 1000)

      },
      
      cancel() {
        console.log(`[temporary-chat-events] Stream cancelled: ${sessionToken.substring(0, 8)}...`)
      }
    })

    // Return SSE response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        ...corsHeaders
      }
    })

  } catch (error) {
    console.error('[temporary-chat-events] Global error:', error)
    
    return new Response(
      `data: ${JSON.stringify({
        type: 'error',
        data: { message: 'Server error', details: error.message },
        timestamp: new Date().toISOString()
      })}\n\n`,
      {
        status: 500,
        headers: {
          'Content-Type': 'text/event-stream',
          ...corsHeaders
        }
      }
    )
  }
})
