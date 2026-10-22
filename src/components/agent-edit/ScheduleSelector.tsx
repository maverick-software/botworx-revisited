import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select';
import { 
    Tabs, 
    TabsContent, 
    TabsList, 
    TabsTrigger 
} from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
    Clock, 
    Calendar, 
    Repeat,
    AlertCircle,
    Info
} from 'lucide-react';
import cronstrue from 'cronstrue';

interface ScheduleSelectorProps {
    cronExpression: string;
    timezone: string;
    onScheduleChange: (cronExpression: string, timezone: string) => void;
    disabled?: boolean;
}

interface PresetSchedule {
    label: string;
    description: string;
    cron: string;
    category: 'common' | 'hourly' | 'daily' | 'weekly' | 'monthly';
}

const PRESET_SCHEDULES: PresetSchedule[] = [
    // Common intervals
    { label: 'Every 5 minutes', description: 'Runs every 5 minutes', cron: '*/5 * * * *', category: 'common' },
    { label: 'Every 15 minutes', description: 'Runs every 15 minutes', cron: '*/15 * * * *', category: 'common' },
    { label: 'Every 30 minutes', description: 'Runs every 30 minutes', cron: '*/30 * * * *', category: 'common' },
    
    // Hourly
    { label: 'Every hour', description: 'Runs at the start of every hour', cron: '0 * * * *', category: 'hourly' },
    { label: 'Every 2 hours', description: 'Runs every 2 hours', cron: '0 */2 * * *', category: 'hourly' },
    { label: 'Every 6 hours', description: 'Runs every 6 hours', cron: '0 */6 * * *', category: 'hourly' },
    
    // Daily
    { label: 'Daily at 9 AM', description: 'Runs every day at 9:00 AM', cron: '0 9 * * *', category: 'daily' },
    { label: 'Daily at 6 PM', description: 'Runs every day at 6:00 PM', cron: '0 18 * * *', category: 'daily' },
    { label: 'Twice daily', description: 'Runs at 9 AM and 6 PM every day', cron: '0 9,18 * * *', category: 'daily' },
    
    // Weekly
    { label: 'Every Monday at 9 AM', description: 'Runs every Monday at 9:00 AM', cron: '0 9 * * 1', category: 'weekly' },
    { label: 'Every Friday at 5 PM', description: 'Runs every Friday at 5:00 PM', cron: '0 17 * * 5', category: 'weekly' },
    { label: 'Weekdays at 9 AM', description: 'Runs Monday-Friday at 9:00 AM', cron: '0 9 * * 1-5', category: 'weekly' },
    
    // Monthly
    { label: 'First day of month', description: 'Runs on the 1st of every month at 9 AM', cron: '0 9 1 * *', category: 'monthly' },
    { label: 'Last day of month', description: 'Runs on the last day of every month', cron: '0 9 L * *', category: 'monthly' },
];

