# Frontend Integration Research - Delegated Access Dashboard
**Research Date:** November 4, 2025  
**Purpose:** Design GoDaddy-style delegation management UI with comprehensive access control

## GoDaddy Delegated Access Model

### Access Levels (GoDaddy Reference)

**1. Products, Domains, & Purchase (Full Control)**
- Make purchases using stored payment methods
- Access all products and control panels
- Cancel new products
- Domain management and transfers
- Billing access

**2. Products & Domains (Manage)**
- Access all products and control panels
- Cancel new products
- Cannot make purchases
- Domain permissions (customizable)

**3. Domains Only (Limited)**
- Access only to domain management
- Customizable management permissions

**4. Accounts Connection Only (View)**
- Connected for potential future access
- Currently no active permissions

### Our Adapted Model for Agentopia

**Full Control** (equivalent to Products, Domains, & Purchase)
- Use all agents (chat, interact)
- CRUD operations on agents
- Manage integrations and tools
- Access billing information
- Delete agents
- Manage other delegations
- Transfer ownership

**Manage** (equivalent to Products & Domains)
- Use all agents (chat, interact)
- CRUD operations on agents
- Manage integrations and tools
- View billing information (read-only)
- Cannot delete agents
- Cannot transfer ownership
- Cannot manage delegations

**View** (equivalent to Domains Only)
- View agent profiles and settings
- View conversations (read-only)
- View billing information (read-only)
- Cannot modify anything
- Cannot interact with agents

## Current Frontend Patterns

### Modal Patterns

**Agent Settings Modal** (`src/components/modals/AgentSettingsModal.tsx`)
- Tab-based navigation (Identity, Tools, Knowledge, etc.)
- Save/Cancel actions
- Ref-based save coordination
- Loading states per tab
- Success feedback

**Tools Tab** (`src/components/modals/agent-settings/ToolsTab.tsx` - 981 lines)
- Switch toggles for features
- Credential selection dialogs
- Provider configuration modals
- Save coordination via useImperativeHandle
- Status indicators (badges)

### List View Patterns

**Credentials Page** (`src/pages/CredentialsPage.tsx` - 471 lines)
- Card-based list items
- Status badges (active, expired, revoked)
- Action buttons (refresh, revoke, view details)
- Details modal for viewing full information
- Loading states
- Empty states

**Key Features:**
```typescript
// Card layout for each connection
<Card className="hover:shadow-md transition-shadow">
  <CardContent className="p-6">
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <Badge variant={statusVariant}>{status}</Badge>
        <div>
          <h3>{connectionName}</h3>
          <p className="text-sm text-muted-foreground">{provider}</p>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <Button onClick={onView}>View</Button>
        <Button variant="destructive" onClick={onRevoke}>Revoke</Button>
      </div>
    </div>
  </CardContent>
</Card>
```

### Agents Page Pattern (`src/pages/AgentsPage.tsx` - 657 lines)
- Grid layout for agent cards
- Search and filter functionality
- Team-based filtering
- Toggle status (active/inactive)
- Delete confirmation
- Create new agent button
- Empty state handling

## Proposed UI Structure

### Main Delegation Dashboard Page

