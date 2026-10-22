import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  Check, 
  TrendingUp,
  Calendar,
  MessageSquare,
  CheckCircle2,
  Lightbulb,
  BarChart3,
  Clock,
  Award,
  Target,
  Brain,
  Zap,
  Users,
  Star,
  ArrowUp,
  ArrowDown,
  Minus,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-hot-toast';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentData?: {
    name?: string;
  };
  onAgentUpdated?: (updatedData: any) => void;
}

interface LearningItem {
  id: string;
  type: 'skill' | 'preference' | 'pattern' | 'knowledge';
  title: string;
  description: string;
  date: string;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  date: string;
  metric?: string;
  value?: number;
}

interface ProgressMetric {
  id: string;
  name: string;
  current: number;
  previous: number;
  change: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
}

const SAMPLE_LEARNING: LearningItem[] = [
  {
    id: '1',
    type: 'skill',
    title: 'Better email tone suggestions',
    description: 'Learned to suggest more conversational and engaging email language',
    date: '2024-01-28'
  },
  {
    id: '2',
    type: 'preference',
    title: 'Your preferred meeting times',
    description: 'You prefer meetings between 9-11 AM and avoid scheduling after 4 PM',
    date: '2024-01-26'
  },
  {
    id: '3',
    type: 'pattern',
    title: 'Faster data analysis patterns',
    description: 'Identified common data patterns to provide quicker insights',
    date: '2024-01-25'
  },
  {
    id: '4',
    type: 'knowledge',
    title: 'Industry terminology',
    description: 'Expanded knowledge of marketing automation and CRM terminology',
    date: '2024-01-24'
  }
];

const SAMPLE_ACHIEVEMENTS: Achievement[] = [
  {
    id: '1',
    title: 'Helped complete 12 tasks this week',
    description: 'Successfully assisted with various tasks and responsibilities',
    date: '2024-01-28',
    metric: 'tasks',
    value: 12
  },
  {
    id: '2',
    title: 'Saved you 3.5 hours of work',
    description: 'Through automation and efficient task handling',
    date: '2024-01-27',
    metric: 'time_saved',
    value: 3.5
  },
  {
    id: '3',
    title: '95% positive feedback on responses',
    description: 'Consistently providing helpful and accurate information',
    date: '2024-01-26',
    metric: 'satisfaction',
    value: 95
  },
  {
    id: '4',
    title: 'Learned 5 new preferences',
    description: 'Better understanding of your work style and preferences',
    date: '2024-01-25',
    metric: 'preferences',
    value: 5
  }
];

const SAMPLE_METRICS: ProgressMetric[] = [
  {
    id: '1',
    name: 'Response Quality',
    current: 85,
    previous: 78,
    change: 7,
    unit: '%',
    trend: 'up'
  },
  {
    id: '2',
    name: 'Task Completion',
    current: 95,
    previous: 92,
    change: 3,
    unit: '%',
    trend: 'up'
  },
  {
    id: '3',
    name: 'Understanding',
    current: 78,
    previous: 75,
    change: 3,
    unit: '%',
    trend: 'up'
  },
  {
    id: '4',
    name: 'Response Time',
    current: 2.1,
    previous: 2.8,
    change: -0.7,
    unit: 's',
    trend: 'up'
  }
];

const FOCUS_AREAS = [
  'Better understanding of complex requests',
  'Faster research and fact-checking',
  'More creative solution suggestions',
  'Improved context awareness',
  'Enhanced follow-up capabilities'
];

