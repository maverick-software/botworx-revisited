import React, { useState, useEffect, useCallback } from 'react';
import { 
  Upload, 
  FileText, 
  Image, 
  Video, 
  Music, 
  Archive,
  Search,
  Filter,
  Grid,
  List,
  Plus,
  FolderPlus,
  Settings,
  Download,
  Eye,
  Trash2,
  MoreHorizontal,
  Tag,
  Calendar,
  FileType,
  HardDrive,
  Users,
  BookOpen,
  Shield,
  GraduationCap,
  BookMarked
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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
  processing_status: 'uploaded' | 'processing' | 'completed' | 'failed' | 'archived';
  assigned_agents_count: number;
  created_at: string;
  updated_at: string;
  file_url?: string;
  chunk_count: number;
}

interface MediaCategory {
  id: string;
  name: string;
  description?: string;
  color_hex?: string;
  icon_name?: string;
  media_count: number;
}

interface MediaStats {
  total_files: number;
  total_size_bytes: number;
  files_by_status: Record<string, number>;
  files_by_type: Record<string, number>;
  categories_count: number;
  assigned_files_count: number;
}

export function MediaLibraryPage() {
  const supabase = useSupabaseClient();
  const { user } = useAuth();
  
  // Data state
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [categories, setCategories] = useState<MediaCategory[]>([]);
  const [stats, setStats] = useState<MediaStats | null>(null);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Upload state
  const [isDragOver, setIsDragOver] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  
  // Load data on component mount
  useEffect(() => {
    if (user) {
      loadMediaLibrary();
    }
  }, [user]);

  const loadMediaLibrary = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Get session token
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('No authenticated session');
      }

      // Load categories and stats
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
          setStats(categoriesData.data.statistics || null);
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
          sort_by: sortBy,
          sort_order: sortOrder
        })
      });

      if (mediaResponse.ok) {
        const mediaData = await mediaResponse.json();
        if (mediaData.success) {
          setMediaFiles(mediaData.data.documents || []);
        }
      }

    } catch (error) {
      console.error('Error loading media library:', error);
      toast.error('Failed to load media library');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = useCallback(async (files: FileList) => {
    if (!user || files.length === 0) return;
    
    setUploading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('No authenticated session');
      }

      for (const file of Array.from(files)) {
        // Validate file
        if (file.size > 50 * 1024 * 1024) { // 50MB limit
          toast.error(`File ${file.name} exceeds 50MB limit`);
          continue;
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
            file_name: file.name,
            file_type: file.type,
            file_size: file.size,
            category: selectedCategory === 'all' ? 'general' : selectedCategory,
            description: `Uploaded via Media Library on ${new Date().toLocaleDateString()}`
          })
        });

        if (!uploadResponse.ok) {
          throw new Error(`Upload preparation failed for ${file.name}`);
        }

        const uploadData = await uploadResponse.json();
        if (!uploadData.success) {
          throw new Error(uploadData.error || `Upload failed for ${file.name}`);
        }

        // Upload file directly to Supabase storage (like other parts of the app)
        const { error: storageError } = await supabase.storage
          .from(uploadData.data.bucket)
          .upload(uploadData.data.storage_path, file, {
            contentType: file.type,
            duplex: 'half'
          });

        if (storageError) {
          console.error('Storage upload error:', storageError);
          throw new Error(`Storage upload failed for ${file.name}: ${storageError.message}`);
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
            toast.success(`${file.name} uploaded and processed successfully`);
          } else {
            toast.warn(`${file.name} uploaded but processing failed: ${processData.error}`);
          }
        } else {
          // Handle process error
          const errorText = await processResponse.text();
          console.error('Process response error:', {
            status: processResponse.status,
            statusText: processResponse.statusText,
            errorText,
            fileName: file.name,
            mediaId: uploadData.data.media_id
          });
          toast.warn(`${file.name} uploaded but processing failed: ${processResponse.status} ${processResponse.statusText}`);
        }
      }

      // Reload media library
      await loadMediaLibrary();

    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  }, [user, selectedCategory, sortBy, sortOrder, supabase]);

  const handleViewDocument = useCallback(async (file: MediaFile) => {
    try {
      console.log('Attempting to view document:', {
        fileName: file.file_name,
        storagePath: file.storage_path,
        documentId: file.id
      });

      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('No authenticated session');
      }

      // Get signed URL via Edge Function (uses service role)
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/media-library-api`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'get_signed_url',
          document_id: file.id,
          expiry_seconds: 3600 // 1 hour
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Signed URL response:', result);

      if (!result.success) {
        throw new Error(result.error || 'Failed to get signed URL');
      }
      
      if (!result.data?.signed_url) {
        throw new Error('No signed URL returned');
      }

      console.log('Opening URL:', result.data.signed_url);
      
      // Open in new tab
      window.open(result.data.signed_url, '_blank');
    } catch (error: any) {
      console.error('View document error:', error);
      toast.error(`Failed to view document: ${error.message}`);
    }
  }, [supabase]);

  const handleDownloadDocument = useCallback(async (file: MediaFile) => {
    try {
      console.log('Attempting to download document:', {
        fileName: file.file_name,
        storagePath: file.storage_path,
        documentId: file.id
      });

      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('No authenticated session');
      }

      // Get signed URL via Edge Function (uses service role)
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/media-library-api`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'get_signed_url',
          document_id: file.id,
          expiry_seconds: 300 // 5 minutes
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Download signed URL response:', result);

      if (!result.success) {
        throw new Error(result.error || 'Failed to get signed URL');
      }
      
      if (!result.data?.signed_url) {
        throw new Error('No signed URL returned for download');
      }

      console.log('Downloading file via fetch to avoid navigation...');
      
      // Fetch the file as a blob to avoid any navigation
      const fileResponse = await fetch(result.data.signed_url);
      if (!fileResponse.ok) {
        throw new Error(`Failed to fetch file: ${fileResponse.status} ${fileResponse.statusText}`);
      }
      
      const blob = await fileResponse.blob();
      
      // Create blob URL and download
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = file.file_name;
      link.style.display = 'none';
      document.body.appendChild(link);
      
      // Trigger download
      link.click();
      
      // Clean up
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      
      toast.success(`Downloaded ${file.file_name}`);
    } catch (error: any) {
      console.error('Download document error:', error);
      toast.error(`Failed to download document: ${error.message}`);
    }
  }, [supabase]);

  const handleDeleteDocument = useCallback(async (file: MediaFile) => {
    if (!confirm(`Are you sure you want to delete "${file.file_name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('No authenticated session');
      }

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('media-library')
        .remove([file.storage_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('media_library')
        .delete()
        .eq('id', file.id);

      if (dbError) throw dbError;

      toast.success(`Deleted ${file.file_name}`);
      
      // Reload media library
      await loadMediaLibrary();
    } catch (error: any) {
      console.error('Delete document error:', error);
      toast.error(`Failed to delete document: ${error.message}`);
    }
  }, [supabase, loadMediaLibrary]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (e.dataTransfer.files) {
      handleFileUpload(e.dataTransfer.files);
    }
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  // Filter media files based on search and filters
  const filteredFiles = mediaFiles.filter(file => {
    const matchesSearch = searchQuery === '' || 
      file.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      file.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      file.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      file.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || file.category === selectedCategory;
    const matchesStatus = selectedStatus === 'all' || file.processing_status === selectedStatus;
    
    return matchesSearch && matchesCategory && matchesStatus;
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

  // Get status badge variant
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'processing': return 'secondary';
      case 'failed': return 'destructive';
      case 'uploaded': return 'outline';
      default: return 'secondary';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Media Library</h1>
          <p className="text-muted-foreground">
            Manage your documents, images, and media files for agent training. 
            Supports PDF, Word, PowerPoint, text, images (JPEG, PNG, GIF, WebP), 
            audio (MP3, WAV), and video (MP4, WebM) files up to 50MB each.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowUploadModal(true)}
            disabled={uploading}
          >
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? 'Uploading...' : 'Upload Files'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
          >
            {viewMode === 'grid' ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Files</p>
                  <p className="text-2xl font-bold">{stats.total_files}</p>
                </div>
                <FileText className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Storage Used</p>
                  <p className="text-2xl font-bold">{formatFileSize(stats.total_size_bytes)}</p>
                </div>
                <HardDrive className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Categories</p>
                  <p className="text-2xl font-bold">{stats.categories_count}</p>
                </div>
                <Archive className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Assigned to Agents</p>
                  <p className="text-2xl font-bold">{stats.assigned_files_count}</p>
                </div>
                <Users className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="library" className="space-y-4">
        <TabsList>
          <TabsTrigger value="library">Library</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="space-y-4">
          {/* Search and Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search files, descriptions, tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="flex gap-2">
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

              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="uploaded">Uploaded</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={`${sortBy}_${sortOrder}`} onValueChange={(value) => {
                const [field, order] = value.split('_');
                setSortBy(field);
                setSortOrder(order as 'asc' | 'desc');
              }}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at_desc">Newest First</SelectItem>
                  <SelectItem value="created_at_asc">Oldest First</SelectItem>
                  <SelectItem value="file_name_asc">Name A-Z</SelectItem>
                  <SelectItem value="file_name_desc">Name Z-A</SelectItem>
                  <SelectItem value="file_size_desc">Largest First</SelectItem>
                  <SelectItem value="file_size_asc">Smallest First</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Media Files Display */}
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading media library...</p>
              </div>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="text-center p-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No files found</p>
              <p className="text-sm">
                {searchQuery || selectedCategory !== 'all' || selectedStatus !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Upload your first file to get started'
                }
              </p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredFiles.map((file) => (
                <Card key={file.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      {getFileTypeIcon(file.file_type)}
                      <Badge variant={getStatusBadgeVariant(file.processing_status)}>
                        {file.processing_status}
                      </Badge>
                    </div>
                    
                    <h4 className="font-medium text-sm mb-1 truncate" title={file.display_name}>
                      {file.display_name}
                    </h4>
                    
                    <p className="text-xs text-muted-foreground mb-2">
                      {formatFileSize(file.file_size)} • {file.category}
                    </p>
                    
                    {file.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {file.tags.slice(0, 2).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {file.tags.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{file.tags.length - 2}
                          </Badge>
                        )}
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{file.assigned_agents_count} agents</span>
                      <span>{new Date(file.created_at).toLocaleDateString()}</span>
                    </div>
                    
                    <div className="flex items-center justify-end mt-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 px-2">
                            <MoreHorizontal className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewDocument(file)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownloadDocument(file)}>
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteDocument(file)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredFiles.map((file) => (
                <Card key={file.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {getFileTypeIcon(file.file_type)}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">{file.display_name}</h4>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{formatFileSize(file.file_size)}</span>
                            <span>•</span>
                            <span>{file.category}</span>
                            <span>•</span>
                            <span>{file.assigned_agents_count} agents</span>
                            <span>•</span>
                            <span>{new Date(file.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge variant={getStatusBadgeVariant(file.processing_status)}>
                          {file.processing_status}
                        </Badge>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewDocument(file)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownloadDocument(file)}>
                              <Download className="h-4 w-4 mr-2" />
                              Download
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDeleteDocument(file)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Categories</h2>
            <Button>
              <FolderPlus className="h-4 w-4 mr-2" />
              New Category
            </Button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {categories.map((category) => (
              <Card key={category.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    {getCategoryIcon(category.icon_name)}
                    <h4 className="font-medium">{category.name}</h4>
                  </div>
                  {category.description && (
                    <p className="text-sm text-muted-foreground mb-2">
                      {category.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {category.media_count} file{category.media_count !== 1 ? 's' : ''}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <h2 className="text-xl font-semibold">Analytics</h2>
          
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Files by Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {stats?.files_by_status ? Object.entries(stats.files_by_status).map(([status, count]) => (
                      <div key={status} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant={getStatusBadgeVariant(status)}>
                            {status}
                          </Badge>
                        </div>
                        <span className="font-medium">{count}</span>
                      </div>
                    )) : (
                      <p className="text-sm text-muted-foreground">No status data available</p>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Files by Type</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {stats?.files_by_type ? Object.entries(stats.files_by_type).map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getFileTypeIcon(`application/${type}`)}
                          <span className="text-sm">{type}</span>
                        </div>
                        <span className="font-medium">{count}</span>
                      </div>
                    )) : (
                      <p className="text-sm text-muted-foreground">No type data available</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Upload Modal */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Media Files</DialogTitle>
            <DialogDescription>
              Upload documents, images, audio, and video files to your media library. 
              Supports files up to 50MB each.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 ${
                isDragOver 
                  ? 'border-primary bg-primary/5' 
                  : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
              <h3 className="font-medium mb-2">
                {uploading ? 'Uploading...' : 'Drop files here or click to browse'}
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                Supports documents, images, audio, and video (max 50MB)
              </p>
              <Button 
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.multiple = true;
                  input.accept = '*/*';
                  input.onchange = (e) => {
                    const files = (e.target as HTMLInputElement).files;
                    if (files) {
                      handleFileUpload(files);
                      setShowUploadModal(false);
                    }
                  };
                  input.click();
                }}
                disabled={uploading}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Browse Files
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