**New Page:** `src/pages/DelegationsPage.tsx` (~450 lines)

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│ Delegated Access                                     │
│ Manage who has access to your agents                 │
├─────────────────────────────────────────────────────┤
│                                                       │
│ ┌─────────────┐  ┌─────────────┐                    │
│ │ Sent (5)    │  │ Received (2)│                    │
│ └─────────────┘  └─────────────┘                    │
│                                                       │
│ [+ Invite User]                     [Search...]      │
│                                                       │
│ ┌─────────────────────────────────────────────────┐ │
│ │ john@example.com                                │ │
│ │ ├─ Support Agent                                │ │
│ │ │  └─ Full Control  [Modify] [Revoke]          │ │
│ │ └─ Sales Agent                                  │ │
│ │    └─ Manage       [Modify] [Revoke]            │ │
│ ├─────────────────────────────────────────────────│ │
│ │ sarah@example.com (Pending)                     │ │
│ │ └─ Support Agent                                │ │
│ │    └─ View Only    [Resend] [Cancel]            │ │
│ └─────────────────────────────────────────────────┘ │
│                                                       │
│ Access Summary                                        │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │
│ │ 3 Active    │ │ 2 Pending   │ │ 5 Total     │    │
│ └─────────────┘ └─────────────┘ └─────────────┘    │
└─────────────────────────────────────────────────────┘
```

### Component Breakdown

#### 1. DelegationsPage.tsx (~450 lines)
Main page component with tab navigation

```typescript
export function DelegationsPage() {
  const [activeTab, setActiveTab] = useState<'sent' | 'received'>('sent');
  const [searchQuery, setSearchQuery] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  
  const { sentDelegations, receivedDelegations, loading } = useDelegations();
  const { agents } = useAgents();
  
  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Delegated Access</h1>
        <p className="text-muted-foreground">
          Manage who has access to your agents
        </p>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard title="Active" count={3} variant="success" />
        <SummaryCard title="Pending" count={2} variant="warning" />
        <SummaryCard title="Total" count={5} variant="default" />
      </div>
      
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="sent">
            Sent ({sentDelegations.length})
          </TabsTrigger>
          <TabsTrigger value="received">
            Received ({receivedDelegations.length})
          </TabsTrigger>
        </TabsList>
        
        {/* Actions Bar */}
        <div className="flex items-center justify-between py-4">
          <Button onClick={() => setShowInviteModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Invite User
          </Button>
          
          <Input
            placeholder="Search by email or agent..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-xs"
          />
        </div>
        
        {/* Sent Tab */}
        <TabsContent value="sent">
          <DelegationListView
            delegations={sentDelegations}
            type="sent"
            agents={agents}
          />
        </TabsContent>
        
        {/* Received Tab */}
        <TabsContent value="received">
          <DelegationListView
            delegations={receivedDelegations}
            type="received"
            agents={agents}
          />
        </TabsContent>
      </Tabs>
      
      {/* Invite Modal */}
      <InviteUserModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        agents={agents}
      />
    </div>
  );
}
```

#### 2. DelegationListView.tsx (~280 lines)
Grouped list of delegations by user

```typescript
interface DelegationListViewProps {
  delegations: Delegation[];
  type: 'sent' | 'received';
  agents: Agent[];
}

