import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Wrench, Loader2, AlertCircle, ExternalLink, Key } from 'lucide-react';

interface DigitalOceanSetupFormProps {
  apiKey: string;
  connectionName: string;
  error: string | null;
  isConnecting: boolean;
  onApiKeyChange: (key: string) => void;
  onConnectionNameChange: (name: string) => void;
  onConnect: () => void;
}

export function DigitalOceanSetupForm({
  apiKey,
  connectionName,
  error,
  isConnecting,
  onApiKeyChange,
  onConnectionNameChange,
  onConnect
}: DigitalOceanSetupFormProps) {
  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Wrench className="h-5 w-5 text-blue-500" />
          <span>DigitalOcean Setup</span>
        </CardTitle>
        <CardDescription>
          Connect your DigitalOcean account to manage droplets and infrastructure.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="do_connection_name">
            Connection Name (Optional)
          </Label>
          <Input
            id="do_connection_name"
            value={connectionName}
            onChange={(e) => onConnectionNameChange(e.target.value)}
            placeholder="My DigitalOcean Connection"
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="do_api_key">
            DigitalOcean API Token
          </Label>
          <Input
            id="do_api_key"
            type="password"
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder="Enter your DigitalOcean API token"
            className="mt-1"
          />
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p><strong>Required scopes:</strong> Read access to droplets, images, regions, and sizes</p>
              <p>
                <Button variant="link" className="p-0 h-auto" asChild>
                  <a 
                    href="https://cloud.digitalocean.com/account/api/tokens" 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    Get API Token <ExternalLink className="h-3 w-3 ml-1" />
                  </a>
                </Button>
              </p>
            </div>
          </AlertDescription>
        </Alert>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button
          onClick={onConnect}
          disabled={!apiKey || isConnecting}
          className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:opacity-90 text-white"
        >
          {isConnecting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <Key className="h-4 w-4 mr-2" />
              Connect DigitalOcean
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

