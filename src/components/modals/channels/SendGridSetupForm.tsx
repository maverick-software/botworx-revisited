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

interface SendGridSetupFormProps {
  service: ChannelService;
  apiKey: string;
  fromEmail: string;
  fromName: string;
  connectionName: string;
  error: string | null;
  isConnecting: boolean;
  onApiKeyChange: (value: string) => void;
  onFromEmailChange: (value: string) => void;
  onFromNameChange: (value: string) => void;
  onConnectionNameChange: (value: string) => void;
  onConnect: () => void;
}

export function SendGridSetupForm({
  service,
  apiKey,
  fromEmail,
  fromName,
  connectionName,
  error,
  isConnecting,
  onApiKeyChange,
  onFromEmailChange,
  onFromNameChange,
  onConnectionNameChange,
  onConnect
}: SendGridSetupFormProps) {
  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Key className="h-5 w-5 text-blue-500" />
          <span>SendGrid API Configuration</span>
        </CardTitle>
        <CardDescription>
          Configure your SendGrid API key and email settings
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
          <Label htmlFor="api_key">
            SendGrid API Key <span className="text-red-500">*</span>
          </Label>
          <Input
            id="api_key"
            type="password"
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder="SG.xxxxxxxxxxxxxxxxxxxxxx"
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Your SendGrid API key with mail.send permissions
          </p>
        </div>

        <div>
          <Label htmlFor="from_email">
            From Email Address <span className="text-red-500">*</span>
          </Label>
          <Input
            id="from_email"
            type="email"
            value={fromEmail}
            onChange={(e) => onFromEmailChange(e.target.value)}
            placeholder="noreply@yourdomain.com"
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">
            The email address that will appear as the sender
          </p>
        </div>

        <div>
          <Label htmlFor="from_name">
            From Name (Optional)
          </Label>
          <Input
            id="from_name"
            value={fromName}
            onChange={(e) => onFromNameChange(e.target.value)}
            placeholder="Your Company Name"
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">
            The name that will appear as the sender
          </p>
        </div>

        <div>
          <Label htmlFor="connection_name_sg">
            Connection Name (Optional)
          </Label>
          <Input
            id="connection_name_sg"
            value={connectionName}
            onChange={(e) => onConnectionNameChange(e.target.value)}
            placeholder="My SendGrid Connection"
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Give this connection a name to identify it later
          </p>
        </div>

        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <ExternalLink className="h-4 w-4" />
          <a 
            href="https://app.sendgrid.com/settings/api_keys" 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:text-foreground underline"
          >
            Get your SendGrid API key
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
              Connect SendGrid
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
