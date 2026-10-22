import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'react-hot-toast';
import { 
  FileText, 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X,
  AlertCircle
} from 'lucide-react';

interface SystemPrompt {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
  content: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = ['identity', 'tools', 'formatting', 'memory', 'meta'] as const;

const CATEGORY_INFO = {
  identity: {
    label: 'Identity',
    description: 'Agent identity and personality prompts',
    color: 'bg-blue-500',
  },
  tools: {
    label: 'Tools',
    description: 'Tool usage and function calling instructions',
    color: 'bg-purple-500',
  },
  formatting: {
    label: 'Formatting',
    description: 'Output formatting and markdown instructions',
    color: 'bg-green-500',
  },
  memory: {
    label: 'Memory',
    description: 'Memory handling and context instructions',
    color: 'bg-yellow-500',
  },
  meta: {
    label: 'Meta',
    description: 'System-level and meta prompts',
    color: 'bg-gray-500',
  },
};

export default function SystemPromptsPage() {
  const [prompts, setPrompts] = useState<SystemPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editingPrompt, setEditingPrompt] = useState<SystemPrompt | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    key: '',
    name: '',
    description: '',
    category: 'identity' as typeof CATEGORIES[number],
    content: '',
    is_active: true,
  });

  useEffect(() => {
    loadPrompts();
  }, []);

  const loadPrompts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('system_prompts')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setPrompts(data || []);
    } catch (error) {
      console.error('Error loading prompts:', error);
      toast.error('Failed to load system prompts');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setIsCreating(true);
    setEditingPrompt(null);
    setFormData({
      key: '',
      name: '',
      description: '',
      category: 'identity',
      content: '',
      is_active: true,
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (prompt: SystemPrompt) => {
    setIsCreating(false);
    setEditingPrompt(prompt);
    setFormData({
      key: prompt.key,
      name: prompt.name,
      description: prompt.description || '',
      category: prompt.category as typeof CATEGORIES[number],
      content: prompt.content,
      is_active: prompt.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.key || !formData.name || !formData.content) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      if (isCreating) {
        // Create new prompt
        const { error } = await supabase.from('system_prompts').insert({
          key: formData.key,
          name: formData.name,
          description: formData.description || null,
          category: formData.category,
          content: formData.content,
          is_active: formData.is_active,
        });

        if (error) throw error;
        toast.success('System prompt created successfully');
      } else if (editingPrompt) {
        // Update existing prompt
        const { error } = await supabase
          .from('system_prompts')
          .update({
            name: formData.name,
            description: formData.description || null,
            category: formData.category,
            content: formData.content,
            is_active: formData.is_active,
          })
          .eq('id', editingPrompt.id);

        if (error) throw error;
        toast.success('System prompt updated successfully');
      }

      setIsDialogOpen(false);
      loadPrompts();
    } catch (error: any) {
      console.error('Error saving prompt:', error);
      toast.error(error.message || 'Failed to save prompt');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This will remove it from all AI agents.`)) return;

    try {
      const { error } = await supabase.from('system_prompts').delete().eq('id', id);

      if (error) throw error;
      toast.success('System prompt deleted');
      loadPrompts();
    } catch (error) {
      console.error('Error deleting prompt:', error);
      toast.error('Failed to delete prompt');
    }
  };

  const filteredPrompts =
    selectedCategory === 'all'
      ? prompts
      : prompts.filter((p) => p.category === selectedCategory);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileText className="w-8 h-8" />
            System Prompts
          </h1>
          <p className="text-muted-foreground mt-1">
            Edit AI system prompts to improve platform results • {prompts.length} prompts
          </p>
        </div>
        <Button onClick={handleCreate} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Create Prompt
        </Button>
      </div>

      {/* Prompts List */}
      <div className="grid grid-cols-1 gap-4">
        {filteredPrompts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No prompts found in this category</p>
            </CardContent>
          </Card>
        ) : (
          filteredPrompts.map((prompt) => (
            <Card key={prompt.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-lg">{prompt.name}</CardTitle>
                      <Badge
                        variant="outline"
                        className={`${CATEGORY_INFO[prompt.category as keyof typeof CATEGORY_INFO].color} text-white border-0`}
                      >
                        {CATEGORY_INFO[prompt.category as keyof typeof CATEGORY_INFO].label}
                      </Badge>
                    </div>
                    {prompt.description && (
                      <CardDescription className="mb-2">{prompt.description}</CardDescription>
                    )}
                    <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                      {prompt.key}
                    </code>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(prompt)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(prompt.id, prompt.name)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={prompt.content}
                  readOnly
                  className="font-mono text-sm min-h-[200px] resize-none bg-muted"
                  onClick={() => handleEdit(prompt)}
                />
                <div className="text-xs text-muted-foreground mt-2">
                  Last updated: {new Date(prompt.updated_at).toLocaleString()}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit/Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isCreating ? 'Create New Prompt' : 'Edit Prompt'}</DialogTitle>
            <DialogDescription>
              {isCreating
                ? 'Create a new system prompt that will be used by AI agents'
                : 'Update the prompt content and configuration'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="key">
                  Key <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="key"
                  value={formData.key}
                  onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                  placeholder="agent_identity"
                  disabled={!isCreating}
                />
                <p className="text-xs text-muted-foreground">
                  Unique identifier (cannot be changed after creation)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">
                  Category <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) =>
                    setFormData({ ...formData, category: value as typeof CATEGORIES[number] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {CATEGORY_INFO[cat].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Agent Identity Template"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="What this prompt does..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">
                Content <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Enter the prompt content..."
                rows={15}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Use templates like {'{agent_name}'}, {'{role}'}, {'{personality}'} where applicable
              </p>
            </div>

          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={saving}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save Prompt'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

