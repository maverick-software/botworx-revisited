/**
 * Artifacts MCP Tools Edge Function
 * 
 * Provides tools for AI agents to create, update, and manage artifacts:
 * - Code files (JavaScript, TypeScript, Python, etc.)
 * - Documents (TXT, MD, JSON, HTML, CSV)
 * - Version control and history
 * - Canvas mode integration
 * 
 * Part of the Artifact System (Brief v2.0)
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface MCPToolRequest {
  action: string;
  agent_id: string;
  user_id: string;
  params: Record<string, any>;
  tool_name?: string;
}

interface MCPToolResponse {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    tool_name?: string;
    execution_time_ms?: number;
    results_count?: number;
  };
}

// Helper: Get MIME content type for file type
function getContentType(fileType: string): string {
  // Supabase Storage is picky about MIME types - use text/plain for most text files
  const contentTypes: Record<string, string> = {
    'txt': 'text/plain',
    'md': 'text/plain',  // Changed from text/markdown
    'json': 'application/json',
    'html': 'text/html',
    'javascript': 'text/plain',  // Changed from text/javascript
    'typescript': 'text/plain',  // Changed from text/typescript
    'python': 'text/plain',  // Changed from text/x-python
    'java': 'text/plain',  // Changed from text/x-java
    'css': 'text/css',
    'csv': 'text/csv',
    'sql': 'text/plain',  // Changed from application/sql
    'yaml': 'text/plain',  // Changed from text/yaml
    'xml': 'application/xml',
    'bash': 'text/plain',  // Changed from text/x-shellscript
    'shell': 'text/plain',  // Changed from text/x-shellscript
    'dockerfile': 'text/plain'  // Changed from text/x-dockerfile
  };
  return contentTypes[fileType.toLowerCase()] || 'text/plain';
}

// =============================================
// Action Handlers
// =============================================

/**
 * Create a new artifact
 * Params: title, file_type, content, description?, tags?, conversation_session_id?, message_id?, workspace_id?
 */
async function handleCreateArtifact(
  supabase: any,
  userId: string,
  agentId: string,
  params: Record<string, any>
): Promise<MCPToolResponse> {
  try {
    const {
      title,
      file_type,
      content,
      description,
      tags,
      conversation_session_id,
      message_id,
      workspace_id,
      metadata
    } = params;

    // Validation
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return {
        success: false,
        error: 'Title is required and must be a non-empty string'
      };
    }

    if (!file_type || typeof file_type !== 'string') {
      return {
        success: false,
        error: 'file_type is required (txt, md, json, html, javascript, typescript, python, etc.)'
      };
    }

    const validFileTypes = [
      'txt', 'md', 'json', 'html',
      'javascript', 'typescript', 'python', 'java',
      'css', 'csv', 'sql', 'yaml', 'xml',
      'bash', 'shell', 'dockerfile'
    ];

    if (!validFileTypes.includes(file_type.toLowerCase())) {
      return {
        success: false,
        error: `Invalid file_type. Must be one of: ${validFileTypes.join(', ')}`
      };
    }

    if (!content || typeof content !== 'string') {
      return {
        success: false,
        error: 'content is required and must be a string'
      };
    }

    // Generate artifact ID first (we'll use this for storage path)
    const artifactId = crypto.randomUUID();
    
    // Upload to storage: media-library/{user_id}/artifacts/{file_type}/{artifact_id}_v1.{file_type}
    const storagePath = `${userId}/artifacts/${file_type.toLowerCase()}/${artifactId}_v1.${file_type.toLowerCase()}`;
    
    console.log(`[Artifacts MCP] Uploading to storage: media-library/${storagePath}`);
    
    const { data: uploadData, error: uploadError} = await supabase.storage
      .from('media-library')
      .upload(storagePath, content, {
        contentType: getContentType(file_type),
        upsert: true  // Allow overwriting if file exists
      });
    
    if (uploadError) {
      console.error('[Artifacts MCP] Storage upload failed:', uploadError);
      return {
        success: false,
        error: `Failed to upload artifact to storage: ${uploadError.message}`
      };
    }
    
    console.log(`[Artifacts MCP] Storage upload successful:`, uploadData);

    // Calculate metadata
    const artifactMetadata = {
      ...metadata,
      file_size: content.length,
      line_count: content.split('\n').length,
      char_count: content.length,
      created_via: 'mcp_tool',
      storage_path: storagePath
    };

    // Insert artifact record with storage_path
    const { data, error } = await supabase
      .from('artifacts')
      .insert({
        id: artifactId, // Use the same ID we used for storage
        user_id: userId,
        agent_id: agentId,
        workspace_id: workspace_id || null,
        conversation_session_id: conversation_session_id || null,
        message_id: message_id || null,
        title: title.trim(),
        file_type: file_type.toLowerCase(),
        content: content, // Still store in DB for quick access
        storage_path: storagePath, // Reference to storage location
        description: description || null,
        tags: tags || [],
        metadata: artifactMetadata,
        version: 1,
        is_latest_version: true,
        status: 'active'
      })
      .select()
      .single();

    if (error) {
      console.error('[Artifacts MCP] Error creating artifact record:', error);
      // Try to clean up the uploaded file
      await supabase.storage.from('media-library').remove([storagePath]);
      return {
        success: false,
        error: `Failed to create artifact record: ${error.message}`
      };
    }

    return {
      success: true,
      data: {
        artifact_id: data.id,
        title: data.title,
        file_type: data.file_type,
        version: data.version,
        created_at: data.created_at,
        artifact: data
      },
      metadata: {
        tool_name: 'create_artifact',
        results_count: 1
      }
    };
  } catch (error: any) {
    console.error('[Artifacts MCP] Error in handleCreateArtifact:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred'
    };
  }
}

