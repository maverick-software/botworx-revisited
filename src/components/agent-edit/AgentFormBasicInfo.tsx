import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { Agent } from '@/types/index';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";


// Define personality templates structure (assuming it's passed)
interface PersonalityTemplate {
  id: string;
  name: string;
  description: string;
}

// Define component props
interface AgentFormBasicInfoProps {
  agentData: Partial<Agent> | null;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSelectChange: (value: string) => void; // For personality select
  handleSwitchChange: (checked: boolean) => void; // For active switch
  personalityTemplates: PersonalityTemplate[];
  handleAvatarUpdate: (newAvatarUrl: string | null) => void;
}

export const AgentFormBasicInfo: React.FC<AgentFormBasicInfoProps> = ({
  agentData,
  handleInputChange,
  handleSelectChange,
  handleSwitchChange,
  personalityTemplates,
  handleAvatarUpdate
}) => {

  console.log("[AgentFormBasicInfo] Received agentData:", agentData, "Type:", typeof agentData);

  if (!agentData || typeof agentData !== 'object' || !agentData.id) {
    console.log("[AgentFormBasicInfo] agentData is null, not an object, or missing id. Rendering null.");
    return null; 
  }

  console.log("[AgentFormBasicInfo] agentData seems valid, attempting to render form. Name:", agentData.name);

  // State hooks relevant to this form section could be moved here
  // if they aren't needed by the parent for the main save action.
  // Example: Local validation state?
  // const [nameError, setNameError] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Basic Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Avatar Display - Management moved to unified Agent Settings */}
        <div className="flex items-center space-x-4 p-4 border rounded-lg bg-muted/30">
          <div className="w-16 h-16">
            {agentData?.avatar_url ? (
              <img 
                src={agentData.avatar_url} 
                alt={agentData.name || 'Agent'}
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <span className="text-white text-lg font-medium">
                  {agentData?.name?.charAt(0)?.toUpperCase() || 'A'}
                </span>
              </div>
            )}
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-medium mb-1">Agent Avatar</h4>
            <p className="text-xs text-muted-foreground mb-2">
              Avatar management has moved to the unified Agent Settings in the chat interface.
            </p>
            <p className="text-xs text-muted-foreground">
              Go to chat → brain icon → Identity to upload or generate avatars.
            </p>
          </div>
        </div>

        {/* Agent Name */}
        <div className="space-y-1">
          <Label htmlFor="name">Name</Label>
          <Input 
            id="name" 
            name="name" 
            value={agentData.name || ''} 
            onChange={handleInputChange} 
            placeholder="My Helpful Agent" 
          />
        </div>

        {/* Agent Description */}
        <div className="space-y-1">
          <Label htmlFor="description">Description</Label>
          <Textarea 
            id="description" 
            name="description" 
            value={agentData.description || ''} 
            onChange={handleInputChange} 
            placeholder="Provide a brief description of the agent's purpose."
          />
        </div>

        {/* Agent Personality */}
        <div>
          <Label htmlFor="agentPersonality">Personality</Label>
          <Select 
            name="personality" // Not standard HTML select, name might not be needed here
            value={agentData.personality || ''} 
            onValueChange={handleSelectChange} // Use onValueChange for Shadcn Select
          >
            <SelectTrigger id="agentPersonality">
              <SelectValue placeholder="Select a personality template" />
            </SelectTrigger>
            <SelectContent>
              {personalityTemplates.map(template => (
                <SelectItem key={template.id} value={template.id}>
                  {template.name} - {template.description}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Active Status */}
        <div className="flex items-center space-x-2">
          <Switch 
            id="agentActive" 
            checked={agentData.active === null ? false : agentData.active} 
            onCheckedChange={handleSwitchChange} 
          />
          <Label htmlFor="agentActive">Active</Label>
        </div>
      </CardContent>
    </Card>
  );
}; 