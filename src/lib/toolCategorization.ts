/**
 * Tool Categorization System
 * Maps specific tools and providers to broader, more user-friendly categories
 */

export interface ToolCategory {
  id: string;
  label: string;
  icon: string;
  color: string;
  description: string;
}

export const TOOL_CATEGORIES: Record<string, ToolCategory> = {
  email: {
    id: 'email',
    label: 'Email',
    icon: '📧',
    color: 'blue',
    description: 'Email sending, reading, and management'
  },
  web: {
    id: 'web',
    label: 'Web',
    icon: '🌐',
    color: 'green',
    description: 'Web search, scraping, and online research'
  },
  docs: {
    id: 'docs',
    label: 'Documents',
    icon: '📄',
    color: 'purple',
    description: 'Document creation, editing, and management'
  },
  cloud: {
    id: 'cloud',
    label: 'Cloud',
    icon: '☁️',
    color: 'cyan',
    description: 'Cloud storage and infrastructure management'
  },
  communication: {
    id: 'communication',
    label: 'Communication',
    icon: '💬',
    color: 'orange',
    description: 'Messaging, chat, and team collaboration'
  },
  calendar: {
    id: 'calendar',
    label: 'Calendar',
    icon: '📅',
    color: 'red',
    description: 'Calendar events and scheduling'
  },
  media: {
    id: 'media',
    label: 'Media',
    icon: '🎨',
    color: 'pink',
    description: 'Image, video, and media processing'
  },
  automation: {
    id: 'automation',
    label: 'Automation',
    icon: '⚡',
    color: 'yellow',
    description: 'Workflow automation and integrations'
  },
  database: {
    id: 'database',
    label: 'Database',
    icon: '🗄️',
    color: 'indigo',
    description: 'Data storage and management'
  },
  ai: {
    id: 'ai',
    label: 'AI',
    icon: '🤖',
    color: 'violet',
    description: 'AI and machine learning tools'
  }
};

/**
 * Maps tool names, providers, and content keywords to categories
 */
export class ToolCategorizer {
  
