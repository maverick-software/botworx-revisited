import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTeamChatRooms } from '../../hooks/useTeamChatRooms';
import { Loader2, AlertCircle, MessageSquare } from 'lucide-react';

interface TeamChatRoomListProps {
  teamId: string;
}

export const TeamChatRoomList: React.FC<TeamChatRoomListProps> = ({ teamId }) => {
  const {
    chatRooms,
    loading,
    error,
    fetchTeamChatRooms,
  } = useTeamChatRooms();

  useEffect(() => {
    if (teamId) {
      fetchTeamChatRooms(teamId);
    }
  }, [teamId, fetchTeamChatRooms]);

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4 text-gray-300">Workspaces</h2>

      {loading && (
        <div className="flex justify-center items-center p-4">
            <Loader2 className="animate-spin h-6 w-6 text-indigo-400" />
        </div>
      )}
      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-400 p-3 rounded-md text-sm flex items-center">
          <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
          Error loading workspaces: {error.message}
        </div>
      )}
      {!loading && !error && chatRooms.length === 0 && (
        <div className="text-center py-6 px-4 border border-dashed border-gray-700 rounded-lg">
          <MessageSquare className="mx-auto h-8 w-8 text-gray-500" />
          <p className="mt-2 text-sm text-gray-400">This team is not part of any workspaces yet.</p>
          {/* TODO: Add button/link to create/add workspace? */}
        </div>
      )}

      {!loading && !error && chatRooms.length > 0 && (
        <ul className="space-y-3">
          {chatRooms.map(chatRoom => (
            <li key={chatRoom.id} className="bg-gray-800 p-3 rounded-md shadow flex justify-between items-center">
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-full bg-indigo-700 flex items-center justify-center text-white">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <span className="ml-3 text-gray-200">{chatRoom.name || 'Untitled Workspace'}</span>
              </div>
              <Link 
                to={`/chat/${chatRoom.id}`} 
                className="text-xs px-3 py-1 bg-indigo-600 hover:bg-indigo-500 transition-colors duration-200 rounded text-white"
              >
                Open
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}; 