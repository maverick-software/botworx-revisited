import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Key, Mail, Loader2, ExternalLink, AlertCircle } from 'lucide-react';

interface ChannelService {
  id: string;
  name: string;
  gradient: string;
}

interface MailgunSetupFormProps {
  service: ChannelService;
  apiKey: string;
  mailgunDomain: string;
  connectionName: string;
  error: string | null;
  isConnecting: boolean;
  onApiKeyChange: (value: string) => void;
  onDomainChange: (value: string) => void;
  onConnectionNameChange: (value: string) => void;
  onConnect: () => void;
}

export function MailgunSetupForm({
  service,
  apiKey,
  mailgunDomain,
  connectionName,
  error,
  isConnecting,
  onApiKeyChange,
  onDomainChange,
  onConnectionNameChange,
  onConnect
}: MailgunSetupFormProps) {
  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Key className="h-5 w-5 text-pink-500" />
          <span>Mailgun API Configuration</span>
        </CardTitle>
        <CardDescription>
          Configure your Mailgun API key and domain
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div>
          <Label htmlFor="mg_domain">
            Mailgun Domain <span className="text-red-500">*</span>
          </Label>
          <Input 
            id="mg_domain" 
            value={mailgunDomain} 
            onChange={(e) => onDomainChange(e.target.value)} 
            placeholder="mail.yourdomain.com" 
            className="mt-1" 
          />
          <p className="text-xs text-muted-foreground mt-1">
            Your verified Mailgun sending domain
          </p>
        </div>

        <div>
          <Label htmlFor="mg_api_key">
            Mailgun API Key <span className="text-red-500">*</span>
          </Label>
          <Input 
            id="mg_api_key" 
            type="password" 
            value={apiKey} 
            onChange={(e) => onApiKeyChange(e.target.value)} 
            placeholder="key-xxxxxxxxxxxxxxxxxxxx" 
            className="mt-1" 
          />
          <p className="text-xs text-muted-foreground mt-1">
            Your Mailgun API key with sending permissions
          </p>
        </div>

        <div>
          <Label htmlFor="connection_name_mg">
            Connection Name (Optional)
          </Label>
          <Input
            id="connection_name_mg"
            value={connectionName}
            onChange={(e) => onConnectionNameChange(e.target.value)}
            placeholder="My Mailgun Connection"
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Give this connection a name to identify it later
          </p>
        </div>

        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <ExternalLink className="h-4 w-4" />
          <a 
            href="https://app.mailgun.com/app/account/security/api_keys" 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:text-foreground underline"
          >
            Get your Mailgun API key
          </a>
        </div>

        <Button
          onClick={onConnect}
          disabled={isConnecting}
          className={`w-full bg-gradient-to-r ${service.gradient} hover:opacity-90 text-white`}
        >
          {isConnecting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <Mail className="h-4 w-4 mr-2" />
              Connect Mailgun
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
