import React, { useState, useEffect } from 'react';
import { useRoomMembers, type RoomMemberDetails } from '../hooks/useRoomMembers';
import { Button } from "@/components/ui/button"; // Assuming Shadcn alias
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { UserPlus, Trash2, Loader2, Users, Bot, Building } from 'lucide-react';
import { type MemberType } from '../types/chat';

interface RoomMemberManagerProps {
  roomId: string;
}

const MemberTypeIcon: React.FC<{ type: MemberType }> = ({ type }) => {
  switch (type) {
    case 'user': return <Users size={16} className="mr-2 text-blue-500" />;
    case 'agent': return <Bot size={16} className="mr-2 text-green-500" />;
    case 'team': return <Building size={16} className="mr-2 text-purple-500" />;
    default: return null;
  }
};

const RoomMemberManager: React.FC<RoomMemberManagerProps> = ({ roomId }) => {
  const { members, loading, error, fetchMembers, addMember, removeMember } = useRoomMembers(roomId);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newMemberId, setNewMemberId] = useState('');
  const [newMemberType, setNewMemberType] = useState<MemberType>('user');
  const [isAdding, setIsAdding] = useState(false);
  const [isRemoving, setIsRemoving] = useState<string | null>(null); // Store ID of member being removed

  // Fetch members when component mounts or roomId changes
  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleAddMember = async () => {
    if (!newMemberId.trim()) return;
    setIsAdding(true);
    const success = await addMember(newMemberType, newMemberId.trim());
    setIsAdding(false);
    if (success) {
      setNewMemberId('');
      // Keep member type selected
      setIsAddDialogOpen(false);
    } // Error handled in hook
  };

  const handleRemoveMember = async (memberEntryId: string) => {
    setIsRemoving(memberEntryId);
    await removeMember(memberEntryId);
    setIsRemoving(null);
    // Error handled in hook
  };

  return (
    <div className="space-y-4">
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">
            <UserPlus size={16} className="mr-2" /> Add Member
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Member</DialogTitle>
            <DialogDescription>Enter the ID and select the type of the member to add.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="member-type" className="text-right">Type</Label>
              <Select value={newMemberType} onValueChange={(value: string) => setNewMemberType(value as MemberType)}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select member type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="agent">Agent</SelectItem>
                  <SelectItem value="team">Team</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="member-id" className="text-right">Member ID</Label>
              <Input
                id="member-id"
                value={newMemberId}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMemberId(e.target.value)}
                className="col-span-3"
                placeholder="Enter User, Agent, or Team UUID"
              />
            </div>
            {/* TODO: Implement user/agent/team search instead of raw ID input */}
          </div>
          <DialogFooter>
            <Button type="button" onClick={handleAddMember} disabled={isAdding || !newMemberId.trim()}>
              {isAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Add Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Member List */}
      <div className="border rounded-md">
        {loading && <div className="p-4 text-center"><Loader2 className="animate-spin" /> Loading members...</div>}
        {error && <div className="p-4 text-red-600">Error loading members: {error}</div>}
        {!loading && members.length === 0 && <div className="p-4 text-gray-500">No members found.</div>}
        {!loading && members.length > 0 && (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {members.map((member) => (
              <li key={member.id} className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800">
                <div className="flex items-center space-x-3">
                  <Avatar className="w-8 h-8">
                     <AvatarImage src={member.member_type === 'user' ? member.user_avatar_url || undefined : undefined} />
                     <AvatarFallback>
                       <MemberTypeIcon type={member.member_type} />
                     </AvatarFallback>
                   </Avatar>
                   <div>
                    <span className="font-medium text-sm">
                      {member.user_full_name || member.agent_name || member.team_name || member.member_id}
                    </span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">
                      {member.member_type} - Added: {new Date(member.added_at).toLocaleDateString()}
                    </span>
                   </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveMember(member.id)}
                  disabled={isRemoving === member.id}
                  className="text-gray-400 hover:text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20"
                >
                  {isRemoving === member.id ? <Loader2 size={16} className="animate-spin"/> : <Trash2 size={16} />}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default RoomMemberManager; 