import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Plus, Loader2, MessageSquare } from 'lucide-react'; // Using MessageSquare instead of Server for chat rooms
import { useChatRooms } from '../hooks/useChatRooms';
import { Button } from '@/components/ui/button';
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

const RoomListSidebar: React.FC = () => {
  const { chatRooms, loading, error, createChatRoom } = useChatRooms();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return;
    setIsCreating(true);
    const newRoom = await createChatRoom(newRoomName);
    setIsCreating(false);
    if (newRoom) {
      setNewRoomName('');
      setIsCreateDialogOpen(false);
    }
  };

  // Generate room icon or use first letter of room name
  const getRoomIcon = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  return (
    <div className="w-64 bg-gray-700 h-full flex flex-col py-4 px-3 border-r border-gray-600">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <MessageSquare className="text-indigo-400 w-5 h-5 mr-2" />
          <h2 className="text-lg font-medium text-white">Chat Rooms</h2>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon"
              className="h-8 w-8 rounded-full bg-gray-600 hover:bg-indigo-500 text-gray-200"
              title="Create New Room"
            >
              <Plus size={16} />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] bg-gray-800 text-white border-gray-700">
            <DialogHeader>
              <DialogTitle className="text-white">Create New Chat Room</DialogTitle>
              <DialogDescription className="text-gray-400">
                Enter a name for your new chat room.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="room-name" className="text-right text-gray-300">
                  Name
                </Label>
                <Input
                  id="room-name"
                  value={newRoomName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewRoomName(e.target.value)}
                  className="col-span-3 bg-gray-700 border-gray-600 text-white"
                  placeholder="e.g., Marketing Team"
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                type="button"
                onClick={handleCreateRoom}
                disabled={isCreating || !newRoomName.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} 
                Create Room
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Room List with improved design */}
              <div className="flex-1 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-border">
        {loading && !chatRooms.length && (
          <div className="flex justify-center py-4">
            <Loader2 className="animate-spin text-indigo-400 w-6 h-6" />
          </div>
        )}
        
        {error && (
          <div className="text-red-400 text-sm px-2 py-1 bg-red-900/20 rounded-md">
            Failed to load chat rooms
          </div>
        )}
        
        {chatRooms.map((room) => (
          <NavLink
            key={room.id}
            to={`/rooms/${room.id}`}
            className={({ isActive }): string =>
              `flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors 
               ${isActive
                 ? 'bg-indigo-600 text-white'
                 : 'text-gray-300 hover:bg-gray-600 hover:text-white'
               }`
            }
          >
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-500/60 flex items-center justify-center mr-3">
              <span className="text-sm font-medium text-white">{getRoomIcon(room.name)}</span>
            </div>
            <span className="truncate">{room.name}</span>
          </NavLink>
        ))}
      </div>

      {/* Create Room Button - Alternative placement at bottom */}
      {!isCreateDialogOpen && chatRooms.length > 0 && (
        <div className="pt-2 mt-2 border-t border-gray-600">
          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            className="w-full flex items-center justify-center py-2 bg-gray-600 hover:bg-indigo-600 text-white"
          >
            <Plus size={16} className="mr-2" />
            <span>New Chat Room</span>
          </Button>
        </div>
      )}
    </div>
  );
};

export default RoomListSidebar; 