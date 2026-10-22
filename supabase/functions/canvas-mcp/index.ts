import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MCPToolResponse {
  success: boolean;
  data?: any;
  error?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, params } = await req.json();
    
    const authHeader = req.headers.get('Authorization')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    console.log(`[Canvas MCP] Action: ${action}`);

    let result: MCPToolResponse;

    switch (action) {
      case 'canvas_get_content':
        result = await handleGetContent(supabase, user.id, params);
        break;
      case 'canvas_replace_lines':
        result = await handleReplaceLines(supabase, user.id, params);
        break;
      case 'canvas_insert_lines':
        result = await handleInsertLines(supabase, user.id, params);
        break;
      case 'canvas_delete_lines':
        result = await handleDeleteLines(supabase, user.id, params);
        break;
      case 'canvas_search_replace':
        result = await handleSearchReplace(supabase, user.id, params);
        break;
      case 'canvas_get_diff':
        result = await handleGetDiff(supabase, user.id, params);
        break;
      case 'canvas_save_snapshot':
        result = await handleSaveSnapshot(supabase, user.id, params);
        break;
      case 'canvas_revert_to_snapshot':
        result = await handleRevertToSnapshot(supabase, user.id, params);
        break;
      case 'canvas_undo':
        result = await handleUndo(supabase, user.id, params);
        break;
      case 'canvas_redo':
        result = await handleRedo(supabase, user.id, params);
        break;
      default:
        result = { success: false, error: `Unknown action: ${action}` };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[Canvas MCP] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

// Get current canvas content with line numbers
async function handleGetContent(supabase: any, userId: string, params: any): Promise<MCPToolResponse> {
  const { canvas_session_id, start_line, end_line } = params;

  const { data: session, error } = await supabase
    .from('canvas_sessions')
    .select('content')
    .eq('id', canvas_session_id)
    .eq('user_id', userId)
    .single();

  if (error) throw error;

  const lines = session.content.split('\n');
  const startIdx = (start_line || 1) - 1;
  const endIdx = end_line ? end_line : lines.length;

  const selectedLines = lines.slice(startIdx, endIdx);
  const numberedLines = selectedLines.map((line: string, idx: number) => ({
    number: startIdx + idx + 1,
    content: line
  }));

  return {
    success: true,
    data: {
      content: selectedLines.join('\n'),
      line_count: lines.length,
      numbered_lines: numberedLines
    }
  };
}

// Replace specific lines
async function handleReplaceLines(supabase: any, userId: string, params: any): Promise<MCPToolResponse> {
  const { canvas_session_id, start_line, end_line, new_content, reason } = params;

  // Get current session
  const { data: session, error: fetchError } = await supabase
    .from('canvas_sessions')
    .select('*')
    .eq('id', canvas_session_id)
    .eq('user_id', userId)
    .single();

  if (fetchError) throw fetchError;

  // Use PostgreSQL function to replace lines
  const { data: newContent, error: replaceError } = await supabase.rpc('replace_lines', {
    content: session.content,
    start_line,
    end_line,
    new_content
  });

  if (replaceError) throw replaceError;

  // Get old content for diff
  const { data: oldLines } = await supabase.rpc('get_lines', {
    content: session.content,
    start_line,
    end_line
  });

  // Update session
  const { error: updateError } = await supabase
    .from('canvas_sessions')
    .update({ content: newContent })
    .eq('id', canvas_session_id);

  if (updateError) throw updateError;

  // Record diff
  await supabase.from('canvas_diffs').insert({
    canvas_session_id,
    operation_type: 'replace',
    start_line,
    end_line,
    before_content: oldLines,
    after_content: new_content,
    reason,
    created_by: userId
  });

  const newLineCount = newContent.split('\n').length;

  return {
    success: true,
    data: {
      lines_affected: end_line - start_line + 1,
      diff: {
        before: oldLines,
        after: new_content
      },
      new_line_count: newLineCount
    }
  };
}

// Insert new lines
async function handleInsertLines(supabase: any, userId: string, params: any): Promise<MCPToolResponse> {
  const { canvas_session_id, insert_after_line, content: newContent, reason } = params;

  const { data: session, error: fetchError } = await supabase
    .from('canvas_sessions')
    .select('*')
    .eq('id', canvas_session_id)
    .eq('user_id', userId)
    .single();

  if (fetchError) throw fetchError;

  const { data: updatedContent, error: insertError } = await supabase.rpc('insert_lines', {
    content: session.content,
    after_line: insert_after_line,
    new_content: newContent
  });

  if (insertError) throw insertError;

  await supabase
    .from('canvas_sessions')
    .update({ content: updatedContent })
    .eq('id', canvas_session_id);

  await supabase.from('canvas_diffs').insert({
    canvas_session_id,
    operation_type: 'insert',
    start_line: insert_after_line + 1,
    before_content: null,
    after_content: newContent,
    reason,
    created_by: userId
  });

  const linesInserted = newContent.split('\n').length;
  const newLineCount = updatedContent.split('\n').length;

  return {
    success: true,
    data: {
      lines_inserted: linesInserted,
      new_line_count: newLineCount
    }
  };
}

// Delete lines
async function handleDeleteLines(supabase: any, userId: string, params: any): Promise<MCPToolResponse> {
  const { canvas_session_id, start_line, end_line, reason } = params;

  const { data: session, error: fetchError } = await supabase
    .from('canvas_sessions')
    .select('*')
    .eq('id', canvas_session_id)
    .eq('user_id', userId)
    .single();

  if (fetchError) throw fetchError;

  const { data: deletedContent } = await supabase.rpc('get_lines', {
    content: session.content,
    start_line,
    end_line
  });

  const { data: updatedContent, error: deleteError } = await supabase.rpc('delete_lines', {
    content: session.content,
    start_line,
    end_line
  });

  if (deleteError) throw deleteError;

  await supabase
    .from('canvas_sessions')
    .update({ content: updatedContent })
    .eq('id', canvas_session_id);

  await supabase.from('canvas_diffs').insert({
    canvas_session_id,
    operation_type: 'delete',
    start_line,
    end_line,
    before_content: deletedContent,
    after_content: null,
    reason,
    created_by: userId
  });

  const linesDeleted = end_line - start_line + 1;
  const newLineCount = updatedContent.split('\n').length;

  return {
    success: true,
    data: {
      lines_deleted: linesDeleted,
      deleted_content: deletedContent,
      new_line_count: newLineCount
    }
  };
}

// Search and replace
async function handleSearchReplace(supabase: any, userId: string, params: any): Promise<MCPToolResponse> {
  const { canvas_session_id, search_pattern, replace_with, case_sensitive = true, regex = false, max_replacements = 0, reason } = params;

  const { data: session, error: fetchError } = await supabase
    .from('canvas_sessions')
    .select('*')
    .eq('id', canvas_session_id)
    .eq('user_id', userId)
    .single();

  if (fetchError) throw fetchError;

  let searchRegex: RegExp;
  if (regex) {
    searchRegex = new RegExp(search_pattern, case_sensitive ? 'g' : 'gi');
  } else {
    const escapedPattern = search_pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    searchRegex = new RegExp(escapedPattern, case_sensitive ? 'g' : 'gi');
  }

  const lines = session.content.split('\n');
  const diffs: any[] = [];
  let replacementCount = 0;
  let updatedLines = lines.map((line: string, idx: number) => {
    if (max_replacements > 0 && replacementCount >= max_replacements) {
      return line;
    }

    const newLine = line.replace(searchRegex, (match) => {
      if (max_replacements > 0 && replacementCount >= max_replacements) {
        return match;
      }
      replacementCount++;
      diffs.push({
        line: idx + 1,
        before: line,
        after: line.replace(searchRegex, replace_with)
      });
      return replace_with;
    });

    return newLine;
  });

  const updatedContent = updatedLines.join('\n');

  if (replacementCount > 0) {
    await supabase
      .from('canvas_sessions')
      .update({ content: updatedContent })
      .eq('id', canvas_session_id);

    await supabase.from('canvas_diffs').insert({
      canvas_session_id,
      operation_type: 'search_replace',
      start_line: diffs[0]?.line || 1,
      before_content: search_pattern,
      after_content: replace_with,
      reason,
      metadata: { replacements_made: replacementCount },
      created_by: userId
    });
  }

  return {
    success: true,
    data: {
      replacements_made: replacementCount,
      affected_lines: diffs.map(d => d.line),
      diffs
    }
  };
}

// Get diff since last save
async function handleGetDiff(supabase: any, userId: string, params: any): Promise<MCPToolResponse> {
  const { canvas_session_id, format = 'unified' } = params;

  const { data: diffs, error } = await supabase
    .from('canvas_diffs')
    .select('*')
    .eq('canvas_session_id', canvas_session_id)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const changes = diffs.map((diff: any) => ({
    type: diff.operation_type === 'delete' ? 'delete' : diff.operation_type === 'insert' ? 'add' : 'modify',
    line: diff.start_line,
    before: diff.before_content,
    after: diff.after_content
  }));

  // Simple unified diff format
  let diffText = '';
  for (const change of changes) {
    if (change.type === 'delete') {
      diffText += `- Line ${change.line}: ${change.before}\n`;
    } else if (change.type === 'add') {
      diffText += `+ Line ${change.line}: ${change.after}\n`;
    } else {
      diffText += `~ Line ${change.line}:\n  - ${change.before}\n  + ${change.after}\n`;
    }
  }

  return {
    success: true,
    data: {
      has_changes: changes.length > 0,
      diff: diffText,
      changes
    }
  };
}

// Save snapshot
async function handleSaveSnapshot(supabase: any, userId: string, params: any): Promise<MCPToolResponse> {
  const { canvas_session_id, label, description } = params;

  const { data: session, error: fetchError } = await supabase
    .from('canvas_sessions')
    .select('content')
    .eq('id', canvas_session_id)
    .eq('user_id', userId)
    .single();

  if (fetchError) throw fetchError;

  const lineCount = session.content.split('\n').length;

  const { data: snapshot, error: insertError } = await supabase
    .from('canvas_snapshots')
    .insert({
      canvas_session_id,
      content: session.content,
      label,
      description,
      line_count: lineCount,
      created_by: userId
    })
    .select()
    .single();

  if (insertError) throw insertError;

  return {
    success: true,
    data: {
      snapshot_id: snapshot.id,
      timestamp: snapshot.created_at,
      line_count: lineCount
    }
  };
}

// Revert to snapshot
async function handleRevertToSnapshot(supabase: any, userId: string, params: any): Promise<MCPToolResponse> {
  const { canvas_session_id, snapshot_id } = params;

  const { data: snapshot, error: fetchError } = await supabase
    .from('canvas_snapshots')
    .select('*')
    .eq('id', snapshot_id)
    .single();

  if (fetchError) throw fetchError;

  const { data: session } = await supabase
    .from('canvas_sessions')
    .select('content')
    .eq('id', canvas_session_id)
    .single();

  // Calculate diff
  const oldLines = session.content.split('\n').length;
  const newLines = snapshot.content.split('\n').length;

  await supabase
    .from('canvas_sessions')
    .update({ content: snapshot.content })
    .eq('id', canvas_session_id);

  return {
    success: true,
    data: {
      reverted_to: {
        snapshot_id: snapshot.id,
        timestamp: snapshot.created_at,
        label: snapshot.label
      },
      diff: `Reverted from ${oldLines} lines to ${newLines} lines`
    }
  };
}

// Undo last change
async function handleUndo(supabase: any, userId: string, params: any): Promise<MCPToolResponse> {
  const { canvas_session_id } = params;

  // Get last diff
  const { data: lastDiff, error } = await supabase
    .from('canvas_diffs')
    .select('*')
    .eq('canvas_session_id', canvas_session_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !lastDiff) {
    return { success: false, error: 'No changes to undo' };
  }

  // Get current session
  const { data: session } = await supabase
    .from('canvas_sessions')
    .select('content, undo_stack, redo_stack')
    .eq('id', canvas_session_id)
    .single();

  // Add current state to redo stack
  const redoStack = session.redo_stack || [];
  redoStack.push({ content: session.content, timestamp: new Date().toISOString() });

  // Restore based on diff type
  let restoredContent = session.content;
  
  if (lastDiff.operation_type === 'replace') {
    restoredContent = await supabase.rpc('replace_lines', {
      content: session.content,
      start_line: lastDiff.start_line,
      end_line: lastDiff.end_line,
      new_content: lastDiff.before_content
    }).then((r: any) => r.data);
  } else if (lastDiff.operation_type === 'insert') {
    restoredContent = await supabase.rpc('delete_lines', {
      content: session.content,
      start_line: lastDiff.start_line,
      end_line: lastDiff.start_line + lastDiff.after_content.split('\n').length - 1
    }).then((r: any) => r.data);
  } else if (lastDiff.operation_type === 'delete') {
    restoredContent = await supabase.rpc('insert_lines', {
      content: session.content,
      after_line: lastDiff.start_line - 1,
      new_content: lastDiff.before_content
    }).then((r: any) => r.data);
  }

  await supabase
    .from('canvas_sessions')
    .update({ content: restoredContent, redo_stack: redoStack })
    .eq('id', canvas_session_id);

  // Delete the undone diff
  await supabase
    .from('canvas_diffs')
    .delete()
    .eq('id', lastDiff.id);

  return {
    success: true,
    data: {
      undone_action: {
        type: lastDiff.operation_type,
        lines_affected: [lastDiff.start_line, lastDiff.end_line]
      },
      can_redo: true
    }
  };
}

// Redo last undone change
async function handleRedo(supabase: any, userId: string, params: any): Promise<MCPToolResponse> {
  const { canvas_session_id } = params;

  const { data: session } = await supabase
    .from('canvas_sessions')
    .select('content, redo_stack')
    .eq('id', canvas_session_id)
    .single();

  const redoStack = session.redo_stack || [];
  
  if (redoStack.length === 0) {
    return { success: false, error: 'No changes to redo' };
  }

  const lastRedo = redoStack.pop();

  await supabase
    .from('canvas_sessions')
    .update({ content: lastRedo.content, redo_stack: redoStack })
    .eq('id', canvas_session_id);

  return {
    success: true,
    data: {
      redone_action: {
        type: 'restore',
        lines_affected: []
      },
      can_undo: true
    }
  };
}

