import React from 'react';
import { Link } from 'react-router-dom';
import { FolderKanban } from 'lucide-react'; // Or choose another relevant icon
// Remove Button import if not used directly anymore
// import { Button } from '@/components/ui/button';
import type { Workspace } from '@/pages/WorkspacesListPage';

interface WorkspaceCardProps {
  workspace: Workspace;
  // Index is removed as animation is removed to match TeamCard
}

const WorkspaceCard: React.FC<WorkspaceCardProps> = ({ workspace }) => {
  return (
    // Make the whole card a link
    <Link
      to={`/workspaces/${workspace.id}`}
      // Apply similar styling and hover effect as TeamCard
      className="block bg-gray-800 hover:bg-gray-700 rounded-lg p-4 shadow transition-colors duration-200"
      // Remove inline style for animation
    >
      {/* Use flex layout similar to TeamCard */}
      <div className="flex items-start space-x-3">
        {/* Icon */}
        <div className="bg-indigo-500 p-2 rounded-lg">
          <FolderKanban className="w-5 h-5 text-white" />
        </div>
        {/* Text content */}
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white truncate" title={workspace.name}>
            {workspace.name}
          </h3>
          {/* Consider adding description if needed/available */}
          {/* <p className="text-sm text-gray-400 mt-1 line-clamp-2" title={workspace.description || ''}>
            {workspace.description || 'No description'}
          </p> */}
          <p className="text-sm text-gray-400 mt-1">
            Created: {new Date(workspace.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>
      {/* Removed the explicit Button */}
    </Link>
  );
};

export default WorkspaceCard; 