/**
 * Update an existing artifact (creates new version)
 * Params: artifact_id, content, changes_note?
 */
async function handleUpdateArtifact(
  supabase: any,
  userId: string,
  agentId: string,
  params: Record<string, any>
): Promise<MCPToolResponse> {
  try {
    const { artifact_id, content, changes_note, title } = params;

    if (!artifact_id) {
      return {
        success: false,
        error: 'artifact_id is required'
      };
    }

    if (!content || typeof content !== 'string') {
      return {
        success: false,
        error: 'content is required and must be a string'
      };
    }

    // Fetch current artifact
    const { data: currentArtifact, error: fetchError } = await supabase
      .from('artifacts')
      .select('*')
      .eq('id', artifact_id)
      .eq('user_id', userId)
      .single();

    if (fetchError || !currentArtifact) {
      return {
        success: false,
        error: 'Artifact not found or access denied'
      };
    }

    // Check if content actually changed
    if (currentArtifact.content === content && !title) {
      return {
        success: true,
        data: {
          artifact_id: currentArtifact.id,
          version: currentArtifact.version,
          message: 'No changes detected - artifact unchanged'
        }
      };
    }

    // Calculate new version number
    const newVersion = currentArtifact.version + 1;
    
    // Upload new version to storage
    const storagePath = `${userId}/artifacts/${currentArtifact.file_type}/${artifact_id}_v${newVersion}.${currentArtifact.file_type}`;
    
    console.log(`[Artifacts MCP] Uploading version ${newVersion} to storage: media-library/${storagePath}`);
    
    const { error: uploadError } = await supabase.storage
      .from('media-library')
      .upload(storagePath, content, {
        contentType: getContentType(currentArtifact.file_type),
        upsert: true  // Allow overwriting if version exists
      });
    
    if (uploadError) {
      console.error('[Artifacts MCP] Storage upload failed:', uploadError);
      return {
        success: false,
        error: `Failed to upload new version to storage: ${uploadError.message}`
      };
    }

    // Update metadata
    const updatedMetadata = {
      ...currentArtifact.metadata,
      file_size: content.length,
      line_count: content.split('\n').length,
      char_count: content.length,
      last_modified_via: 'mcp_tool',
      storage_path: storagePath
    };

    // First, manually create artifact version (since trigger uses auth.uid() which is NULL in service role)
    const { error: versionError } = await supabase
      .from('artifact_versions')
      .insert({
        artifact_id: currentArtifact.id,
        version_number: currentArtifact.version,
        content: currentArtifact.content,
        storage_path: currentArtifact.storage_path,
        created_by: userId,  // Explicitly use the userId from the request
        metadata: currentArtifact.metadata
      });

    if (versionError) {
      console.error('[Artifacts MCP] Error creating artifact version:', versionError);
      return {
        success: false,
        error: `Failed to create artifact version: ${versionError.message}`
      };
    }

    // Clean up old versions - keep only the last 10
    const MAX_VERSIONS = 10;
    try {
      // Get all versions for this artifact, ordered by version number descending
      const { data: allVersions, error: versionsError } = await supabase
        .from('artifact_versions')
        .select('id, version_number, storage_path')
        .eq('artifact_id', currentArtifact.id)
        .order('version_number', { ascending: false });

      if (!versionsError && allVersions && allVersions.length > MAX_VERSIONS) {
        const versionsToDelete = allVersions.slice(MAX_VERSIONS);
        console.log(`[Artifacts MCP] Cleaning up ${versionsToDelete.length} old versions (keeping ${MAX_VERSIONS} most recent)`);

        // Delete old version records from database
        const versionIds = versionsToDelete.map(v => v.id);
        await supabase
          .from('artifact_versions')
          .delete()
          .in('id', versionIds);

        // Delete old version files from storage
        const storagePaths = versionsToDelete
          .map(v => v.storage_path)
          .filter(path => path); // Filter out null paths
        
        if (storagePaths.length > 0) {
          await supabase.storage
            .from('media-library')
            .remove(storagePaths);
          console.log(`[Artifacts MCP] Deleted ${storagePaths.length} old version files from storage`);
        }
      }
    } catch (cleanupError) {
      console.warn('[Artifacts MCP] Warning: Failed to clean up old versions:', cleanupError);
      // Don't fail the update if cleanup fails
    }

    // Now update artifact with new content and incremented version
    const updateData: any = {
      content: content,
      storage_path: storagePath,
      version: newVersion,
      metadata: updatedMetadata,
      updated_at: new Date().toISOString()
    };

    if (title) {
      updateData.title = title.trim();
    }

    const { data, error } = await supabase
      .from('artifacts')
      .update(updateData)
      .eq('id', artifact_id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('[Artifacts MCP] Error updating artifact:', error);
      return {
        success: false,
        error: `Failed to update artifact: ${error.message}`
      };
    }

    return {
      success: true,
      data: {
        artifact_id: data.id,
        title: data.title,
        version: data.version,
        updated_at: data.updated_at,
        artifact: data
      },
      metadata: {
        tool_name: 'update_artifact',
        results_count: 1
      }
    };
  } catch (error: any) {
    console.error('[Artifacts MCP] Error in handleUpdateArtifact:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred'
    };
  }
}

