/*
# Centrova OS Phase 3 — Project Delivery Schema

## Overview
This migration adds the project delivery module tables for Phase 3.
It upgrades the existing milestones table with richer status/progress,
and introduces deliverables, meeting notes, meeting decisions, meeting
action items, and project notes tables.

## Modified Tables

### milestones (ALTERED)
- Status constraint changed from `todo | in_progress | done` to
  `planned | in_progress | review | completed | cancelled`.
- Added `progress` integer column (0-100, default 0).
- Added `sort_order` integer column (default 0) for reordering.
- Existing data migrated: `todo` → `planned`, `done` → `completed`.

## New Tables

### 1. deliverables
Work products to be delivered to the client.
- `id`, `project_id` (FK projects), `milestone_id` (FK milestones, nullable)
- `name`, `description`, `type` (website, web_app, mobile_app, ui_design, api, documentation, other)
- `due_date`, `status` (pending, in_development, ready_for_review, approved, delivered)
- `notes`, `link_url`, `file_path`, `file_url` (attachment support)
- `created_by`, `created_at`, `updated_at`, `deleted_at`

### 2. meeting_notes
Meeting records for each project.
- `id`, `project_id` (FK projects)
- `title`, `meeting_date`, `location` (location or platform)
- `participants` (text array), `notes`
- `created_by`, `created_at`, `updated_at`, `deleted_at`

### 3. meeting_decisions
Decisions recorded from meetings.
- `id`, `meeting_id` (FK meeting_notes)
- `decision` (text), `created_at`

### 4. meeting_action_items
Action items from meetings, optionally linked to tasks.
- `id`, `meeting_id` (FK meeting_notes), `task_id` (FK tasks, nullable)
- `description`, `assignee` (text), `completed` (boolean)
- `created_at`

### 5. project_notes
General notes for a project with categories and tags.
- `id`, `project_id` (FK projects)
- `title`, `content`, `category` (technical, business, client, internal, deployment, miscellaneous)
- `tags` (text array)
- `created_by`, `created_at`, `updated_at`, `deleted_at`

## Security
- RLS enabled on all new tables.
- All policies `TO authenticated USING (true)` — internal tool shared by 3 founders.
- 4 policies per table (SELECT, INSERT, UPDATE, DELETE).

## Important Notes
1. Milestone status migration: `todo` → `planned`, `in_progress` stays, `done` → `completed`.
2. The `progress` column on milestones allows granular tracking beyond just status.
3. Meeting action items can be converted to tasks via the frontend (creates a task row + links action_item.task_id).
4. Deliverable attachments use the existing `documents` storage bucket.
*/

-- ============================================================
-- 1. ALTER milestones TABLE
-- ============================================================

-- Add progress column
ALTER TABLE milestones ADD COLUMN IF NOT EXISTS progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100);

-- Add sort_order column
ALTER TABLE milestones ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Migrate existing status values before changing constraint
UPDATE milestones SET status = 'planned' WHERE status = 'todo';
UPDATE milestones SET status = 'completed' WHERE status = 'done';

-- Drop old constraint and add new one
ALTER TABLE milestones DROP CONSTRAINT IF EXISTS milestones_status_check;
ALTER TABLE milestones ADD CONSTRAINT milestones_status_check CHECK (status IN ('planned', 'in_progress', 'review', 'completed', 'cancelled'));

-- ============================================================
-- 2. deliverables TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  milestone_id uuid REFERENCES milestones(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'other' CHECK (type IN ('website', 'web_app', 'mobile_app', 'ui_design', 'api', 'documentation', 'other')),
  due_date date,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_development', 'ready_for_review', 'approved', 'delivered')),
  notes text,
  link_url text,
  file_path text,
  file_url text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE deliverables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_deliverables" ON deliverables;
CREATE POLICY "select_deliverables" ON deliverables FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_deliverables" ON deliverables;
CREATE POLICY "insert_deliverables" ON deliverables FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_deliverables" ON deliverables;
CREATE POLICY "update_deliverables" ON deliverables FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_deliverables" ON deliverables;
CREATE POLICY "delete_deliverables" ON deliverables FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_deliverables_project_id ON deliverables(project_id);
CREATE INDEX IF NOT EXISTS idx_deliverables_status ON deliverables(status);
CREATE INDEX IF NOT EXISTS idx_deliverables_deleted_at ON deliverables(deleted_at);

-- ============================================================
-- 3. meeting_notes TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS meeting_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  meeting_date date NOT NULL,
  location text,
  participants text[] DEFAULT '{}',
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE meeting_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_meeting_notes" ON meeting_notes;
CREATE POLICY "select_meeting_notes" ON meeting_notes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_meeting_notes" ON meeting_notes;
CREATE POLICY "insert_meeting_notes" ON meeting_notes FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_meeting_notes" ON meeting_notes;
CREATE POLICY "update_meeting_notes" ON meeting_notes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_meeting_notes" ON meeting_notes;
CREATE POLICY "delete_meeting_notes" ON meeting_notes FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_meeting_notes_project_id ON meeting_notes(project_id);
CREATE INDEX IF NOT EXISTS idx_meeting_notes_deleted_at ON meeting_notes(deleted_at);

-- ============================================================
-- 4. meeting_decisions TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS meeting_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES meeting_notes(id) ON DELETE CASCADE,
  decision text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE meeting_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_meeting_decisions" ON meeting_decisions;
CREATE POLICY "select_meeting_decisions" ON meeting_decisions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_meeting_decisions" ON meeting_decisions;
CREATE POLICY "insert_meeting_decisions" ON meeting_decisions FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_meeting_decisions" ON meeting_decisions;
CREATE POLICY "update_meeting_decisions" ON meeting_decisions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_meeting_decisions" ON meeting_decisions;
CREATE POLICY "delete_meeting_decisions" ON meeting_decisions FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_meeting_decisions_meeting_id ON meeting_decisions(meeting_id);

-- ============================================================
-- 5. meeting_action_items TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS meeting_action_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES meeting_notes(id) ON DELETE CASCADE,
  task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  description text NOT NULL,
  assignee text,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE meeting_action_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_meeting_action_items" ON meeting_action_items;
CREATE POLICY "select_meeting_action_items" ON meeting_action_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_meeting_action_items" ON meeting_action_items;
CREATE POLICY "insert_meeting_action_items" ON meeting_action_items FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_meeting_action_items" ON meeting_action_items;
CREATE POLICY "update_meeting_action_items" ON meeting_action_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_meeting_action_items" ON meeting_action_items;
CREATE POLICY "delete_meeting_action_items" ON meeting_action_items FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_meeting_action_items_meeting_id ON meeting_action_items(meeting_id);

-- ============================================================
-- 6. project_notes TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS project_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text,
  category text NOT NULL DEFAULT 'miscellaneous' CHECK (category IN ('technical', 'business', 'client', 'internal', 'deployment', 'miscellaneous')),
  tags text[] DEFAULT '{}',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE project_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_project_notes" ON project_notes;
CREATE POLICY "select_project_notes" ON project_notes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_project_notes" ON project_notes;
CREATE POLICY "insert_project_notes" ON project_notes FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_project_notes" ON project_notes;
CREATE POLICY "update_project_notes" ON project_notes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_project_notes" ON project_notes;
CREATE POLICY "delete_project_notes" ON project_notes FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_project_notes_project_id ON project_notes(project_id);
CREATE INDEX IF NOT EXISTS idx_project_notes_category ON project_notes(category);
CREATE INDEX IF NOT EXISTS idx_project_notes_deleted_at ON project_notes(deleted_at);
