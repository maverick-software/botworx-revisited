import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Search, 
  FileText, 
  Image, 
  Video, 
  Music, 
  Check,
  Plus,
  Upload,
  Filter,
  BookOpen,
  Shield,
  GraduationCap,
  BookMarked
} from 'lucide-react';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-hot-toast';

interface MediaFile {
  id: string;
  file_name: string;
  display_name: string;
  file_type: string;
  file_size: number;
  category: string;
  tags: string[];
  description?: string;
  processing_status: string;
  created_at: string;
  file_url?: string;
  chunk_count: number;
}

interface MediaCategory {
  id: string;
  name: string;
  description?: string;
  icon_name?: string;
  media_count: number;
}

interface MediaLibrarySelectorProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentName?: string;
  onMediaAssigned: (assignedMedia: MediaFile[]) => void;
  multiSelect?: boolean;
  assignmentType?: 'training_data' | 'reference' | 'sop' | 'knowledge_base';
}

export function MediaLibrarySelector({
  isOpen,
  onClose,
  agentId,
  agentName,
  onMediaAssigned,
  multiSelect = true,
  assignmentType = 'training_data'
}: MediaLibrarySelectorProps) {
  const supabase = useSupabaseClient();
  const { user } = useAuth();
  
  // Data state
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [categories, setCategories] = useState<MediaCategory[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showUploadForm, setShowUploadForm] = useState(false);
  
  // Upload form state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState('general');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploading, setUploading] = useState(false);

  // Load media library data
  useEffect(() => {
    if (isOpen && user) {
      loadMediaLibrary();
    }
  }, [isOpen, user]);

  const loadMediaLibrary = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('No authenticated session');
      }

      // Load categories
      const categoriesResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/media-library-api`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'get_categories' })
      });

      if (categoriesResponse.ok) {
        const categoriesData = await categoriesResponse.json();
        if (categoriesData.success) {
          setCategories(categoriesData.data.categories || []);
        }
      }

      // Load media files
      const mediaResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/media-library-api`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          action: 'list_documents',
          sort_by: 'created_at',
          sort_order: 'desc'
        })
      });

      if (mediaResponse.ok) {
        const mediaData = await mediaResponse.json();
        if (mediaData.success) {
          // Filter to only show completed documents
          const completedFiles = (mediaData.data.documents || []).filter(
            (file: MediaFile) => file.processing_status === 'completed'
          );
          setMediaFiles(completedFiles);
        }
      }

    } catch (error) {
      console.error('Error loading media library:', error);
      toast.error('Failed to load media library');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async () => {
    if (!uploadFile || !user) return;
    
    setUploading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('No authenticated session');
      }

      // Prepare upload
      const uploadResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/media-library-api`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'upload',
          file_name: uploadFile.name,
          file_type: uploadFile.type,
          file_size: uploadFile.size,
          category: uploadCategory,
          description: uploadDescription || `Uploaded for agent ${agentName || agentId}`
        })
      });

      if (!uploadResponse.ok) {
        throw new Error('Upload preparation failed');
      }

      const uploadData = await uploadResponse.json();
      console.log('Upload data received:', uploadData);
      
      if (!uploadData.success) {
        throw new Error(uploadData.error || 'Upload failed');
      }

      if (!uploadData.data?.storage_path || !uploadData.data?.bucket) {
        console.error('Missing storage_path or bucket in response:', uploadData);
        throw new Error('Storage path not provided by server');
      }

      console.log('Storage path:', uploadData.data.storage_path, 'Bucket:', uploadData.data.bucket);

      // Upload file to Supabase storage directly
      const { error: storageError } = await supabase.storage
        .from(uploadData.data.bucket)
        .upload(uploadData.data.storage_path, uploadFile, {
          contentType: uploadFile.type,
          duplex: 'half'
        });

      if (storageError) {
        throw new Error(`Storage upload failed: ${storageError.message}`);
      }

      // Process the document
      const processResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/media-library-api`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'process',
          document_id: uploadData.data.media_id
        })
      });

      if (processResponse.ok) {
        const processData = await processResponse.json();
        if (processData.success) {
          toast.success(`${uploadFile.name} uploaded and processed successfully`);
          
          // Auto-select the uploaded file
          setSelectedFiles(new Set([uploadData.data.media_id]));
          
          // Reload media library
          await loadMediaLibrary();
          
          // Reset upload form
          setUploadFile(null);
          setUploadDescription('');
          setShowUploadForm(false);
        } else {
          toast.warn(`${uploadFile.name} uploaded but processing failed: ${processData.error}`);
        }
      }

    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleAssignSelected = async () => {
    if (selectedFiles.size === 0) {
      toast.error('Please select at least one file');
      return;
    }
    
    setAssigning(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('No authenticated session');
      }

      const assignmentPromises = Array.from(selectedFiles).map(async (mediaId) => {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/media-library-api`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'assign_to_agent',
            agent_id: agentId,
            document_id: mediaId,
            assignment_type: assignmentType,
            include_in_vector_search: true,
            include_in_knowledge_graph: true,
            priority_level: 1
          })
        });
        
        if (!response.ok) {
          throw new Error(`Failed to assign document ${mediaId}`);
        }
        
        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error || `Assignment failed for document ${mediaId}`);
        }
        
        return mediaId;
      });

      await Promise.all(assignmentPromises);
      
      // Get assigned media files for callback
      const assignedMedia = mediaFiles.filter(file => selectedFiles.has(file.id));
      
      toast.success(`Successfully assigned ${selectedFiles.size} document(s) to ${agentName || 'agent'}`);
      onMediaAssigned(assignedMedia);
      onClose();
      
    } catch (error: any) {
      console.error('Assignment error:', error);
      toast.error(`Assignment failed: ${error.message}`);
    } finally {
      setAssigning(false);
    }
  };

  const toggleFileSelection = (fileId: string) => {
    if (multiSelect) {
      setSelectedFiles(prev => {
        const newSet = new Set(prev);
        if (newSet.has(fileId)) {
          newSet.delete(fileId);
        } else {
          newSet.add(fileId);
        }
        return newSet;
      });
    } else {
      setSelectedFiles(new Set([fileId]));
    }
  };

  // Filter files based on search and category
  const filteredFiles = mediaFiles.filter(file => {
    const matchesSearch = searchQuery === '' || 
      file.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      file.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      file.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      file.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || file.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  // Get file type icon
  const getFileTypeIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <Image className="h-4 w-4" />;
    if (fileType.startsWith('video/')) return <Video className="h-4 w-4" />;
    if (fileType.startsWith('audio/')) return <Music className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  // Get category icon
  const getCategoryIcon = (iconName?: string) => {
    switch (iconName) {
      case 'BookOpen': return <BookOpen className="h-4 w-4" />;
      case 'GraduationCap': return <GraduationCap className="h-4 w-4" />;
      case 'BookMarked': return <BookMarked className="h-4 w-4" />;
      case 'Shield': return <Shield className="h-4 w-4" />;
      case 'FileTemplate': return <FileText className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select Documents from Media Library</DialogTitle>
            <DialogDescription>
              Choose documents to assign to {agentName || 'this agent'} for {assignmentType.replace('_', ' ')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Search and Filter Bar */}
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.name}>
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(category.icon_name)}
                        {category.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button
                variant="outline"
                onClick={() => setShowUploadForm(!showUploadForm)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Upload
              </Button>
            </div>

            {/* Upload Form */}
            {showUploadForm && (
              <Card className="border-dashed">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Upload className="h-4 w-4" />
                    <span className="font-medium">Upload New Document</span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Input
                        type="file"
                        onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                        accept="*/*"
                      />
                    </div>
                    
                    <Select value={uploadCategory} onValueChange={setUploadCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.name}>
                            <div className="flex items-center gap-2">
                              {getCategoryIcon(category.icon_name)}
                              {category.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Input
                    placeholder="Description (optional)"
                    value={uploadDescription}
                    onChange={(e) => setUploadDescription(e.target.value)}
                  />
                  
                  <div className="flex gap-2">
                    <Button
                      onClick={handleFileUpload}
                      disabled={!uploadFile || uploading}
                      size="sm"
                    >
                      {uploading ? 'Uploading...' : 'Upload & Add'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowUploadForm(false);
                        setUploadFile(null);
                        setUploadDescription('');
                      }}
                      size="sm"
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* File Selection */}
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading media library...</p>
                </div>
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">No documents found</p>
                <p className="text-sm">
                  {searchQuery || selectedCategory !== 'all'
                    ? 'Try adjusting your search or filters'
                    : 'Upload your first document to get started'
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredFiles.map((file) => (
                  <Card 
                    key={file.id} 
                    className={`cursor-pointer transition-all duration-200 ${
                      selectedFiles.has(file.id) 
                        ? 'border-primary bg-primary/5' 
                        : 'hover:border-border hover:bg-accent/50'
                    }`}
                    onClick={() => toggleFileSelection(file.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        {multiSelect && (
                          <Checkbox
                            checked={selectedFiles.has(file.id)}
                            onChange={() => toggleFileSelection(file.id)}
                          />
                        )}
                        
                        {getFileTypeIcon(file.file_type)}
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium truncate">{file.display_name}</h4>
                            <Badge variant="outline" className="text-xs">
                              {file.category}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{formatFileSize(file.file_size)}</span>
                            <span>•</span>
                            <span>{file.chunk_count} chunks</span>
                            <span>•</span>
                            <span>{new Date(file.created_at).toLocaleDateString()}</span>
                          </div>
                          
                          {file.description && (
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                              {file.description}
                            </p>
                          )}
                          
                          {file.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {file.tags.slice(0, 3).map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                              {file.tags.length > 3 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{file.tags.length - 3}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                        
                        {selectedFiles.has(file.id) && (
                          <Check className="h-5 w-5 text-primary" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Selection Summary */}
            {selectedFiles.size > 0 && (
              <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                <p className="text-sm font-medium">
                  {selectedFiles.size} document{selectedFiles.size !== 1 ? 's' : ''} selected
                </p>
                <p className="text-xs text-muted-foreground">
                  These will be assigned to {agentName || 'the agent'} as {assignmentType.replace('_', ' ')}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={assigning}>
              Cancel
            </Button>
            <Button 
              onClick={handleAssignSelected}
              disabled={selectedFiles.size === 0 || assigning}
            >
              {assigning ? 'Assigning...' : `Assign ${selectedFiles.size} Document${selectedFiles.size !== 1 ? 's' : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
