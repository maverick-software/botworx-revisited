/**
 * useArtifacts Hook
 * Manages artifact CRUD operations via MCP tools
 * Updated: 2025-01-10 - Direct artifacts-mcp function calls
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Artifact,
  ArtifactVersion,
  CreateArtifactParams,
  UpdateArtifactParams,
  ListArtifactsParams,
  ARTIFACT_EXTENSIONS
} from '@/types/artifacts';
import { toast } from 'react-hot-toast';
import { saveAs } from 'file-saver';

interface UseArtifactsReturn {
  artifacts: Artifact[];
  loading: boolean;
  error: string | null;
  createArtifact: (params: CreateArtifactParams, agentId: string) => Promise<Artifact | null>;
  updateArtifact: (params: UpdateArtifactParams, agentId: string) => Promise<Artifact | null>;
  listArtifacts: (params: ListArtifactsParams) => Promise<void>;
  getArtifact: (artifactId: string) => Promise<Artifact | null>;
  getVersionHistory: (artifactId: string) => Promise<ArtifactVersion[]>;
  deleteArtifact: (artifactId: string) => Promise<boolean>;
  downloadArtifact: (artifact: Artifact) => void;
}

export const useArtifacts = (): UseArtifactsReturn => {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Call MCP tool via universal-tool-executor
   */
  const callMCPTool = async (
    toolName: string,
    parameters: Record<string, any>,
    agentId: string
  ): Promise<any> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const requestBody = {
        action: toolName,
        agent_id: agentId,
        user_id: session.user.id,
        params: parameters
      };

      console.log('[useArtifacts] Calling artifacts-mcp function', {
        toolName,
        parameters: { ...parameters, content: parameters.content ? `${parameters.content.substring(0, 50)}...` : undefined },
        agentId,
        userId: session.user.id,
        requestBody: { ...requestBody, params: { ...requestBody.params, content: requestBody.params.content ? `${requestBody.params.content.substring(0, 50)}...` : undefined }}
      });

      // Call artifacts-mcp Edge Function directly
      const response = await supabase.functions.invoke('artifacts-mcp', {
        body: requestBody
      });

      console.log('[useArtifacts] artifacts-mcp response', {
        error: response.error,
        success: response.data?.success,
        hasData: !!response.data?.data,
        fullResponse: response.data
      });

      if (response.error) {
        console.error('[useArtifacts] Response error:', response.error);
        throw new Error(response.error.message || 'Tool execution failed');
      }

      if (!response.data?.success) {
        console.error('[useArtifacts] Tool returned success=false:', response.data);
        throw new Error(response.data?.error || 'Tool execution failed');
      }

      return response.data.data;
    } catch (err: any) {
      console.error(`[useArtifacts] MCP tool ${toolName} failed:`, err);
      throw err;
    }
  };

  /**
   * Create a new artifact
   */
  const createArtifact = useCallback(
    async (params: CreateArtifactParams, agentId: string): Promise<Artifact | null> => {
      setLoading(true);
      setError(null);

      try {
        const result = await callMCPTool('create_artifact', params, agentId);
        
        if (result?.artifact) {
          toast.success(`Created ${result.artifact.title}`);
          return result.artifact;
        }

        return null;
      } catch (err: any) {
        const errorMsg = err.message || 'Failed to create artifact';
        setError(errorMsg);
        toast.error(errorMsg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Update an existing artifact
   */
  const updateArtifact = useCallback(
    async (params: UpdateArtifactParams, agentId: string): Promise<Artifact | null> => {
      setLoading(true);
      setError(null);

      try {
        const result = await callMCPTool('update_artifact', params, agentId);
        
        console.log('[useArtifacts] updateArtifact result:', {
          hasResult: !!result,
          hasArtifact: !!result?.artifact,
          artifactId: result?.artifact?.id,
          artifactVersion: result?.artifact?.version,
          artifactContentLength: result?.artifact?.content?.length
        });
        
        if (result?.artifact) {
          toast.success('Artifact updated');
          
          // Update in local state if we have it
          setArtifacts(prev =>
            prev.map(a => (a.id === result.artifact.id ? result.artifact : a))
          );
          
          return result.artifact;
        }

        console.warn('[useArtifacts] updateArtifact - no artifact in result:', result);
        return null;
      } catch (err: any) {
        const errorMsg = err.message || 'Failed to update artifact';
        setError(errorMsg);
        toast.error(errorMsg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * List artifacts with filters
   */
  const listArtifacts = useCallback(async (params: ListArtifactsParams): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      // For listing, we can query directly from Supabase
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      let query = supabase
        .from('artifacts')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('is_latest_version', true)
        .order('created_at', { ascending: false });

      if (params.conversation_session_id) {
        query = query.eq('conversation_session_id', params.conversation_session_id);
      }

      if (params.file_type) {
        query = query.eq('file_type', params.file_type);
      }

      if (!params.include_archived) {
        query = query.eq('status', 'active');
      }

      if (params.limit) {
        query = query.limit(params.limit);
      }

      if (params.offset) {
        query = query.range(params.offset, params.offset + (params.limit || 50) - 1);
      }

      const { data, error: queryError } = await query;

      if (queryError) {
        throw queryError;
      }

      setArtifacts(data || []);
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to list artifacts';
      setError(errorMsg);
      console.error('List artifacts error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get a single artifact by ID
   */
  const getArtifact = useCallback(async (artifactId: string): Promise<Artifact | null> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from('artifacts')
        .select('*')
        .eq('id', artifactId)
        .single();

      if (queryError) {
        throw queryError;
      }

      return data;
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to get artifact';
      setError(errorMsg);
      console.error('Get artifact error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get version history for an artifact
   */
  const getVersionHistory = useCallback(
    async (artifactId: string): Promise<ArtifactVersion[]> => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: queryError } = await supabase
          .from('artifact_versions')
          .select('*')
          .eq('artifact_id', artifactId)
          .order('version_number', { ascending: false });

        if (queryError) {
          throw queryError;
        }

        return data || [];
      } catch (err: any) {
        const errorMsg = err.message || 'Failed to get version history';
        setError(errorMsg);
        console.error('Get version history error:', err);
        return [];
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Delete an artifact (soft delete)
   */
  const deleteArtifact = useCallback(async (artifactId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('artifacts')
        .update({ status: 'deleted' })
        .eq('id', artifactId);

      if (updateError) {
        throw updateError;
      }

      // Remove from local state
      setArtifacts(prev => prev.filter(a => a.id !== artifactId));
      
      toast.success('Artifact deleted');
      return true;
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to delete artifact';
      setError(errorMsg);
      toast.error(errorMsg);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Download an artifact as a file
   */
  const downloadArtifact = useCallback((artifact: Artifact): void => {
    try {
      const extension = ARTIFACT_EXTENSIONS[artifact.file_type] || '.txt';
      const filename = `${artifact.title}${extension}`;
      
      const blob = new Blob([artifact.content], {
        type: 'text/plain;charset=utf-8'
      });
      
      saveAs(blob, filename);
      
      // Increment download count
      supabase
        .from('artifacts')
        .update({
          download_count: artifact.download_count + 1
        })
        .eq('id', artifact.id)
        .then(() => {
          // Update local state
          setArtifacts(prev =>
            prev.map(a =>
              a.id === artifact.id
                ? { ...a, download_count: a.download_count + 1 }
                : a
            )
          );
        });

      toast.success(`Downloaded ${filename}`);
    } catch (err: any) {
      console.error('Download error:', err);
      toast.error('Failed to download artifact');
    }
  }, []);

  return {
    artifacts,
    loading,
    error,
    createArtifact,
    updateArtifact,
    listArtifacts,
    getArtifact,
    getVersionHistory,
    deleteArtifact,
    downloadArtifact
  };
};
