
/*
# Centrova OS Phase 1 — Complete Database Schema

## Overview
Full schema for Centrova OS internal operations system. Covers 7 modules:
Client Management, Project Management, Task Management, Document Center,
Invoice Management, Activity Log, and supporting profile data.

## New Tables
1. `profiles` - Founder profiles linked to auth.users
2. `clients` - Client database with status tracking
3. `client_timeline` - Timeline events per client
4. `projects` - Project management with status & progress
5. `milestones` - Project milestones
6. `tasks` - Task management linked to projects
7. `subtasks` - Sub-tasks within tasks
8. `task_checklists` - Checklist items within tasks
9. `documents` - Document metadata (files stored in Supabase Storage)
10. `invoices` - Invoice management
11. `invoice_items` - Line items per invoice
12. `activity_logs` - Full audit trail of all user actions

## Security
All tables use RLS. Since all 3 founders share equal access to all data,
policies use `TO authenticated USING (true)` — any signed-in user can
read and write any row. No row-level isolation between users.

## Notes
- Soft delete via `deleted_at` on clients, projects, invoices, documents
- Invoice number auto-generation via DB function
- All timestamps in UTC (timestamptz)
- Indexes on frequently queried FK columns and status fields
*/

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_profiles" ON profiles;
CREATE POLICY "auth_select_profiles" ON profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_profiles" ON profiles;
CREATE POLICY "auth_insert_profiles" ON profiles FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_profiles" ON profiles;
CREATE POLICY "auth_update_profiles" ON profiles FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_profiles" ON profiles;
CREATE POLICY "auth_delete_profiles" ON profiles FOR DELETE TO authenticated USING (true);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.email, '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ============================================================
-- CLIENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  pic_name text,
  email text,
  whatsapp text,
  website text,
  industry text,
  address text,
  notes text,
  status text NOT NULL DEFAULT 'prospect' CHECK (status IN ('prospect', 'active', 'completed', 'inactive')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_clients_created_by ON clients(created_by);
CREATE INDEX IF NOT EXISTS idx_clients_deleted_at ON clients(deleted_at);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_clients" ON clients;
CREATE POLICY "auth_select_clients" ON clients FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_clients" ON clients;
CREATE POLICY "auth_insert_clients" ON clients FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_clients" ON clients;
CREATE POLICY "auth_update_clients" ON clients FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_clients" ON clients;
CREATE POLICY "auth_delete_clients" ON clients FOR DELETE TO authenticated USING (true);


-- ============================================================
-- CLIENT TIMELINE
-- ============================================================
CREATE TABLE IF NOT EXISTS client_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('meeting', 'proposal', 'negotiation', 'agreement', 'note')),
  title text NOT NULL,
  description text,
  event_date date DEFAULT CURRENT_DATE,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_timeline_client_id ON client_timeline(client_id);

ALTER TABLE client_timeline ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_client_timeline" ON client_timeline;
CREATE POLICY "auth_select_client_timeline" ON client_timeline FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_client_timeline" ON client_timeline;
CREATE POLICY "auth_insert_client_timeline" ON client_timeline FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_client_timeline" ON client_timeline;
CREATE POLICY "auth_update_client_timeline" ON client_timeline FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_client_timeline" ON client_timeline;
CREATE POLICY "auth_delete_client_timeline" ON client_timeline FOR DELETE TO authenticated USING (true);


-- ============================================================
-- PROJECTS
-- ============================================================
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  client_id uuid REFERENCES clients(id),
  service text,
  description text,
  start_date date,
  deadline date,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status text NOT NULL DEFAULT 'discovery' CHECK (status IN ('discovery', 'planning', 'development', 'testing', 'deployment', 'maintenance', 'completed')),
  progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_deadline ON projects(deadline) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_deleted_at ON projects(deleted_at);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_projects" ON projects;
CREATE POLICY "auth_select_projects" ON projects FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_projects" ON projects;
CREATE POLICY "auth_insert_projects" ON projects FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_projects" ON projects;
CREATE POLICY "auth_update_projects" ON projects FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_projects" ON projects;
CREATE POLICY "auth_delete_projects" ON projects FOR DELETE TO authenticated USING (true);


-- ============================================================
-- MILESTONES
-- ============================================================
CREATE TABLE IF NOT EXISTS milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  deadline date,
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_milestones_project_id ON milestones(project_id);

ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_milestones" ON milestones;
CREATE POLICY "auth_select_milestones" ON milestones FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_milestones" ON milestones;
CREATE POLICY "auth_insert_milestones" ON milestones FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_milestones" ON milestones;
CREATE POLICY "auth_update_milestones" ON milestones FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_milestones" ON milestones;
CREATE POLICY "auth_delete_milestones" ON milestones FOR DELETE TO authenticated USING (true);


-- ============================================================
-- TASKS
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  deadline date,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  assignee uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'review', 'done')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_tasks" ON tasks;
CREATE POLICY "auth_select_tasks" ON tasks FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_tasks" ON tasks;
CREATE POLICY "auth_insert_tasks" ON tasks FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_tasks" ON tasks;
CREATE POLICY "auth_update_tasks" ON tasks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_tasks" ON tasks;
CREATE POLICY "auth_delete_tasks" ON tasks FOR DELETE TO authenticated USING (true);


-- ============================================================
-- SUBTASKS
-- ============================================================
CREATE TABLE IF NOT EXISTS subtasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON subtasks(task_id);

ALTER TABLE subtasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_subtasks" ON subtasks;
CREATE POLICY "auth_select_subtasks" ON subtasks FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_subtasks" ON subtasks;
CREATE POLICY "auth_insert_subtasks" ON subtasks FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_subtasks" ON subtasks;
CREATE POLICY "auth_update_subtasks" ON subtasks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_subtasks" ON subtasks;
CREATE POLICY "auth_delete_subtasks" ON subtasks FOR DELETE TO authenticated USING (true);


