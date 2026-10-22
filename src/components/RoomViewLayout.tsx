import React from 'react';
import { Outlet, useParams } from 'react-router-dom';
import ChannelListSidebar from './ChannelListSidebar'; // Placeholder import
import RoomListSidebar from './RoomListSidebar'; // Import room list sidebar
import { Header } from './Header'; // Use named import

const RoomViewLayout: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();

  // Basic validation or loading state for roomId if needed
  if (!roomId) {
    // Optionally return a loading state or redirect
    return <div>Loading room...</div>; 
  }

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <RoomListSidebar /> {/* Always show the room list */}
      <ChannelListSidebar roomId={roomId} /> {/* Show channel list for the current room */}
      
      {/* Main Content Area for the selected room/channel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Can potentially have a room-specific header here later */}
        {/* <Header roomTitle={roomDetails?.name} /> */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-200 dark:bg-gray-800 p-6">
          {/* Outlet will render the nested route component (e.g., ChatChannelPage) */}
          <Outlet /> 
        </main>
      </div>
    </div>
  );
};

export default RoomViewLayout; 