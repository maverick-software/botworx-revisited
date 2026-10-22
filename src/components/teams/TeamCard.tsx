import React from 'react';
import { Link } from 'react-router-dom';
import type { Team } from '../../types'; // Adjust path as necessary
import { Users } from 'lucide-react'; // Or another relevant icon

interface TeamCardProps {
  team: Team;
}

const TeamCard: React.FC<TeamCardProps> = ({ team }) => {
  return (
    <Link 
      to={`/teams/${team.id}`}
      className="block bg-card hover:bg-accent/50 border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-200"
    >
      <div className="flex items-start space-x-4">
        <div className="bg-primary/10 p-3 rounded-xl flex-shrink-0">
            <Users className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-card-foreground truncate mb-2" title={team.name}>
              {team.name}
            </h3>
            <p className="text-sm text-muted-foreground line-clamp-2" title={team.description || ''}>
              {team.description || 'No description available.'}
            </p>
        </div>
      </div>
      {/* Optional: Add more details like member count later */}
    </Link>
  );
};

export default TeamCard; 