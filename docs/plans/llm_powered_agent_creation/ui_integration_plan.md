# UI Integration Plan - AI Wizard Enhancement

**Date**: October 24, 2025  
**Feature**: Add AI Wizard to Existing Create Agent Modal  
**Component**: `CreateAgentWizard.tsx`  
**Approach**: Non-intrusive enhancement with optional AI path

---

## Overview

Instead of creating a separate modal, we'll enhance the existing `CreateAgentWizard` component with an **"AI Wizard"** option that allows users to skip manual configuration steps.

### User Experience Flow

```
┌─────────────────────────────────────────────────────────────┐
│              Create Agent Modal Opens                        │
│                                                              │
│  Current 5-step wizard:                                      │
│  1. Name  2. Purpose  3. Tools  4. Theme  5. Customize      │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  🤖 Want to skip these steps?                      │    │
│  │                                                     │    │
│  │  [Use AI Wizard 🪄]  - Auto-configure everything  │    │
│  │                                                     │    │
│  │  Or continue with manual setup →                   │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## Integration Design

### Option 1: Banner at Top of Wizard (RECOMMENDED)

Add a prominent banner at the top of the wizard (above step indicator) that users see immediately:

```typescript
// At the top of CreateAgentWizard, before step indicator
<div className="px-6 pt-6 pb-4 border-b border-border bg-accent/30">
  <div className="flex items-center justify-between">
    <div className="flex-1">
      <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
        <Wand2 className="w-4 h-4 text-primary" />
        Skip the Setup
      </h3>
      <p className="text-xs text-muted-foreground mt-1">
        Let AI configure everything in seconds
      </p>
    </div>
    <Button
      onClick={() => setShowAIWizard(true)}
      variant="default"
      size="sm"
      className="ml-4"
    >
      <Sparkles className="w-4 h-4 mr-2" />
      Use AI Wizard
    </Button>
  </div>
</div>
```

**Visual Mock:**
```
┌──────────────────────────────────────────────────────────┐
│ ✨ Skip the Setup                        [Use AI Wizard] │
│    Let AI configure everything in seconds                │
├──────────────────────────────────────────────────────────┤
│                                                          │
│        Step Indicator (1. Name  2. Purpose ...)          │
│                                                          │
```

### Option 2: First Step Alternative

On **Step 1 (Name)**, show AI option prominently:

```typescript
// In Step 1 content
<div className="space-y-6">
  {/* AI Quick Setup Card */}
  <Card className="border-2 border-primary/20 bg-primary/5">
    <CardHeader>
      <CardTitle className="text-base flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-primary" />
        AI Quick Setup
      </CardTitle>
      <CardDescription>
        Describe what you want, and AI will configure everything for you
      </CardDescription>
    </CardHeader>
    <CardContent>
      <Button 
        onClick={() => setShowAIWizard(true)}
        className="w-full"
        size="lg"
      >
        <Wand2 className="w-4 h-4 mr-2" />
        Use AI Wizard
      </Button>
    </CardContent>
  </Card>
  
  <div className="relative">
    <div className="absolute inset-0 flex items-center">
      <span className="w-full border-t border-border" />
    </div>
    <div className="relative flex justify-center text-xs uppercase">
      <span className="bg-background px-2 text-muted-foreground">
        Or configure manually
      </span>
    </div>
  </div>
  
  {/* Existing manual name input */}
  <div className="space-y-2">
    <Label htmlFor="name">Agent Name *</Label>
    <Input ... />
  </div>
