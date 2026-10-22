import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Loader2, AlertCircle, ExternalLink } from 'lucide-react';

interface SearchProvider {
  id: string;
  name: string;
  setupUrl: string;
  rateLimit: string;
  description: string;
}

interface WebSearchSetupFormProps {
  selectedProvider: string;
  apiKey: string;
  connectionName: string;
  error: string | null;
  isConnecting: boolean;
  searchProviders: SearchProvider[];
  onProviderChange: (provider: string) => void;
  onApiKeyChange: (key: string) => void;
  onConnectionNameChange: (name: string) => void;
  onConnect: () => void;
}

export function WebSearchSetupForm({
  selectedProvider,
  apiKey,
  connectionName,
  error,
  isConnecting,
  searchProviders,
  onProviderChange,
  onApiKeyChange,
  onConnectionNameChange,
  onConnect
}: WebSearchSetupFormProps) {
  const selectedProviderInfo = searchProviders.find(p => p.id === selectedProvider);

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Search className="h-5 w-5 text-blue-500" />
          <span>Web Search Setup</span>
        </CardTitle>
        <CardDescription>
          Choose a search provider and enter your API key to enable web search capabilities.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="provider_select">
            Search Provider
          </Label>
          <Select value={selectedProvider} onValueChange={onProviderChange}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Choose your search provider" />
            </SelectTrigger>
            <SelectContent>
              {searchProviders.map((provider) => (
                <SelectItem key={provider.id} value={provider.id}>
                  <div className="flex flex-col text-left">
                    <span className="font-medium">{provider.name}</span>
                    <span className="text-xs text-muted-foreground">{provider.rateLimit}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedProvider && (
          <>
            <div>
              <Label htmlFor="connection_name">
                Connection Name (Optional)
              </Label>
              <Input
                id="connection_name"
                value={connectionName}
                onChange={(e) => onConnectionNameChange(e.target.value)}
                placeholder={`My ${selectedProviderInfo?.name} Connection`}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="api_key">
                API Key
              </Label>
              <Input
                id="api_key"
                type="password"
                value={apiKey}
                onChange={(e) => onApiKeyChange(e.target.value)}
                placeholder="Enter your API key"
                className="mt-1"
              />
            </div>

            {selectedProviderInfo && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p><strong>Provider:</strong> {selectedProviderInfo.description}</p>
                    <p><strong>Rate Limit:</strong> {selectedProviderInfo.rateLimit}</p>
                    <p>
                      <Button variant="link" className="p-0 h-auto" asChild>
                        <a 
                          href={selectedProviderInfo.setupUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                        >
                          Get API Key <ExternalLink className="h-3 w-3 ml-1" />
                        </a>
                      </Button>
                    </p>
                  </div>
                </AlertDescription>
              </Alert>
            )}

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
                  Connecting Web Search...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Connect Web Search
                </>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