/**
 * List artifacts with filtering
 * Params: conversation_session_id?, file_type?, limit?, offset?
 */
async function handleListArtifacts(
  supabase: any,
  userId: string,
  agentId: string,
  params: Record<string, any>
): Promise<MCPToolResponse> {
  try {
    const {
      conversation_session_id,
      file_type,
      limit = 50,
      offset = 0,
      include_archived = false
    } = params;

    let query = supabase
      .from('artifacts')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .eq('is_latest_version', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (conversation_session_id) {
      query = query.eq('conversation_session_id', conversation_session_id);
    }

    if (file_type) {
      query = query.eq('file_type', file_type.toLowerCase());
    }

    if (!include_archived) {
      query = query.eq('status', 'active');
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('[Artifacts MCP] Error listing artifacts:', error);
      return {
        success: false,
        error: `Failed to list artifacts: ${error.message}`
      };
    }

    return {
      success: true,
      data: {
        artifacts: data,
        total_count: count,
        limit,
        offset
      },
      metadata: {
        tool_name: 'list_artifacts',
        results_count: data?.length || 0
      }
    };
  } catch (error: any) {
    console.error('[Artifacts MCP] Error in handleListArtifacts:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred'
    };
  }
}

/**
 * Get artifact by ID with full content
 * Params: artifact_id
 */
async function handleGetArtifact(
  supabase: any,
  userId: string,
  agentId: string,
  params: Record<string, any>
): Promise<MCPToolResponse> {
  try {
    const { artifact_id } = params;

    if (!artifact_id) {
      return {
        success: false,
        error: 'artifact_id is required'
      };
    }

    const { data, error } = await supabase
      .from('artifacts')
      .select('*')
      .eq('id', artifact_id)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return {
        success: false,
        error: 'Artifact not found or access denied'
      };
    }

    // Update view count
    await supabase
      .from('artifacts')
      .update({
        view_count: data.view_count + 1,
        last_viewed_at: new Date().toISOString()
      })
      .eq('id', artifact_id);

    return {
      success: true,
      data: {
        artifact: data
      },
      metadata: {
        tool_name: 'get_artifact',
        results_count: 1
      }
    };
  } catch (error: any) {
    console.error('[Artifacts MCP] Error in handleGetArtifact:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred'
    };
  }
}

/**
 * Get version history for an artifact
 * Params: artifact_id
 */