-- ============================================================
-- TASK CHECKLISTS
-- ============================================================
CREATE TABLE IF NOT EXISTS task_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_checklists_task_id ON task_checklists(task_id);

ALTER TABLE task_checklists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_task_checklists" ON task_checklists;
CREATE POLICY "auth_select_task_checklists" ON task_checklists FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_task_checklists" ON task_checklists;
CREATE POLICY "auth_insert_task_checklists" ON task_checklists FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_task_checklists" ON task_checklists;
CREATE POLICY "auth_update_task_checklists" ON task_checklists FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_task_checklists" ON task_checklists;
CREATE POLICY "auth_delete_task_checklists" ON task_checklists FOR DELETE TO authenticated USING (true);


-- ============================================================
-- INVOICES
-- ============================================================
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE NOT NULL,
  client_id uuid REFERENCES clients(id),
  project_id uuid REFERENCES projects(id),
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  subtotal numeric(15,2) NOT NULL DEFAULT 0,
  discount numeric(15,2) NOT NULL DEFAULT 0,
  tax_rate numeric(5,2) NOT NULL DEFAULT 0,
  tax_amount numeric(15,2) NOT NULL DEFAULT 0,
  total numeric(15,2) NOT NULL DEFAULT 0,
  notes text,
  payment_notes text,
  payment_proof_url text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_project_id ON invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_invoices_deleted_at ON invoices(deleted_at);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_invoices" ON invoices;
CREATE POLICY "auth_select_invoices" ON invoices FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_invoices" ON invoices;
CREATE POLICY "auth_insert_invoices" ON invoices FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_invoices" ON invoices;
CREATE POLICY "auth_update_invoices" ON invoices FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_invoices" ON invoices;
CREATE POLICY "auth_delete_invoices" ON invoices FOR DELETE TO authenticated USING (true);

-- Function to generate next invoice number
CREATE OR REPLACE FUNCTION get_next_invoice_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  next_num integer;
  current_year text;
BEGIN
  current_year := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX(
    CASE
      WHEN invoice_number ~ ('^INV-' || current_year || '-\d+$')
      THEN substring(invoice_number from '\d+$')::integer
      ELSE 0
    END
  ), 0) + 1
  INTO next_num
  FROM invoices
  WHERE deleted_at IS NULL;
  RETURN 'INV-' || current_year || '-' || lpad(next_num::text, 3, '0');
END;
$$;


-- ============================================================
-- INVOICE ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  unit_price numeric(15,2) NOT NULL DEFAULT 0,
  discount numeric(5,2) NOT NULL DEFAULT 0,
  total numeric(15,2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);

ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_invoice_items" ON invoice_items;
CREATE POLICY "auth_select_invoice_items" ON invoice_items FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_invoice_items" ON invoice_items;
CREATE POLICY "auth_insert_invoice_items" ON invoice_items FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_invoice_items" ON invoice_items;
CREATE POLICY "auth_update_invoice_items" ON invoice_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_invoice_items" ON invoice_items;
CREATE POLICY "auth_delete_invoice_items" ON invoice_items FOR DELETE TO authenticated USING (true);


-- ============================================================
-- DOCUMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  original_name text,
  file_url text NOT NULL,
  file_path text,
  file_size bigint,
  file_type text,
  category text NOT NULL DEFAULT 'internal' CHECK (category IN ('client', 'proposal', 'contract', 'nda', 'invoice', 'legal', 'internal')),
  client_id uuid REFERENCES clients(id),
  project_id uuid REFERENCES projects(id),
  invoice_id uuid REFERENCES invoices(id),
  tags text[] DEFAULT '{}',
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_client_id ON documents(client_id);
CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_deleted_at ON documents(deleted_at);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_documents" ON documents;
CREATE POLICY "auth_select_documents" ON documents FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_documents" ON documents;
CREATE POLICY "auth_insert_documents" ON documents FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_documents" ON documents;
CREATE POLICY "auth_update_documents" ON documents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_documents" ON documents;
CREATE POLICY "auth_delete_documents" ON documents FOR DELETE TO authenticated USING (true);


-- ============================================================
-- ACTIVITY LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  module text NOT NULL CHECK (module IN ('auth', 'clients', 'projects', 'tasks', 'invoices', 'documents', 'system')),
  activity_type text NOT NULL,
  description text NOT NULL,
  entity_id uuid,
  entity_type text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_module ON activity_logs(module);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_activity_logs" ON activity_logs;
CREATE POLICY "auth_select_activity_logs" ON activity_logs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_activity_logs" ON activity_logs;
CREATE POLICY "auth_insert_activity_logs" ON activity_logs FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_activity_logs" ON activity_logs;
CREATE POLICY "auth_update_activity_logs" ON activity_logs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_activity_logs" ON activity_logs;
CREATE POLICY "auth_delete_activity_logs" ON activity_logs FOR DELETE TO authenticated USING (true);


-- ============================================================
-- STORAGE BUCKET FOR DOCUMENTS
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('documents', 'documents', false, 52428800)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated can upload documents" ON storage.objects;
CREATE POLICY "Authenticated can upload documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documents');

DROP POLICY IF EXISTS "Authenticated can read documents" ON storage.objects;
CREATE POLICY "Authenticated can read documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'documents');

DROP POLICY IF EXISTS "Authenticated can update documents" ON storage.objects;
CREATE POLICY "Authenticated can update documents"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'documents');

DROP POLICY IF EXISTS "Authenticated can delete documents" ON storage.objects;
CREATE POLICY "Authenticated can delete documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'documents');
