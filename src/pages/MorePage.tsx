import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Settings, 
  User, 
  FileText, 
  Shield, 
  HelpCircle, 
  Info,
  Bell,
  Palette,
  Download,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { MobileHeader } from '@/components/mobile/MobileHeader';
import { cn } from '@/lib/utils';

interface MenuItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  path: string;
  badge?: string;
  adminOnly?: boolean;
}

const menuSections = [
  {
    title: 'Account',
    items: [
      {
        id: 'profile',
        label: 'Profile',
        description: 'Manage your account',
        icon: User,
        path: '/profile'
      },
      {
        id: 'settings',
        label: 'Settings',
        description: 'App preferences',
        icon: Settings,
        path: '/settings'
      },
      {
        id: 'notifications',
        label: 'Notifications',
        description: 'Manage notifications',
        icon: Bell,
        path: '/notifications'
      }
    ]
  },
  {
    title: 'Features',
    items: [
      {
        id: 'datastores',
        label: 'Datastores',
        description: 'Knowledge management',
        icon: FileText,
        path: '/datastores'
      },
      {
        id: 'reasoning',
        label: 'Reasoning Styles',
        description: 'Configure AI reasoning',
        icon: Sparkles,
        path: '/reasoning'
      },
      {
        id: 'appearance',
        label: 'Appearance',
        description: 'Theme and display',
        icon: Palette,
        path: '/appearance'
      }
    ]
  },
  {
    title: 'Admin',
    items: [
      {
        id: 'admin',
        label: 'Admin Panel',
        description: 'System management',
        icon: Shield,
        path: '/admin',
        adminOnly: true
      }
    ]
  },
  {
    title: 'Support',
    items: [
      {
        id: 'help',
        label: 'Help & Support',
        description: 'Get assistance',
        icon: HelpCircle,
        path: '/help'
      },
      {
        id: 'about',
        label: 'About',
        description: 'App information',
        icon: Info,
        path: '/about'
      }
    ]
  }
];

export function MorePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleItemClick = (path: string) => {
    navigate(path);
  };

  return (
    <div className="flex flex-col h-screen-mobile bg-background">
      <MobileHeader title="More" showMenu={false} />

      <div className="flex-1 overflow-y-auto momentum-scroll pb-20">
        {menuSections.map((section) => {
          const visibleItems = section.items.filter(
            (item) => !item.adminOnly || user?.role?.includes('admin')
          );

          if (visibleItems.length === 0) return null;

          return (
            <div key={section.title} className="mb-6">
              <h2 className="text-sm font-semibold text-muted-foreground px-4 py-2 uppercase tracking-wider">
                {section.title}
              </h2>
              <div className="bg-card mx-4 rounded-lg border border-border overflow-hidden">
                {visibleItems.map((item, index) => {
                  const Icon = item.icon;
                  const isLast = index === visibleItems.length - 1;

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleItemClick(item.path)}
                      className={cn(
                        'w-full flex items-center justify-between p-4',
                        'touch-target transition-colors duration-200',
                        'hover:bg-accent active:bg-accent',
                        !isLast && 'border-b border-border'
                      )}
                    >
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Icon className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <div className="flex items-center space-x-2">
                            <p className="font-medium text-foreground">
                              {item.label}
                            </p>
                            {item.badge && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-primary text-primary-foreground rounded-full">
                                {item.badge}
                              </span>
                            )}
                          </div>
                          {item.description && (
                            <p className="text-sm text-muted-foreground truncate">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 ml-2" />
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* App Version */}
        <div className="px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Gofr Agents v1.0.0
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            PWA Mode Active
          </p>
        </div>
      </div>
    </div>
  );
}

