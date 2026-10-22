/**
 * useCanvasSession Hook
 * 
 * Manages canvas editing sessions - auto-saves work-in-progress content
 * without creating artifact versions. Similar to Claude/ChatGPT canvas behavior.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'react-hot-toast';

interface CanvasSession {
  id: string;
  user_id: string;
  agent_id: string;
  artifact_id: string;
  conversation_session_id: string | null;
  content: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  last_accessed_at: string;
}

interface UseCanvasSessionOptions {
  userId: string;
  agentId: string;
  artifactId: string;
  conversationSessionId?: string | null;
  autoSaveInterval?: number; // milliseconds
}

export function useCanvasSession({
  userId,
  agentId,
  artifactId,
  conversationSessionId,
  autoSaveInterval = 3000 // 3 seconds default
}: UseCanvasSessionOptions) {
  const [session, setSession] = useState<CanvasSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedContentRef = useRef<string>('');

  /**
   * Load existing canvas session or create new one
   */
  const loadSession = useCallback(async (initialContent: string) => {
    try {
      setLoading(true);

      // Try to find existing session
      let query = supabase
        .from('canvas_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('artifact_id', artifactId);
      
      // Handle null conversation_session_id properly
      if (conversationSessionId) {
        query = query.eq('conversation_session_id', conversationSessionId);
      } else {
        query = query.is('conversation_session_id', null);
      }
      
      const { data: existingSession, error: fetchError } = await query.maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      if (existingSession) {
        console.log('[Canvas] Loaded existing session:', existingSession.id);
        setSession(existingSession);
        lastSavedContentRef.current = existingSession.content;
        return existingSession.content; // Return saved content
      } else {
        // Create new session
        const { data: newSession, error: createError } = await supabase
          .from('canvas_sessions')
          .insert({
            user_id: userId,
            agent_id: agentId,
            artifact_id: artifactId,
            conversation_session_id: conversationSessionId || null,
            content: initialContent,
            metadata: {
              created_via: 'canvas_mode',
              initial_version: true
            }
          })
          .select()
          .single();

        if (createError) throw createError;

        console.log('[Canvas] Created new session:', newSession.id);
        setSession(newSession);
        lastSavedContentRef.current = initialContent;
        return initialContent;
      }
    } catch (error: any) {
      console.error('[Canvas] Error loading session:', error);
      return initialContent; // Fallback to initial content
    } finally {
      setLoading(false);
    }
  }, [userId, agentId, artifactId, conversationSessionId]);

  /**
   * Auto-save content to canvas session (debounced)
   */
  const autoSave = useCallback(async (content: string) => {
    // Don't save if content hasn't changed
    if (content === lastSavedContentRef.current) {
      return;
    }

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        setSaving(true);

        if (!session) {
          console.warn('[Canvas] No session to save to');
          return;
        }

        const { error } = await supabase
          .from('canvas_sessions')
          .update({
            content,
            metadata: {
              ...session.metadata,
              last_auto_save: new Date().toISOString(),
              char_count: content.length,
              line_count: content.split('\n').length
            }
          })
          .eq('id', session.id);

        if (error) throw error;

        lastSavedContentRef.current = content;
        console.log('[Canvas] Auto-saved session');
      } catch (error: any) {
        console.error('[Canvas] Auto-save error:', error);
        // Don't show toast for auto-save errors (too noisy)
      } finally {
        setSaving(false);
      }
    }, autoSaveInterval);
  }, [session, autoSaveInterval]);

  /**
   * Clear canvas session (after successful save to artifacts)
   */
  const clearSession = useCallback(async () => {
    try {
      if (!session) return;

      const { error } = await supabase
        .from('canvas_sessions')
        .delete()
        .eq('id', session.id);

      if (error) throw error;

      console.log('[Canvas] Cleared session');
      setSession(null);
      lastSavedContentRef.current = '';
    } catch (error: any) {
      console.error('[Canvas] Error clearing session:', error);
      // Don't throw - not critical
    }
  }, [session]);

  /**
   * Manually save (for immediate save without debounce)
   */
  const manualSave = useCallback(async (content: string) => {
    try {
      if (!session) return;

      setSaving(true);

      // Clear any pending auto-save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      const { error } = await supabase
        .from('canvas_sessions')
        .update({
          content,
          metadata: {
            ...session.metadata,
            last_manual_save: new Date().toISOString()
          }
        })
        .eq('id', session.id);

      if (error) throw error;

      lastSavedContentRef.current = content;
      console.log('[Canvas] Manually saved session');
    } catch (error: any) {
      console.error('[Canvas] Manual save error:', error);
      throw error;
    } finally {
      setSaving(false);
    }
  }, [session]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    session,
    loading,
    saving,
    loadSession,
    autoSave,
    manualSave,
    clearSession
  };
}

