# Visual Team Hierarchy Canvas - Work Breakdown Structure Checklist

**Plan ID:** visual_team_canvas_20250828  
**Created:** August 28, 2025  
**Protocol:** plan_and_execute.mdc  
**Status:** Phase 1 - Research Complete

---

## 📋 **PHASE 1: RESEARCH** ✅ COMPLETE

### **1.1 Existing System Analysis**
- [x] **1.1.1** Research current team database schema and relationships
- [x] **1.1.2** Analyze existing TeamsPage.tsx component structure and patterns
- [x] **1.1.3** Document current team management workflow and UI components
- [x] **1.1.4** Identify integration points with existing team features

### **1.2 Technology Research**
- [x] **1.2.1** Research canvas libraries (React Flow, Konva.js, React DnD)
- [x] **1.2.2** Compare performance and feature sets of canvas solutions
- [x] **1.2.3** Evaluate React Flow for team hierarchy use case
- [x] **1.2.4** Document recommended technology stack

### **1.3 Database Requirements Analysis**
- [x] **1.3.1** Design schema extensions for team positioning
- [x] **1.3.2** Plan team connection storage and relationships
- [x] **1.3.3** Design canvas viewport state persistence
- [x] **1.3.4** Plan RLS policies and security considerations

---

## 📋 **PHASE 2: PLANNING** 🔄 IN PROGRESS

### **2.1 Architecture Planning**
- [ ] **2.1.1** Finalize component architecture and file structure
    **REQUIRED READING BEFORE STARTING:** docs/plans/visual_team_canvas/research/architecture_planning_research.md
    **Plan Review & Alignment:** Component architecture follows established Agentopia patterns with modal orchestrator + extracted components, file size compliance ≤300 lines per Philosophy #1
    **Future Intent:** Create modular, reusable canvas components that integrate seamlessly with existing team management system
    **Cautionary Notes:** Must maintain backwards compatibility with existing TeamsPage, ensure proper separation of concerns between canvas and grid views
    **Backups:** TeamsPage.tsx, team-related components to docs/plans/visual_team_canvas/backups/

- [ ] **2.1.2** Design React Flow integration approach  
    **REQUIRED READING BEFORE STARTING:** docs/plans/visual_team_canvas/research/architecture_planning_research.md
    **Plan Review & Alignment:** React Flow v11.x selected as optimal solution, custom TeamNode components planned, integration strategy designed with existing Tailwind/Shadcn theming
    **Future Intent:** Leverage React Flow's built-in features (drag/drop, zoom, connections) while maintaining Agentopia's design system consistency
    **Cautionary Notes:** Bundle size impact, learning curve for team members, ensure accessibility compliance with custom nodes
    **Backups:** Any React Flow prototypes to docs/plans/visual_team_canvas/backups/

- [ ] **2.1.3** Plan state management strategy with hooks
    **REQUIRED READING BEFORE STARTING:** docs/plans/visual_team_canvas/research/architecture_planning_research.md
    **Plan Review & Alignment:** Hook strategy follows existing useTeams pattern, multiple focused hooks (useTeamCanvas, useTeamPositions, useTeamConnections), integrates with current Supabase patterns
    **Future Intent:** Create maintainable, testable state management that extends existing team functionality without breaking changes
    **Cautionary Notes:** Avoid prop drilling, ensure proper cleanup of React Flow subscriptions, manage complex state interactions carefully
    **Backups:** useTeams.ts and related hooks to docs/plans/visual_team_canvas/backups/

- [ ] **2.1.4** Design API endpoints for canvas operations
    **REQUIRED READING BEFORE STARTING:** docs/plans/visual_team_canvas/research/architecture_planning_research.md  
    **Plan Review & Alignment:** Database functions approach follows established RPC patterns in codebase, designed with proper RLS policies, real-time subscription strategy planned
    **Future Intent:** Efficient, secure database operations for canvas persistence with proper error handling and performance optimization
    **Cautionary Notes:** Database migration must be thoroughly tested, RLS policies must prevent unauthorized access, consider performance impact of real-time updates
    **Backups:** Current database schema files to docs/plans/visual_team_canvas/backups/

### **2.2 Database Design Finalization**
- [ ] **2.2.1** Create detailed migration scripts
    **REQUIRED READING BEFORE STARTING:** docs/plans/visual_team_canvas/research/database_design_research.md
    **Plan Review & Alignment:** Migration scripts follow established naming convention and structure patterns, includes proper RLS policies, indexes, and documentation
    **Future Intent:** Create robust database foundation for canvas functionality with proper constraints and performance optimization
    **Cautionary Notes:** Test migrations on staging environment first, ensure cascade delete behavior is correct, validate foreign key constraints
    **Backups:** Current migration files and schema dumps to docs/plans/visual_team_canvas/backups/

