-- Minimal binding fixture for migration0064; full Supabase migration remains a gate.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE agents(id uuid PRIMARY KEY,user_id uuid NOT NULL,active boolean NOT NULL DEFAULT true);
CREATE TABLE desktop_agent_profiles(agent_id uuid PRIMARY KEY,user_id uuid NOT NULL,revision integer NOT NULL);
CREATE TABLE desktop_projects(id uuid PRIMARY KEY,user_id uuid NOT NULL,revision integer NOT NULL);
CREATE TABLE conversation_sessions(conversation_id uuid PRIMARY KEY,user_id uuid NOT NULL);
CREATE TABLE desktop_project_chats(conversation_id uuid PRIMARY KEY,user_id uuid NOT NULL,project_id uuid NOT NULL);
CREATE TABLE chat_messages_v2(id uuid PRIMARY KEY,content jsonb NOT NULL,metadata jsonb NOT NULL DEFAULT '{}');
CREATE TABLE desktop_requests(id uuid PRIMARY KEY,user_id uuid NOT NULL,agent_id uuid NOT NULL,conversation_id uuid NOT NULL,user_message_id uuid NOT NULL,assistant_message_id uuid NOT NULL,status text NOT NULL,error text,updated_at timestamptz NOT NULL DEFAULT now(),agent_instance_id uuid);
CREATE TABLE desktop_agent_instances(id uuid PRIMARY KEY,user_id uuid NOT NULL,request_id uuid,parent_instance_id uuid);