</div>
```

---

## Component Structure

### Enhanced CreateAgentWizard.tsx

```typescript
export function CreateAgentWizard({ open, onOpenChange }: CreateAgentWizardProps) {
  // Existing state
  const [step, setStep] = useState(1);
  const [agentData, setAgentData] = useState<AgentData>({...});
  const [creating, setCreating] = useState(false);
  
  // NEW: AI Wizard state
  const [showAIWizard, setShowAIWizard] = useState(false);
  const [aiGeneratedConfig, setAIGeneratedConfig] = useState<GeneratedConfig | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiStep, setAIStep] = useState<'input' | 'preview' | 'creating'>('input');

  // NEW: AI Wizard handler
  const handleAIGeneration = async (description: string) => {
    setIsGenerating(true);
    try {
      const result = await generateAgentConfig(description);
      setAIGeneratedConfig(result.configuration);
      setAIStep('preview');
    } catch (error) {
      toast.error('Failed to generate configuration');
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  // NEW: Apply AI config to wizard
  const handleApplyAIConfig = () => {
    if (!aiGeneratedConfig) return;
    
    // Populate wizard fields with AI-generated data
    setAgentData({
      name: aiGeneratedConfig.name,
      purpose: aiGeneratedConfig.metadata?.purpose || '',
      description: aiGeneratedConfig.description,
      theme: aiGeneratedConfig.theme || 'professional',
      customInstructions: aiGeneratedConfig.behavior?.role || '',
      mbtiType: aiGeneratedConfig.mbtiType,
      gender: aiGeneratedConfig.gender,
      selectedTools: Object.entries(aiGeneratedConfig.suggested_tools || {})
        .filter(([_, enabled]) => enabled)
        .map(([tool]) => tool)
    });
    
    // Close AI wizard, show preview in main wizard
    setShowAIWizard(false);
    setStep(5); // Jump to final step (Customize) for review
    toast.success('AI configuration applied! Review and create your agent.');
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="..." />
        <DialogPrimitive.Content className="...">
          
          {/* AI Wizard Overlay (when active) */}
          {showAIWizard && (
            <AIWizardOverlay
              open={showAIWizard}
              onClose={() => setShowAIWizard(false)}
              onGenerate={handleAIGeneration}
              isGenerating={isGenerating}
              generatedConfig={aiGeneratedConfig}
              aiStep={aiStep}
              onApply={handleApplyAIConfig}
              onRegenerate={() => setAIStep('input')}
            />
          )}
          
          {/* Existing wizard content (when AI wizard not active) */}
          {!showAIWizard && (
            <>
              {/* AI Banner at top */}
              <AIQuickSetupBanner onUseAI={() => setShowAIWizard(true)} />
              
              {/* Existing step indicator */}
              <StepIndicator />
              
              {/* Existing wizard steps */}
              {step === 1 && <NameStep />}
              {step === 2 && <PurposeStep />}
              {/* ... etc */}
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
```

---

## New Components to Create

### 1. AIQuickSetupBanner.tsx

**Location**: `src/components/agent-wizard/AIQuickSetupBanner.tsx`

```typescript
import { Sparkles, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AIQuickSetupBannerProps {
  onUseAI: () => void;
}

export function AIQuickSetupBanner({ onUseAI }: AIQuickSetupBannerProps) {
  return (
    <div className="px-6 pt-6 pb-4 border-b border-border bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Wand2 className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">
              Skip the Setup
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-medium">
              NEW
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Describe what you want, and AI will configure everything in seconds
          </p>
        </div>
        <Button
          onClick={onUseAI}
          variant="default"
          size="sm"
          className="shrink-0"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Use AI Wizard
        </Button>
      </div>
    </div>
  );
}
```

### 2. AIWizardOverlay.tsx

**Location**: `src/components/agent-wizard/AIWizardOverlay.tsx`

```typescript
import { useState } from 'react';
import { Sparkles, ArrowLeft, RefreshCw, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface AIWizardOverlayProps {
  open: boolean;
  onClose: () => void;
  onGenerate: (description: string) => void;
  isGenerating: boolean;
  generatedConfig: any | null;
  aiStep: 'input' | 'preview' | 'creating';
  onApply: () => void;
  onRegenerate: () => void;
}

export function AIWizardOverlay({
  open,
  onClose,
  onGenerate,
  isGenerating,
  generatedConfig,
  aiStep,
  onApply,
  onRegenerate
}: AIWizardOverlayProps) {
  const [description, setDescription] = useState('');

  const handleGenerate = () => {
    if (!description.trim()) return;
    onGenerate(description);
  };

  if (!open) return null;

  return (
    <div className="absolute inset-0 bg-background z-50 flex flex-col">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="p-2"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                AI Agent Wizard
              </h2>
              <p className="text-xs text-muted-foreground">
                {aiStep === 'input' && 'Describe your ideal agent'}
                {aiStep === 'preview' && 'Review and customize your configuration'}
                {aiStep === 'creating' && 'Creating your agent...'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Input Step */}
        {aiStep === 'input' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Describe Your Agent</CardTitle>
                <CardDescription>
                  Tell us what you want your agent to do, and we'll configure everything automatically
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ai-description">Agent Description</Label>
                  <Textarea
                    id="ai-description"
                    placeholder="Example: Create a friendly SEO specialist agent that helps with keyword research, content optimization, and technical SEO audits. Should be analytical but approachable."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={6}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    Be specific about the role, tone, and capabilities you want
                  </p>
                </div>

                <Button
                  onClick={handleGenerate}
                  disabled={!description.trim() || isGenerating}
                  className="w-full"
                  size="lg"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating Configuration...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate Agent Configuration
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Example Prompts */}
            <ExamplePrompts onSelectExample={(example) => setDescription(example)} />
          </div>
        )}

        {/* Preview Step */}
        {aiStep === 'preview' && generatedConfig && (
          <div className="max-w-4xl mx-auto space-y-6">
            <ConfigurationPreview config={generatedConfig} />
            
            <div className="flex items-center justify-between gap-4 sticky bottom-0 bg-background py-4 border-t border-border">
              <Button
                variant="outline"
                onClick={onRegenerate}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Regenerate
              </Button>
              <Button
                onClick={onApply}
                size="lg"
              >
                <Check className="w-4 h-4 mr-2" />
                Apply Configuration
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

### 3. ConfigurationPreview.tsx

**Location**: `src/components/agent-wizard/ConfigurationPreview.tsx`

```typescript
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, MessageSquare, Wrench, Palette, Brain } from 'lucide-react';

interface ConfigurationPreviewProps {
  config: any;
}

export function ConfigurationPreview({ config }: ConfigurationPreviewProps) {
  return (
    <Tabs defaultValue="identity" className="w-full">
      <TabsList className="grid w-full grid-cols-5">
        <TabsTrigger value="identity">
          <User className="w-4 h-4 mr-2" />
          Identity
        </TabsTrigger>
        <TabsTrigger value="behavior">
          <MessageSquare className="w-4 h-4 mr-2" />
          Behavior
        </TabsTrigger>
        <TabsTrigger value="tools">
          <Wrench className="w-4 h-4 mr-2" />
          Tools
        </TabsTrigger>
        <TabsTrigger value="appearance">
          <Palette className="w-4 h-4 mr-2" />
          Appearance
        </TabsTrigger>
        <TabsTrigger value="advanced">
          <Brain className="w-4 h-4 mr-2" />
          Advanced
        </TabsTrigger>
      </TabsList>

      {/* Identity Tab */}
      <TabsContent value="identity" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agent Identity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Name</Label>
              <p className="text-sm font-medium">{config.name}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Description</Label>
              <p className="text-sm">{config.description}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Personality</Label>
              <Badge variant="secondary">{config.personality}</Badge>
            </div>
            {config.mbtiType && (
              <div>
                <Label className="text-xs text-muted-foreground">MBTI Type</Label>
                <Badge variant="outline">{config.mbtiType}</Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Behavior Tab */}
      <TabsContent value="behavior" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Core Behavior</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {config.behavior?.role && (
              <div>
                <Label className="text-xs text-muted-foreground font-semibold">Role</Label>
                <p className="text-sm mt-1 whitespace-pre-wrap">{config.behavior.role}</p>
              </div>
            )}
            {config.behavior?.instructions && (
              <div>
                <Label className="text-xs text-muted-foreground font-semibold">Instructions</Label>
                <p className="text-sm mt-1 whitespace-pre-wrap">{config.behavior.instructions}</p>
              </div>
            )}
            {config.behavior?.constraints && (
              <div>
                <Label className="text-xs text-muted-foreground font-semibold">Constraints</Label>
                <p className="text-sm mt-1 whitespace-pre-wrap">{config.behavior.constraints}</p>
              </div>
            )}
            {config.behavior?.rules && config.behavior.rules.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground font-semibold">Rules ({config.behavior.rules.length})</Label>
                <ul className="text-sm mt-1 space-y-1">
                  {config.behavior.rules.map((rule: any, idx: number) => (
                    <li key={idx} className="flex gap-2">
                      <span className="text-muted-foreground">{idx + 1}.</span>
                      <span>{rule.content}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Tools Tab */}
      <TabsContent value="tools" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Suggested Capabilities</CardTitle>
            <CardDescription>These tools will be enabled based on your agent's purpose</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(config.suggested_tools || {}).map(([tool, enabled]) => (
                <div
                  key={tool}
                  className={`p-3 rounded-lg border ${
                    enabled 
                      ? 'border-primary/30 bg-primary/5' 
                      : 'border-border bg-muted/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium capitalize">
                      {tool.replace(/_/g, ' ').replace(' enabled', '')}
                    </span>
                    {enabled ? (
                      <Badge variant="default" className="text-xs">Enabled</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">Disabled</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Additional tabs for Appearance and Advanced... */}
    </Tabs>
  );
}
```

### 4. ExamplePrompts.tsx

**Location**: `src/components/agent-wizard/ExamplePrompts.tsx`

```typescript
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lightbulb } from 'lucide-react';

const EXAMPLES = [
  {
    category: 'Sales & Marketing',
    prompts: [
      'Create a friendly SEO specialist agent that helps with keyword research, content optimization, and technical SEO audits. Should be analytical but approachable.',
      'I need an enthusiastic social media manager agent that creates engaging content, schedules posts, and analyzes performance metrics across platforms.'
    ]
  },
  {
    category: 'Customer Support',
    prompts: [
      'Create a patient technical support agent that troubleshoots software issues, provides step-by-step solutions, and escalates complex problems when needed.',
      'I want a supportive customer success agent that helps onboard new users, answers product questions, and ensures customer satisfaction.'
    ]
  },
  {
    category: 'Development',
    prompts: [
      'Create an analytical code review assistant that checks for bugs, suggests improvements, ensures best practices, and provides constructive feedback.',
      'I need a direct and efficient DevOps agent that handles deployment pipelines, monitors system health, and troubleshoots infrastructure issues.'
    ]
  }
];

interface ExamplePromptsProps {
  onSelectExample: (prompt: string) => void;
}

export function ExamplePrompts({ onSelectExample }: ExamplePromptsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-primary" />
          Example Prompts
        </CardTitle>
        <CardDescription>
          Click any example to use it as a starting point
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {EXAMPLES.map((category) => (
          <div key={category.category}>
            <h4 className="text-sm font-semibold mb-2">{category.category}</h4>
            <div className="space-y-2">
              {category.prompts.map((prompt, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  className="w-full h-auto text-left justify-start whitespace-normal p-3"
                  onClick={() => onSelectExample(prompt)}
                >
                  <p className="text-xs">{prompt}</p>
                </Button>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

---

## Implementation Checklist

### Step 1: Create New Components (1-2 hours)
- [ ] Create `src/components/agent-wizard/AIQuickSetupBanner.tsx`
- [ ] Create `src/components/agent-wizard/AIWizardOverlay.tsx`
- [ ] Create `src/components/agent-wizard/ConfigurationPreview.tsx`
- [ ] Create `src/components/agent-wizard/ExamplePrompts.tsx`
- [ ] Create `src/hooks/useAgentGeneration.ts` for API calls

### Step 2: Enhance CreateAgentWizard.tsx (1-2 hours)
- [ ] Add AI wizard state management
- [ ] Add AIQuickSetupBanner to top of modal
- [ ] Implement AIWizardOverlay integration
- [ ] Add logic to apply AI config to wizard fields
- [ ] Add ability to jump to review step after AI generation
- [ ] Maintain backward compatibility with manual flow

### Step 3: API Integration (30 minutes)
- [ ] Create `useAgentGeneration` hook
- [ ] Implement call to `generate-agent-config` edge function
- [ ] Add error handling and retries
- [ ] Add loading states

### Step 4: Testing & Polish (1 hour)
- [ ] Test AI wizard flow end-to-end
- [ ] Test manual wizard still works perfectly
- [ ] Test switching between AI and manual mid-flow
- [ ] Ensure mobile responsiveness
- [ ] Add animations and transitions
- [ ] Test error scenarios

---

## User Flow Examples

### Flow 1: Pure AI Generation
```
1. User clicks "Create Agent" → CreateAgentWizard opens
2. User sees banner: "Skip the Setup - Use AI Wizard"
3. User clicks "Use AI Wizard"
4. AI overlay appears with description input
5. User enters: "Create a helpful customer support agent"
6. User clicks "Generate" → Loading state (15-30s)
7. Configuration preview appears with all sections
8. User reviews → clicks "Apply Configuration"
9. Returns to wizard at final step with all fields pre-filled
10. User clicks "Create Agent" → Agent created!
```

### Flow 2: AI Generation + Manual Refinement
```
1-8. Same as Flow 1
9. User notices they want to change the personality
10. User closes AI overlay → returns to wizard
11. Wizard has all AI-generated values populated
12. User navigates to Identity step → changes personality
13. User completes wizard → Agent created with custom changes
```

### Flow 3: Start Manual, Switch to AI
```
1. User starts manual wizard → enters name on Step 1
2. User realizes it's tedious → clicks "Use AI Wizard" banner
3. AI overlay opens
4. User describes full agent
5. AI generates config → applies to wizard
6. Name field is replaced with AI-generated name
7. User continues from there
```

### Flow 4: Pure Manual (No Change)
```
1. User opens wizard
2. User ignores AI banner
3. User completes all 5 steps manually
4. Everything works exactly as before
```

---

## Visual Design

### AI Banner Style (Top of Modal)

```
╔═══════════════════════════════════════════════════════════╗
║ ✨ Skip the Setup                     [ Use AI Wizard ]  ║
║    Let AI configure everything in seconds        NEW      ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║        Step Indicator (•────○────○────○────○)            ║
║                                                           ║
```

**Colors:**
- Background: `bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5`
- Border: `border-border`
- Button: Primary with Sparkles icon
- "NEW" badge: `bg-primary/20 text-primary`

---

## Key Benefits of This Approach

### ✅ Non-Intrusive
- Existing wizard unchanged
- Users can ignore AI option completely
- Familiar UI for existing users

### ✅ Flexible
- Users can switch between AI and manual at any time
- AI can pre-fill wizard for review
- Manual edits always possible

### ✅ Discoverable
- Prominent banner ensures visibility
- Clear call-to-action
- Examples guide users

### ✅ Seamless Integration
- No code duplication
- Uses existing wizard infrastructure
- Maintains all validation and error handling

### ✅ Progressive Enhancement
- Feature degrades gracefully if AI fails
- Users can complete manually if needed
- No breaking changes to existing flow

---

## Next Steps

1. **Review and approve** this UI integration approach
2. **Implement backend** (generate-agent-config function) first
3. **Create new components** (AIQuickSetupBanner, AIWizardOverlay, etc.)
4. **Enhance CreateAgentWizard** with AI integration
5. **Test thoroughly** with both flows
6. **Deploy with feature flag** for gradual rollout

---

**Status**: Ready for Implementation  
**Estimated Time**: 3-5 hours for UI integration  
**Risk Level**: Low (non-breaking enhancement)

