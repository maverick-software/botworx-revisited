# Agentopia Database Schema

This document provides an overview of the database schema for the Agentopia project.

**Note:** This schema reflects the state after the Workspace refactoring. RLS policies are generally not detailed here but are crucial for access control.

## Core Tables

### `auth.users`
Standard Supabase authentication table.
*   **Key Columns:** `id` (uuid, PK), (Other standard columns)

### `public.user_profiles`
Stores additional user profile information.
*   **(Note:** Migrations use `profiles` table name, but functionality implies this purpose. Columns adjusted based on migrations/context.)*
*   **Key Columns:** 
    *   `id` (uuid, PK, FK -> `auth.users.id`)
    *   `username` (text)
    *   `full_name` (text)
    *   `avatar_url` (text)
    *   `role_id` (uuid, FK -> `roles.id`) // Added by migration
    *   `encryption_key_id` (text) // Added by migration for user secrets
    *   `updated_at` (timestamptz)
*   **Relationships:** One-to-one with `auth.users`.

### `public.roles`
Defines application roles (e.g., 'admin', 'user').
*   **Key Columns:** 
    *   `id` (uuid, PK)
    *   `name` (text, Unique)
    *   `description` (text)
    *   `created_at` (timestamptz)

### `public.teams`
Represents teams, which can be added as members to workspaces.
*   **Key Columns:** 
    *   `id` (uuid, PK)
    *   `name` (text, Not Null)
    *   `description` (text)
    *   `owner_user_id` (uuid, FK -> `auth.users.id`)
    *   `created_at` (timestamptz)
    *   `updated_at` (timestamptz)

### `public.team_members`
Links **Agents** to Teams and defines their role/reporting structure within the team.
*   **Key Columns:** 
    *   `id` (uuid, PK)
    *   `team_id` (uuid, FK -> `teams.id`, Not Null)
    *   `agent_id` (uuid, FK -> `agents.id`, Not Null)
    *   `team_role` (text): Role within the team.
    *   `reports_to_agent_id` (uuid, Nullable, FK -> `agents.id`)
    *   `joined_at` (timestamptz)

### `public.user_team_memberships`
Tracks user membership in teams (distinct from agents in teams).
*   **Key Columns:** 
    *   `id` (uuid, PK)
    *   `user_id` (uuid, FK -> `auth.users.id`, Not Null)
    *   `team_id` (uuid, FK -> `teams.id`, Not Null)
    *   `joined_at` (timestamptz, Not Null)

## Agent Related Tables

### `public.agents`
Stores configuration for individual AI agents.
*   **Key Columns:** 
    *   `id` (uuid, PK)
    *   `user_id` (uuid, FK -> `auth.users.id`)
    *   `name` (text)
    *   `description` (text)
    *   `system_instructions` (text)
    *   `assistant_instructions` (text)
    *   `discord_bot_key` (text, likely reference to Vault)
    *   `active` (boolean, DEFAULT false)
    *   `created_at` (timestamptz)
    *   `updated_at` (timestamptz)

### `public.agent_discord_connections`
Tracks connection details and status for agents, specifically per Discord Server (Guild).
*   **Key Columns:** 
    *   `id` (uuid, PK)
    *   `agent_id` (uuid, FK -> `agents.id`)
    *   `guild_id` (text, Not Null)
    *   `is_enabled` (boolean)
    *   `discord_app_id` (text)
    *   `discord_public_key` (text)
    *   `interaction_secret` (text) // Added by migration
    *   `inactivity_timeout_minutes` (integer) // Renamed from _ms in migrations
    *   `worker_status` (text)
    *   `created_at` (timestamptz)

### `public.datastores`
Represents collections of data for RAG (e.g., Pinecone indexes).
*   **Key Columns:** 
    *   `id` (uuid, PK)
    *   `user_id` (uuid, FK -> `auth.users.id`)
    *   `name` (text)
    *   `description` (text)
    *   `type` (text, e.g., 'pinecone')
    *   `config` (jsonb)
    *   `similarity_metric` (text)
    *   `similarity_threshold` (float4)
    *   `max_results` (integer)
    *   `created_at` (timestamptz)
    *   `updated_at` (timestamptz)

