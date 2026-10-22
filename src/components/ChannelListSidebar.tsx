import React, { useState, useEffect } from 'react';
import { NavLink, useParams, Link } from 'react-router-dom';
import { Hash, Plus, Loader2, AlertTriangle, ArrowLeft } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { supabase } from '@/lib/supabase';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from '@/contexts/AuthContext';
import type { ChatChannel } from '@/hooks/useChatChannels';

interface ChannelListSidebarProps {
  workspaceId: string;
  channels: ChatChannel[];
  loading: boolean;
  currentChannelId?: string | null;
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  workspaceName: string;
}

const ChannelListSidebar: React.FC<ChannelListSidebarProps> = ({
  workspaceId,
  channels,
  loading: channelsLoading,
  currentChannelId,
  isOpen,
  setIsOpen,
  workspaceName,
}) => {
  const { user, signOut } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelTopic, setNewChannelTopic] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreateChannel = async () => {
    if (!newChannelName.trim() || !user?.id || !workspaceId) {
        setCreateError('Channel name, user session, and workspace ID are required.');
        return;
    }
    setIsCreating(true);
    setCreateError(null);
    try {
      const { data, error } = await supabase
        .from('chat_channels')
        .insert({
          name: newChannelName.trim(),
          topic: newChannelTopic.trim() || null,
          workspace_id: workspaceId,
          created_by_user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        console.log('Channel created:', data);
        setNewChannelName('');
        setNewChannelTopic('');
        setIsCreateDialogOpen(false);
      } else {
        throw new Error('Channel creation returned no data.');
      }
    } catch (err: any) {
      console.error("Error creating channel:", err);
      setCreateError(err.message || 'Failed to create channel.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className={`
        fixed md:relative top-0 left-0 h-full z-40 
        w-64 
        bg-card text-card-foreground border-r 
        transition-transform duration-200 ease-in-out transform 
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
        md:translate-x-0 md:shadow-none shadow-lg 
        flex flex-col
      `}
    >
      <div 
        className="block px-4 h-16 flex items-center justify-between border-b shadow-sm"
      >
         <Button 
           variant="ghost" 
           size="icon" 
           className="md:hidden mr-2" 
           onClick={() => setIsOpen(false)}
         >
           <ArrowLeft className="h-5 w-5" />
         </Button>
        <h2 className="text-lg font-semibold truncate grow" title={workspaceName || 'Workspace'}>
            {workspaceName || 'Workspace'}
        </h2>
       
      </div>

              <div className="flex-1 flex flex-col pt-3 px-2 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-card">
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
             <Button variant="ghost" size="sm" className="w-full justify-start mb-1 text-muted-foreground hover:bg-muted hover:text-foreground">
              <Plus size={16} className="mr-2" /> Create Channel
            </Button>
          </DialogTrigger>
           <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Channel</DialogTitle>
              <DialogDescription>Enter details for the new channel in this workspace.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
               <div className="grid grid-cols-4 items-center gap-4">
                 <Label htmlFor="channel-name" className="text-right">Name</Label>
                 <Input
                   id="channel-name"
                   value={newChannelName}
                   onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewChannelName(e.target.value)}
                   className="col-span-3"
                   placeholder="e.g., general"
                 />
               </div>
               <div className="grid grid-cols-4 items-center gap-4">
                 <Label htmlFor="channel-topic" className="text-right">Topic</Label>
                 <Input
                   id="channel-topic"
                   value={newChannelTopic}
                   onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewChannelTopic(e.target.value)}
                   className="col-span-3"
                   placeholder="(Optional)"
                 />
               </div>
            </div>
            {createError && <p className='text-sm text-destructive px-1'>{createError}</p>}
            <DialogFooter>
              <Button type="button" onClick={handleCreateChannel} disabled={isCreating || !newChannelName.trim()}>
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create Channel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {channelsLoading && <Loader2 className="animate-spin text-muted-foreground mx-auto my-4" />}
        {!channelsLoading && channels.length === 0 && (
          <p className="text-muted-foreground text-sm px-2">No channels yet.</p>
        )}
        {channels.map((channel) => (
          <NavLink
            key={channel.id}
            to={`/workspaces/${workspaceId}/channels/${channel.id}`}
            className={({ isActive }): string => 
               `flex items-center px-2 py-1.5 rounded text-sm font-medium transition-colors duration-150 ease-in-out group 
                ${
                  isActive || currentChannelId === channel.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`
            }
            onClick={() => setIsOpen(false)}
          >
            <Hash size={16} className="mr-2 text-gray-500 group-hover:text-gray-400" />
            <span className="truncate">{channel.name}</span>
          </NavLink>
        ))}
      </div>
    </div>
  );
};

export default ChannelListSidebar; 