- [ ] **2.2.2** Design database functions for common operations  
    **REQUIRED READING BEFORE STARTING:** docs/plans/visual_team_canvas/research/database_design_research.md
    **Plan Review & Alignment:** Functions follow SECURITY DEFINER pattern with proper validation, error handling matches existing codebase patterns, RLS integration maintained
    **Future Intent:** Provide efficient, secure database operations that integrate seamlessly with existing team management functions
    **Cautionary Notes:** Ensure proper permission validation, avoid SQL injection vulnerabilities, test concurrent access scenarios
    **Backups:** Existing database functions to docs/plans/visual_team_canvas/backups/

- [ ] **2.2.3** Plan data migration strategy for existing teams
    **REQUIRED READING BEFORE STARTING:** docs/plans/visual_team_canvas/research/database_design_research.md  
    **Plan Review & Alignment:** Default positioning algorithm designed for grid layout, handles existing teams gracefully, per-user migration strategy planned
    **Future Intent:** Seamlessly migrate existing teams to canvas system without disrupting current functionality
    **Cautionary Notes:** Large team counts may require batch processing, ensure migration is reversible, validate data integrity after migration
    **Backups:** Pre-migration database dump to docs/plans/visual_team_canvas/backups/

- [ ] **2.2.4** Test schema design with sample data
    **REQUIRED READING BEFORE STARTING:** docs/plans/visual_team_canvas/research/database_design_research.md
    **Plan Review & Alignment:** Test data creation script includes validation queries, performance benchmarking planned, RLS policy testing included  
    **Future Intent:** Validate schema design handles edge cases and performs well under realistic load conditions
    **Cautionary Notes:** Don't use test data in production, ensure test cleanup procedures, validate constraint behavior thoroughly
    **Backups:** Test database snapshots to docs/plans/visual_team_canvas/backups/

### **2.3 UI/UX Design**
- [ ] **2.3.1** Create wireframes for canvas interface
    **REQUIRED READING BEFORE STARTING:** docs/plans/visual_team_canvas/research/ui_ux_design_research.md
    **Plan Review & Alignment:** Wireframe design builds on existing TeamsPage layout, incorporates React Flow canvas area with toolbar and minimap, maintains current responsive design patterns
    **Future Intent:** Create intuitive canvas interface that feels natural to existing users while providing powerful organizational visualization capabilities
    **Cautionary Notes:** Ensure accessibility compliance, test with different screen sizes, maintain consistent navigation patterns with existing UI
    **Backups:** Current TeamsPage layout and related UI mockups to docs/plans/visual_team_canvas/backups/

- [ ] **2.3.2** Design team node visual styling
    **REQUIRED READING BEFORE STARTING:** docs/plans/visual_team_canvas/research/ui_ux_design_research.md
    **Plan Review & Alignment:** Node design extends current TeamCard styling with React Flow integration, uses established CSS variable system, includes hover/selected states with proper accessibility
    **Future Intent:** Create visually appealing team nodes that integrate seamlessly with existing design system while being optimized for canvas interactions
    **Cautionary Notes:** Ensure proper contrast ratios, test color-blind accessibility, validate touch target sizes for mobile, maintain performance with many nodes
    **Backups:** Current TeamCard component and styling to docs/plans/visual_team_canvas/backups/

- [ ] **2.3.3** Plan connection line styling and types  
    **REQUIRED READING BEFORE STARTING:** docs/plans/visual_team_canvas/research/ui_ux_design_research.md
    **Plan Review & Alignment:** Connection styles follow organizational relationship patterns, integrate with React Flow edge system, use theme-aware colors from CSS variables
    **Future Intent:** Provide clear visual language for different team relationships while maintaining clean, professional appearance
    **Cautionary Notes:** Avoid visual clutter with many connections, ensure connection types are distinguishable, test with colorblind users
    **Backups:** Connection style mockups and patterns to docs/plans/visual_team_canvas/backups/

- [ ] **2.3.4** Design toolbar and control interfaces
    **REQUIRED READING BEFORE STARTING:** docs/plans/visual_team_canvas/research/ui_ux_design_research.md
    **Plan Review & Alignment:** Toolbar design follows existing modal patterns with button groups and consistent spacing, integrates Shadcn UI components, includes proper loading and disabled states
    **Future Intent:** Provide comprehensive canvas controls that are discoverable and easy to use without overwhelming the interface
    **Cautionary Notes:** Avoid toolbar bloat, ensure mobile responsiveness, provide keyboard shortcuts for power users, test with screen readers
    **Backups:** Existing toolbar patterns and modal interfaces to docs/plans/visual_team_canvas/backups/

