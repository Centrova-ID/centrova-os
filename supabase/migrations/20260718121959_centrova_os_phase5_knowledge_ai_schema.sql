/*
# Phase 5: Knowledge & AI Schema

## Overview
Creates tables for the Knowledge Management system and AI Assistant features.

## New Tables
1. `knowledge_articles` — Internal knowledge base articles
   - category: sop, workflow, technical, business, deployment, internal_notes, best_practice, faq
   - status: draft | published
   - content stored as markdown text
   - supports tags (text[]), related project/client foreign keys
   - soft delete via deleted_at

2. `templates` — Company document templates
   - category: proposal, invoice, quotation, mou, nda, contract, meeting_notes, email, project_checklist
   - content stored as markdown/rich text
   - is_active flag for archiving
   - soft delete via deleted_at

3. `service_catalog` — Service/pricing catalog items (evolved template concept from PRD)
   - billing_type: one_time, weekly, monthly, quarterly, yearly, custom
   - category: website, web_app, mobile_app, maintenance, hosting, consulting, ai, design, other
   - default_price, unit, description, notes
   - is_active flag
   - soft delete via deleted_at

4. `ai_settings` — Singleton AI provider configuration
   - provider, model_name, base_url, api_key (protected by RLS)
   - max_tokens, temperature, top_p, system_prompt
   - Fixed UUID singleton row

5. `ai_chats` — AI chat sessions
   - title, is_favorite, created_by
   - soft delete via deleted_at

6. `ai_messages` — Messages within a chat session
   - chat_id (FK → ai_chats), role (user/assistant/system)
   - content (text), created_at

## Security
- RLS enabled on all tables
- TO authenticated USING (true) — all founders share equal access
- 4 policies per table (SELECT/INSERT/UPDATE/DELETE)
- api_key in ai_settings is protected by RLS (authenticated only)

## Activity Log
- Module constraint extended to include 'knowledge' and 'ai'
*/

-- Knowledge articles
CREATE TABLE IF NOT EXISTS knowledge_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'internal_notes',
  tags text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft',
  related_project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  related_client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  views int DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE knowledge_articles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_knowledge_articles" ON knowledge_articles;
CREATE POLICY "select_knowledge_articles" ON knowledge_articles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_knowledge_articles" ON knowledge_articles;
CREATE POLICY "insert_knowledge_articles" ON knowledge_articles FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_knowledge_articles" ON knowledge_articles;
CREATE POLICY "update_knowledge_articles" ON knowledge_articles FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_knowledge_articles" ON knowledge_articles;
CREATE POLICY "delete_knowledge_articles" ON knowledge_articles FOR DELETE TO authenticated USING (true);

-- Templates
CREATE TABLE IF NOT EXISTS templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'proposal',
  content text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_templates" ON templates;
CREATE POLICY "select_templates" ON templates FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_templates" ON templates;
CREATE POLICY "insert_templates" ON templates FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_templates" ON templates;
CREATE POLICY "update_templates" ON templates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_templates" ON templates;
CREATE POLICY "delete_templates" ON templates FOR DELETE TO authenticated USING (true);

-- Service catalog
CREATE TABLE IF NOT EXISTS service_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'website',
  billing_type text NOT NULL DEFAULT 'one_time',
  default_price numeric NOT NULL DEFAULT 0,
  unit text DEFAULT 'project',
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE service_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_service_catalog" ON service_catalog;
CREATE POLICY "select_service_catalog" ON service_catalog FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_service_catalog" ON service_catalog;
CREATE POLICY "insert_service_catalog" ON service_catalog FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_service_catalog" ON service_catalog;
CREATE POLICY "update_service_catalog" ON service_catalog FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_service_catalog" ON service_catalog;
CREATE POLICY "delete_service_catalog" ON service_catalog FOR DELETE TO authenticated USING (true);

-- AI settings (singleton)
CREATE TABLE IF NOT EXISTS ai_settings (
  id uuid PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000002',
  provider text NOT NULL DEFAULT 'deepseek',
  model_name text NOT NULL DEFAULT 'deepseek-chat',
  base_url text NOT NULL DEFAULT 'https://api.deepseek.com',
  api_key text,
  max_tokens int NOT NULL DEFAULT 4096,
  temperature numeric NOT NULL DEFAULT 0.7,
  top_p numeric NOT NULL DEFAULT 0.9,
  system_prompt text NOT NULL DEFAULT 'Kamu adalah AI Assistant untuk Centrova OS, sistem manajemen operasional PT Centrova Teknologi Indonesia. Kamu memahami seluruh data operasional perusahaan termasuk klien, proyek, keuangan, dan administrasi. Jawab dalam bahasa Indonesia secara ringkas, akurat, dan profesional.',
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_ai_settings" ON ai_settings;
CREATE POLICY "select_ai_settings" ON ai_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_ai_settings" ON ai_settings;
CREATE POLICY "insert_ai_settings" ON ai_settings FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_ai_settings" ON ai_settings;
CREATE POLICY "update_ai_settings" ON ai_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_ai_settings" ON ai_settings;
CREATE POLICY "delete_ai_settings" ON ai_settings FOR DELETE TO authenticated USING (true);

-- Insert default singleton row
INSERT INTO ai_settings (id)
SELECT '00000000-0000-0000-0000-000000000002'
WHERE NOT EXISTS (SELECT 1 FROM ai_settings WHERE id = '00000000-0000-0000-0000-000000000002');

-- AI chats
CREATE TABLE IF NOT EXISTS ai_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'New Chat',
  is_favorite boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE ai_chats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_ai_chats" ON ai_chats;
CREATE POLICY "select_ai_chats" ON ai_chats FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_ai_chats" ON ai_chats;
CREATE POLICY "insert_ai_chats" ON ai_chats FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_ai_chats" ON ai_chats;
CREATE POLICY "update_ai_chats" ON ai_chats FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_ai_chats" ON ai_chats;
CREATE POLICY "delete_ai_chats" ON ai_chats FOR DELETE TO authenticated USING (true);

-- AI messages
CREATE TABLE IF NOT EXISTS ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES ai_chats(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'user',
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_ai_messages" ON ai_messages;
CREATE POLICY "select_ai_messages" ON ai_messages FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_ai_messages" ON ai_messages;
CREATE POLICY "insert_ai_messages" ON ai_messages FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_ai_messages" ON ai_messages;
CREATE POLICY "update_ai_messages" ON ai_messages FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_ai_messages" ON ai_messages;
CREATE POLICY "delete_ai_messages" ON ai_messages FOR DELETE TO authenticated USING (true);

-- Extend activity_logs module constraint
ALTER TABLE activity_logs DROP CONSTRAINT IF EXISTS activity_logs_module_check;
ALTER TABLE activity_logs ADD CONSTRAINT activity_logs_module_check
  CHECK (module IN ('auth','clients','projects','tasks','invoices','documents','system','finance','delivery','company','knowledge','ai'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_category ON knowledge_articles(category) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_status ON knowledge_articles(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_service_catalog_category ON service_catalog(category) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ai_chats_created_by ON ai_chats(created_by) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ai_messages_chat_id ON ai_messages(chat_id);
