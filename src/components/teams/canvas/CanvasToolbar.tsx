import React, { useCallback } from 'react';
import { 
  Settings, 
  Grid, 
  Network,
  Loader2,
  Download,
  Plus,
  Check,
  Clock,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
// Temporarily using native select instead of Radix Select to fix infinite update loop
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from '@/components/ui/select';

import type { CanvasToolbarProps, ConnectionType } from './types/canvas';

export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
  zoom,
  canZoomIn,
  canZoomOut,
  viewMode,

  hasUnsavedChanges,
  isSaving,
  onZoomIn,
  onZoomOut,
  onFitView,
  onResetLayout,
  onSaveLayout,
  onExportLayout,
  onViewModeChange,

  onShowSettings,
  onCreateTeam,
  showMinimap = true,
  onToggleMinimap,
  className
}) => {
  // Ensure zoom is valid, default to 100% if NaN
  const validZoom = !isNaN(zoom) && zoom > 0 ? zoom : 1;
  const zoomPercentage = Math.round(validZoom * 100);
  

  return (
    <div className={cn(
      "flex items-center justify-between p-4 bg-card border-b border-border",
      className
    )}>
      {/* Left Section: View Controls */}
      <div className="flex items-center space-x-3">
        {/* View Mode Toggle */}
        <div className="flex items-center border rounded-md overflow-hidden">
          <Button
            size="sm"
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            onClick={() => onViewModeChange('grid')}
            className="rounded-none border-none"
          >
            <Grid className="h-4 w-4 mr-1" />
            Grid
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Button
            size="sm"
            variant={viewMode === 'canvas' ? 'default' : 'ghost'}
            onClick={() => onViewModeChange('canvas')}
            className="rounded-none border-none"
          >
            <Network className="h-4 w-4 mr-1" />
            Canvas
          </Button>
        </div>
        
        {/* Canvas Controls - only show in canvas mode */}
        {viewMode === 'canvas' && (
          <>
            <Separator orientation="vertical" className="h-6" />
          </>
        )}
      </div>
      
      {/* Center Section: Connection Help Text - only show in canvas mode */}
      {viewMode === 'canvas' && (
        <div className="flex items-center space-x-3">
          <Badge variant="outline" className="text-xs">
            💡 Drag between teams to connect them
          </Badge>
        </div>
      )}
      
      {/* Right Section: Actions */}
      <div className="flex items-center space-x-2">
        {/* Create Team Button */}
        {onCreateTeam && (
          <Button
            size="sm"
            onClick={onCreateTeam}
            title="Create New Team"
          >
            <Plus className="h-4 w-4 mr-1" />
            Create Team
          </Button>
        )}
        
        {/* Canvas-specific actions */}
        {viewMode === 'canvas' && (
          <>
            {/* Zoom Controls */}
            <div className="flex items-center space-x-1">
              <Button
                size="sm"
                variant="outline"
                onClick={onZoomOut}
                disabled={!canZoomOut}
                title="Zoom Out"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onZoomIn}
                disabled={!canZoomIn}
                title="Zoom In"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
            
            <Button
              size="sm"
              variant="outline"
              onClick={onExportLayout}
              title="Export Layout"
            >
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
            
            <Separator orientation="vertical" className="h-6" />
          </>
        )}
        
        {/* Autosave Status Indicator */}
        {viewMode === 'canvas' && (
          <div className="flex items-center space-x-2 text-sm">
            {isSaving ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                <span className="text-blue-500 font-medium">Saving...</span>
              </>
            ) : hasUnsavedChanges ? (
              <>
                <Clock className="h-3 w-3 text-orange-500" />
                <span className="text-orange-500 font-medium">Unsaved</span>
              </>
            ) : (
              <>
                <Check className="h-3 w-3 text-green-500" />
                <span className="text-green-500 font-medium">Auto Saved</span>
              </>
            )}
          </div>
        )}
        
        {/* Settings */}
        <Button
          size="sm"
          variant="outline"
          onClick={onShowSettings}
          title="Canvas Settings"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
