# Visual Team Hierarchy Canvas Implementation Plan

**Plan ID:** visual_team_canvas_20250828  
**Priority:** HIGH - UI Enhancement & User Experience  
**Created:** August 28, 2025  
**Protocol:** plan_and_execute.mdc

## 🎯 Executive Summary

**Objective:** Transform the current grid-based Teams page into an interactive visual canvas that allows users to organize teams into hierarchical structures and show visual connections, similar to Lucidchart.io functionality.

**Key Outcomes:**
- Interactive canvas with drag-and-drop team organization
- Visual connections between teams showing relationships
- Persistent layout storage per user
- Professional organizational chart visualization
- Seamless integration with existing team management features

## 🔎 Current State Analysis

### Existing Team System
- **Teams Table**: Basic team storage (id, name, description, owner_user_id)
- **Team Members**: Agent assignment to teams
- **UI Components**: Grid-based display with TeamCard components
- **Features**: Modal-based team creation, editing, member management

### Current Limitations
- No visual relationships between teams
- Static grid layout without hierarchy representation
- No team positioning or organizational structure visualization
- Missing visual indicators of team interdependencies

## 📐 Target Architecture

### Technology Stack
- **Canvas Library**: React Flow (v11.x) - Purpose-built for node-based diagrams
- **Database**: PostgreSQL extensions for positioning and connections
- **UI Framework**: Existing Tailwind + Shadcn UI components
- **State Management**: React hooks with Supabase real-time updates

### Database Schema Extensions
```sql
-- Store team positions on canvas (per user)
team_canvas_positions (team_id, user_id, x_position, y_position, width, height)

-- Store connections between teams
team_connections (user_id, source_team_id, target_team_id, connection_type, label)

-- Store canvas viewport state
team_canvas_viewport (user_id, zoom_level, pan_x, pan_y)
```

## 📁 Proposed File Structure

### Component Files (200-300 lines each)
```
src/components/teams/canvas/
├── TeamCanvas.tsx                    (~250 lines) - Main canvas component
├── TeamNode.tsx                      (~200 lines) - Custom team node for React Flow
├── ConnectionControls.tsx            (~150 lines) - Connection creation/editing
├── CanvasToolbar.tsx                 (~180 lines) - Zoom, save, reset controls
├── TeamNodeEditor.tsx                (~220 lines) - Edit team properties modal
└── CanvasSettingsModal.tsx           (~190 lines) - Canvas preferences

src/hooks/teams/canvas/
├── useTeamCanvas.ts                  (~280 lines) - Canvas state management
├── useTeamPositions.ts               (~200 lines) - Position persistence
├── useTeamConnections.ts             (~240 lines) - Connection management
└── useCanvasViewport.ts              (~150 lines) - Viewport state

src/lib/teams/canvas/
├── canvasUtils.ts                    (~200 lines) - Layout algorithms, positioning
├── canvasTypes.ts                    (~100 lines) - TypeScript interfaces
└── canvasConstants.ts                (~80 lines)  - Default values, config
```

### Database Files
```
supabase/migrations/
├── 20250828_create_team_canvas_tables.sql        (~150 lines)
├── 20250828_create_team_canvas_functions.sql     (~200 lines)
└── 20250828_create_team_canvas_policies.sql      (~100 lines)
```

### Page Updates
```
src/pages/
└── TeamsPage.tsx                     (~280 lines) - Enhanced with canvas toggle
```

## 🎨 User Experience Flow

### Canvas Mode Toggle
1. **Default View**: Current grid layout (backwards compatible)
2. **Canvas View**: Interactive organizational chart mode
3. **Toggle Switch**: Seamless switching between views
4. **Persistent Preference**: Remember user's preferred view

### Canvas Interactions
1. **Drag Teams**: Move team nodes around canvas
2. **Create Connections**: Draw lines between related teams
3. **Edit Properties**: Double-click to edit team details
4. **Connection Types**: Different line styles for different relationships
5. **Zoom/Pan**: Navigate large organizational structures
6. **Auto-Layout**: Smart positioning algorithms for new teams

## 🔧 Implementation Phases

### Phase 1: Database Foundation (Week 1)
- Create database tables and migrations
- Implement RLS policies and indexes
- Create database functions for CRUD operations
- Test data integrity and constraints

### Phase 2: Core Canvas Component (Week 1)
- Implement React Flow integration
- Create custom TeamNode component
- Basic drag-and-drop functionality
- Position persistence

### Phase 3: Connection System (Week 1)
- Team-to-team connection creation
- Different connection types and styling
- Connection editing and deletion
- Visual relationship indicators

### Phase 4: UI Polish & Integration (Week 1)
- Canvas toolbar with controls
- Settings modal for preferences
- Integration with existing team management
- Responsive design and mobile considerations

### Phase 5: Advanced Features (Week 1)
- Auto-layout algorithms
- Team grouping and clustering
- Export/import capabilities
- Performance optimizations for large organizations

## 🎯 Success Metrics

1. **Functionality**: Users can create, edit, and visualize team hierarchies
2. **Performance**: Smooth interaction with 50+ teams on canvas
3. **Data Persistence**: All layouts and connections saved reliably
4. **User Adoption**: Preference for canvas view over grid view
5. **Integration**: Seamless workflow with existing team features

## 🔒 Security Considerations

1. **Per-User Layouts**: Each user has their own canvas configuration
2. **Team Access**: Only teams user has access to appear on canvas
3. **RLS Enforcement**: Database policies prevent unauthorized access
4. **Input Validation**: Sanitize positioning and connection data
5. **Audit Trail**: Track changes to team relationships

## 📊 File Size Compliance

All files designed to stay within 200-300 line limit:
- **TeamCanvas.tsx**: 250 lines (main orchestrator)
- **TeamNode.tsx**: 200 lines (focused rendering)
- **Connection components**: 150-220 lines each
- **Hook files**: 150-280 lines (single responsibility)
- **Utility files**: 80-200 lines (focused functionality)

## 🚀 Rollout Strategy

1. **Development**: Feature branch with comprehensive testing
2. **Database Migration**: Run on staging environment first  
3. **Beta Testing**: Limited rollout to select users
4. **Progressive Enhancement**: Canvas as additional view mode
5. **Full Deployment**: Replace grid with canvas as primary view
6. **Documentation**: Update user guides and help documentation

This plan ensures we create a powerful visual team hierarchy system while maintaining code quality, performance, and user experience standards.
