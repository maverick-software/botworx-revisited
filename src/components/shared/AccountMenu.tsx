/**
 * Shared Account Menu Component
 * Used in both main sidebar and admin sidebar
 * Provides user profile, settings, billing, and navigation options
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Settings, LogOut, HelpCircle, Crown, CreditCard, Shield,
  Key,
  Sun, Moon, Home, Palette, Check
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useTheme } from '@/contexts/ThemeContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PricingModal } from '@/components/billing/PricingModal';
import { UserProfileModal } from '@/components/modals/UserProfileModal';
import { LogoutConfirmDialog } from '@/components/modals/LogoutConfirmDialog';
import { supabase } from '@/lib/supabase';

interface AccountMenuProps {
  isCollapsed: boolean;
  isAdminArea?: boolean;
}

export function AccountMenu({ isCollapsed, isAdminArea = false }: AccountMenuProps) {
  const { user, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const { subscription, getStatusColor, getStatusIcon, isFreePlan } = useSubscription();
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [showUserProfileModal, setShowUserProfileModal] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [currentEmail, setCurrentEmail] = useState('');
  const [displayName, setDisplayName] = useState(user?.email?.split('@')[0] || 'User');
  const [initials, setInitials] = useState(user?.email?.substring(0, 2).toUpperCase() || '??');

  // Load fresh user data from session and profile on mount and when modal closes
  const loadCurrentEmail = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const email = session?.user?.email || '';
    console.log('[AccountMenu] Loaded email from session:', email);
    setCurrentEmail(email);
    
    // Fetch profile data for first_name and last_name
    if (session?.user?.id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', session.user.id)
        .single();
      
      if (profile?.first_name) {
        const firstName = profile.first_name;
        const lastInitial = profile.last_name ? profile.last_name.charAt(0).toUpperCase() : '';
        const displayNameStr = lastInitial ? `${firstName} ${lastInitial}.` : firstName;
        setDisplayName(displayNameStr);
        
        // Set initials for avatar
        const firstInitial = firstName.charAt(0).toUpperCase();
        const avatarInitials = lastInitial ? `${firstInitial}${lastInitial}` : `${firstInitial}${firstName.charAt(1)?.toUpperCase() || ''}`;
        setInitials(avatarInitials);
      } else {
        // Fallback to email
        setDisplayName(email.split('@')[0] || 'User');
        setInitials(email.substring(0, 2).toUpperCase() || '??');
      }
    }
  };

  // Load email on mount and when user changes
  useEffect(() => {
    if (user?.id) {
      loadCurrentEmail();
    }
  }, [user?.id]);

  // Refresh email when profile modal closes
  const handleProfileModalClose = () => {
    setShowUserProfileModal(false);
    loadCurrentEmail(); // Refresh email after modal closes
  };

  const getThemeIcon = (themeMode: 'light' | 'dark' | 'chatgpt') => {
    switch (themeMode) {
      case 'light':
        return <Sun className="h-4 w-4" />;
      case 'dark':
        return <Moon className="h-4 w-4" />;
      case 'chatgpt':
        return <Palette className="h-4 w-4" />;
    }
  };

  const getThemeLabel = (themeMode: 'light' | 'dark' | 'chatgpt') => {
    switch (themeMode) {
      case 'light':
        return 'Light';
      case 'dark':
        return 'Dark Blue';
      case 'chatgpt':
        return 'Dark Gray';
    }
  };

  const handleLogoutClick = () => {
    setShowLogoutDialog(true);
  };

  const handleConfirmLogout = async () => {
    setShowLogoutDialog(false);
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  };

  if (!user) return null;

  return (
    <>
      <div className="pb-2">
        <DropdownMenu onOpenChange={(open) => {
          if (open) {
            // Refresh email when dropdown opens to catch any changes
            loadCurrentEmail();
          }
        }}>
          <DropdownMenuTrigger asChild>
            <button 
              className={`w-full flex items-center gap-2 p-2 rounded-lg hover:bg-sidebar-accent transition-colors text-left ${
                isCollapsed ? 'justify-center' : ''
              }`}
              title={isCollapsed ? displayName : undefined}
            >
              <Avatar className="w-8 h-8 flex-shrink-0">
                <AvatarFallback className="bg-indigo-600 text-white text-sm">
                  {initials}
                </AvatarFallback>
              </Avatar>
              {!isCollapsed && (
                <span className="text-sm text-sidebar-foreground truncate">
                  {displayName}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
             className={`w-64 p-2 shadow-lg rounded-xl ${
               isAdminArea 
                 ? 'bg-gray-800 border-gray-600 text-gray-100' 
                 : 'bg-card border-border/50 text-foreground'
             }`}
             sideOffset={8} 
             align={isCollapsed ? "start" : "center"}
             alignOffset={isCollapsed ? 5 : 0}
          >
            {/* User Info Section - Clickable */}
            <div className={`px-3 py-3 mb-2 border-b ${
              isAdminArea ? 'border-gray-600' : 'border-border/50'
            }`}>
              {/* Theme Selector - Top Right */}
              <div className="flex justify-end mb-2">
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger 
                    className="p-1.5 hover:bg-accent rounded-md transition-colors cursor-pointer"
                    title="Change Theme"
                  >
                    <div className="text-muted-foreground hover:text-foreground">
                      {getThemeIcon(theme)}
                    </div>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-44 bg-card border-border/50 text-foreground shadow-lg rounded-xl">
                    <DropdownMenuItem 
                      onClick={() => setTheme('light')}
                      className="cursor-pointer focus:bg-accent/50 focus:text-accent-foreground rounded-md px-3 py-2"
                    >
                      <Sun className="mr-3 h-4 w-4 text-muted-foreground" />
                      <span className="text-sm flex-1">Light</span>
                      {theme === 'light' && <Check className="h-4 w-4 text-primary" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setTheme('dark')}
                      className="cursor-pointer focus:bg-accent/50 focus:text-accent-foreground rounded-md px-3 py-2"
                    >
                      <Moon className="mr-3 h-4 w-4 text-muted-foreground" />
                      <span className="text-sm flex-1">Dark Blue</span>
                      {theme === 'dark' && <Check className="h-4 w-4 text-primary" />}
                    </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => setTheme('chatgpt')}
                              className="cursor-pointer focus:bg-accent/50 focus:text-accent-foreground rounded-md px-3 py-2"
                            >
                              <Palette className="mr-3 h-4 w-4 text-muted-foreground" />
                              <span className="text-sm flex-1">Dark Gray</span>
                              {theme === 'chatgpt' && <Check className="h-4 w-4 text-primary" />}
                            </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </div>

              <DropdownMenuItem 
                onClick={() => setShowUserProfileModal(true)}
                className="cursor-pointer focus:bg-accent/50 focus:text-accent-foreground rounded-md px-0 py-2 w-full"
              >
                <div className="flex items-center gap-3 w-full">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-sm">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {displayName}
                    </p>
                    <div className="mt-1">
                      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${getStatusColor()}`}>
                        <span className="text-xs">{getStatusIcon()}</span>
                        <span className="truncate">{subscription?.display_name || 'Loading...'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </DropdownMenuItem>
            </div>

            {/* Main Menu Items */}
            <div className="space-y-1 mb-3">

              {/* Settings with Submenu */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="cursor-pointer focus:bg-accent/50 focus:text-accent-foreground rounded-md px-3 py-2">
                  <Settings className="mr-3 h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Settings</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-48 bg-card border-border/50 text-foreground shadow-lg rounded-xl">
                  <DropdownMenuItem asChild className="cursor-pointer focus:bg-accent/50 focus:text-accent-foreground rounded-md px-3 py-2">
                    <Link to="/settings" className="flex items-center w-full">
                      <Settings className="mr-3 h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">General Settings</span>
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuItem asChild className="cursor-pointer focus:bg-accent/50 focus:text-accent-foreground rounded-md px-3 py-2">
                    <Link to="/credentials" className="flex items-center w-full">
                      <Key className="mr-3 h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Credentials</span>
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              
              <DropdownMenuItem className="cursor-pointer focus:bg-accent/50 focus:text-accent-foreground rounded-md px-3 py-2">
                <HelpCircle className="mr-3 h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Get help</span>
              </DropdownMenuItem>
            </div>

            {/* Billing & Plans Section */}
            <div className={`pt-3 mb-3 border-t ${
              isAdminArea ? 'border-gray-600' : 'border-border/50'
            }`}>
              <DropdownMenuItem asChild className="cursor-pointer focus:bg-accent/50 focus:text-accent-foreground rounded-md px-3 py-2">
                <Link to="/billing" className="flex items-center w-full">
                  <CreditCard className="mr-3 h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Billing & Plans</span>
                </Link>
              </DropdownMenuItem>
              
              {(isFreePlan || subscription?.status !== 'active') && (
                <DropdownMenuItem 
                  onClick={() => setShowPricingModal(true)} 
                  className="cursor-pointer focus:bg-accent/50 focus:text-accent-foreground rounded-md px-3 py-2"
                >
                  <Crown className="mr-3 h-4 w-4 text-blue-500" />
                  <span className="text-sm">Upgrade plan</span>
                </DropdownMenuItem>
              )}
            </div>

            {/* Admin Portal - Highlighted - Only show for admins not in admin area */}
            {isAdmin && !isAdminArea && (
              <div className={`pt-3 mb-3 border-t ${
                isAdminArea ? 'border-gray-600' : 'border-border/50'
              }`}>
                <DropdownMenuItem asChild className="cursor-pointer focus:bg-purple-50 dark:focus:bg-purple-900/20 focus:text-purple-600 dark:focus:text-purple-400 rounded-md px-3 py-2 bg-purple-50/50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800">
                  <Link to="/admin" className="flex items-center w-full">
                    <Shield className="mr-3 h-4 w-4 text-purple-600 dark:text-purple-400" />
                    <span className="text-sm font-medium text-purple-600 dark:text-purple-400">Admin Portal</span>
                  </Link>
                </DropdownMenuItem>
              </div>
            )}

            {/* User Dashboard - Highlighted - Only show in admin area */}
            {isAdminArea && (
              <div className={`pt-3 mb-3 border-t ${
                isAdminArea ? 'border-gray-600' : 'border-border/50'
              }`}>
                <DropdownMenuItem asChild className="cursor-pointer focus:bg-purple-50 dark:focus:bg-purple-900/20 focus:text-purple-600 dark:focus:text-purple-400 rounded-md px-3 py-2 bg-purple-50/50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800">
                  <Link to="/" className="flex items-center w-full">
                    <Home className="mr-3 h-4 w-4 text-purple-600 dark:text-purple-400" />
                    <span className="text-sm font-medium text-purple-600 dark:text-purple-400">User Dashboard</span>
                  </Link>
                </DropdownMenuItem>
              </div>
            )}

            {/* Logout */}
            <div className={`pt-3 border-t ${
              isAdminArea ? 'border-gray-600' : 'border-border/50'
            }`}>
              <DropdownMenuItem onClick={handleLogoutClick} className="cursor-pointer focus:bg-red-50 dark:focus:bg-red-900/20 focus:text-red-600 dark:focus:text-red-400 rounded-md px-3 py-2">
                <LogOut className="mr-3 h-4 w-4" />
                <span className="text-sm">Log out</span>
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Modals */}
      <PricingModal
        isOpen={showPricingModal}
        onClose={() => setShowPricingModal(false)}
        currentPlan={subscription?.plan_name || 'free'}
        onPlanSelect={(planName) => {
          console.log('Selected plan:', planName);
          setShowPricingModal(false);
        }}
      />

      <UserProfileModal
        isOpen={showUserProfileModal}
        onClose={handleProfileModalClose}
      />

      <LogoutConfirmDialog
        isOpen={showLogoutDialog}
        onClose={() => setShowLogoutDialog(false)}
        onConfirm={handleConfirmLogout}
        userEmail={user?.email}
      />
    </>
  );
}
