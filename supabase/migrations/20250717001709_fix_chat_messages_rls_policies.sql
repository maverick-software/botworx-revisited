-- Fix chat_messages RLS policies to work with current schema
-- Remove old room-based policies that reference non-existent room_id

-- Drop old policies that reference room_id
DROP POLICY IF EXISTS "Allow room members to read channel messages" ON "public"."chat_messages";
DROP POLICY IF EXISTS "Allow room members to insert channel messages" ON "public"."chat_messages";
DROP POLICY IF EXISTS "Allow room owner to delete channel messages" ON "public"."chat_messages";

-- Create simple policies for agent chat functionality
-- Allow users to read messages they sent or messages from agents
CREATE POLICY "Allow users to read their own messages and agent messages" ON "public"."chat_messages" 
FOR SELECT 
USING (
    auth.uid() = sender_user_id OR 
    sender_agent_id IS NOT NULL
);

-- Allow users to insert their own messages
CREATE POLICY "Allow users to insert their own messages" ON "public"."chat_messages" 
FOR INSERT 
WITH CHECK (
    auth.uid() = sender_user_id AND 
    sender_agent_id IS NULL
);

-- Allow agent messages to be inserted (for backend functions)
CREATE POLICY "Allow agent messages to be inserted" ON "public"."chat_messages" 
FOR INSERT 
WITH CHECK (
    sender_agent_id IS NOT NULL AND 
    sender_user_id IS NULL
);

-- Keep the existing workspace-based policies if they exist and work
-- These are more recent and should work with the current schema
