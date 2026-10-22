import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Users, 
  Search, 
  Settings,
  Check,
  Loader2
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabase';

interface Agent {
  id: string;
  name: string;
  user_id: string;
}

interface Contact {
  id: string;
  display_name: string;
  organization?: string;
  job_title?: string;
  primary_email?: string;
  primary_phone?: string;
}

interface ContactsTabProps {
  agent: Agent;
}

export interface ContactsTabRef {
  save: () => Promise<void>;
  hasChanges?: boolean;
  saving: boolean;
  saveSuccess: boolean;
}

const ContactsTab = forwardRef<ContactsTabRef, ContactsTabProps>(({ agent }, ref) => {
  const { user } = useAuth();
  
  // Simplified state management
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [accessType, setAccessType] = useState<'none' | 'all_contacts' | 'some_contacts'>('none');
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());

  // Expose save function to parent via ref
  useImperativeHandle(ref, () => ({
    save: handleSaveSettings,
    hasChanges: true, // Always show save button for contacts tab since we can't easily track all changes
    saving,
    saveSuccess
  }));

  // Load initial data
  useEffect(() => {
    if (user && agent?.id) {
      loadContactData();
      loadAgentPermissions();
    }
  }, [user?.id, agent?.id]); // Only re-run if IDs change, not if object reference changes

  const loadContactData = async () => {
    setLoading(true);
    try {
      // Load contacts
      const { data: contactsData, error: contactsError } = await supabase
        .from('contacts')
        .select(`
          id,
          display_name,
          organization,
          job_title
        `)
        .eq('user_id', user.id)
        .eq('contact_status', 'active')
        .is('deleted_at', null)
        .order('display_name');

      if (contactsError) throw contactsError;

      // Process contacts to extract primary email/phone
      const processedContacts = await Promise.all(
        (contactsData || []).map(async (contact: any) => {
          // Load channels separately
          const { data: channels } = await supabase
            .from('contact_communication_channels')
            .select('channel_type, channel_identifier, is_primary')
            .eq('contact_id', contact.id)
            .eq('is_active', true);

          const channelsArray = channels || [];
          const primaryEmail = channelsArray.find((c: any) => c.channel_type === 'email' && c.is_primary)?.channel_identifier;
          const primaryPhone = channelsArray.find((c: any) => c.channel_type === 'phone' && c.is_primary)?.channel_identifier;
          
          return {
            ...contact,
            primary_email: primaryEmail,
            primary_phone: primaryPhone
          };
        })
      );

      setContacts(processedContacts);

    } catch (error: any) {
      console.error('Error loading contact data:', error);
      toast.error('Failed to load contact data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadAgentPermissions = async () => {
    try {
      const { data: permissionData, error } = await supabase
        .from('agent_contact_permissions')
        .select('*')
        .eq('agent_id', agent.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      if (permissionData) {
        // Set access type based on permission_type
        if (permissionData.permission_type === 'all_contacts') {
          setAccessType('all_contacts');
        } else if (permissionData.permission_type === 'specific_contacts') {
          setAccessType('some_contacts');
          
          // Load selected contacts
          const { data: specificAccess, error: accessError } = await supabase
            .from('agent_specific_contact_access')
            .select('contact_id')
            .eq('agent_id', agent.id);
          
          if (!accessError && specificAccess) {
            const contactIds = new Set(specificAccess.map((a: any) => a.contact_id));
            setSelectedContactIds(contactIds);
          }
        } else {
          // no_access or any other type
          setAccessType('none');
        }
      } else {
        // Default: no access
        setAccessType('none');
        setSelectedContactIds(new Set());
      }
    } catch (error: any) {
      console.error('Error loading agent permissions:', error);
      // Set defaults on error
      setAccessType('none');
      setSelectedContactIds(new Set());
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      if (accessType === 'none') {
        // If none, set permission_type to 'no_access'
        await supabase
          .from('agent_contact_permissions')
          .upsert({
            agent_id: agent.id,
            user_id: user.id,
            permission_type: 'no_access',
            can_view: false,
            can_contact: false,
            can_edit: false,
            can_delete: false,
            granted_by_user_id: user.id,
            granted_at: new Date().toISOString()
          }, {
            onConflict: 'agent_id'
          });

        // Clear any specific contact access
        await supabase
          .from('agent_specific_contact_access')
          .delete()
          .eq('agent_id', agent.id);

        toast.success('Contact tools disabled for this agent.');
      } else {
        // Determine permission type based on access type
        const permissionType = accessType === 'all_contacts' ? 'all_contacts' : 'specific_contacts';
        
        // Create or update agent permissions and get the record
        const { data: permissionData, error: permissionError } = await supabase
          .from('agent_contact_permissions')
          .upsert({
            agent_id: agent.id,
            user_id: user.id,
            permission_type: permissionType,
            can_view: true,
            can_contact: true,
            can_edit: false,
            can_delete: false,
            granted_by_user_id: user.id,
            granted_at: new Date().toISOString()
          }, {
            onConflict: 'agent_id'
          })
          .select()
          .single();

        if (permissionError) throw permissionError;
        if (!permissionData) throw new Error('Failed to create/update permissions');

        // Handle specific contacts if 'some_contacts' is selected
        if (accessType === 'some_contacts' && selectedContactIds.size > 0) {
          // Delete existing specific access
          await supabase
            .from('agent_specific_contact_access')
            .delete()
            .eq('agent_id', agent.id);

          // Insert new specific access
          const specificAccessData = Array.from(selectedContactIds).map(contactId => ({
            agent_id: agent.id,
            contact_id: contactId,
            permission_id: permissionData.id,
            user_id: user.id,
            access_level: 'view_and_contact'
          }));

          const { error: specificError } = await supabase
            .from('agent_specific_contact_access')
            .insert(specificAccessData);

          if (specificError) throw specificError;
        } else if (accessType === 'all_contacts') {
          // Clear any specific contact access when 'all_contacts' is selected
          await supabase
            .from('agent_specific_contact_access')
            .delete()
            .eq('agent_id', agent.id);
        }

        toast.success('Contact settings updated successfully.');
      }

      // Reload permissions to reflect changes
      await loadAgentPermissions();

      // Show success state
      setSaveSuccess(true);
      
      // Reset success state after 2 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 2000);

    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings. Please try again.');
      setSaveSuccess(false);
    } finally {
      setSaving(false);
    }
  };

  const handleContactToggle = (contactId: string, checked: boolean) => {
    const newSelected = new Set(selectedContactIds);
    if (checked) {
      newSelected.add(contactId);
    } else {
      newSelected.delete(contactId);
    }
    setSelectedContactIds(newSelected);
  };

  const filteredContacts = contacts.filter(contact =>
    contact.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (contact.organization && contact.organization.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (contact.job_title && contact.job_title.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Contact Access</h3>
          <p className="text-sm text-muted-foreground">
            Manage {agent.name}'s access to your contact list
          </p>
        </div>
      </div>

      {/* Main Settings Card */}
      <Card>
        <CardContent className="pt-6 space-y-6">
          {/* Access Level Dropdown */}
          <div className="space-y-2">
            <Label htmlFor="access-type">Access Level</Label>
            <Select
              value={accessType}
              onValueChange={(value: 'none' | 'all_contacts' | 'some_contacts') => {
                console.log('Changing access type to:', value);
                setAccessType(value);
                // Clear selected contacts when switching away from 'some_contacts'
                if (value !== 'some_contacts') {
                  setSelectedContactIds(new Set());
                }
              }}
            >
              <SelectTrigger id="access-type">
                <SelectValue>
                  {accessType === 'none' ? 'None' : accessType === 'all_contacts' ? 'All Contacts' : 'Some Contacts'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="all_contacts">All Contacts</SelectItem>
                <SelectItem value="some_contacts">Some Contacts</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Contact Selection - Only shown when 'some_contacts' is selected */}
          {accessType === 'some_contacts' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Select Contacts</Label>
                    <p className="text-sm text-muted-foreground">
                      Choose which contacts this agent can access
                    </p>
                  </div>

                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search contacts..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  {/* Contact List */}
                  <div className="space-y-2">
                    {filteredContacts.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground">
                        <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No contacts found</p>
                      </div>
                    ) : (
                      <div className="max-h-96 overflow-y-auto space-y-2">
                        {filteredContacts.map((contact) => (
                          <div
                            key={contact.id}
                            className="flex items-center space-x-3 p-3 bg-muted/20 hover:bg-muted/40 transition-colors rounded-lg"
                          >
                            <Checkbox
                              id={`contact-${contact.id}`}
                              checked={selectedContactIds.has(contact.id)}
                              onCheckedChange={(checked) => 
                                handleContactToggle(contact.id, checked as boolean)
                              }
                            />
                            <label
                              htmlFor={`contact-${contact.id}`}
                              className="flex-1 cursor-pointer"
                            >
                              <div className="font-medium">{contact.display_name}</div>
                              {(contact.organization || contact.job_title) && (
                                <div className="text-sm text-muted-foreground">
                                  {[contact.job_title, contact.organization]
                                    .filter(Boolean)
                                    .join(' • ')}
                                </div>
                              )}
                              {contact.primary_email && (
                                <div className="text-xs text-muted-foreground">
                                  {contact.primary_email}
                                </div>
                              )}
                            </label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Selection Summary */}
                  {filteredContacts.length > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {selectedContactIds.size} of {contacts.length} contacts selected
                      </span>
                      {selectedContactIds.size > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedContactIds(new Set())}
                        >
                          Clear Selection
                        </Button>
                      )}
                    </div>
                  )}
                </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
});

ContactsTab.displayName = 'ContactsTab';

export default ContactsTab;