  /**
   * Categorize a tool by its name and provider
   */
  static categorizeByTool(toolName: string, provider?: string): ToolCategory[] {
    const categories: ToolCategory[] = [];
    const lowerTool = toolName.toLowerCase();
    const lowerProvider = provider?.toLowerCase() || '';

    // Email category
    if (
      lowerTool.includes('email') ||
      lowerTool.includes('mail') ||
      lowerTool.includes('send') && (lowerTool.includes('message') || lowerProvider.includes('gmail') || lowerProvider.includes('smtp')) ||
      lowerProvider.includes('gmail') ||
      lowerProvider.includes('sendgrid') ||
      lowerProvider.includes('mailgun') ||
      lowerProvider.includes('smtp')
    ) {
      categories.push(TOOL_CATEGORIES.email);
    }

    // Web category
    if (
      lowerTool.includes('search') ||
      lowerTool.includes('web') ||
      lowerTool.includes('scrape') ||
      lowerTool.includes('browse') ||
      lowerTool.includes('url') ||
      lowerProvider.includes('serper') ||
      lowerProvider.includes('serpapi') ||
      lowerProvider.includes('brave') ||
      lowerTool.includes('news')
    ) {
      categories.push(TOOL_CATEGORIES.web);
    }

    // Documents category
    if (
      lowerTool.includes('doc') ||
      lowerTool.includes('sheet') ||
      lowerTool.includes('slide') ||
      lowerTool.includes('pdf') ||
      lowerTool.includes('file') ||
      lowerProvider.includes('google') && (lowerTool.includes('doc') || lowerTool.includes('drive')) ||
      lowerProvider.includes('dropbox') ||
      lowerProvider.includes('onedrive')
    ) {
      categories.push(TOOL_CATEGORIES.docs);
    }

    // Cloud category
    if (
      lowerTool.includes('droplet') ||
      lowerTool.includes('server') ||
      lowerTool.includes('deploy') ||
      lowerTool.includes('infrastructure') ||
      lowerProvider.includes('digitalocean') ||
      lowerProvider.includes('aws') ||
      lowerProvider.includes('azure') ||
      lowerProvider.includes('gcp')
    ) {
      categories.push(TOOL_CATEGORIES.cloud);
    }

    // Communication category
    if (
      lowerTool.includes('chat') ||
      lowerTool.includes('message') && !lowerTool.includes('email') ||
      lowerTool.includes('channel') ||
      lowerProvider.includes('slack') ||
      lowerProvider.includes('discord') ||
      lowerProvider.includes('teams')
    ) {
      categories.push(TOOL_CATEGORIES.communication);
    }

    // Calendar category
    if (
      lowerTool.includes('calendar') ||
      lowerTool.includes('event') ||
      lowerTool.includes('schedule') ||
      lowerTool.includes('meeting')
    ) {
      categories.push(TOOL_CATEGORIES.calendar);
    }

    // Automation category
    if (
      lowerTool.includes('zapier') ||
      lowerTool.includes('webhook') ||
      lowerTool.includes('trigger') ||
      lowerTool.includes('automation') ||
      lowerProvider.includes('zapier') ||
      lowerProvider.includes('ifttt')
    ) {
      categories.push(TOOL_CATEGORIES.automation);
    }

    // Database category
    if (
      lowerTool.includes('database') ||
      lowerTool.includes('query') ||
      lowerTool.includes('table') ||
      lowerProvider.includes('pinecone') ||
      lowerProvider.includes('getzep') ||
      lowerProvider.includes('supabase')
    ) {
      categories.push(TOOL_CATEGORIES.database);
    }

    // AI category
    if (
      lowerTool.includes('ai') ||
      lowerTool.includes('ml') ||
      lowerTool.includes('model') ||
      lowerTool.includes('generate') ||
      lowerTool.includes('analyze')
    ) {
      categories.push(TOOL_CATEGORIES.ai);
    }

    return categories;
  }

  /**
   * Categorize based on message content analysis
   */
  static categorizeByContent(content: string): ToolCategory[] {
    const categories: ToolCategory[] = [];
    const lowerContent = content.toLowerCase();

    // Email keywords
    if (
      lowerContent.includes('email') ||
      lowerContent.includes('send message') ||
      lowerContent.includes('compose') ||
      lowerContent.includes('inbox') ||
      lowerContent.includes('reply')
    ) {
      categories.push(TOOL_CATEGORIES.email);
    }

    // Web keywords
    if (
      lowerContent.includes('search') ||
      lowerContent.includes('google') ||
      lowerContent.includes('website') ||
      lowerContent.includes('url') ||
      lowerContent.includes('browse')
    ) {
      categories.push(TOOL_CATEGORIES.web);
    }

    // Document keywords
    if (
      lowerContent.includes('document') ||
      lowerContent.includes('doc') ||
      lowerContent.includes('pdf') ||
      lowerContent.includes('spreadsheet') ||
      lowerContent.includes('presentation')
    ) {
      categories.push(TOOL_CATEGORIES.docs);
    }

    return categories;
  }

  /**
   * Get the primary category from a list (for single-tag display)
   */
  static getPrimaryCategory(categories: ToolCategory[]): ToolCategory | null {
    if (categories.length === 0) return null;
    
    // Priority order for primary category selection
    const priority = ['email', 'web', 'docs', 'communication', 'cloud', 'calendar', 'automation', 'database', 'ai', 'media'];
    
    for (const priorityId of priority) {
      const category = categories.find(cat => cat.id === priorityId);
      if (category) return category;
    }
    
    return categories[0];
  }

  /**
   * Format categories for display
   */
  static formatCategoriesForDisplay(categories: ToolCategory[], maxTags: number = 2): string[] {
    return categories
      .slice(0, maxTags)
      .map(cat => `[${cat.label.toLowerCase()}]`);
  }
}
