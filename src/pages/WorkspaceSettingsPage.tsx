import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, Trash2, Loader2 } from 'lucide-react';
import { WorkspaceMemberManager } from '@/components/workspaces/WorkspaceMemberManager';
import { ContextSettingsTab } from '@/components/workspaces/ContextSettingsTab';

export function WorkspaceSettingsPage() {
  const { roomId: workspaceId } = useParams<{ roomId: string }>();
  const {
    workspace,
    loading: loadingWorkspace,
    error: workspaceError,
    fetchWorkspaceById,
    updateWorkspace,
    deleteWorkspace,
  } = useWorkspaces();

  // Local state for form edits
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Fetch workspace data when component mounts or ID changes
  useEffect(() => {
    if (workspaceId && fetchWorkspaceById) {
      fetchWorkspaceById(workspaceId);
    }
  }, [workspaceId, fetchWorkspaceById]);

  // Update local form state when workspace data loads
  useEffect(() => {
    if (workspace) {
      setName(workspace.name || '');
      setDescription(workspace.description || '');
    }
  }, [workspace]);

  const handleSaveChanges = async () => {
    if (!workspaceId || !workspace) return;
    setIsSaving(true);
    setSaveError(null);
    const updated = await updateWorkspace(workspaceId, { name, description });
    setIsSaving(false);
    if (!updated) {
      setSaveError('Failed to save changes. Please try again.');
    } else {
      // Optionally show success message or refetch data
      fetchWorkspaceById(workspaceId); // Refetch to confirm
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!workspaceId || !workspace) return;
    // Add confirmation dialog before deleting
    if (!window.confirm(`Are you sure you want to delete workspace "${workspace.name}"? This action cannot be undone.`)) {
        return;
    }
    setIsDeleting(true);
    setDeleteError(null);
    const success = await deleteWorkspace(workspaceId);
    setIsDeleting(false);
    if (!success) {
      setDeleteError('Failed to delete workspace. Please try again.');
    } else {
      // Redirect to workspaces list after successful deletion
      window.location.href = '/workspaces'; // Simple redirect for now
    }
  };

  if (loadingWorkspace && !workspace) {
    return <LoadingSpinner message="Loading workspace settings..." />;
  }

  if (workspaceError) {
    return <div className="p-4 text-red-600">Error loading workspace: {workspaceError.message}</div>;
  }

  if (!workspace) {
    return <div className="p-4 text-orange-500">Workspace not found.</div>;
  }

  // Check if the current user is the owner (required for editing/deleting)
  // Assuming useWorkspaces hook provides owner_user_id or we fetch it
  // const isOwner = user?.id === workspace.owner_user_id; // Need user from useAuth()
  // TODO: Add actual owner check - for now, enable fields
  const isOwner = true;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Workspace Settings</h1>
      
      {/* General Settings Section */}
      <div className="mb-8 p-4 border border-border rounded-lg bg-card">
        <h2 className="text-lg font-medium mb-4">General</h2>
        <div className="space-y-4">
          <div>
            <Label htmlFor="workspace-name">Workspace Name</Label>
            <Input 
              id="workspace-name" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!isOwner || isSaving}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="workspace-description">Description (Optional)</Label>
            <Textarea
              id="workspace-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!isOwner || isSaving}
              className="mt-1 h-24"
              rows={3}
            />
          </div>
          {saveError && (
             <p className="text-sm text-red-500 flex items-center"><AlertCircle className="h-4 w-4 mr-1" /> {saveError}</p>
          )}
          <Button 
            onClick={handleSaveChanges} 
            disabled={!isOwner || isSaving || (name === workspace.name && description === workspace.description)}
            size="sm"
            >
             {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Changes
           </Button>
        </div>
      </div>

      {/* Member Management Section */}
      <div className="mb-8 p-4 border border-border rounded-lg bg-card">
        <h2 className="text-lg font-medium mb-4">Members</h2>
        {workspaceId && <WorkspaceMemberManager workspaceId={workspaceId} />}
      </div>

      {/* Context Window Settings (Phase 5) */}
      <div className="mb-8 p-4 border border-border rounded-lg bg-card">
        <h2 className="text-lg font-medium mb-4">AI Context Settings</h2>
        {workspaceId && <ContextSettingsTab workspaceId={workspaceId} />}
      </div>

      {/* Danger Zone */}
      {isOwner && (
          <div className="mb-8 p-4 border border-destructive rounded-lg bg-destructive/10">
            <h2 className="text-lg font-medium mb-2 text-destructive">Danger Zone</h2>
            <p className="text-sm text-muted-foreground mb-4">Deleting your workspace is permanent and cannot be undone.</p>
             {deleteError && (
                <p className="text-sm text-red-500 mb-2 flex items-center"><AlertCircle className="h-4 w-4 mr-1" /> {deleteError}</p>
             )}
            <Button 
                variant="destructive" 
                onClick={handleDeleteWorkspace}
                disabled={isDeleting}
                size="sm"
                >
                {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Delete Workspace
            </Button>
          </div>
       )}

       {/* Back Link */}
       <div className="mt-6">
         <Link to={`/workspaces/${workspaceId}`} className="text-sm text-muted-foreground hover:text-foreground">
             &larr; Back to Workspace
         </Link>
       </div>

    </div>
  );
} 