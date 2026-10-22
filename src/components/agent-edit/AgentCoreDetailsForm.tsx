import React from 'react';
import type { Agent as AgentType } from '../../types';
import { Switch } from '@headlessui/react'; // Assuming you use Headless UI for toggle

interface AgentCoreDetailsFormProps {
  formData: Partial<AgentType>;
  onFormDataChange: (fieldName: keyof AgentType, value: any) => void;
  saving: boolean;
}

// Consider moving templates to a shared constants file if used elsewhere
const personalityTemplates = [
  { id: 'disc-d', name: 'DISC - Dominant', description: 'Direct, results-oriented, strong-willed' },
  { id: 'disc-i', name: 'DISC - Influential', description: 'Outgoing, enthusiastic, optimistic' },
  { id: 'disc-s', name: 'DISC - Steady', description: 'Patient, stable, consistent' },
  { id: 'disc-c', name: 'DISC - Conscientious', description: 'Accurate, analytical, systematic' },
  { id: 'mbti-intj', name: 'MBTI - INTJ', description: 'Architect - Imaginative and strategic thinkers' },
  { id: 'mbti-enfp', name: 'MBTI - ENFP', description: 'Campaigner - Enthusiastic, creative, sociable' },
  { id: 'custom', name: 'Custom Template', description: 'Create your own personality template' },
];

export const AgentCoreDetailsForm: React.FC<AgentCoreDetailsFormProps> = ({
  formData,
  onFormDataChange,
  saving,
}) => {
    
  // Basic input change handler
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    onFormDataChange(name as keyof AgentType, value);
  };

  // Toggle handler
  const handleToggleChange = (checked: boolean) => {
    onFormDataChange('active', checked);
  };

  const inputClasses = "block w-full px-3 py-2 border border-input placeholder:text-muted-foreground text-foreground bg-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed";
  const labelClasses = "block text-sm font-medium text-foreground mb-1";
  const textAreaClasses = `${inputClasses} min-h-[100px]`; // Example height

  return (
    <div className="space-y-6 bg-card border border-border p-6 rounded-lg shadow-sm">
      <h2 className="text-xl font-semibold text-card-foreground mb-4 border-b border-border pb-2">Core Agent Details</h2>
      
      {/* Active Toggle */}
      <div className="flex items-center justify-between">
        <span className={labelClasses}>Agent Status</span>
        <Switch
          checked={formData.active ?? true} // Default to true if undefined
          onChange={handleToggleChange}
          disabled={saving}
          className={`${
            formData.active ? 'bg-primary' : 'bg-muted'
          } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <span
            className={`${
              formData.active ? 'translate-x-6' : 'translate-x-1'
            } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
          />
        </Switch>
      </div>

      {/* Name */}
      <div>
        <label htmlFor="name" className={labelClasses}>Agent Name</label>
        <input
          type="text"
          name="name"
          id="name"
          value={formData.name || ''}
          onChange={handleChange}
          required
          className={inputClasses}
          placeholder="e.g., Customer Support Bot"
          disabled={saving}
        />
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className={labelClasses}>Description</label>
        <textarea
          name="description"
          id="description"
          rows={3}
          value={formData.description || ''}
          onChange={handleChange}
          className={textAreaClasses}
          placeholder="A brief description of the agent's purpose."
          disabled={saving}
        />
      </div>

      {/* Personality Template */}
      <div>
        <label htmlFor="personality-template" className={labelClasses}>Personality Template (Optional)</label>
        <select
          id="personality-template"
          name="personality-template-selector" // Use a different name if not directly mapping to formData.personality initially
          // value={selectedTemplate} // Manage selected template state if needed
          onChange={(e) => {
             const selectedTemplate = personalityTemplates.find(t => t.id === e.target.value);
             if (selectedTemplate && selectedTemplate.id !== 'custom') {
                 // Optionally pre-fill personality based on template description
                 // onFormDataChange('personality', selectedTemplate.description); 
             }
             // Handle custom logic if needed
          }}
          className={inputClasses}
          disabled={saving}
        >
            <option value="">-- Select a Template --</option>
            {personalityTemplates.map(template => (
                <option key={template.id} value={template.id}>{template.name}</option>
            ))}
        </select>
         <p className="mt-1 text-xs text-muted-foreground">Selecting a template can help pre-fill the personality instructions below.</p>
      </div>

      {/* Personality Instructions */}
      <div>
        <label htmlFor="personality" className={labelClasses}>Personality / Role Instructions</label>
        <textarea
          name="personality"
          id="personality"
          rows={6}
          value={formData.personality || ''}
          onChange={handleChange}
          className={textAreaClasses}
          placeholder="Define the agent's persona, tone, and specific behavioral guidelines (e.g., 'You are a friendly and helpful assistant...')."
          disabled={saving}
        />
      </div>

      {/* System Instructions */}
      <div>
        <label htmlFor="system_instructions" className={labelClasses}>System Instructions (Advanced)</label>
        <textarea
          name="system_instructions"
          id="system_instructions"
          rows={6}
          value={formData.system_instructions || ''}
          onChange={handleChange}
          className={textAreaClasses}
          placeholder="Provide high-level instructions or context for the underlying LLM (e.g., constraints, domain knowledge, rules for tool use)."
          disabled={saving}
        />
         <p className="mt-1 text-xs text-muted-foreground">Overrides general system prompts. Use with caution.</p>
      </div>

      {/* Assistant Instructions (If applicable - adjust based on your AgentType) */}
      {/* Uncomment if your AgentType has assistant_instructions
      <div>
        <label htmlFor="assistant_instructions" className={labelClasses}>Assistant Instructions (Advanced)</label>
        <textarea
          name="assistant_instructions"
          id="assistant_instructions"
          rows={6}
          value={formData.assistant_instructions || ''}
          onChange={handleChange}
          className={textAreaClasses}
          placeholder="Instructions specific to the assistant's role or interaction flow."
          disabled={saving}
        />
      </div>
       */}
    </div>
  );
}; 