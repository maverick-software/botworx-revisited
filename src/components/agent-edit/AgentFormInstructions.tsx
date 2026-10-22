import React from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Define component props
interface AgentFormInstructionsProps {
  systemInstructions: string | undefined;
  assistantInstructions: string | undefined;
  handleEditorChange: (fieldName: string, value: string) => void;
}

export const AgentFormInstructions: React.FC<AgentFormInstructionsProps> = ({
  systemInstructions,
  assistantInstructions,
  handleEditorChange,
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent Instructions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* System Instructions */}
        <div className="space-y-2">
          <Label htmlFor="system_instructions">System Instructions</Label>
          <Textarea
            id="system_instructions"
            name="system_instructions"
            className="min-h-[8rem] resize-y font-mono text-sm"
            placeholder="System instructions provide the AI with its role and general behavior guidelines..."
            value={systemInstructions || ''}
            onChange={(e) => handleEditorChange('system_instructions', e.target.value)}
          />
        </div>

        {/* Assistant Instructions */}
        <div className="space-y-2">
          <Label htmlFor="assistant_instructions">Assistant Instructions (Optional)</Label>
          <Textarea
            id="assistant_instructions"
            name="assistant_instructions"
            className="min-h-[8rem] resize-y font-mono text-sm"
            placeholder="Assistant instructions can provide additional context or specific response formats..."
            value={assistantInstructions || ''}
            onChange={(e) => handleEditorChange('assistant_instructions', e.target.value)}
          />
        </div>
      </CardContent>
    </Card>
  );
}; 