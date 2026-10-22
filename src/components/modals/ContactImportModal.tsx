import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  XCircle,
  Download,
  Eye,
  FileDown
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabase';

interface ContactImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

interface ImportJob {
  id: string;
  status: string;
  total_rows: number;
  processed_rows: number;
  successful_imports: number;
  failed_imports: number;
  duplicate_contacts: number;
  error_details: any;
}

interface ImportError {
  row_number: number;
  error_type: string;
  error_message: string;
  raw_value?: string;
  suggested_fix?: string;
}

export default function ContactImportModal({ isOpen, onClose, onImportComplete }: ContactImportModalProps) {
  const { user } = useAuth();
  
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'importing' | 'complete'>('upload');
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [importJob, setImportJob] = useState<ImportJob | null>(null);
  const [importErrors, setImportErrors] = useState<ImportError[]>([]);
  const [duplicateHandling, setDuplicateHandling] = useState<'skip' | 'update' | 'create_duplicate'>('skip');

  // Available contact fields for mapping
  const availableFields = [
    { value: 'first_name', label: 'First Name', required: true },
    { value: 'last_name', label: 'Last Name', required: false },
    { value: 'organization', label: 'Organization', required: false },
    { value: 'job_title', label: 'Job Title', required: false },
    { value: 'department', label: 'Department', required: false },
    { value: 'contact_type', label: 'Contact Type', required: false },
    { value: 'email', label: 'Email Address', required: false },
    { value: 'phone', label: 'Phone Number', required: false },
    { value: 'mobile', label: 'Mobile Number', required: false },
    { value: 'notes', label: 'Notes', required: false },
    { value: 'tags', label: 'Tags (semicolon separated)', required: false }
  ];

  // Function to format phone numbers
  const formatPhoneNumber = (phoneNumber: string, defaultCountryCode: string = '+1'): string => {
    if (!phoneNumber) return '';
    
    // Remove all non-digit characters
    const digitsOnly = phoneNumber.replace(/\D/g, '');
    
    // If empty after cleaning, return empty
    if (!digitsOnly) return '';
    
    // If already has country code (11+ digits for US), return formatted
    if (digitsOnly.length >= 11) {
      // Format as +X (XXX) XXX-XXXX for 11 digits, or +X-XXX-XXX-XXXX for longer
      if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
        return `+1 (${digitsOnly.slice(1, 4)}) ${digitsOnly.slice(4, 7)}-${digitsOnly.slice(7)}`;
      }
      // For other country codes or longer numbers, add + and format with dashes
      return `+${digitsOnly.slice(0, digitsOnly.length - 10)}-${digitsOnly.slice(-10, -7)}-${digitsOnly.slice(-7, -4)}-${digitsOnly.slice(-4)}`;
    }
    
    // If 10 digits, assume US number without country code
    if (digitsOnly.length === 10) {
      return `${defaultCountryCode} (${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
    }
    
    // If 7 digits, assume local number, add default area code (555)
    if (digitsOnly.length === 7) {
      return `${defaultCountryCode} (555) ${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3)}`;
    }
    
    // For other lengths, just add country code and return
    return `${defaultCountryCode} ${digitsOnly}`;
  };

  // Function to download CSV template
  const downloadTemplate = useCallback(() => {
    // Create CSV template with all available fields
    const headers = [
      'first_name',
      'last_name', 
      'organization',
      'job_title',
      'department',
      'contact_type',
      'email',
      'phone',
      'mobile',
      'notes',
      'tags'
    ];

    // Create sample data rows
    const sampleRows = [
      [
        'John',
        'Smith',
        'Acme Corporation',
        'Software Engineer',
        'Engineering',
        'internal',
        'john.smith@acme.com',
        '+1-555-0123',
        '+1-555-0124',
        'Lead developer for project X',
        'developer;team-lead;javascript'
      ],
      [
        'Jane',
        'Doe',
        'Tech Solutions Inc',
        'Product Manager',
        'Product',
        'external',
        'jane.doe@techsolutions.com',
        '+1-555-0125',
        '',
        'External consultant for Q1 project',
        'consultant;product;external'
      ],
      [
        'Michael',
        'Johnson',
        'ABC Company',
        'Sales Director',
        'Sales',
        'customer',
        'mjohnson@abc.com',
        '+1-555-0126',
        '+1-555-0127',
        'Key account manager',
        'sales;customer;vip'
      ]
    ];

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...sampleRows.map(row => 
        row.map(cell => {
          // Escape cells that contain commas, quotes, or newlines
          if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
            return `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
        }).join(',')
      )
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'contacts_import_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Template downloaded successfully!');
  }, []);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (!uploadedFile) return;

    if (!uploadedFile.name.toLowerCase().endsWith('.csv')) {
      toast.error('Please upload a CSV file.');
      return;
    }

    setLoading(true);
    try {
      const text = await uploadedFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      const data = lines.map(line => {
        // Simple CSV parsing - handles quoted fields
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      });

      setFile(uploadedFile);
      setCsvData(data);
      
      // Auto-map columns based on header names
      if (data.length > 0) {
        const headers = data[0];
        const autoMapping: Record<string, string> = {};
        
        headers.forEach((header, index) => {
          const normalizedHeader = header.toLowerCase().trim();
          const columnKey = `column_${index}`;
          
          // Auto-map common field names
          if (normalizedHeader.includes('first') && normalizedHeader.includes('name')) {
            autoMapping[columnKey] = 'first_name';
          } else if (normalizedHeader.includes('last') && normalizedHeader.includes('name')) {
            autoMapping[columnKey] = 'last_name';
          } else if (normalizedHeader.includes('email')) {
            autoMapping[columnKey] = 'email';
          } else if (normalizedHeader.includes('mobile') || normalizedHeader.includes('cell') || 
                     normalizedHeader.includes('cellular') || normalizedHeader === 'mobile') {
            autoMapping[columnKey] = 'mobile';
          } else if (normalizedHeader.includes('phone') && !normalizedHeader.includes('mobile')) {
            autoMapping[columnKey] = 'phone';
          } else if (normalizedHeader.includes('company') || normalizedHeader.includes('organization')) {
            autoMapping[columnKey] = 'organization';
          } else if (normalizedHeader.includes('title') || normalizedHeader.includes('position')) {
            autoMapping[columnKey] = 'job_title';
          } else if (normalizedHeader.includes('department')) {
            autoMapping[columnKey] = 'department';
          } else if (normalizedHeader.includes('note')) {
            autoMapping[columnKey] = 'notes';
          } else if (normalizedHeader.includes('tag')) {
            autoMapping[columnKey] = 'tags';
          } else if (normalizedHeader.includes('contact_type') || normalizedHeader.includes('contacttype') ||
                     (normalizedHeader.includes('type') && normalizedHeader.includes('contact'))) {
            autoMapping[columnKey] = 'contact_type';
          }
        });
        
        setColumnMapping(autoMapping);
      }
      
      setStep('mapping');
    } catch (error) {
      toast.error('Failed to parse CSV file. Please check the file format.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleStartImport = async () => {
    if (!file || csvData.length === 0) return;

    // Validate required fields
    const hasRequiredField = Object.values(columnMapping).includes('first_name');
    if (!hasRequiredField) {
      toast.error('First Name is required. Please map at least one column to First Name.');
      return;
    }

    setStep('importing');
    setLoading(true);

    try {
      // Start import job
      const { data: jobId, error: jobError } = await supabase
        .rpc('start_contact_import_job', {
          p_user_id: user.id,
          p_file_name: file.name,
          p_file_size: file.size,
          p_import_settings: {
            duplicate_handling: duplicateHandling,
            has_header: true
          },
          p_column_mapping: columnMapping
        });

      if (jobError) throw jobError;

      // Process CSV data
      const headers = csvData[0];
      const dataRows = csvData.slice(1);
      
      let successCount = 0;
      let errorCount = 0;
      const errors: ImportError[] = [];

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const rowNumber = i + 2; // +2 because we start from row 2 (after header)

        try {
          // Map row data to contact fields
          const contactData: any = {};
          const tags: string[] = [];
          
          Object.entries(columnMapping).forEach(([columnKey, fieldName]) => {
            const columnIndex = parseInt(columnKey.replace('column_', ''));
            const value = row[columnIndex]?.trim();
            
            if (value && fieldName) { // Only process if fieldName is not undefined (not skipped)
              if (fieldName === 'tags') {
                tags.push(...value.split(';').map(tag => tag.trim()).filter(tag => tag));
              } else if (fieldName === 'contact_type') {
                // Validate contact type
                const validTypes = ['internal', 'external', 'partner', 'vendor', 'customer', 'prospect'];
                contactData[fieldName] = validTypes.includes(value.toLowerCase()) ? value.toLowerCase() : 'external';
              } else if (fieldName === 'phone' || fieldName === 'mobile') {
                // Format phone numbers with international code
                contactData[fieldName] = formatPhoneNumber(value);
              } else {
                contactData[fieldName] = value;
              }
            }
          });

          // Validate required fields
          if (!contactData.first_name) {
            errors.push({
              row_number: rowNumber,
              error_type: 'missing_required',
              error_message: 'First name is required',
              raw_value: row.join(', ')
            });
            errorCount++;
            continue;
          }

          // Create contact
          const { error: createError } = await supabase
            .rpc('create_contact_with_validation', {
              p_user_id: user.id,
              p_first_name: contactData.first_name,
              p_last_name: contactData.last_name || null,
              p_organization: contactData.organization || null,
              p_job_title: contactData.job_title || null,
              p_contact_type: contactData.contact_type || 'external',
              p_email: contactData.email || null,
              p_phone: contactData.phone || null,
              p_mobile: contactData.mobile || null,
              p_notes: contactData.notes || null,
              p_tags: tags,
              p_custom_fields: {
                department: contactData.department || null
              }
            });

          if (createError) {
            errors.push({
              row_number: rowNumber,
              error_type: 'validation_error',
              error_message: createError.message,
              raw_value: row.join(', ')
            });
            errorCount++;
          } else {
            successCount++;
          }

          // Update progress
          const progress = ((i + 1) / dataRows.length) * 100;
          setImportJob(prev => prev ? {
            ...prev,
            processed_rows: i + 1,
            successful_imports: successCount,
            failed_imports: errorCount
          } : null);

        } catch (error: any) {
          errors.push({
            row_number: rowNumber,
            error_type: 'system_error',
            error_message: error.message || 'Unknown error',
            raw_value: row.join(', ')
          });
          errorCount++;
        }
      }

      // Complete import job
      await supabase
        .rpc('complete_import_job', {
          p_job_id: jobId,
          p_user_id: user.id,
          p_status: errorCount === 0 ? 'completed' : 'partially_completed',
          p_results: {
            total_processed: dataRows.length,
            successful: successCount,
            failed: errorCount
          },
          p_error_details: errors.length > 0 ? { errors } : {}
        });

      setImportJob({
        id: jobId,
        status: errorCount === 0 ? 'completed' : 'partially_completed',
        total_rows: dataRows.length,
        processed_rows: dataRows.length,
        successful_imports: successCount,
        failed_imports: errorCount,
        duplicate_contacts: 0,
        error_details: { errors }
      });

      setImportErrors(errors);
      setStep('complete');

      if (successCount > 0) {
        toast.success(`Successfully imported ${successCount} contacts${errorCount > 0 ? ` (${errorCount} errors)` : ''}.`);
      }

    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(error.message || 'Failed to import contacts. Please try again.');
      setStep('mapping');
    } finally {
      setLoading(false);
    }
  };

  const resetImport = () => {
    setStep('upload');
    setFile(null);
    setCsvData([]);
    setColumnMapping({});
    setImportJob(null);
    setImportErrors([]);
  };

  const renderUploadStep = () => (
    <div className="space-y-4">
      <div className="text-center">
        <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">Upload CSV File</h3>
        <p className="text-muted-foreground mb-4">
          Select a CSV file containing your contact data
        </p>
        
        <Button 
          variant="outline" 
          onClick={downloadTemplate}
          className="mb-4"
          disabled={loading}
        >
          <FileDown className="w-4 h-4 mr-2" />
          Download CSV Template
        </Button>
      </div>
      
      <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6">
        <Input
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          disabled={loading}
          className="cursor-pointer"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">CSV Format Requirements</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>• Download the template above for proper format and examples</p>
          <p>• First row should contain column headers</p>
          <p>• At minimum, include a "First Name" column</p>
          <p>• Separate multiple tags with semicolons (;)</p>
          <p>• Use standard contact types: internal, external, partner, vendor, customer, prospect</p>
          <p>• Phone numbers can be in any standard format (+1-555-0123, (555) 012-3456, etc.)</p>
        </CardContent>
      </Card>
    </div>
  );

  const renderMappingStep = () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium mb-2">Map CSV Columns</h3>
        <p className="text-muted-foreground mb-4">
          Map your CSV columns to contact fields. Preview shows first 3 rows.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="duplicate-handling">Duplicate Handling</Label>
        <Select value={duplicateHandling} onValueChange={(value: any) => setDuplicateHandling(value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="skip">Skip duplicates</SelectItem>
            <SelectItem value="update">Update existing</SelectItem>
            <SelectItem value="create_duplicate">Create duplicates</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator />

      <div className="space-y-3">
        {csvData[0]?.map((header, index) => {
          const columnKey = `column_${index}`;
          const previewData = csvData.slice(1, 4).map(row => row[index]).filter(Boolean);
          
          return (
            <Card key={columnKey}>
              <CardContent className="pt-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <Label className="font-medium">{header}</Label>
                    <div className="text-sm text-muted-foreground mt-1">
                      Preview: {previewData.slice(0, 3).join(', ')}
                      {previewData.length > 3 && '...'}
                    </div>
                  </div>
                  <div className="w-48">
                    <Select
                      value={columnMapping[columnKey] || '__SKIP__'}
                      onValueChange={(value) => {
                        setColumnMapping(prev => ({
                          ...prev,
                          [columnKey]: value === '__SKIP__' ? undefined : value
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Skip column" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__SKIP__">Skip column</SelectItem>
                        {availableFields.map((field) => (
                          <SelectItem key={field.value} value={field.value}>
                            {field.label} {field.required && '*'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={() => setStep('upload')}>
          Back
        </Button>
        <Button 
          onClick={handleStartImport}
          disabled={!Object.values(columnMapping).includes('first_name')}
          className="bg-blue-600 hover:bg-blue-700"
        >
          Start Import
        </Button>
      </div>
    </div>
  );

  const renderImportingStep = () => (
    <div className="space-y-4">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <h3 className="text-lg font-medium mb-2">Importing Contacts</h3>
        <p className="text-muted-foreground">
          Processing your contact data...
        </p>
      </div>

      {importJob && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span>{importJob.processed_rows} / {importJob.total_rows}</span>
          </div>
          <Progress 
            value={(importJob.processed_rows / importJob.total_rows) * 100} 
            className="w-full"
          />
        </div>
      )}
    </div>
  );

  const renderCompleteStep = () => (
    <div className="space-y-4">
      <div className="text-center">
        {importJob?.status === 'completed' ? (
          <CheckCircle className="w-12 h-12 mx-auto text-green-600 mb-4" />
        ) : (
          <AlertCircle className="w-12 h-12 mx-auto text-yellow-600 mb-4" />
        )}
        <h3 className="text-lg font-medium mb-2">
          Import {importJob?.status === 'completed' ? 'Complete' : 'Completed with Errors'}
        </h3>
      </div>

      {importJob && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold text-green-600">{importJob.successful_imports}</div>
              <div className="text-xs text-muted-foreground">Successful</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold text-red-600">{importJob.failed_imports}</div>
              <div className="text-xs text-muted-foreground">Failed</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{importJob.total_rows}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </CardContent>
          </Card>
        </div>
      )}

      {importErrors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <XCircle className="w-4 h-4 text-red-600" />
              Import Errors ({importErrors.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-40 overflow-y-auto">
              <div className="space-y-2">
                {importErrors.slice(0, 10).map((error, index) => (
                  <div key={index} className="text-sm p-2 border rounded">
                    <div className="font-medium">Row {error.row_number}: {error.error_type}</div>
                    <div className="text-muted-foreground">{error.error_message}</div>
                    {error.raw_value && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Data: {error.raw_value.substring(0, 100)}...
                      </div>
                    )}
                  </div>
                ))}
                {importErrors.length > 10 && (
                  <div className="text-sm text-muted-foreground text-center">
                    ... and {importErrors.length - 10} more errors
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={resetImport}>
          Import Another File
        </Button>
        <Button onClick={() => { onImportComplete(); onClose(); }}>
          Done
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Import Contacts from CSV
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {step === 'upload' && renderUploadStep()}
          {step === 'mapping' && renderMappingStep()}
          {step === 'importing' && renderImportingStep()}
          {step === 'complete' && renderCompleteStep()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
