import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { toast } from 'react-hot-toast';

interface AIQuickSetupProps {
  onConfigGenerated: (config: any) => void;
  onClose: () => void;
}

export function AIQuickSetup({ onConfigGenerated, onClose }: AIQuickSetupProps) {
  const [description, setDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const supabase = useSupabaseClient();

  const handleGenerate = async () => {
    if (!description.trim()) {
      toast.error('Please describe your agent');
      return;
    }

    setIsGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      toast.loading('Generating your agent...', { id: 'ai-gen' });

      const { data, error } = await supabase.functions.invoke('generate-agent-config', {
        body: { description: description.trim() },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Generation failed');

      toast.success('Agent configuration created!', { id: 'ai-gen' });
      
      // Pass config to parent - parent will handle image generation and agent creation
      onConfigGenerated(data.configuration);
      // Don't close - let parent handle transition
    } catch (error: any) {
      console.error('Error generating config:', error);
      toast.error(error.message || 'Failed to generate configuration', { id: 'ai-gen' });
      setIsGenerating(false); // Only reset on error
    }
    // Don't reset isGenerating on success - parent will handle the full flow
  };

  const examples = [
    'Create a friendly SEO specialist agent that helps with keyword research, content optimization, and technical SEO audits',
    'I need a patient technical support agent that troubleshoots software issues and provides step-by-step solutions',
    'Create an analytical code review assistant that checks for bugs and suggests improvements'
  ];

  return (
    <div className="flex items-start justify-center h-full overflow-y-auto">
      <div className="w-full max-w-3xl px-8 py-12 space-y-8">
        {/* Main Input Section */}
        <div className="space-y-3">
          <h3 className="text-base font-medium text-foreground">
            Describe Your Agent
          </h3>
          <Textarea
            placeholder="Example: Create a friendly customer support agent that helps users with technical issues..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            disabled={isGenerating}
            className="resize-none text-base bg-muted/30 border-muted-foreground/20 focus:border-primary/50 transition-colors"
            autoFocus
          />
          <p className="text-sm text-muted-foreground">
            Be specific about the role, personality, and what the agent should help with
          </p>
        </div>

        {/* Example Prompts */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground">Quick Examples:</h4>
          <div className="space-y-3">
            {examples.map((example, idx) => (
              <button
                key={idx}
                onClick={() => setDescription(example)}
                disabled={isGenerating}
                className="w-full text-left text-sm p-4 rounded-lg bg-muted/30 border border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        {/* Generate Button */}
        <Button
          onClick={handleGenerate}
          disabled={!description.trim() || isGenerating}
          className="w-full h-12 text-base font-medium"
          size="lg"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Generating Configuration...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 mr-2" />
              Generate Agent Configuration
            </>
          )}
        </Button>
      </div>
    </div>
  );
}