const TIMEZONES = [
    { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
    { value: 'America/New_York', label: 'Eastern Time (US & Canada)' },
    { value: 'America/Chicago', label: 'Central Time (US & Canada)' },
    { value: 'America/Denver', label: 'Mountain Time (US & Canada)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (US & Canada)' },
    { value: 'Europe/London', label: 'London (GMT/BST)' },
    { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
    { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
    { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
    { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
];

const WEEKDAYS = [
    { value: '0', label: 'Sunday' },
    { value: '1', label: 'Monday' },
    { value: '2', label: 'Tuesday' },
    { value: '3', label: 'Wednesday' },
    { value: '4', label: 'Thursday' },
    { value: '5', label: 'Friday' },
    { value: '6', label: 'Saturday' },
];

const MONTHS = [
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
];

export const ScheduleSelector: React.FC<ScheduleSelectorProps> = ({
    cronExpression,
    timezone,
    onScheduleChange,
    disabled = false
}) => {
    const [selectedTab, setSelectedTab] = useState<'presets' | 'custom' | 'advanced'>('custom');
    const [customSchedule, setCustomSchedule] = useState({
        minute: '0',
        hour: '9',
        dayOfMonth: '*',
        month: '*',
        dayOfWeek: '*'
    });
    const [cronInput, setCronInput] = useState(cronExpression);
    const [cronDescription, setCronDescription] = useState('');
    const [cronError, setCronError] = useState('');

    useEffect(() => {
        setCronInput(cronExpression);
        generateCronDescription(cronExpression);
    }, [cronExpression]);

    // Parse cron expression to update custom form
    useEffect(() => {
        if (cronExpression && selectedTab === 'custom') {
            const parts = cronExpression.split(' ');
            if (parts.length >= 5) {
                setCustomSchedule({
                    minute: parts[0] || '0',
                    hour: parts[1] || '9',
                    dayOfMonth: parts[2] || '*',
                    month: parts[3] || '*',
                    dayOfWeek: parts[4] || '*'
                });
            }
        }
    }, [cronExpression, selectedTab]);

    const generateCronDescription = (cron: string) => {
        if (!cron || cron.split(' ').length < 5) {
            setCronDescription('');
            return;
        }

        try {
            const description = cronstrue.toString(cron, {
                throwExceptionOnParseError: true,
                verbose: false,
                use24HourTimeFormat: true
            });
            
            setCronDescription(description);
            setCronError('');
        } catch (error) {
            setCronDescription('');
            setCronError('Invalid cron expression format');
        }
    };

    const handlePresetSelect = (preset: PresetSchedule) => {
        onScheduleChange(preset.cron, timezone);
    };

    const handleCustomScheduleChange = () => {
        const newCron = `${customSchedule.minute} ${customSchedule.hour} ${customSchedule.dayOfMonth} ${customSchedule.month} ${customSchedule.dayOfWeek}`;
        onScheduleChange(newCron, timezone);
    };

    const handleAdvancedCronChange = () => {
        if (validateCronExpression(cronInput)) {
            onScheduleChange(cronInput, timezone);
            setCronError('');
        } else {
            setCronError('Invalid cron expression format');
        }
    };

    const validateCronExpression = (cron: string): boolean => {
        // Basic validation - should have 5 parts
        const parts = cron.trim().split(/\s+/);
        return parts.length === 5;
    };

    const renderPresetSchedules = (category: string) => {
        const presets = PRESET_SCHEDULES.filter(p => p.category === category);
        
        return (
            <div className="grid gap-2">
                {presets.map((preset, index) => (
                    <div
                        key={index}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                            cronExpression === preset.cron 
                                ? 'bg-primary/5 border-primary' 
                                : 'bg-background border-border hover:bg-muted/50'
                        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                        onClick={() => !disabled && handlePresetSelect(preset)}
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="font-medium text-sm">{preset.label}</div>
                                <div className="text-xs text-muted-foreground">{preset.description}</div>
                            </div>
                            <Badge variant="outline" className="text-xs font-mono">
                                {preset.cron}
                            </Badge>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Schedule Configuration
                </CardTitle>
                <CardDescription>
                    Configure when this task should run
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Timezone Selector */}
                <div className="space-y-2">
                    <Label>Timezone</Label>
                    <Select
                        value={timezone}
                        onValueChange={(value) => onScheduleChange(cronExpression, value)}
                        disabled={disabled}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Select timezone" />
                        </SelectTrigger>
                        <SelectContent>
                            {TIMEZONES.map(tz => (
                                <SelectItem key={tz.value} value={tz.value}>
                                    {tz.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Schedule Configuration Tabs */}
                <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value as any)}>
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="custom">Schedule</TabsTrigger>
                        <TabsTrigger value="presets">Quick Options</TabsTrigger>
                        <TabsTrigger value="advanced">Advanced</TabsTrigger>
                    </TabsList>

                    <TabsContent value="custom" className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <div className="space-y-2">
                                <Label>Minute</Label>
                                <Input
                                    value={customSchedule.minute}
                                    onChange={(e) => setCustomSchedule({
                                        ...customSchedule,
                                        minute: e.target.value
                                    })}
                                    placeholder="0-59"
                                    disabled={disabled}
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <Label>Hour</Label>
                                <Input
                                    value={customSchedule.hour}
                                    onChange={(e) => setCustomSchedule({
                                        ...customSchedule,
                                        hour: e.target.value
                                    })}
                                    placeholder="0-23"
                                    disabled={disabled}
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <Label>Day of Month</Label>
                                <Input
                                    value={customSchedule.dayOfMonth}
                                    onChange={(e) => setCustomSchedule({
                                        ...customSchedule,
                                        dayOfMonth: e.target.value
                                    })}
                                    placeholder="1-31 or *"
                                    disabled={disabled}
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <Label>Month</Label>
                                <Input
                                    value={customSchedule.month}
                                    onChange={(e) => setCustomSchedule({
                                        ...customSchedule,
                                        month: e.target.value
                                    })}
                                    placeholder="1-12 or *"
                                    disabled={disabled}
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <Label>Day of Week</Label>
                                <Input
                                    value={customSchedule.dayOfWeek}
                                    onChange={(e) => setCustomSchedule({
                                        ...customSchedule,
                                        dayOfWeek: e.target.value
                                    })}
                                    placeholder="0-6 or *"
                                    disabled={disabled}
                                />
                            </div>
                        </div>
                        
                        <Button 
                            onClick={handleCustomScheduleChange}
                            disabled={disabled}
                            className="w-full"
                        >
                            Update Schedule
                        </Button>
                        
                        <Alert>
                            <Info className="h-4 w-4" />
                            <AlertDescription className="text-xs">
                                Use * for "any", ranges like 1-5, lists like 1,3,5, or intervals like */15
                            </AlertDescription>
                        </Alert>
                    </TabsContent>

                    <TabsContent value="presets" className="space-y-4">
                        <div className="space-y-4">
                            <div>
                                <h4 className="text-sm font-medium mb-2">Common Intervals</h4>
                                {renderPresetSchedules('common')}
                            </div>
                            
                            <div>
                                <h4 className="text-sm font-medium mb-2">Hourly</h4>
                                {renderPresetSchedules('hourly')}
                            </div>
                            
                            <div>
                                <h4 className="text-sm font-medium mb-2">Daily</h4>
                                {renderPresetSchedules('daily')}
                            </div>
                            
                            <div>
                                <h4 className="text-sm font-medium mb-2">Weekly</h4>
                                {renderPresetSchedules('weekly')}
                            </div>
                            
                            <div>
                                <h4 className="text-sm font-medium mb-2">Monthly</h4>
                                {renderPresetSchedules('monthly')}
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="advanced" className="space-y-4">
                        <div className="space-y-2">
                            <Label>Cron Expression</Label>
                            <Input
                                value={cronInput}
                                onChange={(e) => {
                                    setCronInput(e.target.value);
                                    generateCronDescription(e.target.value);
                                }}
                                placeholder="0 9 * * *"
                                disabled={disabled}
                                className={cronError ? 'border-red-500' : ''}
                            />
                            {cronError && (
                                <div className="text-red-500 text-xs">{cronError}</div>
                            )}
                        </div>
                        
                        <Button 
                            onClick={handleAdvancedCronChange}
                            disabled={disabled || !!cronError}
                            className="w-full"
                        >
                            Update Schedule
                        </Button>
                        
                        <Alert>
                            <Info className="h-4 w-4" />
                            <AlertDescription className="text-xs">
                                Format: minute hour day month day-of-week (e.g., "0 9 * * *" = daily at 9 AM)
                            </AlertDescription>
                        </Alert>
                    </TabsContent>
                </Tabs>

                {/* Current schedule display */}
                {cronExpression && (
                    <div className="pt-4 border-t border-border">
                        <Label className="text-sm font-medium">Current Schedule</Label>
                        <div className="mt-2 p-3 bg-muted rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="font-mono text-xs">
                                    {cronExpression}
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                    {timezone}
                                </Badge>
                            </div>
                            {cronDescription && (
                                <div className="text-sm text-muted-foreground">
                                    {cronDescription}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}; 