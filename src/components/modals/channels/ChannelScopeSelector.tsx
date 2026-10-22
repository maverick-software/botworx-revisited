import React from 'react';

interface AgentPermission {
  id: string;
  connection_id: string;
  provider_name: string;
  external_username?: string | null;
  is_active: boolean;
  allowed_scopes?: string[];
}

interface ChannelScopeSelectorProps {
  editingPermission: AgentPermission | null;
  selectedScopes: string[];
  onScopesChange: (scopes: string[]) => void;
}

export function ChannelScopeSelector({
  editingPermission,
  selectedScopes,
  onScopesChange
}: ChannelScopeSelectorProps) {
  const toggleScope = (scope: string, checked: boolean) => {
    const newScopes = checked 
      ? [...selectedScopes, scope]
      : selectedScopes.filter(s => s !== scope);
    onScopesChange(newScopes);
  };

  const provider = (editingPermission as any)?.provider_name?.toLowerCase() || '';

  if (provider === 'gmail') {
    const gmailScopes = [
      { 
        scope: 'https://www.googleapis.com/auth/gmail.send', 
        label: 'Send Email',
        description: 'Allow agent to send emails on your behalf'
      },
      { 
        scope: 'https://www.googleapis.com/auth/gmail.readonly', 
        label: 'Read/Search Emails',
        description: 'Allow agent to read and search your emails'
      },
      { 
        scope: 'https://www.googleapis.com/auth/gmail.modify', 
        label: 'Email Actions (modify)',
        description: 'Allow agent to modify email labels and properties'
      }
    ];

    return (
      <div className="space-y-3">
        {gmailScopes.map(({ scope, label, description }) => (
          <div key={scope} className="space-y-1">
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <input 
                type="checkbox" 
                checked={selectedScopes.includes(scope)} 
                onChange={(e) => toggleScope(scope, e.target.checked)}
                className="rounded border-gray-300"
              />
              {label}
            </label>
            <p className="text-xs text-muted-foreground ml-6">
              {description}
            </p>
          </div>
        ))}
      </div>
    );
  }

  if (provider === 'mailgun') {
    const mailgunScopes = [
      { scope: 'send_email', label: 'Send Email', description: 'Send emails through Mailgun' },
      { scope: 'validate', label: 'Validate', description: 'Validate email addresses' },
      { scope: 'stats', label: 'Stats', description: 'Access email delivery statistics' },
      { scope: 'suppressions', label: 'Suppressions', description: 'Manage suppression lists' }
    ];

    return (
      <div className="space-y-3">
        {mailgunScopes.map(({ scope, label, description }) => (
          <div key={scope} className="space-y-1">
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <input 
                type="checkbox" 
                checked={selectedScopes.includes(scope)} 
                onChange={(e) => toggleScope(scope, e.target.checked)}
                className="rounded border-gray-300"
              />
              {label}
            </label>
            <p className="text-xs text-muted-foreground ml-6">
              {description}
            </p>
          </div>
        ))}
      </div>
    );
  }

  if (provider === 'sendgrid') {
    return (
      <div className="space-y-1">
        <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
          <input 
            type="checkbox" 
            checked={selectedScopes.includes('send_email')} 
            onChange={(e) => toggleScope('send_email', e.target.checked)}
            className="rounded border-gray-300"
          />
          Send Email
        </label>
        <p className="text-xs text-muted-foreground ml-6">
          Send emails through SendGrid
        </p>
      </div>
    );
  }

  return (
    <div className="text-sm text-muted-foreground">
      No permissions available for this service.
    </div>
  );
}
