import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Users, 
  UserPlus, 
  Search, 
  Filter, 
  Download, 
  Upload, 
  Settings, 
  Eye,
  Phone,
  Mail,
  MessageSquare,
  MoreVertical,
  Edit,
  Trash2,
  Plus,
  FileUp,
  FileDown
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import ContactImportModal from '@/components/modals/ContactImportModal';
import AddContactModal from '@/components/modals/AddContactModal';

interface Contact {
  id: string;
  display_name: string;
  first_name: string;
  last_name?: string;
  organization?: string;
  job_title?: string;
  contact_type: string;
  contact_status: string;
  tags: string[];
  primary_email?: string;
  primary_phone?: string;
  last_contacted_at?: string;
  created_at: string;
  interaction_count?: number;
}

interface ContactGroup {
  id: string;
  name: string;
  description?: string;
  group_type: string;
  member_count: number;
  color: string;
  icon: string;
}

export default function ContactsPage() {
  const { user } = useAuth();
  
  // State management
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactGroups, setContactGroups] = useState<ContactGroup[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name');
  
  // Modal states
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddContactModal, setShowAddContactModal] = useState(false);

  // Statistics
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    recent: 0,
    withEmail: 0,
    withPhone: 0
  });

  // Load initial data
  useEffect(() => {
    if (user) {
      loadContactData();
      loadContactGroups();
    }
  }, [user]);

  const loadContactData = async () => {
    setLoading(true);
    try {
      // Load contacts first
      const { data: contactsData, error: contactsError } = await supabase
        .from('contacts')
        .select(`
          id,
          display_name,
          first_name,
          last_name,
          organization,
          job_title,
          contact_type,
          contact_status,
          tags,
          created_at,
          last_contacted_at
        `)
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('display_name');

      if (contactsError) throw contactsError;

      // Process contacts to extract primary channels and interaction counts
      const processedContacts = await Promise.all(
        contactsData.map(async (contact: any) => {
          // Load channels separately to avoid join issues
          const { data: channels } = await supabase
            .from('contact_communication_channels')
            .select('channel_type, channel_identifier, is_primary, is_active')
            .eq('contact_id', contact.id)
            .eq('is_active', true);

          const channelsArray = channels || [];
          const primaryEmail = channelsArray.find((c: any) => 
            c.channel_type === 'email' && c.is_primary
          )?.channel_identifier;
          const primaryPhone = channelsArray.find((c: any) => 
            c.channel_type === 'phone' && c.is_primary
          )?.channel_identifier;

          // Get interaction count
          const { count: interactionCount } = await supabase
            .from('contact_interactions')
            .select('*', { count: 'exact', head: true })
            .eq('contact_id', contact.id);
          
          return {
            ...contact,
            primary_email: primaryEmail,
            primary_phone: primaryPhone,
            interaction_count: interactionCount || 0
          };
        })
      );

      setContacts(processedContacts);

      // Calculate statistics
      const totalContacts = processedContacts.length;
      const activeContacts = processedContacts.filter(c => c.contact_status === 'active').length;
      const recentContacts = processedContacts.filter(c => {
        const createdDate = new Date(c.created_at);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return createdDate > thirtyDaysAgo;
      }).length;
      const withEmail = processedContacts.filter(c => c.primary_email).length;
      const withPhone = processedContacts.filter(c => c.primary_phone).length;

      setStats({
        total: totalContacts,
        active: activeContacts,
        recent: recentContacts,
        withEmail,
        withPhone
      });

    } catch (error: any) {
      console.error('Error loading contact data:', error);
      toast.error('Failed to load contacts. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadContactGroups = async () => {
    try {
      const { data: groupsData, error: groupsError } = await supabase
        .from('contact_groups')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (groupsError) throw groupsError;
      setContactGroups(groupsData || []);
    } catch (error: any) {
      console.error('Error loading contact groups:', error);
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm('Are you sure you want to delete this contact? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .rpc('gdpr_delete_contact', {
          p_contact_id: contactId,
          p_user_id: user.id,
          p_deletion_reason: 'User requested deletion'
        });

      if (error) throw error;

      toast.success('Contact deleted successfully.');

      // Reload contacts
      loadContactData();
    } catch (error: any) {
      console.error('Error deleting contact:', error);
      toast.error('Failed to delete contact. Please try again.');
    }
  };

  const handleExportContacts = async () => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select(`
          display_name,
          first_name,
          last_name,
          organization,
          job_title,
          contact_type,
          tags,
          created_at,
          contact_communication_channels (
            channel_type,
            channel_identifier,
            is_primary
          )
        `)
        .eq('user_id', user.id)
        .eq('contact_status', 'active')
        .is('deleted_at', null);

      if (error) throw error;

      // Convert to CSV format
      const csvHeaders = [
        'Name', 'First Name', 'Last Name', 'Organization', 'Job Title', 
        'Type', 'Tags', 'Email', 'Phone', 'Created'
      ];

      const csvRows = data.map((contact: any) => {
        const channels = contact.contact_communication_channels || [];
        const email = channels.find((c: any) => c.channel_type === 'email' && c.is_primary)?.channel_identifier || '';
        const phone = channels.find((c: any) => c.channel_type === 'phone' && c.is_primary)?.channel_identifier || '';
        
        return [
          contact.display_name,
          contact.first_name,
          contact.last_name || '',
          contact.organization || '',
          contact.job_title || '',
          contact.contact_type,
          contact.tags.join('; '),
          email,
          phone,
          new Date(contact.created_at).toLocaleDateString()
        ];
      });

      const csvContent = [csvHeaders, ...csvRows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');

      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `contacts_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Contacts exported successfully.');

    } catch (error: any) {
      console.error('Error exporting contacts:', error);
      toast.error('Failed to export contacts. Please try again.');
    }
  };

  // Filter and sort contacts
  const filteredContacts = contacts
    .filter(contact => {
      // Search filter
      const searchMatch = searchQuery === '' || 
        contact.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (contact.organization && contact.organization.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (contact.job_title && contact.job_title.toLowerCase().includes(searchQuery.toLowerCase()));

      // Type filter
      const typeMatch = filterType === 'all' || contact.contact_type === filterType;

      return searchMatch && typeMatch;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.display_name.localeCompare(b.display_name);
        case 'organization':
          return (a.organization || '').localeCompare(b.organization || '');
        case 'created':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'contacted':
          const aDate = a.last_contacted_at ? new Date(a.last_contacted_at).getTime() : 0;
          const bDate = b.last_contacted_at ? new Date(b.last_contacted_at).getTime() : 0;
          return bDate - aDate;
        default:
          return 0;
      }
    });

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Contacts</h1>
          <p className="text-muted-foreground">
            Manage your contact list and communication channels
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2"
          >
            <FileUp className="w-4 h-4" />
            Import
          </Button>
          <Button 
            variant="outline" 
            onClick={handleExportContacts}
            className="flex items-center gap-2"
          >
            <FileDown className="w-4 h-4" />
            Export
          </Button>
          <Button 
            onClick={() => setShowAddContactModal(true)}
            className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Add Contact
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total Contacts</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.active}</div>
              <div className="text-xs text-muted-foreground">Active</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{stats.recent}</div>
              <div className="text-xs text-muted-foreground">Added Recently</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{stats.withEmail}</div>
              <div className="text-xs text-muted-foreground">With Email</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-teal-600">{stats.withPhone}</div>
              <div className="text-xs text-muted-foreground">With Phone</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search contacts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-type">Contact Type</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="internal">Internal</SelectItem>
                  <SelectItem value="external">External</SelectItem>
                  <SelectItem value="partner">Partner</SelectItem>
                  <SelectItem value="vendor">Vendor</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="prospect">Prospect</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sort-by">Sort By</Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort by..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="organization">Organization</SelectItem>
                  <SelectItem value="created">Date Created</SelectItem>
                  <SelectItem value="contacted">Last Contacted</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchQuery('');
                  setFilterType('all');
                  setSortBy('name');
                }}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contacts List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Contacts ({filteredContacts.length})
            </span>
            {selectedContacts.size > 0 && (
              <Badge variant="secondary">
                {selectedContacts.size} selected
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-muted-foreground mt-2">Loading contacts...</p>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No contacts found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || filterType !== 'all' 
                  ? 'Try adjusting your search or filters'
                  : 'Get started by adding your first contact'
                }
              </p>
              {!searchQuery && filterType === 'all' && (
                <Button onClick={() => setShowAddContactModal(true)}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add Contact
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <input
                      type="checkbox"
                      checked={selectedContacts.has(contact.id)}
                      onChange={(e) => {
                        const newSelected = new Set(selectedContacts);
                        if (e.target.checked) {
                          newSelected.add(contact.id);
                        } else {
                          newSelected.delete(contact.id);
                        }
                        setSelectedContacts(newSelected);
                      }}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{contact.display_name}</h4>
                        <Badge variant={
                          contact.contact_type === 'internal' ? 'default' :
                          contact.contact_type === 'customer' ? 'secondary' :
                          contact.contact_type === 'prospect' ? 'outline' : 'secondary'
                        }>
                          {contact.contact_type}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {contact.organization && (
                          <span>{contact.organization}</span>
                        )}
                        {contact.organization && contact.job_title && (
                          <span> • </span>
                        )}
                        {contact.job_title && (
                          <span>{contact.job_title}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1">
                        {contact.primary_email && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail className="w-3 h-3" />
                            <span>{contact.primary_email}</span>
                          </div>
                        )}
                        {contact.primary_phone && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="w-3 h-3" />
                            <span>{contact.primary_phone}</span>
                          </div>
                        )}
                        {contact.interaction_count > 0 && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MessageSquare className="w-3 h-3" />
                            <span>{contact.interaction_count} interactions</span>
                          </div>
                        )}
                      </div>
                      {contact.tags.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {contact.tags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {contact.tags.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{contact.tags.length - 3} more
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleDeleteContact(contact.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <ContactImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={() => {
          setShowImportModal(false);
          loadContactData();
        }}
      />
      
      <AddContactModal
        isOpen={showAddContactModal}
        onClose={() => setShowAddContactModal(false)}
        onContactAdded={() => {
          setShowAddContactModal(false);
          loadContactData();
        }}
      />
    </div>
  );
}
