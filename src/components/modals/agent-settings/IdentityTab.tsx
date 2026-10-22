import React, { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Loader2, 
  Check, 
  Camera, 
  Upload,
  ImageIcon,
  Save
} from 'lucide-react';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { GenerateAvatarModal } from '../GenerateAvatarModal';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getModelsByProvider } from '@/lib/llm/modelRegistry';
import { useMediaLibraryUrl } from '@/hooks/useMediaLibraryUrl';
import { toast } from 'react-hot-toast';

interface IdentityTabProps {
  agentId: string;
  agentData?: {
    name?: string;
    description?: string;
    personality?: string;
    avatar_url?: string;
  };
  onAgentUpdated?: (updatedData: any) => void;
}

export interface IdentityTabRef {
  save: () => Promise<void>;
  hasChanges: boolean;
  saving: boolean;
  saveSuccess: boolean;
}

// Real personality templates from the actual system  
const PERSONALITY_OPTIONS = [
  {
    id: 'professional',
    name: 'Professional',
    description: 'Formal, structured, and business-focused communication',
    icon: '💼'
  },
  {
    id: 'friendly',
    name: 'Friendly',
    description: 'Warm, approachable, and conversational',
    icon: '😊'
  },
  {
    id: 'analytical',
    name: 'Analytical',
    description: 'Data-driven, logical, and detail-oriented',
    icon: '📊'
  },
  {
    id: 'creative',
    name: 'Creative',
    description: 'Imaginative, innovative, and artistic',
    icon: '🎨'
  },
  {
    id: 'supportive',
    name: 'Supportive',
    description: 'Encouraging, empathetic, and helpful',
    icon: '🤝'
  },
  {
    id: 'direct',
    name: 'Direct',
    description: 'Straightforward, concise, and to-the-point',
    icon: '🎯'
  },
  {
    id: 'enthusiastic',
    name: 'Enthusiastic',
    description: 'Energetic, positive, and motivating',
    icon: '⚡'
  },
  {
    id: 'thoughtful',
    name: 'Thoughtful',
    description: 'Reflective, considerate, and wise',
    icon: '🤔'
  }
];