### `public.agent_datastores`
Join table linking agents to datastores.
*   **Key Columns:** 
    *   `id` (uuid, PK)
    *   `agent_id` (uuid, FK -> `agents.id`)
    *   `datastore_id` (uuid, FK -> `datastores.id`)
    *   `created_at` (timestamptz)

## Workspace & Collaboration Tables

### `public.workspaces`
Top-level containers for collaboration (chat, agents, teams, users).
*   **Key Columns:** 
    *   `id` (uuid, PK)
    *   `name` (text, Not Null)
    *   `owner_user_id` (uuid, FK -> `auth.users.id`, Not Null)
    *   `created_at` (timestamptz)

### `public.chat_channels`
Individual text channels within a workspace.
*   **Key Columns:** 
    *   `id` (uuid, PK)
    *   `workspace_id` (uuid, FK -> `workspaces.id`, Not Null)
    *   `name` (text, Not Null)
    *   `topic` (text)
    *   `created_at` (timestamptz, Not Null)
    *   `last_message_at` (timestamptz)
*   **RLS Note:** RLS policies need correction (pending migration) to allow members SELECT/INSERT access based on `is_workspace_member`.

### `public.workspace_members`
Links agents, teams, or users to a specific workspace and defines their role within it.
*   **Key Columns:**
    *   `id` (uuid, PK)
    *   `workspace_id` (uuid, FK -> `workspaces.id`, Not Null)
    *   `agent_id` (uuid, FK -> `agents.id`, NULLABLE)
    *   `team_id` (uuid, FK -> `teams.id`, NULLABLE)
    *   `user_id` (uuid, FK -> `auth.users.id`, NULLABLE)
    *   `role` (text, NULLABLE, default 'member')
    *   `added_by_user_id` (uuid, FK -> `auth.users.id`, NULLABLE)
    *   `created_at` (timestamptz, default now())
*   **Constraints:** `CHECK (num_nonnulls(agent_id, team_id, user_id) = 1)`, UNIQUE constraints on `(workspace_id, agent_id)`, `(workspace_id, team_id)`, `(workspace_id, user_id)`.

### `public.chat_messages`
Stores individual messages within a chat channel.
*   **Key Columns:** 
    *   `id` (uuid, PK)
    *   `channel_id` (uuid, FK -> `chat_channels.id`, Not Null)
    *   `sender_user_id` (uuid, Nullable, FK -> `auth.users.id`)
    *   `sender_agent_id` (uuid, Nullable, FK -> `agents.id`)
    *   `content` (text, Not Null)
    *   `metadata` (jsonb)
    *   `embedding` (vector(1536))
    *   `created_at` (timestamptz, Not Null)
    *   `updated_at` (timestamptz)

## Other Supporting Tables

### `public.mcp_configurations`
Configuration for the Multi-Cloud Proxy feature, linked to agents and specific servers.
*   **Key Columns:** 
    *   `id` (uuid, PK)
    *   `agent_id` (uuid, FK -> `agents.id`)
    *   `server_id` (uuid, FK -> `mcp_servers.id`) // Link to server
    *   `name` (text)
    *   `is_active` (boolean)
    *   `priority` (integer)
    *   `timeout_ms` (integer)
    *   `max_retries` (integer)
    *   `retry_backoff_ms` (integer)
    *   `created_at`, `updated_at` (timestamptz)

### `public.mcp_servers`
Defines available backend servers for MCP.
*   **Key Columns:** 
    *   `id` (uuid, PK)
    *   `name` (text)
    *   `endpoint_url` (text)
    *   `vault_api_key_id` (text) // Reference to key in vault
    *   `capabilities` (jsonb)
    *   `created_at`, `updated_at` (timestamptz)

### `public.user_secrets`
*   **(Note:** Internal Supabase Vault management? Seems related to `vault.secrets`.)*
*   **Key Columns (from migrations):** 
    *   `id` (uuid, PK)
    *   `user_id` (uuid, FK -> `auth.users.id`)
    *   `key_id` (uuid) // Refers to vault encryption key?
    *   `secret` (text) // Encrypted secret value
    *   `name` (text)
    *   `description` (text)
    *   `created_at`, `updated_at` (timestamptz)

## Removed / Deprecated Tables

*   `public.chat_sessions`: Replaced by `workspaces` and `chat_channels`.
*   `public.chat_room_members`: Replaced by `workspace_members`. 