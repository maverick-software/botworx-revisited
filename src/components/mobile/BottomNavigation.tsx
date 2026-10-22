import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Bot, Users, Menu, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  path: string;
}

const navItems: NavItem[] = [
  {
    id: 'chat',
    label: 'Chat',
    icon: Home,
    path: '/chat'
  },
  {
    id: 'agents',
    label: 'Agents',
    icon: Bot,
    path: '/agents'
  },
  {
    id: 'teams',
    label: 'Teams',
    icon: Users,
    path: '/teams'
  }
];

interface BottomNavigationProps {
  // No longer need onMoreClick since we removed the More button
}

export function BottomNavigation({}: BottomNavigationProps) {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/chat') {
      return location.pathname === '/' || location.pathname === '/chat';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border bottom-nav-safe md:hidden"
      role="navigation"
      aria-label="Mobile bottom navigation"
    >
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <Link
              key={item.id}
              to={item.path}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full gap-1',
                'touch-target no-select transition-colors duration-200',
                active
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="w-6 h-6" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