export function DelegationListView({ delegations, type, agents }: DelegationListViewProps) {
  // Group delegations by user/email
  const groupedDelegations = useMemo(() => {
    const groups = new Map<string, Delegation[]>();
    
    delegations.forEach(delegation => {
      const key = type === 'sent' 
        ? delegation.delegate_email 
        : delegation.owner_email;
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(delegation);
    });
    
    return Array.from(groups.entries()).map(([email, delegations]) => ({
      email,
      delegations,
      totalAgents: delegations.length,
      pendingCount: delegations.filter(d => d.status === 'pending').length,
      activeCount: delegations.filter(d => d.status === 'accepted').length
    }));
  }, [delegations, type]);
  
  if (delegations.length === 0) {
    return (
      <div className="text-center py-12">
        <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">
          {type === 'sent' ? 'No invitations sent' : 'No invitations received'}
        </h3>
        <p className="text-muted-foreground">
          {type === 'sent' 
            ? 'Invite users to collaborate on your agents' 
            : 'You haven\'t received any agent access invitations'}
        </p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {groupedDelegations.map(group => (
        <UserDelegationGroup
          key={group.email}
          email={group.email}
          delegations={group.delegations}
          type={type}
          agents={agents}
        />
      ))}
    </div>
  );
}
```

#### 3. UserDelegationGroup.tsx (~320 lines)
Card showing all delegations for a single user

```typescript
interface UserDelegationGroupProps {
  email: string;
  delegations: Delegation[];
  type: 'sent' | 'received';
  agents: Agent[];
}

export function UserDelegationGroup({ email, delegations, type, agents }: UserDelegationGroupProps) {
  const [expanded, setExpanded] = useState(true);
  const { revokeDelegation, resendInvitation } = useDelegationManagement();
  
  const activeCount = delegations.filter(d => d.status === 'accepted').length;
  const pendingCount = delegations.filter(d => d.status === 'pending').length;
  
  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{email}</CardTitle>
              <CardDescription>
                {activeCount} active, {pendingCount} pending
              </CardDescription>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {pendingCount > 0 && (
              <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                {pendingCount} Pending
              </Badge>
            )}
            <ChevronDown className={`h-5 w-5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </div>
        </div>
      </CardHeader>
      
      {expanded && (
        <CardContent className="space-y-2">
          {delegations.map(delegation => (
            <DelegationItem
              key={delegation.id}
              delegation={delegation}
              agent={agents.find(a => a.id === delegation.agent_id)}
              type={type}
              onRevoke={() => revokeDelegation(delegation.id)}
              onResend={() => resendInvitation(delegation.id)}
            />
          ))}
        </CardContent>
      )}
    </Card>
  );
}
```

#### 4. DelegationItem.tsx (~250 lines)
Single agent delegation with actions

```typescript
interface DelegationItemProps {
  delegation: Delegation;
  agent?: Agent;
  type: 'sent' | 'received';
  onRevoke: () => void;
  onResend: () => void;
}

export function DelegationItem({ delegation, agent, type, onRevoke, onResend }: DelegationItemProps) {
  const [showModifyModal, setShowModifyModal] = useState(false);
  
  const getPermissionBadge = (level: string) => {
    const configs = {
      view: { variant: 'secondary', icon: Eye, label: 'View Only' },
      manage: { variant: 'default', icon: Settings, label: 'Manage' },
      full_control: { variant: 'destructive', icon: Crown, label: 'Full Control' }
    };
    
    const config = configs[level] || configs.view;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="flex items-center space-x-1">
        <Icon className="h-3 w-3" />
        <span>{config.label}</span>
      </Badge>
    );
  };
  
  return (
    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-center space-x-3 flex-1">
        {/* Agent Avatar */}
        {agent?.avatar_url ? (
          <img 
            src={agent.avatar_url} 
            alt={agent.name}
            className="w-8 h-8 rounded-full"
          />
        ) : (
          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
            <Bot className="h-4 w-4 text-primary" />
          </div>
        )}
        
        {/* Agent Info */}
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <span className="font-medium">{agent?.name || 'Unknown Agent'}</span>
            {delegation.status === 'pending' && (
              <Badge variant="outline" className="text-xs">
                Pending
              </Badge>
            )}
          </div>
          <div className="flex items-center space-x-2 mt-1">
            {getPermissionBadge(delegation.permission_level)}
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(delegation.invited_at))} ago
            </span>
          </div>
        </div>
      </div>
      
      {/* Actions */}
      <div className="flex items-center space-x-2">
        {type === 'sent' && (
          <>
            {delegation.status === 'pending' && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={onResend}
              >
                <Mail className="h-4 w-4 mr-1" />
                Resend
              </Button>
            )}
            
            {delegation.status === 'accepted' && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowModifyModal(true)}
              >
                <Edit className="h-4 w-4 mr-1" />
                Modify
              </Button>
            )}
            
            <Button 
              variant="destructive" 
              size="sm"
              onClick={onRevoke}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              {delegation.status === 'pending' ? 'Cancel' : 'Revoke'}
            </Button>
          </>
        )}
        
        {type === 'received' && delegation.status === 'pending' && (
          <>
            <Button 
              variant="default" 
              size="sm"
              onClick={() => {/* Accept */}}
            >
              <Check className="h-4 w-4 mr-1" />
              Accept
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {/* Decline */}}
            >
              <X className="h-4 w-4 mr-1" />
              Decline
            </Button>
          </>
        )}
      </div>
      
      {/* Modify Permission Modal */}
      {showModifyModal && (
        <ModifyPermissionModal
          delegation={delegation}
          agent={agent}
          onClose={() => setShowModifyModal(false)}
        />
      )}
    </div>
  );
}
```

#### 5. InviteUserModal.tsx (~380 lines)
Modal for inviting users with agent selection

```typescript
interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  agents: Agent[];
}

export function InviteUserModal({ isOpen, onClose, agents }: InviteUserModalProps) {
  const [email, setEmail] = useState('');
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
  const [permissionLevel, setPermissionLevel] = useState<'view' | 'manage' | 'full_control'>('manage');
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [emailExists, setEmailExists] = useState<boolean | null>(null);
  const [sending, setSending] = useState(false);
  
  const { createInvitation } = useDelegationManagement();
  
  const handleEmailChange = async (value: string) => {
    setEmail(value);
    
    if (!value.includes('@')) {
      setEmailExists(null);
      return;
    }
    
    setCheckingEmail(true);
    try {
      const { data } = await supabase.functions.invoke('check-email-exists', {
        body: { email: value }
      });
      setEmailExists(data?.exists || false);
    } catch (error) {
      console.error('Error checking email:', error);
      setEmailExists(null);
    } finally {
      setCheckingEmail(false);
    }
  };
  
  const handleSubmit = async () => {
    if (!email || selectedAgents.size === 0) return;
    
    setSending(true);
    try {
      // Create invitations for each selected agent
      await Promise.all(
        Array.from(selectedAgents).map(agentId =>
          createInvitation({
            agentId,
            delegateEmail: email,
            permissionLevel
          })
        )
      );
      
      toast.success(`Invited ${email} to ${selectedAgents.size} agent(s)`);
      onClose();
    } catch (error) {
      toast.error('Failed to send invitations');
    } finally {
      setSending(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Invite User to Access Agents</DialogTitle>
          <DialogDescription>
            Share access to your agents with other users
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Email Input */}
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <div className="relative">
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
              />
              {checkingEmail && (
                <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin" />
              )}
            </div>
            
            {emailExists !== null && (
              <p className="text-sm text-muted-foreground">
                {emailExists ? (
                  <span className="flex items-center text-green-600">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    User has an account
                  </span>
                ) : (
                  <span className="flex items-center text-blue-600">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    New user - will receive signup invitation
                  </span>
                )}
              </p>
            )}
          </div>
          
          {/* Agent Selection */}
          <div className="space-y-2">
            <Label>Select Agents</Label>
            <div className="border rounded-lg max-h-60 overflow-y-auto">
              {agents.map(agent => (
                <div 
                  key={agent.id}
                  className="flex items-center space-x-3 p-3 hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    checked={selectedAgents.has(agent.id)}
                    onCheckedChange={(checked) => {
                      const newSet = new Set(selectedAgents);
                      if (checked) {
                        newSet.add(agent.id);
                      } else {
                        newSet.delete(agent.id);
                      }
                      setSelectedAgents(newSet);
                    }}
                  />
                  <div className="flex items-center space-x-2 flex-1">
                    {agent.avatar_url ? (
                      <img 
                        src={agent.avatar_url} 
                        alt={agent.name}
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium">{agent.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {agent.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              {selectedAgents.size} agent(s) selected
            </p>
          </div>
          
          {/* Permission Level */}
          <div className="space-y-2">
            <Label>Permission Level</Label>
            <RadioGroup value={permissionLevel} onValueChange={setPermissionLevel}>
              <PermissionOption
                value="view"
                title="View Only"
                description="Can view agent profiles and conversations (read-only)"
                icon={Eye}
              />
              <PermissionOption
                value="manage"
                title="Manage"
                description="Can chat, modify settings, and manage integrations"
                icon={Settings}
                recommended
              />
              <PermissionOption
                value="full_control"
                title="Full Control"
                description="Complete access including delete and delegation management"
                icon={Crown}
                warning
              />
            </RadioGroup>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!email || selectedAgents.size === 0 || sending}
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Invitation{selectedAgents.size > 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

#### 6. PermissionOption.tsx (~120 lines)
Radio option for permission levels with visual indicators

```typescript
interface PermissionOptionProps {
  value: string;
  title: string;
  description: string;
  icon: React.ComponentType;
  recommended?: boolean;
  warning?: boolean;
}

export function PermissionOption({ 
  value, 
  title, 
  description, 
  icon: Icon,
  recommended,
  warning
}: PermissionOptionProps) {
  return (
    <div className="flex items-start space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors">
      <RadioGroupItem value={value} id={value} />
      <div className="flex-1">
        <div className="flex items-center space-x-2">
          <Icon className="h-4 w-4 text-primary" />
          <Label htmlFor={value} className="cursor-pointer font-medium">
            {title}
          </Label>
          {recommended && (
            <Badge variant="default" className="text-xs">
              Recommended
            </Badge>
          )}
          {warning && (
            <Badge variant="destructive" className="text-xs">
              Use with caution
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
    </div>
  );
}
```

## Agents Page Integration

### Showing Delegated Agents

**Modified:** `src/pages/AgentsPage.tsx`

```typescript
// Updated fetch to include delegated agents
const fetchAgents = useCallback(async () => {
  // 1. Fetch owned agents
  const { data: ownedAgents } = await supabase
    .from('agents')
    .select('*, is_delegated:false')
    .eq('user_id', user.id);
  
  // 2. Fetch delegated agents
  const { data: delegatedAgents } = await supabase
    .from('agents')
    .select(`
      *,
      is_delegated:true,
      delegation:agent_delegations!inner(
        permission_level,
        owner_user_id,
        delegate_user_id
      )
    `)
    .eq('agent_delegations.delegate_user_id', user.id)
    .eq('agent_delegations.status', 'accepted');
  
  // 3. Combine and mark delegated agents
  const allAgents = [
    ...(ownedAgents || []),
    ...(delegatedAgents || []).map(agent => ({
      ...agent,
      is_delegated: true,
      permission_level: agent.delegation?.permission_level
    }))
  ];
  
  setAgents(allAgents);
}, [user]);

// In the render, show delegation badge
<AgentCard
  agent={agent}
  isDelegated={agent.is_delegated}
  permissionLevel={agent.permission_level}
  onShare={() => setShowDelegationModal(true)}
/>
```

### Delegation Badge Component

**New:** `src/components/delegations/DelegatedAgentBadge.tsx` (~80 lines)

```typescript
interface DelegatedAgentBadgeProps {
  permissionLevel: 'view' | 'manage' | 'full_control';
  ownerName?: string;
}

export function DelegatedAgentBadge({ permissionLevel, ownerName }: DelegatedAgentBadgeProps) {
  const config = {
    view: { color: 'bg-blue-100 text-blue-700', icon: Eye, label: 'View' },
    manage: { color: 'bg-purple-100 text-purple-700', icon: Settings, label: 'Manage' },
    full_control: { color: 'bg-red-100 text-red-700', icon: Crown, label: 'Full' }
  };
  
  const { color, icon: Icon, label } = config[permissionLevel];
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className={`${color} flex items-center space-x-1`}>
            <Icon className="h-3 w-3" />
            <span>Delegated</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">Shared by {ownerName || 'another user'}</p>
          <p className="text-xs">{label} access</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

## Accept Delegation Page

**New:** `src/pages/AcceptDelegationPage.tsx` (~350 lines)

```typescript
export function AcceptDelegationPage() {
  const { token } = useParams<{ token: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [delegation, setDelegation] = useState<Delegation | null>(null);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [owner, setOwner] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  
  useEffect(() => {
    fetchDelegationDetails();
  }, [token]);
  
  const fetchDelegationDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('agent_delegations')
        .select(`
          *,
          agent:agents(*),
          owner:auth.users!owner_user_id(*)
        `)
        .eq('invitation_token', token)
        .single();
      
      if (error) throw error;
      
      // Check if token is expired
      if (new Date(data.token_expires_at) < new Date()) {
        setError('This invitation has expired');
        return;
      }
      
      // Check if already accepted/declined
      if (data.status !== 'pending') {
        setError(`This invitation has already been ${data.status}`);
        return;
      }
      
      setDelegation(data);
      setAgent(data.agent);
      setOwner(data.owner);
    } catch (err) {
      setError('Invalid or expired invitation link');
    } finally {
      setLoading(false);
    }
  };
  
  const handleAccept = async () => {
    if (!user) {
      // Redirect to login with return URL
      navigate(`/login?return=/accept-delegation/${token}`);
      return;
    }
    
    setAccepting(true);
    try {
      await supabase.functions.invoke('agent-delegation-manager', {
        body: {
          action: 'accept',
          token,
          user_id: user.id
        }
      });
      
      toast.success('Access granted! Redirecting...');
      setTimeout(() => {
        navigate(`/agents/${agent.id}`);
      }, 1500);
    } catch (error) {
      toast.error('Failed to accept invitation');
      setAccepting(false);
    }
  };
  
  const handleDecline = async () => {
    // Similar logic for declining
  };
  
  if (loading) {
    return <LoadingScreen />;
  }
  
  if (error) {
    return <ErrorScreen message={error} />;
  }
  
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader>
          <CardTitle>Agent Access Invitation</CardTitle>
          <CardDescription>
            {owner?.full_name || owner?.email} has invited you to access their agent
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Agent Details */}
          <div className="flex items-center space-x-4 p-4 border rounded-lg">
            {agent.avatar_url && (
              <img 
                src={agent.avatar_url} 
                alt={agent.name}
                className="w-16 h-16 rounded-full"
              />
            )}
            <div>
              <h3 className="text-lg font-semibold">{agent.name}</h3>
              <p className="text-sm text-muted-foreground">{agent.description}</p>
            </div>
          </div>
          
          {/* Permission Details */}
          <div>
            <h4 className="font-medium mb-2">Your Access Level</h4>
            <PermissionDetailsCard level={delegation.permission_level} />
          </div>
          
          {/* Actions */}
          <div className="flex items-center space-x-3">
            <Button 
              onClick={handleAccept}
              disabled={accepting}
              className="flex-1"
            >
              {accepting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Accepting...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Accept Invitation
                </>
              )}
            </Button>
            <Button 
              variant="outline" 
              onClick={handleDecline}
              className="flex-1"
            >
              Decline
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

## Billing Integration (Future Enhancement)

### Billing Access Control

For users with billing permissions:

```typescript
// In BillingPage.tsx or BillingDashboard.tsx
export function BillingDashboard() {
  const { user } = useAuth();
  const { billingPermissions } = useBillingPermissions(user.id);
  
  return (
    <div>
      {billingPermissions.canView && (
        <BillingOverview readOnly={!billingPermissions.canModify} />
      )}
      
      {billingPermissions.canModify && (
        <PaymentMethodsSection />
      )}
      
      {!billingPermissions.canView && (
        <AccessDenied message="You don't have permission to view billing" />
      )}
    </div>
  );
}
```

## Mobile Responsiveness

All components designed mobile-first:

- Collapsible delegation groups on mobile
- Stack actions vertically on small screens
- Touch-friendly tap targets (min 44x44px)
- Drawer-style modals on mobile
- Responsive grid layouts

## Accessibility

- WCAG AA compliant (4.5:1+ contrast)
- Keyboard navigation support
- Screen reader labels (ARIA)
- Focus indicators
- Skip links for navigation

## Summary of New Files

```
src/pages/
├── DelegationsPage.tsx (~450 lines)
└── AcceptDelegationPage.tsx (~350 lines)

src/components/delegations/
├── DelegationListView.tsx (~280 lines)
├── UserDelegationGroup.tsx (~320 lines)
├── DelegationItem.tsx (~250 lines)
├── InviteUserModal.tsx (~380 lines)
├── PermissionOption.tsx (~120 lines)
├── DelegatedAgentBadge.tsx (~80 lines)
├── ModifyPermissionModal.tsx (~220 lines)
├── PermissionDetailsCard.tsx (~150 lines)
└── SummaryCard.tsx (~60 lines)

src/hooks/
├── useDelegations.ts (~250 lines)
├── useAgentPermissions.ts (~180 lines)
└── useDelegationManagement.ts (~280 lines)
```

**Total Lines:** ~3,370 lines across 12 new files
**Average File Size:** ~281 lines (complies with Philosophy #1!)

## Next Steps

1. Implement base components (badges, cards)
2. Build delegation hooks for data management
3. Create invite flow UI
4. Implement accept/decline page
5. Add delegation management to AgentsPage
6. Test responsive design
7. Add accessibility features

## References

- GoDaddy Delegated Access: https://www.godaddy.com/help/delegate-access-levels-of-permission-12374
- Credentials Page: `src/pages/CredentialsPage.tsx`
- Agent Settings Modal: `src/components/modals/AgentSettingsModal.tsx`
- Current Agents Page: `src/pages/AgentsPage.tsx`

