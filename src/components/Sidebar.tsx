import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation, Link } from 'react-router-dom';
import { 
  Users, Settings,
  LogOut, Bot, PanelLeftClose, PanelRightClose,
  ChevronDown, ChevronRight,
  GitBranch, FolderKanban,
  User as UserIcon,
  Server, Key, Zap, Plus,
  MoreVertical, Pencil, Archive, Trash2,
  Network, FileText, HelpCircle, Crown, CreditCard, Shield,
  MessageCircle, Brain, Building2, Plug
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useAgents } from '../hooks/useAgents';
import { CreateAgentWizard } from './CreateAgentWizard';
import { AccountMenu } from './shared/AccountMenu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Logo } from './ui/logo';

// Define type for a single navigation item, allowing for children
interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  children?: NavItem[];
  adminOnly?: boolean;
  isCustom?: boolean; // For special handling of Agents and Teams
}

// Helper function to get icon color class based on route or label
const getIconColorClass = (route: string, label: string): string => {
  // Map routes/labels to Tailwind icon color classes
  if (route === '/' || label === 'Dashboard') return 'text-icon-dashboard';
  if (route === '/agents' || label === 'Agents') return 'text-icon-agents';
  if (route === '/datastores' || label === 'Library') return 'text-icon-memory';
  if (route === '/knowledge' || label === 'Knowledge') return 'text-icon-memory';
  if (route === '/workflows' || label === 'Workflows') return 'text-icon-workflows';
  if (route === '/automations' || label === 'Automations') return 'text-icon-workflows';
  if (route === '/integrations' || label === 'Integrations') return 'text-icon-integrations';
  if (route === '/credentials' || label === 'Credentials') return 'text-icon-credentials';
  if (route === '/teams' || label === 'Teams') return 'text-icon-teams';
  if (route === '/workspaces' || label === 'Workspaces') return 'text-icon-workspaces';
  if (route === '/projects' || label === 'Projects') return 'text-icon-projects';
  if (route === '/settings' || label === 'Settings') return 'text-icon-settings';
  if (route === '/monitoring' || label === 'Monitoring') return 'text-icon-monitoring';
  if (route === '/contacts' || label === 'Contacts') return 'text-icon-integrations';
  if (route === '/media-library' || label === 'Media Library') return 'text-icon-memory';
  if (route === '/mcp-servers' || label === 'MCP Servers') return 'text-icon-integrations';
  
  // Default to sidebar foreground color
  return 'text-sidebar-foreground';
};

// Updated navigation structure with organized hierarchical nesting
const navItems: NavItem[] = [
  // NOTE: "New chat" removed - users should create and chat with their own agents
  // The system agent (Gofr) is not exposed via the main navigation
  // { 
  //   to: '/chat', 
  //   icon: SquarePen, 
  //   label: 'New chat',
  //   isCustom: false
  // },
  { 
    to: '/agents', 
    icon: Users, 
    label: 'Agents',
    isCustom: true
  },
  { 
    to: '/teams', 
    icon: Building2, 
    label: 'Teams',
    isCustom: false
  },
  { 
    to: '/integrations', 
    icon: Plug, 
    label: 'Integrations',
    isCustom: false
  },
  { 
    to: '/credentials', 
    icon: Key, 
    label: 'Credentials',
    isCustom: false
  },
  { 
    to: '/media', 
    icon: FileText, 
    label: 'Library',
    isCustom: false
  },
  { 
    to: '/graph-settings', 
    icon: Brain, 
    label: 'Knowledge',
    isCustom: false
  },
];

