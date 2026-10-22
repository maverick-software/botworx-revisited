import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface Workspace {
    id: string;
    created_at: string;
    name: string;
    description?: string;
    owner_user_id: string;
    context_window_size?: number;
    context_window_token_limit?: number;
}

export interface UseWorkspacesReturn {
    workspaces: Workspace[];
    workspace: Workspace | null; // Single workspace for detail views
    loading: boolean;
    error: Error | null;
    fetchWorkspaces: () => Promise<void>;
    fetchWorkspaceById: (workspaceId: string) => Promise<Workspace | null>;
    createWorkspace: (name: string, description?: string) => Promise<Workspace | null>;
    updateWorkspace: (workspaceId: string, data: Partial<Omit<Workspace, 'id' | 'owner_user_id' | 'created_at'>>) => Promise<Workspace | null>;
    deleteWorkspace: (workspaceId: string) => Promise<boolean>;
}

export function useWorkspaces(): UseWorkspacesReturn {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspace, setWorkspace] = useState<Workspace | null>(null); // Add state for single workspace
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // Fetch workspaces the current user owns or is a member of
  const fetchWorkspaces = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        throw userError || new Error('User not found.');
      }
      const userId = userData.user.id;

      // Fetch workspaces where the user is the owner
      const { data: ownedWorkspaces, error: ownedError } = await supabase
        .from('workspaces')
        .select('*')
        .eq('owner_user_id', userId);

      if (ownedError) throw ownedError;

      // Fetch workspaces where the user is a direct member (via user_id)
      // Note: This doesn't yet fetch workspaces the user is a member of via a Team.
      // This might need adjustment depending on how team membership should grant access.
      const { data: memberWorkspaceIds, error: memberIdError } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', userId);

      if (memberIdError) throw memberIdError;

      const workspaceIds = memberWorkspaceIds?.map(m => m.workspace_id) || [];

      // Fetch workspaces where the user is a member, excluding those already fetched as owned
      const ownedIds = ownedWorkspaces?.map(w => w.id) || [];
      const memberIdsToFetch = workspaceIds.filter(id => !ownedIds.includes(id));

      let memberWorkspaces: Workspace[] = [];
      if (memberIdsToFetch.length > 0) {
          const { data: fetchedMemberWorkspaces, error: memberWsError } = await supabase
              .from('workspaces')
              .select('*')
              .in('id', memberIdsToFetch);

          if (memberWsError) throw memberWsError;
          memberWorkspaces = fetchedMemberWorkspaces || [];
      }


      // Combine and deduplicate (though the logic above should prevent duplicates)
      const allWorkspaces = [...(ownedWorkspaces || []), ...memberWorkspaces];
      const uniqueWorkspaces = Array.from(new Map(allWorkspaces.map(ws => [ws.id, ws])).values());

      setWorkspaces(uniqueWorkspaces);
    } catch (err) {
      console.error('Error fetching workspaces:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch workspaces'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Update fetchWorkspaceById to set the workspace state
  const fetchWorkspaceById = useCallback(async (workspaceId: string): Promise<Workspace | null> => {
    setLoading(true);
    setError(null);
    try {
      // Basic fetch, no RLS check here - assumes if you have the ID, you should fetch.
      // RLS SELECT policy on the `workspaces` table should handle authorization.
      const { data, error } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', workspaceId)
        .single();

      if (error) {
        // Handle case where RLS prevents fetching or item not found
        if (error.code === 'PGRST116') { // PostgREST error code for "Fetched rowcount 0" from .single()
          console.warn(`Workspace with ID ${workspaceId} not found or access denied.`);
          setWorkspace(null);
          return null;
        }
        throw error;
      }

      setWorkspace(data);
      return data;
    } catch (err) {
      console.error(`Error fetching workspace ${workspaceId}:`, err);
      setError(err instanceof Error ? err : new Error('Failed to fetch workspace'));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const createWorkspace = useCallback(async (name: string, description?: string): Promise<Workspace | null> => {
    setLoading(true);
    setError(null);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        throw userError || new Error('User not found.');
      }
      const userId = userData.user.id;

      const { data, error } = await supabase
        .from('workspaces')
        .insert({
          name: name,
          description: description,
          owner_user_id: userId
        })
        .select()
        .single(); // Assuming you want the created workspace back

      if (error) throw error;

      // Optionally: Refetch the list or add the new workspace to the state
      // For simplicity, we'll just return the created workspace here.
      // Consider invalidation or state update strategy based on app needs.
      // fetchWorkspaces(); // Example: refetch all
      // setWorkspaces(prev => [...prev, data]); // Example: append to state

      return data;
    } catch (err) {
      console.error('Error creating workspace:', err);
      setError(err instanceof Error ? err : new Error('Failed to create workspace'));
      return null;
    } finally {
      setLoading(false); // Ensure loading is reset even after returning data
    }
  }, []);

  const updateWorkspace = useCallback(async (workspaceId: string, data: Partial<Omit<Workspace, 'id' | 'owner_user_id' | 'created_at'>>): Promise<Workspace | null> => {
    setLoading(true); // Use global loading for mutation
    setError(null);
    try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user) {
            throw userError || new Error('User not found.');
        }
        const userId = userData.user.id;

        // Perform the update, but add a filter to ensure the user is the owner.
        // RLS UPDATE policy should enforce this, but client-side check adds clarity.
        const { data: updatedData, error } = await supabase
            .from('workspaces')
            .update(data)
            .eq('id', workspaceId)
            .eq('owner_user_id', userId) // << Ensure user is owner
            .select()
            .single();

        if (error) {
             // Handle case where RLS prevents update or item not found/not owned
            if (error.code === 'PGRST116') {
                 console.warn(`Workspace with ID ${workspaceId} not found or update denied (not owner?).`);
                 setError(new Error('Workspace not found or update permission denied.'));
                 return null;
            }
            throw error;
        }

        // Update both the list and single workspace state
        setWorkspaces(prev => prev.map(ws => ws.id === workspaceId ? { ...ws, ...updatedData } : ws));
        setWorkspace(updatedData); // Also update the single workspace state

        return updatedData;
    } catch (err) {
        console.error(`Error updating workspace ${workspaceId}:`, err);
        setError(err instanceof Error ? err : new Error('Failed to update workspace'));
        return null;
    } finally {
        setLoading(false);
    }
  }, []);

  const deleteWorkspace = useCallback(async (workspaceId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user) {
            throw userError || new Error('User not found.');
        }
        const userId = userData.user.id;

        // Perform the delete, filtering by ID and owner ID.
        // RLS DELETE policy should enforce this, but client-side check adds clarity.
        const { error } = await supabase
            .from('workspaces')
            .delete()
            .eq('id', workspaceId)
            .eq('owner_user_id', userId); // << Ensure user is owner

        if (error) {
            // Note: Unlike update/select with .single(), delete doesn't throw PGRST116
            // if the row doesn't match. It just reports 0 rows affected.
            // We rely on the error object itself for issues (e.g., RLS violation).
            console.error(`Error deleting workspace ${workspaceId} (maybe not owner?):`, error);
            throw error;
        }

        // Optionally update the state
        setWorkspaces(prev => prev.filter(ws => ws.id !== workspaceId));

        return true; // Indicate success
    } catch (err) {
        console.error(`Error deleting workspace ${workspaceId}:`, err);
        setError(err instanceof Error ? err : new Error('Failed to delete workspace'));
        return false; // Indicate failure
    } finally {
        setLoading(false);
    }
  }, []);

  return {
    workspaces,
    workspace, // Expose the single workspace state
    loading,
    error,
    fetchWorkspaces,
    fetchWorkspaceById,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
  };
} 