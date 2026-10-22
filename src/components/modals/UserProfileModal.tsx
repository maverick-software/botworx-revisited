/**
 * User Profile Modal Component
 * Allows users to view and edit their profile settings
 * Matches the theme and design patterns of other modals
 */

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  User, 
  Mail, 
  Calendar, 
  Save, 
  X, 
  Settings,
  Phone,
  Check,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/lib/supabase';
import { toast } from 'react-hot-toast';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UserProfile {
  id: string;
  email: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  mobile_number?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export function UserProfileModal({ isOpen, onClose }: UserProfileModalProps) {
  const { user } = useAuth();
  const { subscription, getStatusColor, getStatusIcon } = useSubscription();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [countryCode, setCountryCode] = useState('+1');
  const [mobileNumber, setMobileNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [usernameError, setUsernameError] = useState('');
  const [changingEmail, setChangingEmail] = useState(false);
  const [showEmailChangeModal, setShowEmailChangeModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailChangeError, setEmailChangeError] = useState('');
  const [currentEmail, setCurrentEmail] = useState('');

  // Country codes for North America with flag components
  const CountryFlag = ({ country }: { country: string }) => {
    const flags = {
      'US': (
        <svg className="w-5 h-4 rounded-sm" viewBox="0 0 640 480">
          <path fill="#bd3d44" d="M0 0h640v480H0"/>
          <path stroke="#fff" strokeWidth="37" d="M0 55.3h640M0 129h640M0 203h640M0 277h640M0 351h640M0 425h640"/>
          <path fill="#192f5d" d="M0 0h364.8v258.5H0"/>
        </svg>
      ),
      'CA': (
        <svg className="w-5 h-4 rounded-sm" viewBox="0 0 640 480">
          <path fill="#d52b1e" d="M0 0h150v480H0zm490 0h150v480H490z"/>
          <path fill="#fff" d="M150 0h340v480H150z"/>
          <path fill="#d52b1e" d="M318 349.5l-41.5-30.8-41.7 30.6 15.7-49.7-41.6-30.8h51.4l15.8-49.7 16 49.7h51.3l-41.4 30.8"/>
        </svg>
      ),
      'MX': (
        <svg className="w-5 h-4 rounded-sm" viewBox="0 0 640 480">
          <path fill="#006847" d="M0 0h213.3v480H0z"/>
          <path fill="#fff" d="M213.3 0h213.4v480H213.3z"/>
          <path fill="#ce1126" d="M426.7 0H640v480H426.7z"/>
          <circle cx="320" cy="240" r="60" fill="#fcdd09"/>
        </svg>
      ),
    };
    return flags[country as keyof typeof flags] || null;
  };

  const countryCodes = [
    { value: '+1', label: 'US +1', country: 'US' },
    { value: '+1-ca', label: 'CA +1', country: 'CA' },
    { value: '+52', label: 'MX +52', country: 'MX' },
  ];

  // Helper to extract display username (remove _number suffix)
  const getDisplayUsername = (fullUsername: string | undefined) => {
    if (!fullUsername) return '';
    const match = fullUsername.match(/^(.+)_\d+$/);
    return match ? match[1] : fullUsername;
  };

  // Helper to generate unique username with suffix
  const generateUniqueUsername = async (baseUsername: string): Promise<string> => {
    const sanitized = baseUsername.toLowerCase().trim().replace(/[^a-z0-9_]/g, '');
    if (!sanitized) throw new Error('Invalid username');

    // Check if base username exists
    const { data: existing } = await supabase
      .from('profiles')
      .select('username')
      .like('username', `${sanitized}%`)
      .order('username', { ascending: false });

    if (!existing || existing.length === 0) {
      return `${sanitized}_1`;
    }

    // Find highest number suffix
    let maxNumber = 0;
    existing.forEach((profile) => {
      const match = profile.username?.match(/^.+_(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNumber) maxNumber = num;
      }
    });

    return `${sanitized}_${maxNumber + 1}`;
  };

  // Load user profile when modal opens
  useEffect(() => {
    if (isOpen && user) {
      loadUserProfile();
    }
  }, [isOpen, user]);

  // Listen for auth state changes (e.g., email verification)
  useEffect(() => {
    if (!isOpen) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[UserProfileModal] Auth state changed:', event);
      
      // Reload profile if user data changed (e.g., email verified)
      if (event === 'USER_UPDATED' && session?.user) {
        console.log('[UserProfileModal] User updated, reloading profile');
        loadUserProfile();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isOpen]);

  const loadUserProfile = async () => {
    // Always get the latest user from session, don't rely on stale props
    const { data: { session } } = await supabase.auth.getSession();
    const currentUser = session?.user;
    
    if (!currentUser?.id) {
      console.error('Cannot load profile: user ID is missing');
      return;
    }
    
    console.log('[UserProfileModal] Loading profile with email:', currentUser.email);
    
    try {
      setLoading(true);
      
      // Get user profile from profiles table
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading profile:', error);
      }

      // Create profile object with FRESH user data from session
      const userProfile: UserProfile = {
        id: currentUser.id,
        email: currentUser.email || '',
        username: profileData?.username || '',
        first_name: profileData?.first_name || '',
        last_name: profileData?.last_name || '',
        mobile_number: profileData?.mobile_number || '',
        avatar_url: profileData?.avatar_url || '',
        created_at: currentUser.created_at || '',
        updated_at: profileData?.updated_at || currentUser.created_at || '',
      };

      setProfile(userProfile);
      setCurrentEmail(userProfile.email);
      setUsername(getDisplayUsername(userProfile.username));
      setFirstName(userProfile.first_name || '');
      setLastName(userProfile.last_name || '');
      
      // Parse country code and mobile number
      const fullMobile = userProfile.mobile_number || '';
      if (fullMobile.startsWith('+52')) {
        setCountryCode('+52');
        setMobileNumber(fullMobile.substring(3).trim());
      } else if (fullMobile.startsWith('+1')) {
        setCountryCode('+1');
        setMobileNumber(fullMobile.substring(2).trim());
      } else if (fullMobile) {
        setMobileNumber(fullMobile);
      }
    } catch (error) {
      console.error('Failed to load user profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    if (!user || !profile) return;

    const startTime = Date.now();
    const minLoadingTime = 1000; // Minimum 1 second loading

    try {
      setSaving(true);
      setSaveStatus('saving');
      setUsernameError('');
      
      // Generate unique username if username is provided or changed
      let finalUsername = profile.username;
      if (username.trim() && getDisplayUsername(profile.username) !== username.trim()) {
        try {
          finalUsername = await generateUniqueUsername(username.trim());
        } catch (err) {
          setUsernameError('Invalid username. Use only letters, numbers, and underscores.');
          
          // Ensure minimum loading time
          const elapsed = Date.now() - startTime;
          const remainingTime = Math.max(0, minLoadingTime - elapsed);
          
          await new Promise(resolve => setTimeout(resolve, remainingTime));
          
          setSaving(false);
          setSaveStatus('error');
          setTimeout(() => setSaveStatus('idle'), 2000);
          return;
        }
      }
      
      // Combine country code with mobile number
      const fullMobileNumber = mobileNumber.trim() 
        ? `${countryCode} ${mobileNumber.trim()}`
        : null;
      
      // Update or insert profile
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          username: finalUsername || null,
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          mobile_number: fullMobileNumber,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          setUsernameError('Username already taken. Please try another.');
        } else {
          throw error;
        }
        
        // Ensure minimum loading time
        const elapsed = Date.now() - startTime;
        const remainingTime = Math.max(0, minLoadingTime - elapsed);
        
        await new Promise(resolve => setTimeout(resolve, remainingTime));
        
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 2000);
        return;
      }

      // Update local state
      setProfile(prev => prev ? { 
        ...prev,
        username: finalUsername,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        mobile_number: fullMobileNumber || undefined
      } : null);
      
      // Update display username
      setUsername(getDisplayUsername(finalUsername));
      
      // Ensure minimum loading time before showing success
      const elapsed = Date.now() - startTime;
      const remainingTime = Math.max(0, minLoadingTime - elapsed);
      
      await new Promise(resolve => setTimeout(resolve, remainingTime));
      
      setSaveStatus('success');
      toast.success('Profile updated successfully');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to save profile:', error);
      toast.error('Failed to save profile');
      
      // Ensure minimum loading time
      const elapsed = Date.now() - startTime;
      const remainingTime = Math.max(0, minLoadingTime - elapsed);
      
      await new Promise(resolve => setTimeout(resolve, remainingTime));
      
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } finally {
      setSaving(false);
    }
  };

  const handleEmailChange = async () => {
    if (!user || !newEmail.trim()) {
      setEmailChangeError('Please enter a new email address');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      setEmailChangeError('Please enter a valid email address');
      return;
    }

    // Check if same as current (use currentEmail state, not profile)
    if (newEmail.toLowerCase() === currentEmail.toLowerCase()) {
      setEmailChangeError('New email must be different from current email');
      return;
    }

    try {
      setChangingEmail(true);
      setEmailChangeError('');

      console.log('[UserProfileModal] Requesting email change to:', newEmail);

      // Get the current session to ensure we have a valid auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('You must be logged in to change your email');
      }

      console.log('[UserProfileModal] Session valid, calling edge function');

      const { data, error } = await supabase.functions.invoke('change-email', {
        body: { newEmail: newEmail.trim() }
      });

      console.log('[UserProfileModal] Edge function response:', { data, error });

      if (error) {
        console.error('[UserProfileModal] Email change error:', error);
        throw new Error(error.message || 'Failed to change email');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to change email');
      }

      console.log('[UserProfileModal] Email change initiated successfully');

      // Close modal
      setShowEmailChangeModal(false);
      setNewEmail('');

      // Show success message
      toast.success(
        `Email updated successfully to ${data.newEmail}!`,
        { duration: 5000 }
      );

      // Update the UI immediately
      console.log('[UserProfileModal] BEFORE UPDATE - currentEmail:', currentEmail);
      console.log('[UserProfileModal] Setting currentEmail to:', data.newEmail);
      setCurrentEmail(data.newEmail);
      console.log('[UserProfileModal] AFTER UPDATE - setCurrentEmail called with:', data.newEmail);
      
      // Force refresh the auth session to update sidebar and all UI
      console.log('[UserProfileModal] Forcing auth session refresh...');
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError) {
        console.error('[UserProfileModal] Error refreshing session:', refreshError);
        console.log('[UserProfileModal] Email changed but sidebar may not update until page refresh');
      } else if (refreshData?.session?.user) {
        console.log('[UserProfileModal] ✅ Session refreshed successfully!');
        console.log('[UserProfileModal] New user email in session:', refreshData.session.user.email);
        setProfile(prev => prev ? {
          ...prev,
          email: refreshData.session.user.email || prev.email
        } : null);
      }

    } catch (error: any) {
      console.error('[UserProfileModal] Email change failed:', error);
      setEmailChangeError(error.message || 'Failed to change email');
      toast.error(error.message || 'Failed to change email');
    } finally {
      setChangingEmail(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-background border-border rounded-2xl p-0 [&>button]:hidden">
        {/* Header */}
        <DialogHeader className="py-6 px-6 border-b border-border rounded-t-2xl">
          <div className="flex justify-between items-center">
            <DialogTitle className="text-2xl font-bold text-foreground flex items-center gap-2">
              <User className="w-6 h-6" />
              User Profile
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-colors"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-2 text-muted-foreground">Loading profile...</span>
            </div>
          ) : (
            <>
              {/* Profile Header */}
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16">
                  <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                    {profile?.email?.substring(0, 2).toUpperCase() || '??'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">
                    {profile?.first_name 
                      ? `${profile.first_name} ${profile.last_name || ''}`.trim()
                      : profile?.email?.split('@')[0] || 'User'}
                  </h3>
                  <div className="flex items-center gap-3 mt-1">
                    <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${getStatusColor()}`}>
                      <span className="text-xs">{getStatusIcon()}</span>
                      {subscription?.display_name || 'Free Plan'}
                    </div>
                    <span className="text-xs text-muted-foreground">•</span>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      Member since {formatDate(profile?.created_at || '')}
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Profile Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    Profile Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Row 1: Username (full width) */}
                  <div>
                    <Label htmlFor="username" className="flex items-center gap-2 mb-2">
                      <User className="w-4 h-4" />
                      Username
                    </Label>
                    <Input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        setUsernameError('');
                      }}
                      placeholder="Enter a unique username"
                      className="rounded-lg"
                    />
                    {usernameError && (
                      <p className="text-xs text-red-500 mt-1">{usernameError}</p>
                    )}
                  </div>
                  
                  {/* Row 2: First Name, Last Name */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName" className="flex items-center gap-2 mb-2">
                        <User className="w-4 h-4" />
                        First Name
                      </Label>
                      <Input
                        id="firstName"
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Enter your first name"
                        className="rounded-lg"
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName" className="mb-2 block">Last Name</Label>
                      <Input
                        id="lastName"
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Enter your last name"
                        className="rounded-lg"
                      />
                    </div>
                  </div>
                  
                  {/* Row 3: Email Address (full width) */}
                  <div>
                    <Label htmlFor="email" className="flex items-center gap-2 mb-2">
                      <Mail className="w-4 h-4" />
                      Email Address
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="email"
                        type="email"
                        value={currentEmail}
                        disabled
                        className="bg-muted rounded-lg flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowEmailChangeModal(true)}
                        className="rounded-lg whitespace-nowrap"
                      >
                        Change Email
                      </Button>
                    </div>
                  </div>
                  
                  {/* Row 4: Mobile Number with Country Code */}
                  <div>
                    <Label htmlFor="mobileNumber" className="flex items-center gap-2 mb-2">
                      <Phone className="w-4 h-4" />
                      Mobile Number <span className="text-muted-foreground text-xs">(optional)</span>
                    </Label>
                    <div className="flex gap-2">
                      <Select value={countryCode} onValueChange={setCountryCode}>
                        <SelectTrigger className="w-[120px] rounded-lg">
                          <SelectValue>
                            <span className="flex items-center gap-2">
                              <CountryFlag country={countryCodes.find(c => c.value === countryCode)?.country || 'US'} />
                              <span>{countryCodes.find(c => c.value === countryCode)?.label?.split(' ')[1]}</span>
                            </span>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="rounded-lg">
                          {countryCodes.map((country) => (
                            <SelectItem key={country.value} value={country.value} className="rounded-md">
                              <div className="flex items-center gap-2">
                                <CountryFlag country={country.country} />
                                <span className="font-medium">{country.label.split(' ')[0]}</span>
                                <span className="text-muted-foreground">{country.label.split(' ')[1]}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        id="mobileNumber"
                        type="tel"
                        value={mobileNumber}
                        onChange={(e) => setMobileNumber(e.target.value)}
                        placeholder="(555) 123-4567"
                        className="flex-1 rounded-lg"
                      />
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="flex justify-end pt-4">
                    <Button 
                      onClick={saveProfile} 
                      disabled={saveStatus !== 'idle'} 
                      className={`group rounded-lg transition-all duration-300 ease-out hover:scale-[1.05] active:scale-95 disabled:scale-100 disabled:hover:scale-100 ${
                        saveStatus === 'success' ? 'bg-green-600 hover:bg-green-600' : 
                        saveStatus === 'error' ? 'bg-red-600 hover:bg-red-600' : ''
                      }`}
                    >
                      {saveStatus === 'saving' && (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      )}
                      {saveStatus === 'success' && (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Saved!
                        </>
                      )}
                      {saveStatus === 'error' && (
                        <>
                          <AlertCircle className="w-4 h-4 mr-2" />
                          Error!
                        </>
                      )}
                      {saveStatus === 'idle' && (
                        <>
                          <Save className="w-4 h-4 mr-2 transition-transform duration-300 group-hover:rotate-[15deg]" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* Email Change Modal */}
    <Dialog open={showEmailChangeModal} onOpenChange={setShowEmailChangeModal}>
      <DialogContent className="sm:max-w-[500px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Change Email Address
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            You'll receive a verification email at your new address. Your email won't change until you click the verification link.
          </p>

          <div className="space-y-4">
            <div>
              <Label htmlFor="currentEmail" className="mb-2 block">Current Email</Label>
              <Input
                id="currentEmail"
                type="email"
                value={currentEmail}
                disabled
                className="bg-muted rounded-lg"
              />
            </div>

            <div>
              <Label htmlFor="newEmailInput" className="mb-2 block">New Email Address</Label>
              <Input
                id="newEmailInput"
                type="email"
                value={newEmail}
                onChange={(e) => {
                  setNewEmail(e.target.value);
                  setEmailChangeError('');
                }}
                placeholder="Enter your new email"
                className="rounded-lg"
                disabled={changingEmail}
              />
              {emailChangeError && (
                <p className="text-xs text-red-500 mt-1">{emailChangeError}</p>
              )}
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>What happens next:</strong>
                <br />
                1. We'll send a verification link to your new email
                <br />
                2. Click the link to confirm the change
                <br />
                3. Your email will be updated automatically
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowEmailChangeModal(false);
                setNewEmail('');
                setEmailChangeError('');
              }}
              disabled={changingEmail}
              className="rounded-lg"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEmailChange}
              disabled={changingEmail || !newEmail.trim()}
              className="rounded-lg"
            >
              {changingEmail ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Send Verification
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </>
  );
}
