import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Button } from '@/components/ui/button';
import WorkspaceCard from '@/components/workspaces/WorkspaceCard';

// Define and export a type for the workspace data we expect
export interface Workspace {
  id: string;
  name: string;
  created_at: string;
  owner_user_id: string;
  // Add other relevant fields if needed, e.g., description
}

export function WorkspacesListPage() {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWorkspaces = async () => {
      if (!user) {
        setError("User not authenticated.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Fetch workspaces where the user is the owner OR a member
        // This requires joining workspaces with workspace_members

        // Option 1: Fetch owned workspaces directly
        const { data: ownedWorkspaces, error: ownedError } = await supabase
          .from('workspaces')
          .select('id, name, created_at, owner_user_id')
          .eq('owner_user_id', user.id);

        if (ownedError) {
          console.error("Error fetching owned workspaces:", ownedError);
          throw new Error(`Failed to fetch owned workspaces: ${ownedError.message}`);
        }

        // Option 2: Fetch workspaces where the user is a member
        const { data: memberEntries, error: memberError } = await supabase
          .from('workspace_members')
          .select('workspace_id') // Select the workspace ID
          .eq('user_id', user.id);

        if (memberError) {
          console.error("Error fetching workspace memberships:", memberError);
          throw new Error(`Failed to fetch workspace memberships: ${memberError.message}`);
        }

        const memberWorkspaceIds = memberEntries?.map(entry => entry.workspace_id) || [];

        // Fetch details for workspaces where user is a member (excluding already fetched owned ones)
        let memberWorkspaces: Workspace[] = [];
        if (memberWorkspaceIds.length > 0) {
            const { data: fetchedMemberWorkspaces, error: memberDetailsError } = await supabase
                .from('workspaces')
                .select('id, name, created_at, owner_user_id')
                .in('id', memberWorkspaceIds)
                .neq('owner_user_id', user.id); // Avoid duplicates if user is owner AND member

            if (memberDetailsError) {
                console.error("Error fetching member workspace details:", memberDetailsError);
                throw new Error(`Failed to fetch member workspace details: ${memberDetailsError.message}`);
            }
            memberWorkspaces = fetchedMemberWorkspaces || [];
        }

        // Uncomment the combining/deduplicating logic
        const allWorkspacesMap = new Map<string, Workspace>();
        (ownedWorkspaces || []).forEach(ws => allWorkspacesMap.set(ws.id, ws));
        memberWorkspaces.forEach(ws => allWorkspacesMap.set(ws.id, ws));
        setWorkspaces(Array.from(allWorkspacesMap.values()));

      } catch (err: any) {
        console.error("Error in fetchWorkspaces:", err);
        setError(err.message || "An unexpected error occurred while fetching workspaces.");
      } finally {
        setLoading(false);
      }
    };

    fetchWorkspaces();
  }, [user]);

  if (loading) {
    return <div className="flex justify-center items-center h-full"><LoadingSpinner /></div>;
  }

  if (error) {
    return <div className="text-red-500 p-4">Error: {error}</div>;
  }

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Workspaces</h1>
        <Button asChild>
          {/* Link to the new workspace creation page */}
          <Link to="/workspaces/new">Create New Workspace</Link>
        </Button>
      </div>

      {workspaces.length === 0 ? (
        <p className="text-gray-500">You are not a member of any workspaces yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workspaces.map((workspace, index) => (
            <WorkspaceCard key={workspace.id} workspace={workspace} index={index} />
          ))}
        </div>
      )}
    </div>
  );
} 