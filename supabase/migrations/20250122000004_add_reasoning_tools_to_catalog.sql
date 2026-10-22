-- Add MCP reasoning tools to tool_catalog and integration_capabilities
-- This registers the new advanced reasoning system as available tools

-- Skip this migration if required tables don't exist (for shadow database compatibility)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tool_catalog') OR
       NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'integrations_renamed') OR
       NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'integration_capabilities') OR
       NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'integration_categories') THEN
        RAISE NOTICE 'Skipping reasoning tools catalog addition - required tables do not exist yet';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Adding reasoning tools to catalog - required tables exist';
    
    -- Insert reasoning tools into tool_catalog
    EXECUTE $MIGRATION$
INSERT INTO tool_catalog (
  id,
  tool_name,
  name,
  description,
  category,
  provider,
  version,
  status,
  package_identifier,
  docker_image_url,
  required_config_schema,
  required_capabilities_schema,
  default_config_template,
  created_at,
  updated_at
) VALUES 
-- Main reasoning orchestrator
(
  '00000000-0000-0000-0000-000000000010',
  'reasoning_execute_chain',
  'Execute Reasoning Chain',
  'Orchestrates iterative reasoning process with confidence tracking and memory integration',
  'reasoning',
  'agentopia',
  '1.0.0',
  'available',
  'agentopia/advanced-reasoning',
  'ghcr.io/agentopia/advanced-reasoning:latest',
  '{
    "type": "object",
    "properties": {
      "query": {"type": "string", "description": "The question or problem to reason about"},
      "max_iterations": {"type": "integer", "default": 6, "minimum": 1, "maximum": 10},
      "confidence_threshold": {"type": "number", "default": 0.85, "minimum": 0.5, "maximum": 0.99},
      "reasoning_style": {"type": "string", "enum": ["auto", "inductive", "deductive", "abductive"], "default": "auto"},
      "include_memory": {"type": "boolean", "default": true},
      "timeout_ms": {"type": "integer", "default": 30000}
    },
    "required": ["query"]
  }'::jsonb,
  '["iterative_reasoning", "confidence_tracking", "memory_integration", "safety_controls"]'::jsonb,
  '{
    "edge_function": "advanced-reasoning",
    "action": "execute_chain",
    "requires_auth": true,
    "supports_streaming": false,
    "max_iterations": 6,
    "confidence_threshold": 0.85
  }'::jsonb,
  NOW(),
  NOW()
),
-- Individual reasoning types
(
  '00000000-0000-0000-0000-000000000011',
  'reasoning_inductive',
  'Inductive Reasoning',
  'Pattern-based reasoning from specific observations to general principles',
  'reasoning',
  'agentopia',
  '1.0.0',
  'available',
  'agentopia/advanced-reasoning',
  'ghcr.io/agentopia/advanced-reasoning:latest',
  '{
    "type": "object",
    "properties": {
      "observations": {"type": "array", "items": {"type": "string"}},
      "context": {"type": "string"},
      "confidence_threshold": {"type": "number", "default": 0.8}
    },
    "required": ["observations"]
  }'::jsonb,
  '["pattern_recognition", "generalization", "hypothesis_formation"]'::jsonb,
  '{
    "edge_function": "advanced-reasoning",
    "action": "inductive_reasoning",
    "reasoning_type": "inductive"
  }'::jsonb,
  NOW(),
  NOW()
),
(
  '00000000-0000-0000-0000-000000000012',
  'reasoning_deductive',
  'Deductive Reasoning',
  'Logic-based reasoning from general principles to specific conclusions',
  'reasoning',
  'agentopia',
  '1.0.0',
  'available',
  'agentopia/advanced-reasoning',
  'ghcr.io/agentopia/advanced-reasoning:latest',
  '{
    "type": "object",
    "properties": {
      "premises": {"type": "array", "items": {"type": "string"}},
      "rules": {"type": "array", "items": {"type": "string"}},
      "context": {"type": "string"}
    },
    "required": ["premises"]
  }'::jsonb,
  '["logical_inference", "rule_application", "conclusion_derivation"]'::jsonb,
  '{
    "edge_function": "advanced-reasoning",
    "action": "deductive_reasoning",
    "reasoning_type": "deductive"
  }'::jsonb,
  NOW(),
  NOW()
),
(
  '00000000-0000-0000-0000-000000000013',
  'reasoning_abductive',
  'Abductive Reasoning',
  'Inference to the best explanation for observed phenomena',
  'reasoning',
  'agentopia',
  '1.0.0',
  'available',
  'agentopia/advanced-reasoning',
  'ghcr.io/agentopia/advanced-reasoning:latest',
  '{
    "type": "object",
    "properties": {
      "observations": {"type": "array", "items": {"type": "string"}},
      "anomalies": {"type": "array", "items": {"type": "string"}},
      "context": {"type": "string"}
    },
    "required": ["observations"]
  }'::jsonb,
  '["explanation_generation", "hypothesis_ranking", "anomaly_detection"]'::jsonb,
  '{
    "edge_function": "advanced-reasoning",
    "action": "abductive_reasoning",
    "reasoning_type": "abductive"
  }'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  tool_name = EXCLUDED.tool_name,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  required_config_schema = EXCLUDED.required_config_schema,
  required_capabilities_schema = EXCLUDED.required_capabilities_schema,
  default_config_template = EXCLUDED.default_config_template,
  updated_at = NOW();