export const IdentityTab = forwardRef<IdentityTabRef, IdentityTabProps>(({ agentId, agentData, onAgentUpdated }, ref) => {
  const supabase = useSupabaseClient();
  const { user } = useAuth();

  // Form state
  const [name, setName] = useState(agentData?.name || '');
  const [selectedPersonality, setSelectedPersonality] = useState(agentData?.personality || 'professional');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(agentData?.avatar_url || null);
  
  // Resolve media library URLs
  const resolvedAvatarUrl = useMediaLibraryUrl(avatarUrl);

  // UI state
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  // Update form when agentData changes
  useEffect(() => {
    if (agentData) {
      setName(agentData.name || '');
      setSelectedPersonality(agentData.personality || 'professional');
      setAvatarUrl(agentData.avatar_url || null);
    }
  }, [agentData]);

  // Detect if there are unsaved changes
  const hasChanges = 
    name.trim() !== (agentData?.name || '') ||
    selectedPersonality !== (agentData?.personality || 'professional') ||
    avatarUrl !== (agentData?.avatar_url || null);

  const handleSave = useCallback(async () => {
    if (!agentId || !user) return;
    
    if (!name.trim()) {
      toast.error('Agent name is required');
      return;
    }
    
    setLoading(true);
    const startTime = Date.now();
    
    try {
      const { data, error } = await supabase
        .from('agents')
        .update({
          name: name.trim(),
          personality: selectedPersonality,
          avatar_url: avatarUrl
        })
        .eq('id', agentId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      // Ensure minimum 1 second loading time
      const elapsed = Date.now() - startTime;
      const remainingTime = Math.max(0, 1000 - elapsed);
      await new Promise(resolve => setTimeout(resolve, remainingTime));

      toast.success('Identity updated successfully! ✨');
      
      // Show success state for 2 seconds
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
      
      if (onAgentUpdated) {
        onAgentUpdated(data);
      }
      
    } catch (error: any) {
      console.error('Error updating agent:', error);
      toast.error('Failed to update identity');
    } finally {
      setLoading(false);
    }
  }, [agentId, user, name, selectedPersonality, avatarUrl, supabase, onAgentUpdated]);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const target = event.target; // Store reference before async operations
    if (!target.files || target.files.length === 0 || !agentId || !user) {
      return;
    }

    const file = target.files[0];
    const maxSize = 50 * 1024 * 1024; // 50MB (Media Library limit)
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'];

    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a PNG, JPEG, WebP, GIF, or SVG image');
      return;
    }

    if (file.size > maxSize) {
      toast.error('Image must be smaller than 50MB');
      return;
    }

    setUploading(true);

    try {
      // Upload to Media Library via API
      const uploadResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/media-library-api`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'upload',
          file_name: `avatar-${agentId}-${Date.now()}.${file.name.split('.').pop()}`,
          file_type: file.type,
          file_size: file.size,
          category: 'avatars',
          description: `Avatar for agent ${agentData?.name || agentId}`
        })
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
      }

      const uploadData = await uploadResponse.json();

      // Upload actual file to storage
      const { error: storageError } = await supabase.storage
        .from(uploadData.data.bucket)
        .upload(uploadData.data.storage_path, file, {
          contentType: file.type,
          duplex: 'half'
        });

      if (storageError) {
        throw new Error(`Storage upload failed: ${storageError.message}`);
      }

      // Get signed URL for the uploaded avatar
      const urlResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/media-library-api`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'get_signed_url',
          document_id: uploadData.data.media_id,
          expiry_seconds: 31536000 // 1 year for avatars
        })
      });

      if (!urlResponse.ok) {
        throw new Error(`Failed to get avatar URL: ${urlResponse.status}`);
      }

      const urlData = await urlResponse.json();
      const newAvatarUrl = urlData.data.signed_url;

      setAvatarUrl(newAvatarUrl);
      toast.success('Avatar uploaded to Media Library! 📸');
      
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      toast.error('Failed to upload avatar');
    } finally {
      setUploading(false);
      // Reset the input value so the same file can be selected again
      if (target) {
        target.value = '';
      }
    }
  }, [agentId, user, supabase, agentData?.name]);

  const handleGeneratedAvatar = useCallback((newAvatarUrl: string) => {
    setAvatarUrl(newAvatarUrl);
    setShowGenerateModal(false);
  }, []);

  const getSelectedPersonality = () => {
    return PERSONALITY_OPTIONS.find(p => p.id === selectedPersonality);
  };

  // Expose save method and state to parent via ref
  useImperativeHandle(ref, () => ({
    save: handleSave,
    hasChanges,
    saving: loading,
    saveSuccess: justSaved
  }));

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Identity & Appearance</h3>
        <p className="text-sm text-muted-foreground">
          Configure your agent's name, avatar, and personality type.
        </p>
      </div>

      {/* Agent Name - Moved from General tab */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Name</CardTitle>
          <CardDescription>
            This is how your agent will be identified in conversations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="agent-name" className="text-sm font-medium">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="agent-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter agent name"
              className="max-w-md"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Avatar & Image Generation</CardTitle>
          <CardDescription>
            Upload a custom avatar or generate one using AI.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-6">
            <Avatar className="h-20 w-20">
              <AvatarImage src={resolvedAvatarUrl || undefined} alt={name || 'Agent'} />
              <AvatarFallback className="text-lg bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                {name?.charAt(0)?.toUpperCase() || 'A'}
              </AvatarFallback>
            </Avatar>
            
            <div className="space-y-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" disabled={uploading}>
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Camera className="h-4 w-4 mr-2" />
                        Change Avatar
                      </>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.onchange = handleFileUpload;
                      input.click();
                    }}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Image
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowGenerateModal(true)}>
                    <ImageIcon className="h-4 w-4 mr-2" />
                    Generate with AI
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <p className="text-xs text-muted-foreground">
                PNG, JPEG, WebP, GIF, or SVG up to 50MB
              </p>
            </div>
          </div>
        </CardContent>
      </Card>



      <Card>
        <CardHeader>
          <CardTitle>Personality Type (MBTI)</CardTitle>
          <CardDescription>
            Define your agent's personality traits and communication style.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Personality Style</Label>
            <Select value={selectedPersonality} onValueChange={setSelectedPersonality}>
              <SelectTrigger className="max-w-md">
                <SelectValue>
                  <div className="flex items-center space-x-2">
                    <span>{getSelectedPersonality()?.icon}</span>
                    <span>{getSelectedPersonality()?.name}</span>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PERSONALITY_OPTIONS.map((personality) => (
                  <SelectItem key={personality.id} value={personality.id}>
                    <div className="flex items-center space-x-3">
                      <span className="text-lg">{personality.icon}</span>
                      <div>
                        <div className="font-medium">{personality.name}</div>
                        <div className="text-xs text-muted-foreground">{personality.description}</div>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              This affects how your agent communicates and approaches problems.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Generate Avatar Modal */}
      <GenerateAvatarModal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        agentId={agentId}
        agentName={name}
        onAvatarGenerated={handleGeneratedAvatar}
      />
    </div>
  );
});