export function HistoryModal({
  isOpen,
  onClose,
  agentId,
  agentData,
  onAgentUpdated
}: HistoryModalProps) {
  const { user } = useAuth();
  
  // State
  const [loading, setLoading] = useState(false);
  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'quarter'>('week');
  const [showDetailedHistory, setShowDetailedHistory] = useState(false);

  // Initialize data
  useEffect(() => {
    if (isOpen && agentData) {
      // Load learning and analytics data
    }
  }, [isOpen, agentData]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'skill': return <Zap className="h-4 w-4 text-blue-500" />;
      case 'preference': return <Users className="h-4 w-4 text-green-500" />;
      case 'pattern': return <BarChart3 className="h-4 w-4 text-purple-500" />;
      case 'knowledge': return <Brain className="h-4 w-4 text-orange-500" />;
      default: return <Lightbulb className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <ArrowUp className="h-3 w-3 text-green-500" />;
      case 'down': return <ArrowDown className="h-3 w-3 text-red-500" />;
      case 'stable': return <Minus className="h-3 w-3 text-muted-foreground" />;
      default: return null;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up': return 'text-green-600';
      case 'down': return 'text-red-600';
      case 'stable': return 'text-muted-foreground';
      default: return 'text-muted-foreground';
    }
  };

  const formatMetricChange = (metric: ProgressMetric) => {
    const absChange = Math.abs(metric.change);
    const sign = metric.change > 0 ? '+' : metric.change < 0 ? '-' : '';
    
    if (metric.unit === 's') {
      // For time metrics, improvement is actually a decrease
      return metric.change < 0 ? `${absChange}${metric.unit} faster` : `${sign}${absChange}${metric.unit}`;
    }
    
    return `${sign}${absChange}${metric.unit}`;
  };

  const handleViewDetailedHistory = () => {
    setShowDetailedHistory(true);
    toast.info('Detailed history view coming soon! 📊');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-xl font-semibold flex items-center">
            📈 History
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Track my learning journey and see how I'm improving over time.
          </DialogDescription>
        </DialogHeader>
        
        <div className="px-6 space-y-6">
          {/* Timeframe Selector */}
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium">Time period:</label>
            <div className="flex border border-border rounded-lg p-1">
              {(['week', 'month', 'quarter'] as const).map((period) => (
                <button
                  key={period}
                  onClick={() => setTimeframe(period)}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    timeframe === period
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  This {period}
                </button>
              ))}
            </div>
          </div>

          {/* Learning Highlights */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">What I've learned recently</h3>
            <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center space-x-2 mb-3">
                <Lightbulb className="h-5 w-5 text-blue-600" />
                <h4 className="font-medium text-blue-800 dark:text-blue-200">New Skills & Knowledge This {timeframe}</h4>
              </div>
              <div className="space-y-2">
                {SAMPLE_LEARNING.slice(0, 3).map(item => (
                  <div key={item.id} className="flex items-start space-x-3">
                    {getTypeIcon(item.type)}
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">How I'm improving</h3>
            <div className="grid grid-cols-2 gap-4">
              {SAMPLE_METRICS.map(metric => (
                <div key={metric.id} className="p-4 bg-card border border-border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium">{metric.name}</h4>
                    <div className={`flex items-center space-x-1 ${getTrendColor(metric.trend)}`}>
                      {getTrendIcon(metric.trend)}
                      <span className="text-xs font-medium">
                        {formatMetricChange(metric)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-end space-x-2">
                    <span className="text-2xl font-bold">{metric.current}{metric.unit}</span>
                    <span className="text-xs text-muted-foreground mb-1">
                      from {metric.previous}{metric.unit}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5 mt-2">
                    <div 
                      className="bg-primary h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${metric.unit === '%' ? metric.current : Math.min(metric.current / 5 * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Achievements */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Recent achievements</h3>
            <div className="space-y-2">
              {SAMPLE_ACHIEVEMENTS.map(achievement => (
                <div key={achievement.id} className="flex items-start space-x-3 p-3 bg-card border border-border rounded-lg">
                  <Award className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="text-sm font-medium">{achievement.title}</h4>
                    <p className="text-xs text-muted-foreground">{achievement.description}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {new Date(achievement.date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  {achievement.value && (
                    <Badge variant="secondary" className="text-xs">
                      {achievement.value}
                      {achievement.metric === 'time_saved' ? 'h' : 
                       achievement.metric === 'satisfaction' ? '%' : ''}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Areas for Improvement */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Areas I'm working on</h3>
            <div className="p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
              <div className="flex items-center space-x-2 mb-3">
                <Target className="h-5 w-5 text-orange-600" />
                <h4 className="font-medium text-orange-800 dark:text-orange-200">Current Focus Areas</h4>
              </div>
              <ul className="space-y-2">
                {FOCUS_AREAS.slice(0, 3).map((area, index) => (
                  <li key={index} className="flex items-center space-x-2 text-sm">
                    <div className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0" />
                    <span>{area}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="p-4 bg-muted/50 rounded-lg border border-muted">
            <div className="text-sm font-medium mb-2 flex items-center">
              <BarChart3 className="h-4 w-4 mr-2" />
              Learning journey summary:
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
              <div>
                <div className="font-medium">This {timeframe}:</div>
                <ul className="space-y-1 mt-1">
                  <li>• {SAMPLE_LEARNING.length} new skills learned</li>
                  <li>• {SAMPLE_ACHIEVEMENTS.length} achievements unlocked</li>
                  <li>• {SAMPLE_METRICS.filter(m => m.trend === 'up').length} metrics improved</li>
                </ul>
              </div>
              <div>
                <div className="font-medium">Overall progress:</div>
                <ul className="space-y-1 mt-1">
                  <li>• {Math.round(SAMPLE_METRICS.reduce((sum, m) => sum + m.current, 0) / SAMPLE_METRICS.length)}% average performance</li>
                  <li>• {FOCUS_AREAS.length} areas being improved</li>
                  <li>• Consistent growth trajectory</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border bg-card/50">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={handleViewDetailedHistory} className="min-w-[140px]">
            <ExternalLink className="mr-2 h-4 w-4" />
            View Detailed History
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}