---

## 📋 **PHASE 3: DESIGN**

### **3.1 Component Design**
- [ ] **3.1.1** Design TeamCanvas main component interface
    **REQUIRED READING BEFORE STARTING:** docs/plans/visual_team_canvas/research/component_design_research.md
    **Plan Review & Alignment:** Component interface follows established modal patterns with proper TypeScript interfaces, integrates React Flow framework, includes comprehensive prop validation and error boundaries
    **Future Intent:** Create robust, reusable canvas component that integrates seamlessly with existing team management while providing powerful visualization capabilities
    **Cautionary Notes:** Ensure proper error boundaries for large datasets, validate all props thoroughly, maintain backwards compatibility with existing TeamsPage, test performance with 100+ teams
    **Backups:** Current component patterns and interface designs to docs/plans/visual_team_canvas/backups/

- [ ] **3.1.2** Design TeamNode custom component for React Flow
    **REQUIRED READING BEFORE STARTING:** docs/plans/visual_team_canvas/research/component_design_research.md
    **Plan Review & Alignment:** Node design extends TeamCard patterns with React Flow Handle integration, follows component size limits (<150 lines), includes proper accessibility attributes and keyboard navigation
    **Future Intent:** Create intuitive, interactive team nodes optimized for canvas manipulation while maintaining visual consistency with existing design system
    **Cautionary Notes:** Ensure proper touch target sizes for mobile, validate performance with many nodes, test color contrast for accessibility, handle text overflow gracefully
    **Backups:** TeamCard component and existing node patterns to docs/plans/visual_team_canvas/backups/

- [ ] **3.1.3** Design ConnectionControls for relationship management
    **REQUIRED READING BEFORE STARTING:** docs/plans/visual_team_canvas/research/component_design_research.md
    **Plan Review & Alignment:** Connection design integrates React Flow edge system with custom markers, follows established styling patterns, includes interactive states for editing and deletion
    **Future Intent:** Provide clear visual representation of team relationships with intuitive interaction patterns for connection management
    **Cautionary Notes:** Test visual clarity with many overlapping connections, ensure connection types are distinguishable, validate interactive states work on touch devices
    **Backups:** Connection patterns and edge styling examples to docs/plans/visual_team_canvas/backups/

- [ ] **3.1.4** Design CanvasToolbar with zoom, save, reset controls
    **REQUIRED READING BEFORE STARTING:** docs/plans/visual_team_canvas/research/component_design_research.md
    **Plan Review & Alignment:** Toolbar follows existing button group patterns from modals, integrates Shadcn UI components consistently, includes proper loading and disabled states with keyboard shortcuts
    **Future Intent:** Comprehensive yet uncluttered canvas controls that enhance productivity without overwhelming the interface
    **Cautionary Notes:** Avoid feature bloat in toolbar, ensure mobile responsiveness, test keyboard shortcuts don't conflict, validate screen reader compatibility
    **Backups:** Existing toolbar patterns from modals to docs/plans/visual_team_canvas/backups/

### **3.2 Hook Design**
- [ ] **3.2.1** Design useTeamCanvas hook for state management
    **REQUIRED READING BEFORE STARTING:** docs/plans/visual_team_canvas/research/hook_design_research.md
    **Plan Review & Alignment:** Hook design follows established patterns from useModalState with proper state management, debounced updates, and stable callback functions, includes comprehensive error handling
    **Future Intent:** Create robust canvas state management hook that handles complex interactions while maintaining performance and preventing data loss
    **Cautionary Notes:** Test performance with large team datasets, ensure proper cleanup on unmount, validate debouncing doesn't cause state inconsistencies, test browser tab switching scenarios
    **Backups:** Existing state management patterns to docs/plans/visual_team_canvas/backups/

- [ ] **3.2.2** Design useTeamPositions hook for persistence  
    **REQUIRED READING BEFORE STARTING:** docs/plans/visual_team_canvas/research/hook_design_research.md
    **Plan Review & Alignment:** Persistence hook integrates with established database patterns, includes optimistic updates with rollback, follows React Query patterns for data fetching and caching
    **Future Intent:** Seamless position persistence that works offline and handles conflicts gracefully while maintaining optimal user experience
    **Cautionary Notes:** Handle network failures gracefully, implement proper conflict resolution, test with poor network conditions, validate data integrity on restore
    **Backups:** Existing data persistence hooks to docs/plans/visual_team_canvas/backups/