async function handleGetVersionHistory(
  supabase: any,
  userId: string,
  agentId: string,
  params: Record<string, any>
): Promise<MCPToolResponse> {
  try {
    const { artifact_id } = params;

    if (!artifact_id) {
      return {
        success: false,
        error: 'artifact_id is required'
      };
    }

    // Verify artifact ownership
    const { data: artifact, error: artifactError } = await supabase
      .from('artifacts')
      .select('id')
      .eq('id', artifact_id)
      .eq('user_id', userId)
      .single();

    if (artifactError || !artifact) {
      return {
        success: false,
        error: 'Artifact not found or access denied'
      };
    }

    // Get version history
    const { data, error } = await supabase
      .from('artifact_versions')
      .select('*')
      .eq('artifact_id', artifact_id)
      .order('version_number', { ascending: false });

    if (error) {
      console.error('[Artifacts MCP] Error fetching version history:', error);
      return {
        success: false,
        error: `Failed to fetch version history: ${error.message}`
      };
    }

    return {
      success: true,
      data: {
        artifact_id,
        versions: data,
        version_count: data?.length || 0
      },
      metadata: {
        tool_name: 'get_version_history',
        results_count: data?.length || 0
      }
    };
  } catch (error: any) {
    console.error('[Artifacts MCP] Error in handleGetVersionHistory:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred'
    };
  }
}

/**
 * Delete artifact (soft delete)
 * Params: artifact_id
 */
async function handleDeleteArtifact(
  supabase: any,
  userId: string,
  agentId: string,
  params: Record<string, any>
): Promise<MCPToolResponse> {
  try {
    const { artifact_id } = params;

    if (!artifact_id) {
      return {
        success: false,
        error: 'artifact_id is required'
      };
    }

    // Soft delete (mark as deleted)
    const { data, error } = await supabase
      .from('artifacts')
      .update({
        status: 'deleted',
        updated_at: new Date().toISOString()
      })
      .eq('id', artifact_id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !data) {
      return {
        success: false,
        error: 'Artifact not found or access denied'
      };
    }

    return {
      success: true,
      data: {
        artifact_id: data.id,
        status: data.status,
        message: 'Artifact deleted successfully'
      },
      metadata: {
        tool_name: 'delete_artifact',
        results_count: 1
      }
    };
  } catch (error: any) {
    console.error('[Artifacts MCP] Error in handleDeleteArtifact:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred'
    };
  }
}

// =============================================
// Main Handler
// =============================================

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const requestData: MCPToolRequest = await req.json();
    const { action, agent_id, user_id, params } = requestData;

    console.log(`[Artifacts MCP] Action: ${action}, Agent: ${agent_id}, User: ${user_id}`);
    console.log(`[Artifacts MCP] Params:`, JSON.stringify(params, null, 2));

    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let response: MCPToolResponse;

    switch (action) {
      case 'create_artifact':
        console.log(`[Artifacts MCP] Calling handleCreateArtifact...`);
        response = await handleCreateArtifact(supabase, user_id, agent_id, params);
        console.log(`[Artifacts MCP] handleCreateArtifact response:`, JSON.stringify(response, null, 2));
        break;

      case 'update_artifact':
        response = await handleUpdateArtifact(supabase, user_id, agent_id, params);
        break;

      case 'list_artifacts':
        response = await handleListArtifacts(supabase, user_id, agent_id, params);
        break;

      case 'get_artifact':
        response = await handleGetArtifact(supabase, user_id, agent_id, params);
        break;

      case 'get_version_history':
        response = await handleGetVersionHistory(supabase, user_id, agent_id, params);
        break;

      case 'delete_artifact':
        response = await handleDeleteArtifact(supabase, user_id, agent_id, params);
        break;

      default:
        response = {
          success: false,
          error: `Unknown action: ${action}. Available actions: create_artifact, update_artifact, list_artifacts, get_artifact, get_version_history, delete_artifact`
        };
    }

    // Add execution time to metadata
    if (response.metadata) {
      response.metadata.execution_time_ms = Date.now() - startTime;
    }

    console.log(`[Artifacts MCP] Final response:`, JSON.stringify(response, null, 2));
    console.log(`[Artifacts MCP] Execution time: ${Date.now() - startTime}ms`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: response.success ? 200 : 400
    });
  } catch (error: any) {
    console.error('[Artifacts MCP] Unexpected error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'An unexpected error occurred',
        metadata: {
          execution_time_ms: Date.now() - startTime
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});

