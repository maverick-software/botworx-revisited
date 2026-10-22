import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { X, Bot, ArrowLeft, ArrowRight, Sparkles, Palette, User, Settings, Check, MessageSquare, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { AIQuickSetup } from './agent-wizard/AIQuickSetup';

interface CreateAgentWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AgentData {
  name: string;
  purpose: string;
  description: string;
  gender?: 'male' | 'female' | 'neutral';
  hairColor?: string;
  eyeColor?: string;
  theme: string;
  customInstructions?: string;
  mbtiType?: string;
  avatar_url?: string;
  selectedTools?: string[];
}

interface ToolCapability {
  id: string;
  name: string;
  description: string;
  category: string;
  requiresAuth: boolean;
  authType?: 'oauth' | 'api_key';
  comingSoon?: boolean;
}

const THEMES = [
  { id: 'professional', name: 'Professional', description: 'Business attire, confident pose' },
  { id: 'business-casual', name: 'Business Casual', description: 'Smart casual, approachable' },
  { id: 'futuristic', name: 'Futuristic', description: 'Sci-fi, high-tech aesthetic' },
  { id: 'alien', name: 'Alien', description: 'Otherworldly, unique features' },
  { id: 'animal', name: 'Animal', description: 'Anthropomorphic animal character' },
  { id: 'custom', name: 'Custom', description: 'Your own creative vision' }
];

const MBTI_TYPES = [
  { type: 'INTJ', name: 'The Architect', description: 'Imaginative and strategic thinkers' },
  { type: 'INTP', name: 'The Thinker', description: 'Innovative inventors with unquenchable thirst for knowledge' },
  { type: 'ENTJ', name: 'The Commander', description: 'Bold, imaginative and strong-willed leaders' },
  { type: 'ENTP', name: 'The Debater', description: 'Smart and curious thinkers who love intellectual challenges' },
  { type: 'INFJ', name: 'The Advocate', description: 'Creative and insightful, inspired and independent' },
  { type: 'INFP', name: 'The Mediator', description: 'Poetic, kind and altruistic, always eager to help' },
  { type: 'ENFJ', name: 'The Protagonist', description: 'Charismatic and inspiring leaders' },
  { type: 'ENFP', name: 'The Campaigner', description: 'Enthusiastic, creative and sociable free spirits' },
  { type: 'ISTJ', name: 'The Logistician', description: 'Practical and fact-minded, reliable and responsible' },
  { type: 'ISFJ', name: 'The Protector', description: 'Warm-hearted and dedicated, always ready to protect loved ones' },
  { type: 'ESTJ', name: 'The Executive', description: 'Excellent administrators, unsurpassed at managing things or people' },
  { type: 'ESFJ', name: 'The Consul', description: 'Extraordinarily caring, social and popular people' },
  { type: 'ISTP', name: 'The Virtuoso', description: 'Bold and practical experimenters, masters of all kinds of tools' },
  { type: 'ISFP', name: 'The Adventurer', description: 'Flexible and charming artists, always ready to explore new possibilities' },
  { type: 'ESTP', name: 'The Entrepreneur', description: 'Smart, energetic and perceptive, truly enjoy living on the edge' },
  { type: 'ESFP', name: 'The Entertainer', description: 'Spontaneous, energetic and enthusiastic people' }
];

const HAIR_COLORS = ['Black', 'Brown', 'Blonde', 'Red', 'Gray', 'White', 'Blue', 'Purple', 'Green'];
const EYE_COLORS = ['Brown', 'Blue', 'Green', 'Hazel', 'Gray', 'Amber', 'Violet', 'Red'];

const AVAILABLE_TOOLS: ToolCapability[] = [
  {
    id: 'email',
    name: 'Email',
    description: 'Send and manage emails',
    category: 'Communication',
    requiresAuth: true,
    authType: 'oauth'
  },
  {
    id: 'web_search',
    name: 'Web Search',
    description: 'Search the internet for information',
    category: 'Research',
    requiresAuth: false
  },
  {
    id: 'document_creation',
    name: 'Document Creation',
    description: 'Create, edit, and manage documents',
    category: 'Productivity',
    requiresAuth: false
  },
  {
    id: 'sms',
    name: 'SMS',
    description: 'Send and receive text messages',
    category: 'Communication',
    requiresAuth: true,
    authType: 'api_key',
    comingSoon: true
  },
  {
    id: 'voice',
    name: 'Voice',
    description: 'Voice calls and audio processing',
    category: 'Communication',
    requiresAuth: true,
    authType: 'api_key',
    comingSoon: true
  }
];

const WIZARD_STEPS = [
  { 
    id: 1, 
    title: 'Name', 
    description: 'Agent Name',
    icon: Bot,
    key: 'name'
  },
  { 
    id: 2, 
    title: 'Purpose', 
    description: 'What should this agent be good at?',
    icon: MessageSquare,
    key: 'purpose'
  },
  { 
    id: 3, 
    title: 'Tools', 
    description: 'Select agent capabilities',
    icon: Settings,
    key: 'tools'
  },
  { 
    id: 4, 
    title: 'Theme', 
    description: 'Choose appearance theme',
    icon: Palette,
    key: 'theme'
  },
  { 
    id: 5, 
    title: 'Customize', 
    description: 'Physical attributes & personality',
    icon: User,
    key: 'customize'
  }
];

export function CreateAgentWizard({ open, onOpenChange }: CreateAgentWizardProps) {
  const [step, setStep] = useState(1);
  const [creating, setCreating] = useState(false);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [showAIWizard, setShowAIWizard] = useState(true); // Changed to true - AI first
  const supabase = useSupabaseClient();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Step Indicator Component
  const StepIndicator = () => (
    <div className="flex items-center justify-center space-x-4 py-6 px-6 border-b border-border dark:border-border bg-background dark:bg-background">
      {WIZARD_STEPS.map((stepConfig, index) => {
        const StepIcon = stepConfig.icon;
        const isActive = step === stepConfig.id;
        const isCompleted = step > stepConfig.id;
        const isAccessible = step >= stepConfig.id;

        return (
          <div key={stepConfig.id} className="flex items-center">
            {/* Step Circle */}
            <div className="flex flex-col items-center">
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all
                  ${isCompleted 
                    ? 'bg-primary border-primary text-primary-foreground shadow-sm' 
                    : isActive 
                      ? 'bg-primary border-primary text-primary-foreground shadow-sm' 
                      : 'bg-muted/20 border-muted-foreground/30 text-muted-foreground'
                  }
                `}
              >
                {isCompleted ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <StepIcon className="w-5 h-5" />
                )}
              </div>
              <div className="mt-2 text-center">
                <div className={`text-xs font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {stepConfig.title}
                </div>
              </div>
            </div>

            {/* Connector Line */}
            {index < WIZARD_STEPS.length - 1 && (
              <div 
                className={`
                  w-12 h-0.5 mx-4 transition-all
                  ${step > stepConfig.id ? 'bg-primary' : 'bg-muted-foreground/30'}
                `}
              />
            )}
          </div>
        );
      })}
    </div>
  );

  const [agentData, setAgentData] = useState<AgentData>({
    name: '',
    purpose: '',
    description: '',
    theme: '',
    mbtiType: '',
    selectedTools: [] // Start with no tools selected
  });

  const updateAgentData = (updates: Partial<AgentData>) => {
    setAgentData(prev => ({ ...prev, ...updates }));
  };

  // Handle AI-generated configuration - FULLY AUTOMATED
  const handleAIConfig = async (config: any) => {
    console.log('AI Config received:', config);
    
    // Show loading state
    setCreating(true);
    setGeneratingImage(true);
    
    try {
      const agentConfig = {
        name: config.name || '',
        purpose: config.purpose || '',
        description: config.description || '',
        theme: config.theme || 'professional',
        customInstructions: config.customInstructions || '',
        mbtiType: config.mbtiType || '',
        gender: config.gender,
        hairColor: config.hairColor,
        eyeColor: config.eyeColor,
        selectedTools: config.selectedTools || []
      };
      
      // Generate agent image automatically
      toast.success('✨ Configuration generated! Creating agent...');
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      // Generate image
      const { data: imageData, error: imageError } = await supabase.functions.invoke('generate-agent-image', {
        body: {
          theme: agentConfig.theme,
          gender: agentConfig.gender,
          hairColor: agentConfig.hairColor,
          eyeColor: agentConfig.eyeColor,
          customInstructions: agentConfig.customInstructions,
          agentName: agentConfig.name
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      let avatarUrl = 'https://via.placeholder.com/400x400/6366f1/ffffff?text=AI+Agent';
      if (!imageError && imageData?.success) {
        avatarUrl = imageData.imageUrl;
      }

      // Create the agent directly
      const { data, error } = await supabase.functions.invoke('create-agent', {
        body: {
          name: agentConfig.name.trim(),
          description: agentConfig.description,
          avatar_url: avatarUrl,
          personality: agentConfig.mbtiType || 'helpful',
          metadata: {
            purpose: agentConfig.purpose,
            theme: agentConfig.theme,
            gender: agentConfig.gender,
            hairColor: agentConfig.hairColor,
            eyeColor: agentConfig.eyeColor,
            mbtiType: agentConfig.mbtiType,
            customInstructions: agentConfig.customInstructions,
            aiGenerated: true
          }
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to create agent');
      }

      const newAgent = data.agent;
      
      toast.success(`🎉 ${agentConfig.name} created successfully!`);
      
      if (data.reasoning_permissions_granted) {
        toast.success('Advanced reasoning capabilities enabled!', { duration: 3000 });
      }
      
      // Close modal and navigate to the new agent's chat page
      onOpenChange(false);
      resetWizard();
      navigate(`/agents/${newAgent.id}/chat`);

    } catch (error: any) {
      console.error('Error creating agent:', error);
      toast.error(`Failed to create agent: ${error.message}`);
    } finally {
      setCreating(false);
      setGeneratingImage(false);
    }
  };

  const handleNext = async () => {
    if (step === 1) {
      if (!agentData.name.trim()) {
        toast.error('Please enter an agent name');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!agentData.purpose.trim()) {
        toast.error('Please describe what your agent should be good at');
        return;
      }
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    } else if (step === 4) {
      if (!agentData.theme) {
        toast.error('Please select a theme');
        return;
      }
      setStep(5);
    } else if (step === 5) {
      await handleCreate();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const generateDescription = async (purpose: string): Promise<string> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      const { data, error } = await supabase.functions.invoke('generate-agent-description', {
        body: {
          purpose: purpose,
          agentName: agentData.name
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to generate description');
      }

      return data.description;
    } catch (error) {
      console.error('Error generating description:', error);
      // Fallback to template-based description
      return `An AI assistant specialized in ${purpose.toLowerCase()}. This agent is designed to provide expert guidance, answer questions, and assist with tasks related to ${purpose.toLowerCase()}. With a focus on accuracy and helpfulness, this agent combines knowledge with practical problem-solving skills.`;
    }
  };

  const generateRandomAttributes = () => {
    const randomGender = Math.random() > 0.5 ? 'female' : 'male';
    const randomHair = HAIR_COLORS[Math.floor(Math.random() * HAIR_COLORS.length)];
    const randomEyes = EYE_COLORS[Math.floor(Math.random() * EYE_COLORS.length)];
    const randomMBTI = MBTI_TYPES[Math.floor(Math.random() * MBTI_TYPES.length)].type;
    
    updateAgentData({
      gender: randomGender,
      hairColor: randomHair,
      eyeColor: randomEyes,
      mbtiType: randomMBTI
    });
  };

  const generateAgentImage = async (): Promise<string> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      const { data, error } = await supabase.functions.invoke('generate-agent-image', {
        body: {
          theme: agentData.theme,
          gender: agentData.gender,
          hairColor: agentData.hairColor,
          eyeColor: agentData.eyeColor,
          customInstructions: agentData.customInstructions,
          agentName: agentData.name
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to generate image');
      }

      return data.imageUrl;
    } catch (error) {
      console.error('Error generating image:', error);
      // Fallback to placeholder
      return 'https://via.placeholder.com/400x400/6366f1/ffffff?text=AI+Agent';
    }
  };

  const handleCreate = async () => {
    if (!agentData.theme) {
      toast.error('Please select a theme for your agent');
      return;
    }

    setCreating(true);

    try {
      // Generate image if needed
      let avatarUrl = agentData.avatar_url;
      if (!avatarUrl) {
        setGeneratingImage(true);
        avatarUrl = await generateAgentImage();
        updateAgentData({ avatar_url: avatarUrl });
      }

      // Get the user's session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      // Call the create-agent edge function
      const { data, error } = await supabase.functions.invoke('create-agent', {
        body: {
          name: agentData.name.trim(),
          description: agentData.description,
          avatar_url: avatarUrl,
          personality: agentData.mbtiType || 'helpful',
          metadata: {
            purpose: agentData.purpose,
            theme: agentData.theme,
            gender: agentData.gender,
            hairColor: agentData.hairColor,
            eyeColor: agentData.eyeColor,
            mbtiType: agentData.mbtiType,
            customInstructions: agentData.customInstructions
          }
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to create agent');
      }

      const newAgent = data.agent;
      
      toast.success(`${agentData.name} created successfully!`);
      
      // Show additional success message if reasoning permissions were granted
      if (data.reasoning_permissions_granted) {
        toast.success('Advanced reasoning capabilities enabled!', { duration: 3000 });
      }
      
      // Close modal and navigate to the new agent's chat page
      onOpenChange(false);
      resetWizard();
      navigate(`/agents/${newAgent.id}/chat`);

    } catch (error: any) {
      console.error('Error creating agent:', error);
      toast.error(`Failed to create agent: ${error.message}`);
    } finally {
      setCreating(false);
      setGeneratingImage(false);
    }
  };

  const resetWizard = () => {
    setStep(1);
    setShowAIWizard(true); // Reset to AI wizard for next time
    setAgentData({
      name: '',
      purpose: '',
      description: '',
      theme: '',
      mbtiType: ''
    });
  };

  const handleClose = () => {
    onOpenChange(false);
    resetWizard();
  };

  const renderStep1 = () => (
    <div className="text-center bg-muted/10 rounded-lg p-6 border border-muted-foreground/10">
      <Bot className="w-12 h-12 text-primary mx-auto mb-4" />
      <h3 className="text-xl font-semibold mb-6">What's your agent's name?</h3>
      
      <div className="flex flex-col items-center">
        <Input
          id="agent-name"
          placeholder="e.g., Sarah, Research Assistant, Code Helper..."
          value={agentData.name}
          onChange={(e) => updateAgentData({ name: e.target.value })}
          autoFocus
          className="text-lg py-4 px-4 bg-muted/30 border-muted-foreground/20 rounded focus:bg-background transition-colors text-center w-1/2 min-w-[300px]"
        />
      </div>
    </div>
  );

  const handleEnhanceWithAI = async () => {
    if (!agentData.purpose.trim()) {
      toast.error('Please enter a purpose first');
      return;
    }

    setGeneratingDescription(true);
    try {
      const description = await generateDescription(agentData.purpose);
      updateAgentData({ purpose: description });
      toast.success('Enhanced with AI!');
    } catch (error) {
      console.error('Error enhancing with AI:', error);
      toast.error('Failed to enhance with AI. Please try again.');
    } finally {
      setGeneratingDescription(false);
    }
  };

  const renderStep2 = () => (
    <div className="text-center bg-muted/10 rounded-lg p-6 border border-muted-foreground/10">
      <Sparkles className="w-12 h-12 text-primary mx-auto mb-4" />
      <h3 className="text-xl font-semibold mb-6">What should {agentData.name} be good at?</h3>
      
      <div className="flex flex-col items-center space-y-4">
        <Textarea
          id="agent-purpose"
          placeholder="e.g., Helping with customer support, Research and analysis, Creative writing, Technical documentation..."
          value={agentData.purpose}
          onChange={(e) => updateAgentData({ purpose: e.target.value })}
          rows={5}
          className="resize-none bg-muted/30 border-muted-foreground/20 rounded focus:bg-background transition-colors py-4 px-4 w-1/2 min-w-[300px]"
        />
        
        <button
          onClick={handleEnhanceWithAI}
          disabled={generatingDescription || !agentData.purpose.trim()}
          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors"
        >
          {generatingDescription ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Enhancing...</span>
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4" />
              <span>Enhance with AI</span>
            </>
          )}
        </button>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="bg-muted/10 rounded-lg p-6 border border-muted-foreground/10">
      <div className="text-center mb-6">
        <Palette className="w-12 h-12 text-primary mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">Choose Theme for {agentData.name}</h3>
      </div>

      {/* Theme Selection */}
      <div className="space-y-4">
        <Label className="text-sm font-medium">Theme <span className="text-destructive">*</span></Label>
        <div className="grid grid-cols-2 gap-3">
          {THEMES.map((theme) => (
            <Card 
              key={theme.id}
              className={`cursor-pointer transition-all rounded-lg ${
                agentData.theme === theme.id 
                  ? 'ring-2 ring-primary border-primary bg-primary/5' 
                  : 'hover:border-primary/50 bg-muted/20 hover:bg-muted/30'
              }`}
              onClick={() => updateAgentData({ theme: theme.id })}
            >
              <CardContent className="p-4">
                <div className="font-medium text-sm mb-1">{theme.name}</div>
                <div className="text-xs text-muted-foreground">{theme.description}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Custom Instructions for Custom Theme */}
        {agentData.theme === 'custom' && (
          <div className="space-y-2 mt-4">
            <Label htmlFor="custom-instructions" className="text-sm font-medium">
              Custom Theme Instructions
            </Label>
            <Textarea
              id="custom-instructions"
              placeholder="Describe your custom theme in detail..."
              value={agentData.customInstructions || ''}
              onChange={(e) => updateAgentData({ customInstructions: e.target.value })}
              rows={4}
              className="resize-none bg-muted/30 border-muted-foreground/20 rounded-lg focus:bg-background transition-colors"
            />
          </div>
        )}
      </div>
    </div>
  );

  const toggleTool = (toolId: string) => {
    const currentTools = agentData.selectedTools || [];
    const updatedTools = currentTools.includes(toolId)
      ? currentTools.filter(id => id !== toolId)
      : [...currentTools, toolId];
    updateAgentData({ selectedTools: updatedTools });
  };

  const renderStep4 = () => (
    <div className="bg-muted/10 rounded-lg p-6 border border-muted-foreground/10">
      <div className="text-center mb-6">
        <User className="w-12 h-12 text-primary mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">Customize {agentData.name}</h3>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Left Column - Physical Attributes */}
        <div className="space-y-4">
          <Label className="text-sm font-medium">Physical Attributes</Label>
          
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Gender</Label>
              <Select value={agentData.gender || ''} onValueChange={(value) => updateAgentData({ gender: value as any })}>
                <SelectTrigger className="bg-muted/30 border-muted-foreground/20 rounded-lg focus:bg-background transition-colors">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="neutral">Neutral</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Hair Color</Label>
              <Select value={agentData.hairColor || ''} onValueChange={(value) => updateAgentData({ hairColor: value })}>
                <SelectTrigger className="bg-muted/30 border-muted-foreground/20 rounded-lg focus:bg-background transition-colors">
                  <SelectValue placeholder="Select hair color" />
                </SelectTrigger>
                <SelectContent>
                  {HAIR_COLORS.map(color => (
                    <SelectItem key={color} value={color}>{color}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Eye Color</Label>
              <Select value={agentData.eyeColor || ''} onValueChange={(value) => updateAgentData({ eyeColor: value })}>
                <SelectTrigger className="bg-muted/30 border-muted-foreground/20 rounded-lg focus:bg-background transition-colors">
                  <SelectValue placeholder="Select eye color" />
                </SelectTrigger>
                <SelectContent>
                  {EYE_COLORS.map(color => (
                    <SelectItem key={color} value={color}>{color}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Right Column - Personality */}
        <div className="space-y-4">
          <Label className="text-sm font-medium">Personality Type</Label>
          
          <div className="space-y-3">
            <div className="space-y-2">
              <Select value={agentData.mbtiType || ''} onValueChange={(value) => updateAgentData({ mbtiType: value })}>
                <SelectTrigger className="bg-muted/30 border-muted-foreground/20 rounded-lg focus:bg-background transition-colors">
                  <SelectValue placeholder="Select MBTI personality" />
                </SelectTrigger>
                <SelectContent>
                  {MBTI_TYPES.map(mbti => (
                    <SelectItem key={mbti.type} value={mbti.type}>
                      <div className="flex flex-col">
                        <span>{mbti.type} - {mbti.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Selected MBTI Description */}
            {agentData.mbtiType && (
              <Card className="bg-muted/20 border-muted-foreground/20 rounded-lg">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">{agentData.mbtiType}</Badge>
                    <span className="font-medium text-sm">
                      {MBTI_TYPES.find(m => m.type === agentData.mbtiType)?.name}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {MBTI_TYPES.find(m => m.type === agentData.mbtiType)?.description}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Random Generation Button */}
      <div className="flex justify-center mt-6">
        <Button 
          variant="outline" 
          onClick={generateRandomAttributes}
          className="w-full max-w-sm bg-muted/20 border-muted-foreground/20 rounded-lg hover:bg-muted/30 transition-colors"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Generate Random Attributes
        </Button>
      </div>
    </div>
  );

  const renderStep5 = () => {
    const selectedTools = agentData.selectedTools || [];
    
    // Group tools by category for two-column layout
    const communicationTools = AVAILABLE_TOOLS.filter(tool => tool.category === 'Communication');
    const otherTools = AVAILABLE_TOOLS.filter(tool => tool.category !== 'Communication');

    const renderToolCard = (tool: ToolCapability) => {
      const isSelected = selectedTools.includes(tool.id);
      const isComingSoon = tool.comingSoon;
      
      return (
        <div
          key={tool.id}
          className={`flex items-center justify-between p-3 bg-background/50 rounded-lg border border-muted-foreground/10 ${
            isComingSoon ? 'opacity-50' : ''
          }`}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`font-medium text-sm ${isComingSoon ? 'text-muted-foreground' : ''}`}>
                {tool.name}
              </span>
              {isComingSoon && (
                <span className="text-xs text-muted-foreground/70 italic">
                  (coming soon)
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{tool.description}</p>
          </div>
          <Switch
            checked={isSelected}
            onCheckedChange={() => toggleTool(tool.id)}
            disabled={isComingSoon}
            className="ml-3 flex-shrink-0"
          />
        </div>
      );
    };

    return (
      <div className="bg-muted/10 rounded-lg p-6 border border-muted-foreground/10">
        <div className="text-center mb-6">
          <Settings className="w-12 h-12 text-primary mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">Which tools should {agentData.name} have access to?</h3>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Left Column - Communication */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Communication
            </h4>
            <div className="space-y-2">
              {communicationTools.map(renderToolCard)}
            </div>
          </div>

          {/* Right Column - Other Tools */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Productivity & Research
            </h4>
            <div className="space-y-2">
              {otherTools.map(renderToolCard)}
            </div>
          </div>
        </div>

        {/* Auth Notice - Show only if tools requiring auth are selected */}
        {(() => {
          const selectedAuthTools = AVAILABLE_TOOLS.filter(tool => 
            selectedTools.includes(tool.id) && tool.requiresAuth && !tool.comingSoon
          );
          
          if (selectedAuthTools.length === 0) return null;
          
          return (
            <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <div className="flex items-start gap-2">
                <div className="w-4 h-4 rounded-full bg-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                    Authentication Required
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    You'll need to connect API keys or OAuth credentials for the selected tools after creating your agent.
                  </p>
                </div>
              </div>
            </div>
          );
        })()}

        <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <div className="flex items-start gap-2">
            <div className="w-4 h-4 rounded-full bg-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                More Tools Available
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                Additional tools will be available after you create your agent. You can enable them anytime in the agent settings.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Show AI wizard first, or manual wizard after user switches
  if (showAIWizard) {
    return (
      <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 flex flex-col w-full max-w-[800px] translate-x-[-50%] translate-y-[-50%] border bg-background shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] rounded-xl border-border dark:border-border max-h-[90vh] h-[90vh]">
            
            {/* Accessibility - Hidden title and description for screen readers */}
            <VisuallyHidden.Root>
              <DialogPrimitive.Title>Create New Agent with AI</DialogPrimitive.Title>
              <DialogPrimitive.Description>
                Use AI to generate your agent configuration by describing what you want in natural language.
              </DialogPrimitive.Description>
            </VisuallyHidden.Root>

            {/* Header with switch to manual option */}
            <div className="flex-shrink-0 px-8 py-6 border-b border-border/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-6 h-6 text-primary" />
                  <h2 className="text-xl font-semibold">AI Agent Wizard</h2>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAIWizard(false)}
                    disabled={creating || generatingImage}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Manual Setup
                  </Button>
                  <DialogPrimitive.Close 
                    className="rounded-md p-2 opacity-70 ring-offset-background transition-opacity hover:opacity-100 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-muted"
                    onClick={handleClose}
                    disabled={creating || generatingImage}
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                  </DialogPrimitive.Close>
                </div>
              </div>
            </div>
            
            {/* AI Wizard Content with Loading Overlay */}
            <div className="flex-1 overflow-hidden relative">
              {(creating || generatingImage) && (
                <div className="absolute inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center">
                  <div className="text-center space-y-6 max-w-md px-6">
                    <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
                    <div className="space-y-3">
                      <p className="text-lg font-semibold">
                        {generatingImage ? 'Generating avatar...' : 'Creating your agent...'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        This may take a few moments
                      </p>
                      
                      {/* Progress Bar */}
                      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full transition-all duration-1000 ease-out animate-pulse"
                          style={{ 
                            width: generatingImage ? '66%' : '90%',
                            animation: 'progress 2s ease-in-out infinite'
                          }}
                        />
                      </div>
                      
                      <style>{`
                        @keyframes progress {
                          0% { width: 10%; }
                          50% { width: ${generatingImage ? '66%' : '90%'}; }
                          100% { width: 10%; }
                        }
                      `}</style>
                    </div>
                  </div>
                </div>
              )}
              <AIQuickSetup 
                onConfigGenerated={handleAIConfig}
                onClose={handleClose}
              />
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    );
  }

  // Manual wizard flow
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 flex flex-col w-full max-w-[800px] translate-x-[-50%] translate-y-[-50%] border bg-background shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] rounded-xl border-border dark:border-border max-h-[90vh] h-[90vh]">
          
          {/* Accessibility - Hidden title and description for screen readers */}
          <VisuallyHidden.Root>
            <DialogPrimitive.Title>Create New Agent</DialogPrimitive.Title>
            <DialogPrimitive.Description>
              A multi-step wizard to create and customize your AI agent with tools, themes, and personality settings.
            </DialogPrimitive.Description>
          </VisuallyHidden.Root>
          
          {/* Close Button */}
          <div className="absolute top-4 right-4 z-10">
            <DialogPrimitive.Close 
              className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
              onClick={handleClose}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          {/* Step Indicator */}
          <div className="flex-shrink-0">
            <StepIndicator />
          </div>
          
          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-6 py-6">
              {step === 1 && renderStep1()}
              {step === 2 && renderStep2()}
              {step === 3 && renderStep5()}
              {step === 4 && renderStep3()}
              {step === 5 && renderStep4()}
            </div>
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 px-6 py-4 border-t border-border dark:border-border bg-background dark:bg-background rounded-b-xl">
            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={step === 1 ? handleClose : handleBack}
                disabled={creating || generatingDescription || generatingImage}
              >
                {step === 1 ? 'Cancel' : (
                  <>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </>
                )}
              </Button>
              
              <Button
                onClick={handleNext}
                disabled={creating || generatingDescription || generatingImage}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {generatingDescription ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : creating || generatingImage ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating Agent...
                  </>
                ) : step === 5 ? (
                  'Create Agent'
                ) : (
                  <>
                    Next
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
