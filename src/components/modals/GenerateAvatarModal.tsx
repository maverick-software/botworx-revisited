import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Sparkles, User, Palette, Eye, Brush, Building, Shuffle, ChevronDown, ChevronUp, Globe, Check, X, RotateCcw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { generateAgentAvatar } from '@/lib/openaiClient';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';

interface GenerateAvatarModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentName?: string;
  onAvatarGenerated: (avatarUrl: string) => void;
}

// Avatar generation options
interface AvatarOptions {
  gender: 'male' | 'female' | 'neutral' | 'other';
  customGender: string;
  hair: 'blonde' | 'brown' | 'black' | 'red' | 'gray' | 'other';
  customHair: string;
  eyes: 'blue' | 'green' | 'brown' | 'hazel' | 'gray' | 'other';
  customEyes: string;
  ethnicity: 'caucasian' | 'african' | 'asian' | 'hispanic' | 'middle_eastern' | 'mixed' | 'other';
  customEthnicity: string;
  age: 'young_adult' | 'middle_aged' | 'elderly';
  style: 'photorealistic' | 'cartoon' | '3d_animation' | 'artistic' | 'other';
  customStyle: string;
  theme: 'office' | 'android' | 'alien' | 'animal' | 'fantasy' | 'other';
  customTheme: string;
}

