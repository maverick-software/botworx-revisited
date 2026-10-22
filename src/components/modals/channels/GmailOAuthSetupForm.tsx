import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Loader2 } from 'lucide-react';

interface ChannelService {
  id: string;
  name: string;
  gradient: string;
  type: 'oauth' | 'api_key';
}

interface GmailOAuthSetupFormProps {
  service: ChannelService;
  connectionName: string;
  isConnecting: boolean;
  onConnectionNameChange: (value: string) => void;
  onConnect: (serviceId: string) => void;
}

export function GmailOAuthSetupForm({
  service,
  connectionName,
  isConnecting,
  onConnectionNameChange,
  onConnect
}: GmailOAuthSetupFormProps) {
  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Shield className="h-5 w-5 text-blue-500" />
          <span>OAuth 2.0 Authentication</span>
        </CardTitle>
        <CardDescription>
          Secure authentication flow to connect your {service.name} account
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="connection_name">
            Connection Name (Optional)
          </Label>
          <Input
            id="connection_name"
            value={connectionName}
            onChange={(e) => onConnectionNameChange(e.target.value)}
            placeholder={`My ${service.name} Connection`}
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Give this connection a name to identify it later
          </p>
        </div>

        <Button
          onClick={() => onConnect(service.id)}
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
              <Shield className="h-4 w-4 mr-2" />
              Connect with {service.name}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
