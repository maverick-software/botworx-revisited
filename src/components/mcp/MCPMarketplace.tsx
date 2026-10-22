import React, { useState, useMemo } from 'react';
import { 
  MCPMarketplaceProps, 
  MCPServerTemplate, 
  MCPServerCategory 
} from '@/lib/mcp/ui-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import LoadingSpinner from '@/components/LoadingSpinner';
import { 
  Search,
  Star,
  Download,
  Shield,
  ExternalLink,
  Play,
  Tag,
  Calendar,
  User,
  Package
} from 'lucide-react';
import { cn } from '@/lib/utils';

const categoryColors: Record<MCPServerCategory, string> = {
  'productivity': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  'development': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'data-analysis': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  'ai-tools': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  'integrations': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  'utilities': 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  'entertainment': 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  'business': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  'other': 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200'
};

const MCPMarketplace: React.FC<MCPMarketplaceProps> = ({
  templates,
  onTemplateSelect,
  onDeploy,
  loading = false,
  error,
  categories = [],
  selectedCategory,
  onCategoryChange,
  searchQuery = '',
  onSearchChange,
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<MCPServerTemplate | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    let result = [...templates];

    // Apply search filter
    if (searchQuery) {
      result = result.filter(template =>
        template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())) ||
        template.author.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply category filter
    if (selectedCategory) {
      result = result.filter(template => template.category === selectedCategory);
    }

    // Sort by rating and downloads
    result.sort((a, b) => {
      if (a.verified && !b.verified) return -1;
      if (!a.verified && b.verified) return 1;
      return (b.rating.average * b.rating.count + b.downloads) - 
             (a.rating.average * a.rating.count + a.downloads);
    });

    return result;
  }, [templates, searchQuery, selectedCategory]);

  const handleTemplateClick = (template: MCPServerTemplate) => {
    setSelectedTemplate(template);
    setShowDetails(true);
    onTemplateSelect?.(template);
  };

  const handleDeploy = (template: MCPServerTemplate) => {
    onDeploy?.(template, {
      templateId: template.id,
      name: template.name,
      environment: 'development',
      configuration: {},
      resourceLimits: {
        memory: template.resourceRequirements.memory,
        cpu: template.resourceRequirements.cpu,
        storage: template.resourceRequirements.storage
      },
      scaling: {
        replicas: 1,
        autoScale: false
      },
      networking: {
        expose: true
      },
      credentials: [],
      healthCheck: {
        enabled: true,
        interval: 30,
        timeout: 10,
        retries: 3
      },
      monitoring: {
        enabled: true,
        alerts: false,
        logLevel: 'info'
      }
    });
    setShowDetails(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner />
        <span className="ml-2 text-muted-foreground">Loading marketplace...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="p-6">
          <div className="text-center text-destructive">
            <h3 className="font-semibold mb-2">Error Loading Marketplace</h3>
            <p className="text-sm">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="p-6 space-y-8">
      {/* Search and Filter Section */}
      <div className="space-y-6">
        {/* Search Bar */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search MCP servers..."
              value={searchQuery}
              onChange={(e) => onSearchChange?.(e.target.value)}
              className="pl-10 h-11"
            />
          </div>
        </div>

        {/* Category Filter */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Filter by Category</h3>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedCategory === null ? "default" : "outline"}
              size="sm"
              onClick={() => onCategoryChange?.(null)}
              className="rounded-full"
            >
              All Categories
            </Button>
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
                onClick={() => onCategoryChange?.(category)}
                className="rounded-full"
              >
                {category.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Results Summary */}
      {searchQuery || selectedCategory ? (
        <div className="flex items-center justify-between py-2 border-b">
          <div className="text-sm text-muted-foreground">
            {filteredTemplates.length} server{filteredTemplates.length !== 1 ? 's' : ''} found
            {selectedCategory && ` in ${selectedCategory.replace('-', ' ')}`}
            {searchQuery && ` for "${searchQuery}"`}
          </div>
          {(searchQuery || selectedCategory) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onSearchChange?.('');
                onCategoryChange?.(null);
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      ) : null}

      {/* Template Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.length === 0 ? (
          <div className="col-span-full">
            <Card className="border-dashed">
              <CardContent className="p-12 text-center">
                <Package className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-2">No MCP servers found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery || selectedCategory 
                    ? "Try adjusting your search or category filter" 
                    : "No servers are currently available"}
                </p>
                {(searchQuery || selectedCategory) && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      onSearchChange?.('');
                      onCategoryChange?.(null);
                    }}
                  >
                    Clear filters
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          filteredTemplates.map((template) => (
            <Card 
              key={template.id} 
              className="cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.02] group"
              onClick={() => handleTemplateClick(template)}
            >
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg line-clamp-1 group-hover:text-primary transition-colors">
                        {template.name}
                      </CardTitle>
                      {template.verified && (
                        <Shield className="h-4 w-4 text-blue-600 flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span>{template.author}</span>
                      <span className="text-muted-foreground/50">•</span>
                      <span>v{template.version}</span>
                    </div>
                  </div>
                </div>

                <CardDescription className="line-clamp-2 text-sm leading-relaxed">
                  {template.description}
                </CardDescription>

                <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2">
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    <span className="font-medium">{template.rating.average.toFixed(1)}</span>
                    <span className="text-muted-foreground/70">({template.rating.count})</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Download className="h-3 w-3" />
                    <span>{template.downloads.toLocaleString()}</span>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0 space-y-4">
                <div className="flex items-center justify-between">
                  <Badge 
                    className={cn("text-xs font-medium", categoryColors[template.category])}
                    variant="outline"
                  >
                    {template.category.replace('-', ' ')}
                  </Badge>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>{template.lastUpdated.toLocaleDateString()}</span>
                  </div>
                </div>

                {template.tags.slice(0, 3).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {template.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs px-2 py-0.5">
                        <Tag className="h-2 w-2 mr-1" />
                        {tag}
                      </Badge>
                    ))}
                    {template.tags.length > 3 && (
                      <Badge variant="secondary" className="text-xs px-2 py-0.5">
                        +{template.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t">
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium">{template.resourceRequirements.memory}</span>
                    <span className="mx-1">•</span>
                    <span className="font-medium">{template.resourceRequirements.cpu}</span> CPU
                  </div>
                  <Button 
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeploy(template);
                    }}
                    className="gap-1.5 group-hover:scale-105 transition-transform"
                  >
                    <Play className="h-3 w-3" />
                    Deploy
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Template Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl">
          {selectedTemplate && (
            <>
              <DialogHeader className="space-y-3">
                <div className="flex items-center gap-3">
                  <DialogTitle className="text-xl">{selectedTemplate.name}</DialogTitle>
                  {selectedTemplate.verified && (
                    <Shield className="h-5 w-5 text-blue-600" />
                  )}
                </div>
                <DialogDescription>
                  by {selectedTemplate.author} • v{selectedTemplate.version}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <p className="text-sm">{selectedTemplate.description}</p>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Category:</span>
                    <p className="text-muted-foreground">{selectedTemplate.category}</p>
                  </div>
                  <div>
                    <span className="font-medium">Downloads:</span>
                    <p className="text-muted-foreground">{selectedTemplate.downloads.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="font-medium">Rating:</span>
                    <p className="text-muted-foreground">
                      {selectedTemplate.rating.average.toFixed(1)}/5 ({selectedTemplate.rating.count} reviews)
                    </p>
                  </div>
                  <div>
                    <span className="font-medium">Last Updated:</span>
                    <p className="text-muted-foreground">{selectedTemplate.lastUpdated.toLocaleDateString()}</p>
                  </div>
                </div>

                <div>
                  <span className="font-medium text-sm">Resource Requirements:</span>
                  <div className="text-sm text-muted-foreground mt-1">
                    Memory: {selectedTemplate.resourceRequirements.memory} • 
                    CPU: {selectedTemplate.resourceRequirements.cpu}
                    {selectedTemplate.resourceRequirements.storage && (
                      <> • Storage: {selectedTemplate.resourceRequirements.storage}</>
                    )}
                  </div>
                </div>

                {selectedTemplate.tags.length > 0 && (
                  <div>
                    <span className="font-medium text-sm">Tags:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedTemplate.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <Button 
                    onClick={() => handleDeploy(selectedTemplate)}
                    className="flex-1"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Deploy Server
                  </Button>
                  {selectedTemplate.documentation && (
                    <Button variant="outline" asChild>
                      <a href={selectedTemplate.documentation} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Docs
                      </a>
                    </Button>
                  )}
                  {selectedTemplate.sourceCode && (
                    <Button variant="outline" asChild>
                      <a href={selectedTemplate.sourceCode} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Source
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MCPMarketplace; 