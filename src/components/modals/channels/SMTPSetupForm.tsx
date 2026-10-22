import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Key, AlertCircle, Loader2, Mail } from 'lucide-react';

interface SMTPSetupFormProps {
  // SMTP form state
  smtpHost: string;
  smtpPort: string;
  smtpSecure: string;
  smtpUsername: string;
  smtpPassword: string;
  fromEmail: string;
  fromName: string;
  error: string | null;
  connectingService: string | null;
  // Form handlers
  onSMTPHostChange: (value: string) => void;
  onSMTPPortChange: (value: string) => void;
  onSMTPSecureChange: (value: string) => void;
  onSMTPUsernameChange: (value: string) => void;
  onSMTPPasswordChange: (value: string) => void;
  onFromEmailChange: (value: string) => void;
  onFromNameChange: (value: string) => void;
  // Setup handler
  onSMTPSetup: () => void;
}

export function SMTPSetupForm({
  smtpHost,
  smtpPort,
  smtpSecure,
  smtpUsername,
  smtpPassword,
  fromEmail,
  fromName,
  error,
  connectingService,
  onSMTPHostChange,
  onSMTPPortChange,
  onSMTPSecureChange,
  onSMTPUsernameChange,
  onSMTPPasswordChange,
  onFromEmailChange,
  onFromNameChange,
  onSMTPSetup
}: SMTPSetupFormProps) {
  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Key className="h-5 w-5 text-gray-500" />
          <span>SMTP Server Configuration</span>
        </CardTitle>
        <CardDescription>
          Configure your SMTP server settings
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
          <Label htmlFor="smtp_host">SMTP Host <span className="text-red-500">*</span></Label>
          <Input 
            id="smtp_host" 
            type="text" 
            value={smtpHost} 
            onChange={(e) => onSMTPHostChange(e.target.value)} 
            placeholder="smtp.gmail.com" 
            className="mt-1" 
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="smtp_port">Port <span className="text-red-500">*</span></Label>
            <Input 
              id="smtp_port" 
              type="number" 
              value={smtpPort} 
              onChange={(e) => onSMTPPortChange(e.target.value)} 
              placeholder="587" 
              className="mt-1" 
            />
          </div>
          <div>
            <Label htmlFor="smtp_secure">Security</Label>
            <select 
              id="smtp_secure"
              value={smtpSecure} 
              onChange={(e) => onSMTPSecureChange(e.target.value)}
              className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="tls">TLS</option>
              <option value="ssl">SSL</option>
              <option value="none">None</option>
            </select>
          </div>
        </div>

        <div>
          <Label htmlFor="smtp_username">Username <span className="text-red-500">*</span></Label>
          <Input 
            id="smtp_username" 
            type="text" 
            value={smtpUsername} 
            onChange={(e) => onSMTPUsernameChange(e.target.value)} 
            placeholder="your-email@domain.com" 
            className="mt-1" 
          />
        </div>

        <div>
          <Label htmlFor="smtp_password">Password <span className="text-red-500">*</span></Label>
          <Input 
            id="smtp_password" 
            type="password" 
            value={smtpPassword} 
            onChange={(e) => onSMTPPasswordChange(e.target.value)} 
            placeholder="your-app-password" 
            className="mt-1" 
          />
        </div>

        <div>
          <Label htmlFor="smtp_from_email">From Email <span className="text-red-500">*</span></Label>
          <Input 
            id="smtp_from_email" 
            type="email" 
            value={fromEmail} 
            onChange={(e) => onFromEmailChange(e.target.value)} 
            placeholder="noreply@yourdomain.com" 
            className="mt-1" 
          />
        </div>

        <div>
          <Label htmlFor="smtp_from_name">From Name (Optional)</Label>
          <Input 
            id="smtp_from_name" 
            type="text" 
            value={fromName} 
            onChange={(e) => onFromNameChange(e.target.value)} 
            placeholder="Your Company" 
            className="mt-1" 
          />
        </div>

        <Button
          onClick={onSMTPSetup}
          disabled={connectingService === 'smtp'}
          className="w-full bg-gradient-to-r from-gray-500 to-gray-600 hover:opacity-90 text-white"
        >
          {connectingService === 'smtp' ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <Mail className="h-4 w-4 mr-2" />
              Connect SMTP
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
