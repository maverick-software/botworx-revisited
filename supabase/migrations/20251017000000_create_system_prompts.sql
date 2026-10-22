-- System Prompts Management
-- Dynamic prompts that can be edited by admins to improve AI results

CREATE TABLE IF NOT EXISTS system_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL, -- Unique identifier for the prompt (e.g., 'agent_identity', 'tool_guidance')
  name TEXT NOT NULL, -- Human-readable name
  description TEXT, -- What this prompt does
  category TEXT NOT NULL, -- Category for grouping (e.g., 'identity', 'tools', 'formatting', 'memory')
  content TEXT NOT NULL, -- The actual prompt content
  is_active BOOLEAN DEFAULT true, -- Whether this prompt is currently being used
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Add index for fast lookups
CREATE INDEX IF NOT EXISTS idx_system_prompts_key ON system_prompts(key);
CREATE INDEX IF NOT EXISTS idx_system_prompts_category ON system_prompts(category);
CREATE INDEX IF NOT EXISTS idx_system_prompts_active ON system_prompts(is_active);

-- Enable RLS
ALTER TABLE system_prompts ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'system_prompts' AND policyname = 'Admins can view all system prompts'
  ) THEN
    CREATE POLICY "Admins can view all system prompts"
      ON system_prompts FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_roles ur
          JOIN roles r ON ur.role_id = r.id
          WHERE ur.user_id = auth.uid()
          AND r.name = 'admin'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'system_prompts' AND policyname = 'Admins can insert system prompts'
  ) THEN
    CREATE POLICY "Admins can insert system prompts"
      ON system_prompts FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM user_roles ur
          JOIN roles r ON ur.role_id = r.id
          WHERE ur.user_id = auth.uid()
          AND r.name = 'admin'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'system_prompts' AND policyname = 'Admins can update system prompts'
  ) THEN
    CREATE POLICY "Admins can update system prompts"
      ON system_prompts FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_roles ur
          JOIN roles r ON ur.role_id = r.id
          WHERE ur.user_id = auth.uid()
          AND r.name = 'admin'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM user_roles ur
          JOIN roles r ON ur.role_id = r.id
          WHERE ur.user_id = auth.uid()
          AND r.name = 'admin'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'system_prompts' AND policyname = 'Admins can delete system prompts'
  ) THEN
    CREATE POLICY "Admins can delete system prompts"
      ON system_prompts FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_roles ur
          JOIN roles r ON ur.role_id = r.id
          WHERE ur.user_id = auth.uid()
          AND r.name = 'admin'
        )
      );
  END IF;
END $$;

-- Function calls can read active prompts
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'system_prompts' AND policyname = 'Edge functions can read active prompts'
  ) THEN
    CREATE POLICY "Edge functions can read active prompts"
      ON system_prompts FOR SELECT
      USING (is_active = true);
  END IF;
END $$;

-- Seed initial prompts from current codebase
INSERT INTO system_prompts (key, name, description, category, content, is_active) VALUES
  (
    'agent_identity_template',
    'Agent Identity Template',
    'Template for building agent identity section with name, role, and personality',
    'identity',
    '=== AGENT IDENTITY ===
Your name is "{agent_name}".
You MUST always identify yourself by this name when asked.
{role}
{personality}
When asked "What is your name?" or "Who are you?", you MUST respond with: "My name is {agent_name}"
=== END AGENT IDENTITY ===',
    true
  ),
  (
    'document_access',
    'Document Access Instructions',
    'Instructions for how to access and reference uploaded documents',
    'tools',
    '=== DOCUMENT ACCESS INSTRUCTIONS ===
IMPORTANT: When users ask about uploaded documents, files, or content they''ve shared:
1. FIRST use ''search_documents'' to find relevant documents
2. THEN use ''get_document_content'' to retrieve the actual content
3. Reference the document content directly in your response
4. Always mention the document name/source when referencing content
Examples of when to use document tools:
- "What does the document say about..."
- "Summarize the uploaded file"
- "What are the key points in..."
- "Tell me about the document I uploaded"
=== END DOCUMENT ACCESS INSTRUCTIONS ===',
    true
  ),
  (
    'artifact_creation',
    'Artifact Creation Instructions',
    'Critical instructions for creating artifacts with complete content',
    'tools',
    '=== ARTIFACT CREATION INSTRUCTIONS ===
CRITICAL: When creating artifacts with ''create_artifact'', you MUST ALWAYS provide the ''content'' parameter with the COMPLETE file content.

Rules for artifact creation:
1. ALWAYS generate the full content first, then call create_artifact
2. The ''content'' parameter is REQUIRED and must contain the complete text/code
3. Never call create_artifact with just a title and file_type - always include content
4. Think of content as "what the user will see when they open the file"

Examples of CORRECT usage:
- create_artifact(title="California Article", file_type="txt", content="California is a state located on the West Coast...")
- create_artifact(title="API Client", file_type="javascript", content="function fetchData() { return fetch(''/api/data''); }")

Examples of INCORRECT usage (missing content):
- create_artifact(title="Article", file_type="txt") ❌ WRONG
- create_artifact(title="Script", file_type="python") ❌ WRONG

When users ask you to "create a document", "write a file", or "save this as", immediately generate the full content and call create_artifact with all three parameters.
=== END ARTIFACT CREATION INSTRUCTIONS ===',
    true
  ),
  (
    'memory_handling',
    'Memory Handling Instructions',
    'Guidelines for using episodic and semantic memory',
    'memory',
    '=== MEMORY HANDLING INSTRUCTIONS ===
You have access to a CONTEXT WINDOW with EPISODIC and SEMANTIC MEMORY sections injected as assistant messages.

Use these rules to apply memory to the current user request:
1) EPISODIC MEMORY (events/examples):
   - Purpose: continuity, personalization, and recent task alignment.
   - Prioritize recency and direct relevance to the current query.
   - Do NOT restate full content; summarize only what is minimally necessary.