- [ ] **3.2.3** Design useTeamConnections hook for relationships
    **REQUIRED READING BEFORE STARTING:** docs/plans/visual_team_canvas/research/hook_design_research.md
    **Plan Review & Alignment:** Connection management follows validation patterns, includes cycle detection for hierarchical structures, implements proper constraint checking and error reporting
    **Future Intent:** Robust connection management that prevents invalid relationships while providing intuitive user experience for complex organizational structures  
    **Cautionary Notes:** Test cycle detection performance with large hierarchies, validate constraint enforcement, ensure proper error messages for business rule violations
    **Backups:** Connection management patterns to docs/plans/visual_team_canvas/backups/

- [ ] **3.2.4** Design useCanvasViewport hook for view state
    **REQUIRED READING BEFORE STARTING:** docs/plans/visual_team_canvas/research/hook_design_research.md
    **Plan Review & Alignment:** Layout persistence follows storage patterns with conflict resolution, includes local storage fallback and database synchronization, implements proper versioning
    **Future Intent:** Transparent layout persistence that preserves user customizations across sessions and devices while handling multi-user scenarios
    **Cautionary Notes:** Test storage quota limits, implement proper conflict resolution UI, validate synchronization doesn't cause layout jumping, handle storage failures gracefully  
    **Backups:** Layout persistence patterns to docs/plans/visual_team_canvas/backups/

### **3.3 Database Function Design**
- [ ] **3.3.1** Design save_team_position function
    **REQUIRED READING BEFORE STARTING:** docs/plans/visual_team_canvas/research/database_function_design_research.md
    **Plan Review & Alignment:** Function design follows established patterns with proper security validation, RLS policy integration, comprehensive error handling and logging, includes performance monitoring
    **Future Intent:** Robust database functions that handle canvas operations securely and efficiently while providing comprehensive audit trails
    **Cautionary Notes:** Test with concurrent updates, validate all security checks, ensure proper RLS policy enforcement, test error recovery scenarios thoroughly
    **Backups:** Existing database function patterns to docs/plans/visual_team_canvas/backups/

- [ ] **3.3.2** Design create_team_connection function
    **REQUIRED READING BEFORE STARTING:** docs/plans/visual_team_canvas/research/database_function_design_research.md
    **Plan Review & Alignment:** Connection functions include cycle detection, proper constraint validation, follows security patterns with user access verification, includes comprehensive business rule enforcement
    **Future Intent:** Secure and intelligent connection management that prevents invalid organizational structures while maintaining data integrity
    **Cautionary Notes:** Test cycle detection algorithm performance, validate constraint enforcement thoroughly, test with various permission scenarios, ensure proper error messaging
    **Backups:** Connection management database patterns to docs/plans/visual_team_canvas/backups/

- [ ] **3.3.3** Design get_user_canvas_data function  
    **REQUIRED READING BEFORE STARTING:** docs/plans/visual_team_canvas/research/database_function_design_research.md
    **Plan Review & Alignment:** Data retrieval functions follow established security patterns, include proper access control validation, implement efficient querying with appropriate indexes
    **Future Intent:** Optimized data retrieval that provides complete canvas state while respecting security boundaries and maintaining performance
    **Cautionary Notes:** Test query performance with large datasets, validate access control edge cases, ensure proper data filtering, test with various user permission levels
    **Backups:** Data retrieval patterns to docs/plans/visual_team_canvas/backups/

- [ ] **3.3.4** Design batch canvas update functions
    **REQUIRED READING BEFORE STARTING:** docs/plans/visual_team_canvas/research/database_function_design_research.md
    **Plan Review & Alignment:** Batch functions follow transaction patterns with proper rollback handling, include validation integration, implement performance monitoring and metrics collection
    **Future Intent:** Efficient batch operations that maintain data consistency while providing optimal performance for complex canvas operations
    **Cautionary Notes:** Test transaction rollback scenarios, validate batch size limits, ensure proper error isolation, test with concurrent batch operations
    **Backups:** Batch operation patterns to docs/plans/visual_team_canvas/backups/

---

## 📋 **PHASE 4: DEVELOPMENT**

### **4.1 Database Implementation**
- [ ] **4.1.1** Create team_canvas_positions table migration
- [ ] **4.1.2** Create team_connections table migration
- [ ] **4.1.3** Create team_canvas_viewport table migration
- [ ] **4.1.4** Create RLS policies and indexes

### **4.2 Core Canvas Implementation**
- [ ] **4.2.1** Implement TeamCanvas main component
- [ ] **4.2.2** Implement TeamNode custom React Flow node
- [ ] **4.2.3** Implement basic drag-and-drop positioning
- [ ] **4.2.4** Implement position persistence to database