// Component to render a single NavLink or a collapsible parent item
const NavItemRenderer: React.FC<{ item: NavItem; isCollapsed: boolean; level?: number }> = ({ item, isCollapsed, level = 0 }) => {
  const location = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);

  // Check if the current path matches the item's path or any of its children's paths
  const isActiveOrParent = location.pathname === item.to || (item.children?.some(child => location.pathname.startsWith(child.to)) ?? false);

  // Determine if the item should be expanded initially (if it or a child is active)
  React.useEffect(() => {
    if (isActiveOrParent) {
      setIsExpanded(true);
    }
    // Optionally collapse when navigating away, depends on desired UX
    // else {
    //   setIsExpanded(false);
    // }
  }, [isActiveOrParent]);

  if (item.children && !isCollapsed) {
    return (
      <div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`flex items-center w-full space-x-2 rounded-md transition-colors px-3 py-2 hover:bg-sidebar-accent text-sm ${
            isActiveOrParent ? 'bg-sidebar-accent/50' : '' // Subtle highlight for active parent
          }`}
          style={{ paddingLeft: `${1 + level * 1.5}rem` }} // Indentation for submenus
        >
          <item.icon className={`w-4 h-4 flex-shrink-0 ${getIconColorClass(item.to, item.label)}`} />
          <span className="font-normal flex-1 text-left truncate text-sidebar-foreground">{item.label}</span>
          {isExpanded ? <ChevronDown size={16} className="text-sidebar-foreground" /> : <ChevronRight size={16} className="text-sidebar-foreground" />}
        </button>
        {isExpanded && (
          <div className="mt-1 space-y-1">
            {item.children.map((child) => (
              <NavItemRenderer key={child.to} item={child} isCollapsed={isCollapsed} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  } else {
    // Render standard NavLink for top-level items (when collapsed or no children) or child items
    return (
      <NavLink
        key={item.to}
        to={item.to}
        title={isCollapsed ? item.label : undefined}
        className={({ isActive }): string =>
          `flex items-center space-x-2 rounded-md transition-colors text-sm ${
            isCollapsed
              ? 'px-2 justify-center py-2' // Collapsed style
              : level > 0 
                ? 'py-1.5 px-3' // Child item style (not collapsed)
                : 'px-3 py-2' // Top-level item style (not collapsed)
          } ${
            isActive
              ? 'bg-sidebar-accent/20'
              : 'hover:bg-sidebar-accent'
          }`
        }
        style={!isCollapsed ? { paddingLeft: `${1 + level * 1.5}rem` } : {}}
      >
        <item.icon className={`w-4 h-4 flex-shrink-0 ${getIconColorClass(item.to, item.label)}`} />
        {!isCollapsed && <span className="font-normal truncate text-sidebar-foreground">{item.label}</span>}
      </NavLink>
    );
  }
};

// Simplified Agents navigation - just the main link
const AgentsNavRenderer: React.FC<{ isCollapsed: boolean; level?: number }> = ({ isCollapsed, level = 0 }) => {
  if (isCollapsed) {
    return (
      <NavLink
        to="/agents"
        title="Agents"
        className={({ isActive }): string =>
          `flex items-center space-x-2 rounded-md transition-colors px-2 justify-center py-2 text-sm ${
            isActive
              ? 'bg-sidebar-accent/20 text-sidebar-foreground'
              : 'text-sidebar-foreground hover:bg-sidebar-accent'
          }`
        }
      >
        <Users className={`w-5 h-5 flex-shrink-0 ${getIconColorClass('/agents', 'Agents')}`} />
      </NavLink>
    );
  }

  return (
    <NavLink
      to="/agents"
      className={({ isActive }): string =>
        `flex items-center space-x-2 rounded-md transition-colors px-3 py-2 text-sm ${
          isActive
            ? 'bg-sidebar-accent/30 text-sidebar-foreground'
            : 'text-sidebar-foreground hover:bg-sidebar-accent'
        }`
      }
      style={{ paddingLeft: `${1 + level * 1.5}rem` }}
    >
      <Users className={`w-5 h-5 flex-shrink-0 ${getIconColorClass('/agents', 'Agents')}`} />
      <span className="font-normal truncate">Agents</span>
    </NavLink>
  );
};



// Update props interface
interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
}

export function Sidebar({ isCollapsed, setIsCollapsed }: SidebarProps) {
  const { user } = useAuth();
  const location = useLocation();
  const [showCreateAgentModal, setShowCreateAgentModal] = useState(false);

  // Filter nav items based on admin status - no longer needed for the main list
  // const visibleNavItems = navItems.filter(item => !item.adminOnly || isAdmin);
  // Use the full navItems list now
  const visibleNavItems = navItems; 


  return (
    <nav 
      className={`relative flex flex-col bg-sidebar-background border-r border-sidebar-border h-full overflow-y-hidden transition-all duration-300 ease-in-out ${isCollapsed ? 'w-12 p-1' : 'w-64 p-2'}`}
    >
      <div className="flex-1 mb-2 flex flex-col min-h-0 overflow-y-auto">
        <div>
          <div className={`flex items-center mb-3 mt-1 transition-all duration-300 ${isCollapsed ? 'justify-center mt-4' : 'justify-between px-2'}`}>
            <div className="flex items-center">
              <Logo
                size={isCollapsed ? 'sm' : 'md'}
                variant="icon"
                showText={false}
              />
              {!isCollapsed && (
                <span className="ml-2 text-base text-sidebar-foreground">
                  <span className="font-semibold">Gofr</span> <span className="font-light">Labs</span>
                </span>
              )}
            </div>
            {!isCollapsed && (
              <button 
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="text-sidebar-foreground/60 hover:text-sidebar-foreground p-1 rounded hover:bg-sidebar-accent transition-colors duration-200"
                title="Collapse Sidebar"
              >
                <PanelLeftClose size={20} />
              </button>
            )}
          </div>
          
          {/* Subtle separator line */}
          <div className="border-b border-sidebar-border/30 mb-3"></div>
          
          <div className="space-y-1">
            {visibleNavItems.map((item) => {
              if (item.isCustom && item.label === 'Agents') {
                return <AgentsNavRenderer key={item.to} isCollapsed={isCollapsed} />;
              } else {
                return <NavItemRenderer key={item.to} item={item} isCollapsed={isCollapsed} />;
              }
            })}
          </div>
        </div>

        {/* Show expand button at bottom when collapsed */}
        {isCollapsed && (
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="mt-auto text-sidebar-foreground/60 hover:text-sidebar-foreground p-1 rounded hover:bg-sidebar-accent transition-colors duration-200 mb-2 self-center"
            title="Expand Sidebar"
          >
            <PanelRightClose size={20} />
          </button>
        )}
      </div>

      {user && !isCollapsed && (
        <>
          {/* Account Menu */}
          <div className="border-t border-sidebar-border/50 pt-2 px-2 pb-2">
            <AccountMenu isCollapsed={isCollapsed} isAdminArea={false} />
          </div>
        </>
      )}
      
      {user && isCollapsed && (
        <div className="border-t border-sidebar-border/50 pt-2 mt-2 px-2">
          <AccountMenu isCollapsed={isCollapsed} isAdminArea={false} />
        </div>
      )}

      {/* Create Agent Wizard */}
      <CreateAgentWizard 
        open={showCreateAgentModal} 
        onOpenChange={setShowCreateAgentModal} 
      />
    </nav>
  );
}