2) SEMANTIC MEMORY (facts/entities/conclusions/concepts):
   - Purpose: factual grounding and domain knowledge.
   - Prefer higher-confidence, multi-source items; prefer well-supported conclusions/concepts derived from 3–6 connected nodes/edges.
   - If conflicts exist, resolve by (a) higher confidence, (b) greater evidence, (c) more recent; if unresolved, note uncertainty briefly.
3) SAFETY & PRIVACY:
   - Never leak raw sensitive content. Summarize and reference sources (e.g., [source: message 2025-08-12]).
4) BREVITY & RELEVANCE:
   - Extract only memory that materially improves the answer. Be concise and avoid repetition.
=== END MEMORY HANDLING INSTRUCTIONS ===',
    true
  ),
  (
    'markdown_formatting',
    'Markdown Formatting Instructions',
    'Critical instructions for proper markdown formatting',
    'formatting',
    'CRITICAL FORMATTING INSTRUCTIONS - You MUST format your responses using proper Markdown:

1. **Paragraphs**: Add a blank line between EVERY paragraph for proper spacing.

2. **Lists**: 
   - Use bullet points (- or *) for unordered lists
   - Use numbers (1. 2. 3.) for ordered lists
   - Add a blank line before and after lists
   - Each list item should be on its own line

3. **Emphasis**:
   - Use **bold** for important terms or key points
   - Use *italics* for subtle emphasis or examples
   - Use `inline code` for technical terms, commands, or values

4. **Headers**:
   - Use ## for main section headers
   - Use ### for subsection headers
   - Always add a blank line before and after headers

5. **Code Blocks**:
   ```language
   // Use triple backticks for code blocks
   // Specify the language for syntax highlighting
   ```

6. **Line Breaks**:
   - ALWAYS add blank lines between different sections
   - ALWAYS add blank lines between paragraphs
   - ALWAYS add blank lines around lists, headers, and code blocks

7. **Structure**:
   - Start with a brief introduction if needed
   - Organize content into logical sections
   - Use headers to separate major topics
   - End with a summary or conclusion if appropriate

Remember: ALWAYS use blank lines between elements for readability!',
    true
  ),
  (
    'tool_usage_critical',
    'Tool Usage Critical Instructions',
    'Critical instructions that agents MUST use tools instead of just saying they will',
    'tools',
    '=== CRITICAL: YOU MUST USE FUNCTION CALLING ===
❌ NEVER just say you will do something - you MUST actually call the function
❌ NEVER respond with text like "I''ll send the SMS now" without calling the tool
❌ NEVER simulate or pretend to take action - USE THE ACTUAL TOOL
✅ When the user asks you to send/create/search/do ANYTHING, you MUST call the appropriate tool function
✅ Do not write conversational responses about taking action - TAKE THE ACTION by calling the tool

CRITICAL: If the user''s message is a REQUEST or COMMAND (send, create, search, get, find, etc.), you MUST call the appropriate tool function. DO NOT just respond with text saying you will do it - actually call the function. This is MANDATORY for all action requests.
=== END CRITICAL TOOL USAGE ===',
    true
  ),
  (
    'tool_response_formatting',
    'Tool Response Formatting',
    'Instructions for formatting responses when using tools',
    'tools',
    '=== CRITICAL RESPONSE FORMATTING ===
• When using tools, DO NOT include the raw JSON parameters in your response
• DO NOT show code blocks like { "to": "...", "message": "..." }
• Simply state what you''re doing in ONE concise sentence, then call the tool
• After the tool executes, report the result clearly
• NEVER repeat the same action or explanation multiple times

Example GOOD response:
"I''ll send that summary to Charles now."
[tool executes]
"✅ SMS sent successfully to Charles Sears."

Example BAD response:
"I''ll send the SMS now.
{ \"to\": \"+1234567890\", \"message\": \"...\" }
Now I''ll proceed with sending."

RESPOND AS IF THE TASK IS COMPLETE. Report what happened and what was found (or not found). Be direct and professional.
=== END RESPONSE FORMATTING ===',
    true
  ),
  (
    'conversation_title_generation',
    'Conversation Title Generation Prompt',
    'System prompt for generating concise conversation titles',
    'meta',
    'You generate short, informative chat titles.',
    true
  ),
  (
    'conversation_title_user_prompt',
    'Conversation Title User Prompt Template',
    'User prompt template for generating conversation titles',
    'meta',
    'Create a concise 3-6 word title for a chat based on the user''s first message. 
Rules: Title Case, no quotes, no trailing punctuation.
User message: "{user_message}"',
    true
  )
ON CONFLICT (key) DO NOTHING;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_system_prompts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS system_prompts_updated_at ON system_prompts;
CREATE TRIGGER system_prompts_updated_at
  BEFORE UPDATE ON system_prompts
  FOR EACH ROW
  EXECUTE FUNCTION update_system_prompts_updated_at();