### **4.3 Connection System Implementation**
- [ ] **4.3.1** Implement team-to-team connection creation
- [ ] **4.3.2** Implement connection line styling and types
- [ ] **4.3.3** Implement connection editing and deletion
- [ ] **4.3.4** Implement connection persistence to database

### **4.4 Canvas Controls Implementation**
- [ ] **4.4.1** Implement CanvasToolbar with zoom/pan controls
- [ ] **4.4.2** Implement save/load canvas state functionality
- [ ] **4.4.3** Implement canvas reset and auto-layout features
- [ ] **4.4.4** Implement canvas settings and preferences modal

### **4.5 Integration Implementation**
- [ ] **4.5.1** Integrate canvas with existing TeamsPage
- [ ] **4.5.2** Implement view toggle between grid and canvas modes
- [ ] **4.5.3** Integrate with existing team creation/editing workflows
- [ ] **4.5.4** Implement real-time updates from team changes

---

## 📋 **PHASE 5: TESTING**

### **5.1 Unit Testing**
- [ ] **5.1.1** Test TeamCanvas component functionality
- [ ] **5.1.2** Test TeamNode rendering and interactions
- [ ] **5.1.3** Test canvas hook functionality
- [ ] **5.1.4** Test database functions and queries

### **5.2 Integration Testing**
- [ ] **5.2.1** Test canvas with existing team management
- [ ] **5.2.2** Test real-time updates and synchronization
- [ ] **5.2.3** Test cross-component communication
- [ ] **5.2.4** Test error handling and edge cases

### **5.3 Performance Testing**
- [ ] **5.3.1** Test canvas performance with 50+ teams
- [ ] **5.3.2** Test rendering performance with complex connections
- [ ] **5.3.3** Test database query performance
- [ ] **5.3.4** Test memory usage and cleanup

### **5.4 User Experience Testing**
- [ ] **5.4.1** Test drag-and-drop user interactions
- [ ] **5.4.2** Test connection creation workflow
- [ ] **5.4.3** Test canvas navigation (zoom, pan, minimap)
- [ ] **5.4.4** Test mobile and responsive behavior

---

## 📋 **PHASE 6: REFINEMENT**

### **6.1 Performance Optimization**
- [ ] **6.1.1** Optimize React Flow rendering performance
- [ ] **6.1.2** Implement canvas virtualization for large datasets
- [ ] **6.1.3** Optimize database queries with proper indexing
- [ ] **6.1.4** Implement debounced saving for position updates

### **6.2 UI/UX Polish**
- [ ] **6.2.1** Refine team node visual design and animations
- [ ] **6.2.2** Polish connection line styling and interactions
- [ ] **6.2.3** Enhance toolbar and control interactions
- [ ] **6.2.4** Implement accessibility improvements

### **6.3 Feature Enhancements**
- [ ] **6.3.1** Implement auto-layout algorithms for new teams
- [ ] **6.3.2** Add team grouping and clustering features
- [ ] **6.3.3** Implement canvas export functionality
- [ ] **6.3.4** Add keyboard shortcuts for power users

### **6.4 Documentation & Cleanup**
- [ ] **6.4.1** Create comprehensive user documentation
- [ ] **6.4.2** Create developer documentation for components
- [ ] **6.4.3** Update README.md with canvas feature information
- [ ] **6.4.4** Clean up development backups and temporary files

---

## 📊 **Progress Tracking**

**Phase 1**: ✅ **COMPLETE** - Research  
**Phase 2**: ✅ **COMPLETE** - Planning  
**Phase 3**: ✅ **COMPLETE** - Design  
**Phase 4**: ⏳ **PENDING** - Development  
**Phase 5**: ⏳ **PENDING** - Testing  
**Phase 6**: ⏳ **PENDING** - Refinement  

**Overall Progress**: 50% Complete (Phases 1-3 finished, ready for development)

---

## 🎯 **Critical Success Factors**

1. **File Size Compliance**: All files must stay ≤300 lines (Philosophy #1)
2. **Backwards Compatibility**: Existing team features must continue working
3. **Performance**: Smooth interaction with large organizational structures
4. **Data Integrity**: Canvas state must persist reliably across sessions
5. **User Experience**: Intuitive interface that improves upon grid layout

---

## 🚨 **Risk Mitigation**

- **Database Migration Risk**: Test all migrations on staging environment first
- **Performance Risk**: Implement virtualization and pagination early
- **Integration Risk**: Maintain existing API interfaces during development
- **User Adoption Risk**: Keep grid view as fallback during transition period
