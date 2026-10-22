import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Loader2, 
  Check, 
  Camera, 
  Smile,
  Briefcase,
  Zap,
  Brain,
  Palette,
  Edit3,
  Upload,
  ImageIcon
} from 'lucide-react';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';

import { GenerateAvatarModal } from './GenerateAvatarModal';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getModelsByProvider } from '@/lib/llm/modelRegistry';
import { toast } from 'react-hot-toast';

interface AboutMeModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentData?: {
    name?: string;
    description?: string;
    personality?: string;
    avatar_url?: string;
  };
  onAgentUpdated?: (updatedData: any) => void;
}

// Real personality templates from the actual system  
const PERSONALITY_OPTIONS = [
  {
    id: 'helpful',
    name: 'Helpful',
    description: 'Friendly and eager to assist',
    icon: Smile,
    gradient: 'from-green-400 to-blue-500'
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'Formal and business-oriented',
    icon: Briefcase,
    gradient: 'from-gray-600 to-blue-600'
  },
  {
    id: 'cheerful',
    name: 'Cheerful',
    description: 'Upbeat and positive',
    icon: Zap,
    gradient: 'from-yellow-400 to-orange-500'
  }
];

export function AboutMeModal({
  isOpen,
  onClose,
  agentId,
  agentData,
  onAgentUpdated
}: AboutMeModalProps) {
  const supabase = useSupabaseClient();
  const { user } = useAuth();
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPersonality, setSelectedPersonality] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [model, setModel] = useState<string>('gpt-4o-mini');
  const [modelSaving, setModelSaving] = useState(false);

  // Initialize form data when modal opens or agent data changes
  useEffect(() => {
    if (isOpen && agentData) {
      setName(agentData.name || '');
      setDescription(agentData.description || '');
      setSelectedPersonality(agentData.personality || '');
      setAvatarUrl(agentData.avatar_url || null);
      setSaved(false);

      // Load agent llm preferences (wrap await in IIFE)
      (async () => {
        try {
          const { data: prefs } = await supabase
            .from('agent_llm_preferences')
            .select('provider, model')
            .eq('agent_id', agentId)
            .maybeSingle();
          if (prefs?.model) setModel(prefs.model);
        } catch (_) {}
      })();
    }
  }, [isOpen, agentData]);

  // Clear saved state after 2.5 seconds for better UX
  useEffect(() => {
    if (saved) {
      const timer = setTimeout(() => setSaved(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [saved]);

  const handleSave = useCallback(async () => {
    if (!agentId || !user) return;
    
    // Reset saved state and start loading
    setSaved(false);
    setLoading(true);
    
    try {
      // Ensure minimum loading time so user can see "Saving..." state
      const startTime = Date.now();
      
      const updatePayload = {
        name: name.trim() || undefined,
        description: description.trim() || undefined,
        personality: selectedPersonality || undefined,
        avatar_url: avatarUrl
      };

      const { data: updatedAgent, error } = await supabase
        .from('agents')
        .update(updatePayload)
        .eq('id', agentId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      // Ensure at least 800ms of loading time for better UX
      const elapsedTime = Date.now() - startTime;
      const minLoadingTime = 800;
      if (elapsedTime < minLoadingTime) {
        await new Promise(resolve => setTimeout(resolve, minLoadingTime - elapsedTime));
      }

      // Show success feedback with slight delay to ensure state visibility
      setLoading(false);
      
      // Small delay to ensure loading state clears before showing saved state
      await new Promise(resolve => setTimeout(resolve, 100));
      
      setSaved(true);
      toast.success('Profile updated! ✨');
      
      // Notify parent component
      if (onAgentUpdated && updatedAgent) {
        onAgentUpdated(updatedAgent);
      }
      
    } catch (error: any) {
      console.error('Error updating agent:', error);
      toast.error('Failed to update profile');
      setLoading(false);
      setSaved(false);
    }
  }, [agentId, name, description, selectedPersonality, avatarUrl, supabase, user, onAgentUpdated]);



  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0 || !agentId || !user) {
      return;
    }

    const file = event.target.files[0];
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
      const avatarUrl = urlData.data.signed_url;

      // Update agent record
      const { error: updateError } = await supabase
        .from('agents')
        .update({ avatar_url: avatarUrl })
        .eq('id', agentId)
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setAvatarUrl(avatarUrl);
      toast.success('Avatar uploaded to Media Library! 📸');
      
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      toast.error('Failed to upload avatar');
    } finally {
      setUploading(false);
      // Reset the input value so the same file can be selected again
      event.target.value = '';
    }
  }, [agentId, user, supabase, agentData?.name]);

  const handleGeneratedAvatar = useCallback((newAvatarUrl: string) => {
    setAvatarUrl(newAvatarUrl);
    setShowGenerateModal(false);
  }, []);

  const getSelectedPersonality = () => {
    return PERSONALITY_OPTIONS.find(p => p.id === selectedPersonality);
  };

  const hasChanges = () => {
    if (!agentData) return false;
    return (
      name !== (agentData.name || '') ||
      description !== (agentData.description || '') ||
      selectedPersonality !== (agentData.personality || '') ||
      avatarUrl !== (agentData.avatar_url || null)
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] p-0 flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
          <DialogTitle className="text-xl font-semibold flex items-center">
            🎭 Profile
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Help me build my identity and personality so I can be the best companion for you.
          </DialogDescription>
        </DialogHeader>
        
        <div className="px-6 space-y-6 overflow-y-auto flex-1 min-h-0">
          {/* Avatar Section */}
          <div className="flex flex-col items-center space-y-4">
            <div className="relative group">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className="relative cursor-pointer">
                    <Avatar className="h-24 w-24 border-4 border-border shadow-lg transition-all group-hover:border-primary/50">
                      {avatarUrl ? (
                        <AvatarImage src={avatarUrl} alt={name || 'Agent'} />
                      ) : (
                        <AvatarFallback className="text-2xl bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                          {name?.charAt(0)?.toUpperCase() || 'A'}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Edit3 className="h-6 w-6 text-white" />
                    </div>
                    
                    {/* Loading overlay */}
                    {uploading && (
                      <div className="absolute inset-0 bg-black/70 rounded-full flex items-center justify-center">
                        <Loader2 className="h-6 w-6 text-white animate-spin" />
                      </div>
                    )}
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-48">
                  <DropdownMenuItem onClick={() => document.getElementById('avatar-upload')?.click()}>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Image
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowGenerateModal(true)}>
                    <ImageIcon className="h-4 w-4 mr-2" />
                    Generate Image
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              {/* Hidden file input */}
              <input
                id="avatar-upload"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Click the avatar to upload or generate an image
            </p>

            {/* Model selection under avatar */}
            <div className="w-full max-w-sm space-y-2">
              <Label className="text-sm font-medium">Model</Label>
              <Select
                value={model}
                onValueChange={async (val) => {
                  setModel(val);
                  try {
                    setModelSaving(true);
                    const { error } = await supabase
                      .from('agent_llm_preferences')
                      .upsert({ agent_id: agentId, provider: 'openai', model: val }, { onConflict: 'agent_id' });
                    if (error) throw error;
                  } catch (e) {
                    console.error('Failed to save model preference', e);
                  } finally {
                    setModelSaving(false);
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {getModelsByProvider('openai').map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {modelSaving && <div className="text-xs text-muted-foreground">Saving…</div>}
            </div>
          </div>

          {/* Name Section */}
          <div className="space-y-2">
            <Label htmlFor="agent-name" className="text-sm font-medium">
              What should I call myself?
            </Label>
            <Input
              id="agent-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Choose a friendly name for me..."
              className="bg-background border-border"
            />
          </div>

          {/* Description Section */}
          <div className="space-y-2">
            <Label htmlFor="agent-description" className="text-sm font-medium">
              How should I introduce myself?
            </Label>
            <Textarea
              id="agent-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="I'm a helpful AI who loves to..."
              className="bg-background border-border min-h-[80px] resize-none"
            />
          </div>

          {/* Personality Section */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              What's my personality like?
            </Label>
            <div className="grid grid-cols-1 gap-2">
              {PERSONALITY_OPTIONS.map((personality) => {
                const Icon = personality.icon;
                const isSelected = selectedPersonality === personality.id;
                
                return (
                  <button
                    key={personality.id}
                    onClick={() => setSelectedPersonality(personality.id)}
                    className={`flex items-center p-3 rounded-lg border transition-all duration-200 text-left ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border hover:border-primary/50 hover:bg-accent/50'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${personality.gradient} flex items-center justify-center mr-3 flex-shrink-0`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{personality.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {personality.description}
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="h-5 w-5 text-primary flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border bg-card/50 flex-shrink-0">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={loading || !hasChanges()}
            className={`min-w-[140px] transition-all duration-200 ${
              saved ? 'bg-green-600 hover:bg-green-700 text-white' : ''
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : saved ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Saved!
              </>
            ) : (
              'Save My Identity'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Generate Avatar Modal */}
      <GenerateAvatarModal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        agentId={agentId || ''}
        agentName={name}
        onAvatarGenerated={handleGeneratedAvatar}
      />
    </Dialog>
  );
}