export function GenerateAvatarModal({
  isOpen,
  onClose,
  agentId,
  agentName,
  onAvatarGenerated
}: GenerateAvatarModalProps) {
  const { user } = useAuth();
  const supabase = useSupabaseClient();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [generatedMediaId, setGeneratedMediaId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  
  // Avatar customization options
  const [options, setOptions] = useState<AvatarOptions>({
    gender: 'neutral',
    customGender: '',
    hair: 'brown',
    customHair: '',
    eyes: 'brown',
    customEyes: '',
    ethnicity: 'mixed',
    customEthnicity: '',
    age: 'young_adult',
    style: 'photorealistic',
    customStyle: '',
    theme: 'office',
    customTheme: ''
  });

  // Randomize all features
  const randomizeFeatures = () => {
    const genderOptions = ['male', 'female', 'neutral', 'other'];
    const hairOptions = ['blonde', 'brown', 'black', 'red', 'gray', 'other'];
    const eyeOptions = ['blue', 'green', 'brown', 'hazel', 'gray', 'other'];
    const ethnicityOptions = ['caucasian', 'african', 'asian', 'hispanic', 'middle_eastern', 'mixed', 'other'];
    const ageOptions = ['young_adult', 'middle_aged', 'elderly'];
    const styleOptions = ['photorealistic', 'cartoon', '3d_animation', 'other'];
    const themeOptions = ['office', 'android', 'alien', 'animal', 'fantasy', 'other'];
    
    const selectedGender = genderOptions[Math.floor(Math.random() * genderOptions.length)] as any;
    const selectedHair = hairOptions[Math.floor(Math.random() * hairOptions.length)] as any;
    const selectedEyes = eyeOptions[Math.floor(Math.random() * eyeOptions.length)] as any;
    const selectedEthnicity = ethnicityOptions[Math.floor(Math.random() * ethnicityOptions.length)] as any;
    const selectedStyle = styleOptions[Math.floor(Math.random() * styleOptions.length)] as any;
    const selectedTheme = themeOptions[Math.floor(Math.random() * themeOptions.length)] as any;
    
    setOptions({
      gender: selectedGender,
      customGender: selectedGender === 'other' ? 'non-binary' : '',
      hair: selectedHair,
      customHair: selectedHair === 'other' ? 'silver' : '',
      eyes: selectedEyes,
      customEyes: selectedEyes === 'other' ? 'amber' : '',
      ethnicity: selectedEthnicity,
      customEthnicity: selectedEthnicity === 'other' ? 'multiracial' : '',
      age: ageOptions[Math.floor(Math.random() * ageOptions.length)] as any,
      style: selectedStyle,
      customStyle: selectedStyle === 'other' ? 'watercolor painting style' : '',
      theme: selectedTheme,
      customTheme: selectedTheme === 'other' ? 'steampunk aesthetic' : ''
    });
    
    toast.success('Random features selected! 🎲');
  };

  // Generate prompt from user selections
  const generatePrompt = (): string => {
    const parts: string[] = [];
    
    // Base description
    parts.push(`Professional avatar for ${agentName || 'agent'}`);
    
    // Gender
    if (options.gender !== 'neutral') {
      const genderText = options.gender === 'other' ? options.customGender : options.gender;
      if (genderText) parts.push(genderText);
    }
    
    // Ethnicity
    const ethnicityText = options.ethnicity === 'other' ? options.customEthnicity : options.ethnicity;
    if (ethnicityText && ethnicityText !== 'other') {
      if (ethnicityText === 'mixed') {
        parts.push('mixed ethnicity, diverse features');
      } else {
        parts.push(`${ethnicityText.replace('_', ' ')} ethnicity`);
      }
    }
    
    // Age
    const ageText = options.age.replace('_', ' ');
    parts.push(ageText);
    
    // Hair
    const hairText = options.hair === 'other' ? options.customHair : options.hair;
    if (hairText && hairText !== 'other' && hairText.trim()) {
      parts.push(`${hairText} hair`);
    }
    
    // Eyes
    const eyesText = options.eyes === 'other' ? options.customEyes : options.eyes;
    if (eyesText && eyesText !== 'other' && eyesText.trim()) {
      parts.push(`${eyesText} eyes`);
    }
    
    // Theme
    let themeText = '';
    switch (options.theme) {
      case 'office':
        themeText = 'professional business setting, office environment';
        break;
      case 'android':
        themeText = 'futuristic android/robot aesthetic, high-tech design';
        break;
      case 'alien':
        themeText = 'friendly alien character, otherworldly features';
        break;
      case 'animal':
        themeText = 'anthropomorphic animal character, friendly and approachable';
        break;
      case 'fantasy':
        themeText = 'fantasy character, magical or mystical elements';
        break;
      case 'other':
        themeText = options.customTheme.trim();
        break;
    }
    if (themeText && themeText.length > 0) parts.push(themeText);
    
    // Style
    let styleText = '';
    switch (options.style) {
      case 'photorealistic':
        styleText = 'photorealistic, high quality, detailed, realistic rendering';
        break;
      case 'cartoon':
        styleText = 'cartoon style, friendly and approachable, animated, stylized';
        break;
      case '3d_animation':
        styleText = '3D animated style, Pixar-like, modern 3D rendering, computer graphics';
        break;
      case 'other':
        styleText = options.customStyle.trim();
        break;
    }
    if (styleText && styleText.length > 0) parts.push(styleText);
    
    // Add quality modifiers
    parts.push('portrait orientation, centered composition, professional lighting, clean background');
    
    return parts.join(', ');
  };

  const handleGenerate = async () => {
    if (!agentId || !user) {
      toast.error('Unable to generate avatar');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const prompt = generatePrompt();
      console.log('Generated prompt:', prompt);
      
      // Generate the avatar using AI
      const result = await generateAgentAvatar(supabase, agentId, prompt);
      const { mediaLibraryId } = result;

      if (!mediaLibraryId) {
        throw new Error('Failed to generate avatar image');
      }

      // Get signed URL for the generated image using media library API
      const { data: signedUrlData, error: urlError } = await supabase.functions.invoke('media-library-api', {
        body: {
          action: 'get_signed_url',
          document_id: mediaLibraryId,
          expiry_seconds: 3600 // 1 hour
        }
      });

      console.log('Media library API response:', { signedUrlData, urlError });

      if (urlError || !signedUrlData?.success || !signedUrlData?.data?.signed_url) {
        console.error('Failed to get signed URL:', { urlError, signedUrlData });
        throw new Error('Failed to get image URL');
      }

      // Show preview instead of immediately updating
      setGeneratedImageUrl(signedUrlData.data.signed_url);
      setGeneratedMediaId(mediaLibraryId);
      setShowPreview(true);
      
      toast.success('Avatar generated! Review and approve below. 🎨');
      
    } catch (error: any) {
      console.error('Error generating avatar:', error);
      setError(error.message || 'Failed to generate avatar');
      toast.error('Failed to generate avatar');
    } finally {
      setGenerating(false);
    }
  };

  const handleApproveAvatar = async () => {
    if (!generatedMediaId || !user) return;

    try {
      // Store the media library ID in the agent's avatar_url field
      // The platform will handle getting signed URLs when needed
      const avatarReference = `media-library:${generatedMediaId}`;
      
      // Update the agent's avatar in the database
      const { error: updateError } = await supabase
        .from('agents')
        .update({ avatar_url: avatarReference })
        .eq('id', agentId)
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      // Call the callback to update the parent component
      onAvatarGenerated(avatarReference);
      
      toast.success('Avatar updated successfully! 🎨');
      onClose();
    } catch (error: any) {
      console.error('Error updating agent avatar:', error);
      toast.error('Failed to update avatar');
    }
  };

  const handleRejectAvatar = async () => {
    if (!generatedMediaId) return;

    try {
      // Delete the image from storage via media library API
      const { error: deleteError } = await supabase.functions.invoke('media-library-api', {
        body: {
          action: 'delete',
          document_id: generatedMediaId
        }
      });

      if (deleteError) {
        console.error('Error deleting rejected avatar:', deleteError);
        // Continue anyway - don't block the UI
      }

      // Reset state
      setGeneratedImageUrl(null);
      setGeneratedMediaId(null);
      setShowPreview(false);
      toast.success('Avatar rejected. Try generating a new one!');
    } catch (error) {
      console.error('Error during avatar rejection:', error);
      // Reset state even if deletion failed
      setGeneratedImageUrl(null);
      setGeneratedMediaId(null);
      setShowPreview(false);
      toast.success('Avatar rejected. Try generating a new one!');
    }
  };

  const handleClose = () => {
    if (!generating) {
      setError(null);
      setShowAdvanced(false);
      setGeneratedImageUrl(null);
      setGeneratedMediaId(null);
      setShowPreview(false);
      // Reset options to defaults
      setOptions({
        gender: 'neutral',
        customGender: '',
        hair: 'brown',
        customHair: '',
        eyes: 'brown',
        customEyes: '',
        ethnicity: 'mixed',
        customEthnicity: '',
        age: 'young_adult',
        style: 'photorealistic',
        customStyle: '',
        theme: 'office',
        customTheme: ''
      });
      onClose();
    }
  };

  // Helper component for option buttons
  const OptionButton = ({ 
    selected, 
    onClick, 
    children, 
    disabled = false 
  }: { 
    selected: boolean; 
    onClick: () => void; 
    children: React.ReactNode; 
    disabled?: boolean;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled || generating}
      className={cn(
        "px-3 py-2 text-sm rounded-lg border transition-all duration-200",
        "hover:border-primary/50 hover:bg-accent/50",
        selected 
          ? "border-primary bg-primary/10 text-primary font-medium" 
          : "border-border bg-background text-muted-foreground",
        (disabled || generating) && "opacity-50 cursor-not-allowed"
      )}
    >
      {children}
    </button>
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto rounded-xl border-border">
        <DialogHeader className="pb-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
          <DialogTitle className="text-xl font-semibold flex items-center">
                <Sparkles className="h-5 w-5 mr-2 text-primary" />
            Generate Avatar
          </DialogTitle>
              <DialogDescription className="text-muted-foreground mt-1">
                Customize and create a unique AI-generated avatar for {agentName || 'your agent'}.
          </DialogDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={randomizeFeatures}
              disabled={generating}
              className="flex items-center gap-2"
            >
              <Shuffle className="h-4 w-4" />
              Random
            </Button>
          </div>
        </DialogHeader>
        
        <div className="space-y-6 py-6">
          {/* Art Style */}
          <Card className="bg-muted/30 border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Brush className="h-4 w-4 text-primary" />
                <Label className="text-sm font-medium">Art Style</Label>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                <OptionButton
                  selected={options.style === 'photorealistic'}
                  onClick={() => setOptions(prev => ({ ...prev, style: 'photorealistic' }))}
                >
                  Photorealistic
                </OptionButton>
                <OptionButton
                  selected={options.style === 'cartoon'}
                  onClick={() => setOptions(prev => ({ ...prev, style: 'cartoon' }))}
                >
                  Cartoon
                </OptionButton>
                <OptionButton
                  selected={options.style === '3d_animation'}
                  onClick={() => setOptions(prev => ({ ...prev, style: '3d_animation' }))}
                >
                  3D Animation
                </OptionButton>
                <OptionButton
                  selected={options.style === 'other'}
                  onClick={() => setOptions(prev => ({ ...prev, style: 'other' }))}
                >
                  Other
                </OptionButton>
              </div>
              {options.style === 'other' && (
                <Input
                  placeholder="Describe art style..."
                  value={options.customStyle}
                  onChange={(e) => setOptions(prev => ({ ...prev, customStyle: e.target.value }))}
                  className="mt-2"
              disabled={generating}
            />
              )}
            </CardContent>
          </Card>

          {/* Theme */}
          <Card className="bg-muted/30 border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Building className="h-4 w-4 text-primary" />
                <Label className="text-sm font-medium">Theme</Label>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                <OptionButton
                  selected={options.theme === 'office'}
                  onClick={() => setOptions(prev => ({ ...prev, theme: 'office' }))}
                >
                  Office
                </OptionButton>
                <OptionButton
                  selected={options.theme === 'android'}
                  onClick={() => setOptions(prev => ({ ...prev, theme: 'android' }))}
                >
                  Android
                </OptionButton>
                <OptionButton
                  selected={options.theme === 'alien'}
                  onClick={() => setOptions(prev => ({ ...prev, theme: 'alien' }))}
                >
                  Alien
                </OptionButton>
                <OptionButton
                  selected={options.theme === 'animal'}
                  onClick={() => setOptions(prev => ({ ...prev, theme: 'animal' }))}
                >
                  Animal
                </OptionButton>
                <OptionButton
                  selected={options.theme === 'fantasy'}
                  onClick={() => setOptions(prev => ({ ...prev, theme: 'fantasy' }))}
                >
                  Fantasy
                </OptionButton>
                <OptionButton
                  selected={options.theme === 'other'}
                  onClick={() => setOptions(prev => ({ ...prev, theme: 'other' }))}
                >
                  Other
                </OptionButton>
              </div>
              {options.theme === 'other' && (
                <Input
                  placeholder="Describe theme..."
                  value={options.customTheme}
                  onChange={(e) => setOptions(prev => ({ ...prev, customTheme: e.target.value }))}
                  className="mt-2"
                  disabled={generating}
                />
              )}
            </CardContent>
          </Card>

          {/* Gender Selection */}
          <Card className="bg-muted/30 border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <User className="h-4 w-4 text-primary" />
                <Label className="text-sm font-medium">Gender</Label>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                <OptionButton
                  selected={options.gender === 'male'}
                  onClick={() => setOptions(prev => ({ ...prev, gender: 'male' }))}
                >
                  Male
                </OptionButton>
                <OptionButton
                  selected={options.gender === 'female'}
                  onClick={() => setOptions(prev => ({ ...prev, gender: 'female' }))}
                >
                  Female
                </OptionButton>
                <OptionButton
                  selected={options.gender === 'neutral'}
                  onClick={() => setOptions(prev => ({ ...prev, gender: 'neutral' }))}
                >
                  Neutral
                </OptionButton>
                <OptionButton
                  selected={options.gender === 'other'}
                  onClick={() => setOptions(prev => ({ ...prev, gender: 'other' }))}
                >
                  Other
                </OptionButton>
              </div>
              {options.gender === 'other' && (
                <Input
                  placeholder="Describe gender..."
                  value={options.customGender}
                  onChange={(e) => setOptions(prev => ({ ...prev, customGender: e.target.value }))}
                  className="mt-2"
                  disabled={generating}
                />
              )}
            </CardContent>
          </Card>

          {/* Advanced Options */}
          <Card className="bg-muted/30 border-0">
            <CardContent className="p-4">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                disabled={generating}
                className="flex items-center justify-between w-full text-left hover:bg-accent/50 rounded-lg p-2 -m-2 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-primary" />
                  <Label className="text-sm font-medium cursor-pointer">Advanced Options</Label>
                </div>
                {showAdvanced ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
              
              {showAdvanced && (
                <div className="mt-4 space-y-4">
                  {/* Age */}
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Age</Label>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <OptionButton
                        selected={options.age === 'young_adult'}
                        onClick={() => setOptions(prev => ({ ...prev, age: 'young_adult' }))}
                      >
                        Young Adult
                      </OptionButton>
                      <OptionButton
                        selected={options.age === 'middle_aged'}
                        onClick={() => setOptions(prev => ({ ...prev, age: 'middle_aged' }))}
                      >
                        Middle-aged
                      </OptionButton>
                      <OptionButton
                        selected={options.age === 'elderly'}
                        onClick={() => setOptions(prev => ({ ...prev, age: 'elderly' }))}
                      >
                        Elderly
                      </OptionButton>
                    </div>
                  </div>

                  {/* Ethnicity */}
          <div>
                    <Label className="text-sm font-medium mb-2 block">Ethnicity</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                      <OptionButton
                        selected={options.ethnicity === 'caucasian'}
                        onClick={() => setOptions(prev => ({ ...prev, ethnicity: 'caucasian' }))}
                      >
                        Caucasian
                      </OptionButton>
                      <OptionButton
                        selected={options.ethnicity === 'african'}
                        onClick={() => setOptions(prev => ({ ...prev, ethnicity: 'african' }))}
                      >
                        African
                      </OptionButton>
                      <OptionButton
                        selected={options.ethnicity === 'asian'}
                        onClick={() => setOptions(prev => ({ ...prev, ethnicity: 'asian' }))}
                      >
                        Asian
                      </OptionButton>
                      <OptionButton
                        selected={options.ethnicity === 'hispanic'}
                        onClick={() => setOptions(prev => ({ ...prev, ethnicity: 'hispanic' }))}
                      >
                        Hispanic
                      </OptionButton>
                      <OptionButton
                        selected={options.ethnicity === 'middle_eastern'}
                        onClick={() => setOptions(prev => ({ ...prev, ethnicity: 'middle_eastern' }))}
                      >
                        Middle Eastern
                      </OptionButton>
                      <OptionButton
                        selected={options.ethnicity === 'mixed'}
                        onClick={() => setOptions(prev => ({ ...prev, ethnicity: 'mixed' }))}
                      >
                        Mixed
                      </OptionButton>
                      <OptionButton
                        selected={options.ethnicity === 'other'}
                        onClick={() => setOptions(prev => ({ ...prev, ethnicity: 'other' }))}
                      >
                        Other
                      </OptionButton>
                    </div>
                    {options.ethnicity === 'other' && (
                      <Input
                        placeholder="Describe ethnicity..."
                        value={options.customEthnicity}
                        onChange={(e) => setOptions(prev => ({ ...prev, customEthnicity: e.target.value }))}
                        className="mt-2"
              disabled={generating}
            />
                    )}
          </div>

                  {/* Hair Color */}
          <div>
                    <Label className="text-sm font-medium mb-2 block">Hair Color</Label>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
                      <OptionButton
                        selected={options.hair === 'blonde'}
                        onClick={() => setOptions(prev => ({ ...prev, hair: 'blonde' }))}
                      >
                        Blonde
                      </OptionButton>
                      <OptionButton
                        selected={options.hair === 'brown'}
                        onClick={() => setOptions(prev => ({ ...prev, hair: 'brown' }))}
                      >
                        Brown
                      </OptionButton>
                      <OptionButton
                        selected={options.hair === 'black'}
                        onClick={() => setOptions(prev => ({ ...prev, hair: 'black' }))}
                      >
                        Black
                      </OptionButton>
                      <OptionButton
                        selected={options.hair === 'red'}
                        onClick={() => setOptions(prev => ({ ...prev, hair: 'red' }))}
                      >
                        Red
                      </OptionButton>
                      <OptionButton
                        selected={options.hair === 'gray'}
                        onClick={() => setOptions(prev => ({ ...prev, hair: 'gray' }))}
                      >
                        Gray
                      </OptionButton>
                      <OptionButton
                        selected={options.hair === 'other'}
                        onClick={() => setOptions(prev => ({ ...prev, hair: 'other' }))}
                      >
                        Other
                      </OptionButton>
                    </div>
                    {options.hair === 'other' && (
                      <Input
                        placeholder="Describe hair color..."
                        value={options.customHair}
                        onChange={(e) => setOptions(prev => ({ ...prev, customHair: e.target.value }))}
                        className="mt-2"
                  disabled={generating}
                      />
                    )}
                  </div>

                  {/* Eye Color */}
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Eye Color</Label>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
                      <OptionButton
                        selected={options.eyes === 'blue'}
                        onClick={() => setOptions(prev => ({ ...prev, eyes: 'blue' }))}
                      >
                        Blue
                      </OptionButton>
                      <OptionButton
                        selected={options.eyes === 'green'}
                        onClick={() => setOptions(prev => ({ ...prev, eyes: 'green' }))}
                      >
                        Green
                      </OptionButton>
                      <OptionButton
                        selected={options.eyes === 'brown'}
                        onClick={() => setOptions(prev => ({ ...prev, eyes: 'brown' }))}
                      >
                        Brown
                      </OptionButton>
                      <OptionButton
                        selected={options.eyes === 'hazel'}
                        onClick={() => setOptions(prev => ({ ...prev, eyes: 'hazel' }))}
                      >
                        Hazel
                      </OptionButton>
                      <OptionButton
                        selected={options.eyes === 'gray'}
                        onClick={() => setOptions(prev => ({ ...prev, eyes: 'gray' }))}
                      >
                        Gray
                      </OptionButton>
                      <OptionButton
                        selected={options.eyes === 'other'}
                        onClick={() => setOptions(prev => ({ ...prev, eyes: 'other' }))}
                      >
                        Other
                      </OptionButton>
                    </div>
                    {options.eyes === 'other' && (
                      <Input
                        placeholder="Describe eye color..."
                        value={options.customEyes}
                        onChange={(e) => setOptions(prev => ({ ...prev, customEyes: e.target.value }))}
                        className="mt-2"
                        disabled={generating}
                      />
                    )}
            </div>
          </div>
              )}
            </CardContent>
          </Card>

          {/* Generated Avatar Preview */}
          {showPreview && generatedImageUrl && (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-6">
                <div className="text-center space-y-4">
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <Label className="text-lg font-semibold">Generated Avatar Preview</Label>
                  </div>
                  
                  <div className="flex justify-center">
                    <div className="relative">
                      <img 
                        src={generatedImageUrl} 
                        alt="Generated Avatar Preview" 
                        className="w-32 h-32 rounded-full object-cover border-4 border-primary/20 shadow-lg"
                        onError={(e) => {
                          console.error('Failed to load generated image:', generatedImageUrl);
                          console.error('Image load error event:', e);
                          e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDEyOCAxMjgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiByeD0iNjQiIGZpbGw9IiNmMWY1ZjkiLz4KPHN2ZyB4PSIzMiIgeT0iMzIiIHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM5NGE2YjgiIHN0cm9rZS13aWR0aD0iMiI+CjxwYXRoIGQ9Im0yMCAxNi0yLTJtMC0ydjJtMC0yaDJtLTItMnYyIi8+CjxjaXJjbGUgY3g9IjkiIGN5PSI5IiByPSI3Ii8+CjwvZz4KPC9zdmc+';
                        }}
                      />
            </div>
          </div>
                  
                  <p className="text-sm text-muted-foreground">
                    Do you want to use this avatar for {agentName || 'your agent'}?
                  </p>
                  
                  <div className="flex items-center justify-center gap-3">
                    <Button
                      onClick={handleRejectAvatar}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <X className="h-4 w-4" />
                      Reject
                    </Button>
                    <Button
                      onClick={handleGenerate}
                      variant="outline"
                      size="sm"
                      disabled={generating}
                      className="flex items-center gap-2"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Generate New
                    </Button>
                    <Button
                      onClick={handleApproveAvatar}
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <Check className="h-4 w-4" />
                      Approve & Use
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error Display */}
          {error && (
            <Card className="bg-destructive/10 border-destructive/20">
              <CardContent className="p-4">
                <p className="text-destructive text-sm">{error}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-6 border-t border-border">
          <Button 
            variant="outline" 
            onClick={handleClose} 
            disabled={generating}
          >
            {showPreview ? 'Close' : 'Cancel'}
          </Button>
          {!showPreview && (
          <Button 
            onClick={handleGenerate} 
            disabled={generating}
              className="min-w-[140px]"
          >
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Avatar
              </>
            )}
          </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}