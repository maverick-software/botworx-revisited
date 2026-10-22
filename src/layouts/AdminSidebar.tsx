import React from 'react';
import { NavLink } from 'react-router-dom';
// Replace Heroicons with Lucide icons
import { 
  LayoutDashboard, 
  Users, 
  Bot,
  Settings,
  FileText,
  PanelLeftClose, 
  PanelRightClose 
} from 'lucide-react';
import { AccountMenu } from '@/components/shared/AccountMenu';
import { Logo } from '../components/ui/logo';

// Define props for the component
interface AdminSidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
}

const navigation = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { name: 'Users', href: '/admin/users', icon: Users },
    { name: 'Agents', href: '/admin/agents', icon: Bot }, 
    { name: 'System Prompts', href: '/admin/prompts', icon: FileText },
    { name: 'Settings', href: '/admin/settings', icon: Settings },
];

function classNames(...classes: string[]) {
    return classes.filter(Boolean).join(' ');
}

// Accept props
export const AdminSidebar: React.FC<AdminSidebarProps> = ({ isCollapsed, setIsCollapsed }) => {
    return (
        // Match user sidebar styling exactly
        <nav 
            className={`relative flex flex-col bg-sidebar-background border-r border-sidebar-border h-full overflow-y-hidden transition-all duration-300 ease-in-out ${isCollapsed ? 'w-12 p-1' : 'w-64 p-2'}`}
        >
            {/* Match user sidebar structure exactly */}
            <div className="flex-1 mb-2 flex flex-col min-h-0 overflow-y-auto">
                <div>
                    {/* Logo/Title section - match user sidebar exactly */}
                    <div className={`flex items-center mb-3 mt-1 transition-all duration-300 ${isCollapsed ? 'justify-center mt-4' : 'justify-between px-2'}`}>
                        <div className="flex items-center gap-2">
                            <Logo 
                                size={isCollapsed ? 'sm' : 'md'}
                                variant="icon"
                                showText={false}
                            />
                            {!isCollapsed && (
                                <>
                                    <span className="text-base text-sidebar-foreground">
                                        <span className="font-semibold">Gofr</span> <span className="font-light">Labs</span>
                                    </span>
                                    <span className="px-2 py-0.5 text-xs font-medium bg-green-500/10 text-green-500 border border-green-500/20 rounded">
                                        Admin
                                    </span>
                                </>
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
                    
                    {/* Navigation Links - match user sidebar spacing */}
                    <ul role="list" className="space-y-1">
                        {navigation.map((item) => (
                            <li key={item.name}>
                                <NavLink
                                    to={item.href}
                                    title={isCollapsed ? item.name : undefined}
                                    className={({ isActive }) =>
                                        `flex items-center rounded-md transition-colors duration-200 ${
                                            isCollapsed ? 'px-2 justify-center py-2.5' : 'px-3 py-2 space-x-3'
                                        } ${
                                            isActive 
                                                ? 'bg-sidebar-primary text-sidebar-primary-foreground' 
                                                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                                        }`
                                    }
                                >
                                    <item.icon className="w-5 h-5 shrink-0" aria-hidden="true" />
                                    {!isCollapsed && (
                                        <span className="font-medium text-sm">{item.name}</span>
                                    )}
                                </NavLink>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
            
            {/* Bottom section - match user sidebar exactly */}
            {isCollapsed && (
                <div className="mt-auto">
                    <button 
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="w-full text-sidebar-foreground/60 hover:text-sidebar-foreground p-2 rounded hover:bg-sidebar-accent transition-colors duration-200 flex justify-center"
                        title="Expand Sidebar"
                    >
                        <PanelRightClose size={20} />
                    </button>
                </div>
            )}
            
            {/* Account Menu - match user sidebar exactly */}
            <div className="border-t border-sidebar-border/50 pt-2 px-2 pb-2">
                <AccountMenu isCollapsed={isCollapsed} isAdminArea={true} />
            </div>
        </nav>
    );
}; 