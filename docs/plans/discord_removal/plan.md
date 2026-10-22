# Discord Capability Removal - Implementation Plan

## Project Overview
**Objective**: Complete removal of Discord integration capabilities from Agentopia codebase
**Approach**: Systematic removal following plan_and_execute.mdc and big_picture_protocol.mdc methodologies
**Priority**: High - Remove unnecessary complexity and dependencies

## Problem Statement
The Discord integration adds significant complexity to the Agentopia codebase through:
- Multiple database tables and relationships
- 13+ Supabase Edge Functions
- External service dependencies (discord-worker, gateway-client)
- Complex frontend components and state management
- Security surface area expansion

## Proposed File Structure

### Files to Remove (Complete Deletion)
```
/src/components/DiscordConnect.tsx
/src/components/DiscordTypes.tsx  
/src/components/DiscordModals.tsx (if exists)
/src/pages/Discord.tsx
/services/discord-worker/ (entire directory)
/discord-gateway-client/ (entire directory)
/scripts/register-discord-commands.js
/supabase/functions/discord-connect/
/supabase/functions/discord-disconnect/
/supabase/functions/discord-get-bot-guilds/
/supabase/functions/discord-get-guild-channels/
/supabase/functions/discord-interaction-handler/
/supabase/functions/discord-webhook/
/supabase/functions/get-discord-agent-tokens/
/supabase/functions/get-enabled-guilds/
/supabase/functions/manage-discord-worker/
/supabase/functions/register-agent-commands/
/supabase/functions/securely-update-discord-token/
/supabase/functions/update-agent-discord-token/
/supabase/functions/update-enabled-guilds/
```

### Files to Modify (Partial Updates)
```
/supabase/functions/_shared/database.types.ts - Remove Discord type definitions
/src/types/ - Remove Discord-related type exports (if any)
/package.json - Remove discord.js dependencies
/supabase/functions/import_map.json - Clean up Discord function imports
/README.md - Remove Discord documentation references
```

### Database Schema Changes
```sql
-- Remove table: agent_discord_connections
-- Remove columns from agents table:
--   - discord_bot_key
--   - discord_bot_token_encrypted  
--   - discord_bot_token_id
--   - discord_channel
--   - discord_user_id
-- Remove indexes and constraints
-- Remove RLS policies
```

## File Size Constraints Compliance
All proposed changes involve removal rather than creation, ensuring compliance with 200-300 line maximum rule. No new files exceed this limit.

## Architecture After Removal
- **Simplified Agent Model**: Agents focus purely on chat/workspace functionality
- **Reduced External Dependencies**: No Discord.js or related packages
- **Cleaner Database Schema**: Removal of Discord-specific tables and columns
- **Streamlined UI**: Agent configuration UI simplified without Discord options
- **Reduced Security Surface**: No Discord token management or webhook handling

## Benefits
1. **Reduced Complexity**: Elimination of 13+ functions and multiple services
2. **Lower Maintenance Burden**: No Discord API version compatibility issues
3. **Improved Security**: Removal of token storage and webhook endpoints
4. **Better Performance**: Fewer database relationships and external calls
5. **Simplified Testing**: Reduced integration test surface area

## Risks & Mitigation
1. **Data Loss Risk**: Existing Discord configurations will be lost
   - Mitigation: Create data export utility before removal
2. **Service Disruption**: Active Discord bots will stop working
   - Mitigation: User notification and graceful shutdown procedures
3. **Frontend Breaking Changes**: Components may have unexpected dependencies
   - Mitigation: Comprehensive testing and gradual removal

## Success Criteria
- [ ] All Discord-related code removed from codebase
- [ ] Database schema cleaned of Discord tables/columns  
- [ ] No Discord dependencies in package.json
- [ ] Application builds and runs without errors
- [ ] No broken links or references to Discord features
- [ ] All tests pass (excluding Discord tests)
- [ ] Documentation updated to reflect removal

## Next Steps
1. Create Work Breakdown Structure (WBS) with detailed tasks
2. Research each WBS item thoroughly
3. Create backup procedures for each component
4. Execute removal in phased approach
5. Test and validate at each phase
6. Update documentation and cleanup

---

**Research Reference**: docs/plans/discord_removal/research/discord_components_analysis.md
**WBS Reference**: docs/plans/discord_removal/wbs_checklist.md (to be created)
**Implementation**: docs/plans/discord_removal/implementation/ (to be populated) 