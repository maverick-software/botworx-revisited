-- Fix Infinite Recursion in Teams RLS Policies
-- Date: January 1, 2026
-- Purpose: Simplify RLS policies to avoid infinite recursion when querying teams table

BEGIN;

-- Simple ownership-based policies without recursion
DROP POLICY IF EXISTS teams_select_own ON teams;
CREATE POLICY teams_select_own ON teams
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS teams_insert_own ON teams;
CREATE POLICY teams_insert_own ON teams
  FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS teams_update_own ON teams;
CREATE POLICY teams_update_own ON teams
  FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

COMMIT;

