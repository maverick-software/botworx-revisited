import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Loader2 } from 'lucide-react';

export function CreateWorkspacePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [workspaceName, setWorkspaceName] = useState('');
  // Add description state if needed
  // const [workspaceDescription, setWorkspaceDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !workspaceName.trim()) {
      setError('Workspace name is required and you must be logged in.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: insertError } = await supabase
        .from('workspaces')
        .insert({
          name: workspaceName.trim(),
          owner_user_id: user.id,
          // description: workspaceDescription.trim() // Add if using description
        })
        .select()
        .single(); // Select the newly created row

      if (insertError) {
        throw insertError;
      }

      console.log('Successfully created workspace:', data);
      // Optionally navigate to the new workspace or back to the list
      navigate('/workspaces'); 

    } catch (err: any) {
      console.error('Error creating workspace:', err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Create New Workspace</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="workspaceName">Workspace Name</Label>
          <Input
            id="workspaceName"
            type="text"
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            placeholder="Enter workspace name"
            required
            className="mt-1"
          />
        </div>

        {/* Add description field if needed */}
        {/* <div>
          <Label htmlFor="workspaceDescription">Description (Optional)</Label>
          <Textarea
            id="workspaceDescription"
            value={workspaceDescription}
            onChange={(e) => setWorkspaceDescription(e.target.value)}
            placeholder="Enter a brief description"
            className="mt-1"
          />
        </div> */} 

        {error && (
          <div className="text-red-500 flex items-center">
            <AlertCircle className="w-4 h-4 mr-2" />
            {error}
          </div>
        )}

        <div className="flex justify-end space-x-3">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => navigate('/workspaces')}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={loading || !workspaceName.trim()}>
            {loading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</>
            ) : (
              'Create Workspace'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
} 