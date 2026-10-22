import React, { useState, useEffect } from 'react';
import { Building2, Plus, Check, X } from 'lucide-react';
import { useTeams } from '../../hooks/useTeams';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';

interface TeamAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentName: string;
  onTeamAssigned?: (teamId: string, teamName: string) => void;
}

export function TeamAssignmentModal({
  isOpen,
  onClose,
  agentId,
  agentName,
  onTeamAssigned
}: TeamAssignmentModalProps) {
  const { teams, fetchTeams, createTeam, loading } = useTeams();
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDescription, setNewTeamDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchTeams();
      setSelectedTeamId(null);
      setShowCreateTeam(false);
      setNewTeamName('');
      setNewTeamDescription('');
    }
  }, [isOpen, fetchTeams]);

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;

    setIsCreating(true);
    try {
      const team = await createTeam(newTeamName.trim(), newTeamDescription.trim() || undefined);
      if (team) {
        setSelectedTeamId(team.id);
        setShowCreateTeam(false);
        setNewTeamName('');
        setNewTeamDescription('');
        // Refresh teams list
        await fetchTeams();
      }
    } catch (error) {
      console.error('Error creating team:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleAssignToTeam = async () => {
    if (!selectedTeamId) return;

    setIsAssigning(true);
    try {
      // TODO: Implement agent team assignment logic here
      // This would typically involve calling an API to assign the agent to the team
      console.log(`Assigning agent ${agentId} to team ${selectedTeamId}`);
      
      const selectedTeam = teams.find(team => team.id === selectedTeamId);
      if (selectedTeam && onTeamAssigned) {
        onTeamAssigned(selectedTeamId, selectedTeam.name);
      }
      
      onClose();
    } catch (error) {
      console.error('Error assigning agent to team:', error);
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Building2 className="w-5 h-5" />
            <span>Add {agentName} to Team</span>
          </DialogTitle>
          <DialogDescription>
            Assign this agent to an existing team or create a new one.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!showCreateTeam ? (
            <>
              {/* Existing Teams */}
              <div>
                <Label className="text-sm font-medium mb-3 block">Select Team</Label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {loading ? (
                    <div className="text-center py-4 text-muted-foreground">
                      Loading teams...
                    </div>
                  ) : teams.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      No teams found. Create one below.
                    </div>
                  ) : (
                    teams.map((team) => (
                      <div
                        key={team.id}
                        onClick={() => setSelectedTeamId(team.id)}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedTeamId === team.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-blue-600 flex items-center justify-center">
                              <span className="text-white text-sm font-medium">
                                {team.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <div className="font-medium text-foreground">{team.name}</div>
                              {team.description && (
                                <div className="text-sm text-muted-foreground">{team.description}</div>
                              )}
                            </div>
                          </div>
                          {selectedTeamId === team.id && (
                            <Check className="w-5 h-5 text-primary" />
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Create New Team Button */}
              <Button
                variant="outline"
                onClick={() => setShowCreateTeam(true)}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create New Team
              </Button>
            </>
          ) : (
            <>
              {/* Create New Team Form */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Create New Team</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCreateTeam(false)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                
                <div>
                  <Label htmlFor="teamName" className="text-sm font-medium">Team Name</Label>
                  <Input
                    id="teamName"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder="Enter team name"
                    className="mt-1"
                  />
                </div>
                
                <div>
                  <Label htmlFor="teamDescription" className="text-sm font-medium">Description (Optional)</Label>
                  <Textarea
                    id="teamDescription"
                    value={newTeamDescription}
                    onChange={(e) => setNewTeamDescription(e.target.value)}
                    placeholder="Enter team description"
                    className="mt-1"
                    rows={3}
                  />
                </div>

                <Button
                  onClick={handleCreateTeam}
                  disabled={!newTeamName.trim() || isCreating}
                  className="w-full"
                >
                  {isCreating ? 'Creating...' : 'Create Team'}
                </Button>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleAssignToTeam}
            disabled={!selectedTeamId || isAssigning}
          >
            {isAssigning ? 'Assigning...' : 'Add to Team'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}