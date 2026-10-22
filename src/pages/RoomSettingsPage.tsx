import React from 'react';
import { useParams } from 'react-router-dom';
import RoomMemberManager from '../components/RoomMemberManager'; // Placeholder import

const RoomSettingsPage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();

  if (!roomId) {
    return <div>Invalid Room ID.</div>;
  }

  // TODO: Fetch room details (like name) if needed for display/editing
  // const { roomDetails, loading, error } = useRoomDetails(roomId);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Room Settings</h1>
      <p className="mb-4 text-gray-600 dark:text-gray-400">Room ID: {roomId}</p>

      {/* Placeholder for Room Name Editing */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Room Name</h2>
        {/* Add input and save button here later */} 
        <p className="text-gray-500 italic">(Name editing UI to be implemented)</p>
      </div>

      {/* Room Member Management */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Members</h2>
        <RoomMemberManager roomId={roomId} />
      </div>

      {/* Other settings sections can be added here */}
      
    </div>
  );
};

export default RoomSettingsPage; 