-- Add reasoning integration to integrations table first
INSERT INTO integrations_renamed (
  id,
  category_id,
  name,
  description,
  icon_name,
  status,
  is_popular,
  configuration_schema,
  required_tool_catalog_id,
  display_order,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000020',
  (SELECT id FROM integration_categories WHERE name = 'Automation & Workflows' LIMIT 1),
  'Advanced Reasoning',
  'AI-powered iterative reasoning with confidence tracking and memory integration',
  'Brain',
  'available',
  true,
  '{
    "type": "object",
    "properties": {
      "enabled": {"type": "boolean", "default": true},
      "threshold": {"type": "number", "default": 0.3, "minimum": 0.1, "maximum": 0.9},
      "max_iterations": {"type": "integer", "default": 6, "minimum": 1, "maximum": 10},
      "confidence_threshold": {"type": "number", "default": 0.85, "minimum": 0.5, "maximum": 0.99},
      "preferred_styles": {"type": "array", "items": {"type": "string"}, "default": ["inductive", "deductive", "abductive"]},
      "safety_switch_enabled": {"type": "boolean", "default": true}
    }
  }'::jsonb,
  '00000000-0000-0000-0000-000000000010',
  1,
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  configuration_schema = EXCLUDED.configuration_schema,
  required_tool_catalog_id = EXCLUDED.required_tool_catalog_id,
  updated_at = NOW();

-- Add integration capabilities for reasoning
INSERT INTO integration_capabilities (
  id,
  integration_id,
  capability_key,
  display_label,
  display_order,
  created_at,
  updated_at
) VALUES
(
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000020',
  'iterative_processing',
  'Iterative Processing',
  1,
  NOW(),
  NOW()
),
(
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000020',
  'confidence_tracking',
  'Confidence Tracking',
  2,
  NOW(),
  NOW()
),
(
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000020',
  'memory_integration',
  'Memory Integration',
  3,
  NOW(),
  NOW()
),
(
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000020',
  'safety_controls',
  'Safety Controls',
  4,
  NOW(),
  NOW()
),
(
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000020',
  'inductive_reasoning',
  'Inductive Reasoning',
  5,
  NOW(),
  NOW()
),
(
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000020',
  'deductive_reasoning',
  'Deductive Reasoning',
  6,
  NOW(),
  NOW()
),
(
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000020',
  'abductive_reasoning',
  'Abductive Reasoning',
  7,
  NOW(),
  NOW()
) ON CONFLICT (integration_id, capability_key) DO UPDATE SET
  display_label = EXCLUDED.display_label,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- Add comment
COMMENT ON TABLE reasoning_sessions IS ''Enhanced: Tracks MCP-based iterative reasoning sessions with confidence progression'';
COMMENT ON TABLE reasoning_steps IS ''Enhanced: Individual steps within MCP reasoning sessions with detailed memory integration'';
    $MIGRATION$;
END $$;
