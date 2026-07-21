-- Centrova OS MySQL Schema
-- Execute this to create the database and tables

CREATE DATABASE IF NOT EXISTS centrova_os CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE centrova_os;

-- ============================================================
-- USERS (replaces Supabase auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL DEFAULT '',
  avatar_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id VARCHAR(36) PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================
-- CLIENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS clients (
  id VARCHAR(36) PRIMARY KEY,
  company_name TEXT NOT NULL,
  pic_name TEXT,
  email TEXT,
  whatsapp TEXT,
  website TEXT,
  industry TEXT,
  address TEXT,
  notes TEXT,
  status ENUM('prospect','active','completed','inactive') NOT NULL DEFAULT 'prospect',
  created_by VARCHAR(36),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX idx_clients_status ON clients(status);
CREATE INDEX idx_clients_deleted_at ON clients(deleted_at);

-- ============================================================
-- CLIENT TIMELINE
-- ============================================================
CREATE TABLE IF NOT EXISTS client_timeline (
  id VARCHAR(36) PRIMARY KEY,
  client_id VARCHAR(36) NOT NULL,
  type ENUM('meeting','proposal','negotiation','agreement','note') NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE DEFAULT (CURRENT_DATE),
  created_by VARCHAR(36),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX idx_client_timeline_client_id ON client_timeline(client_id);

-- ============================================================
-- PROJECTS
-- ============================================================
CREATE TABLE IF NOT EXISTS projects (
  id VARCHAR(36) PRIMARY KEY,
  name TEXT NOT NULL,
  client_id VARCHAR(36),
  service TEXT,
  description TEXT,
  start_date DATE,
  deadline DATE,
  priority ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
  status ENUM('discovery','planning','development','testing','deployment','maintenance','completed') NOT NULL DEFAULT 'discovery',
  progress INT NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  created_by VARCHAR(36),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_client_id ON projects(client_id);
CREATE INDEX idx_projects_deleted_at ON projects(deleted_at);

-- ============================================================
-- MILESTONES
-- ============================================================
CREATE TABLE IF NOT EXISTS milestones (
  id VARCHAR(36) PRIMARY KEY,
  project_id VARCHAR(36) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  deadline DATE,
  status ENUM('planned','in_progress','review','completed','cancelled') NOT NULL DEFAULT 'planned',
  progress INT NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX idx_milestones_project_id ON milestones(project_id);

-- ============================================================
-- DELIVERABLES
-- ============================================================
CREATE TABLE IF NOT EXISTS deliverables (
  id VARCHAR(36) PRIMARY KEY,
  project_id VARCHAR(36) NOT NULL,
  milestone_id VARCHAR(36),
  name TEXT NOT NULL,
  description TEXT,
  type ENUM('website','web_app','mobile_app','ui_design','api','documentation','other') NOT NULL DEFAULT 'other',
  due_date DATE,
  status ENUM('pending','in_development','ready_for_review','approved','delivered') NOT NULL DEFAULT 'pending',
  notes TEXT,
  link_url TEXT,
  file_path TEXT,
  file_url TEXT,
  created_by VARCHAR(36),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (milestone_id) REFERENCES milestones(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX idx_deliverables_project_id ON deliverables(project_id);

-- ============================================================
-- MEETING NOTES
-- ============================================================
CREATE TABLE IF NOT EXISTS meeting_notes (
  id VARCHAR(36) PRIMARY KEY,
  project_id VARCHAR(36) NOT NULL,
  title TEXT NOT NULL,
  meeting_date DATE NOT NULL,
  location TEXT,
  participants JSON DEFAULT ('[]'),
  notes TEXT,
  created_by VARCHAR(36),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX idx_meeting_notes_project_id ON meeting_notes(project_id);

-- ============================================================
-- MEETING DECISIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS meeting_decisions (
  id VARCHAR(36) PRIMARY KEY,
  meeting_id VARCHAR(36) NOT NULL,
  decision TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (meeting_id) REFERENCES meeting_notes(id) ON DELETE CASCADE
);

-- ============================================================
-- MEETING ACTION ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS meeting_action_items (
  id VARCHAR(36) PRIMARY KEY,
  meeting_id VARCHAR(36) NOT NULL,
  task_id VARCHAR(36),
  description TEXT NOT NULL,
  assignee TEXT,
  completed BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (meeting_id) REFERENCES meeting_notes(id) ON DELETE CASCADE
);

-- ============================================================
-- PROJECT NOTES
-- ============================================================
CREATE TABLE IF NOT EXISTS project_notes (
  id VARCHAR(36) PRIMARY KEY,
  project_id VARCHAR(36) NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  category ENUM('technical','business','client','internal','deployment','miscellaneous') NOT NULL DEFAULT 'miscellaneous',
  tags JSON DEFAULT ('[]'),
  created_by VARCHAR(36),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- ============================================================
-- TASKS
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
  id VARCHAR(36) PRIMARY KEY,
  project_id VARCHAR(36),
  title TEXT NOT NULL,
  description TEXT,
  deadline DATE,
  priority ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
  assignee VARCHAR(36),
  status ENUM('todo','in_progress','review','done') NOT NULL DEFAULT 'todo',
  created_by VARCHAR(36),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (assignee) REFERENCES users(id)
);

CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_assignee ON tasks(assignee);

-- ============================================================
-- SUBTASKS
-- ============================================================
CREATE TABLE IF NOT EXISTS subtasks (
  id VARCHAR(36) PRIMARY KEY,
  task_id VARCHAR(36) NOT NULL,
  title TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- ============================================================
-- TASK CHECKLISTS
-- ============================================================
CREATE TABLE IF NOT EXISTS task_checklists (
  id VARCHAR(36) PRIMARY KEY,
  task_id VARCHAR(36) NOT NULL,
  title TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- ============================================================
-- INVOICES
-- ============================================================
CREATE TABLE IF NOT EXISTS invoices (
  id VARCHAR(36) PRIMARY KEY,
  invoice_number VARCHAR(100) NOT NULL,
  client_id VARCHAR(36),
  project_id VARCHAR(36),
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status ENUM('draft','sent','paid','overdue','cancelled') NOT NULL DEFAULT 'draft',
  subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
  discount DECIMAL(15,2) NOT NULL DEFAULT 0,
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  total DECIMAL(15,2) NOT NULL DEFAULT 0,
  notes TEXT,
  payment_notes TEXT,
  payment_proof_url TEXT,
  created_by VARCHAR(36),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_client_id ON invoices(client_id);

-- ============================================================
-- INVOICE ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS invoice_items (
  id VARCHAR(36) PRIMARY KEY,
  invoice_id VARCHAR(36) NOT NULL,
  description TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(15,2) NOT NULL DEFAULT 0,
  discount DECIMAL(15,2) NOT NULL DEFAULT 0,
  total DECIMAL(15,2) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

-- ============================================================
-- DOCUMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS documents (
  id VARCHAR(36) PRIMARY KEY,
  name TEXT NOT NULL,
  original_name TEXT,
  file_url TEXT NOT NULL,
  file_path TEXT,
  file_size BIGINT,
  file_type TEXT,
  category ENUM('client','proposal','contract','nda','invoice','legal','internal') NOT NULL DEFAULT 'internal',
  client_id VARCHAR(36),
  project_id VARCHAR(36),
  invoice_id VARCHAR(36),
  tags JSON DEFAULT ('[]'),
  uploaded_by VARCHAR(36),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

-- ============================================================
-- ACTIVITY LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36),
  module VARCHAR(255) NOT NULL,
  activity_type VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  entity_id VARCHAR(255),
  entity_type VARCHAR(255),
  metadata JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_module ON activity_logs(module);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at);

-- ============================================================
-- TRANSACTIONS (Finance)
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
  id VARCHAR(36) PRIMARY KEY,
  type ENUM('income','expense') NOT NULL,
  category VARCHAR(255) NOT NULL DEFAULT 'General',
  description TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL CHECK (amount >= 0),
  transaction_date DATE NOT NULL,
  reference TEXT,
  client_id VARCHAR(36),
  project_id VARCHAR(36),
  invoice_id VARCHAR(36),
  payment_method ENUM('bank_transfer','cash','qris','card','other') NOT NULL DEFAULT 'bank_transfer',
  status ENUM('completed','pending') NOT NULL DEFAULT 'completed',
  created_by VARCHAR(36),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- RECURRING EXPENSES
-- ============================================================
CREATE TABLE IF NOT EXISTS recurring_expenses (
  id VARCHAR(36) PRIMARY KEY,
  name TEXT NOT NULL,
  category ENUM('operational','software','hardware','salary','marketing','tax','office','travel','other') NOT NULL DEFAULT 'operational',
  description TEXT,
  vendor TEXT,
  amount DECIMAL(15,2) NOT NULL,
  frequency ENUM('daily','weekly','monthly','quarterly','yearly') NOT NULL,
  start_date DATE NOT NULL,
  next_due_date DATE NOT NULL,
  end_date DATE,
  payment_method ENUM('bank_transfer','cash','qris','card','other') NOT NULL DEFAULT 'bank_transfer',
  is_active BOOLEAN DEFAULT TRUE,
  created_by VARCHAR(36),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- EXPENSES
-- ============================================================
CREATE TABLE IF NOT EXISTS expenses (
  id VARCHAR(36) PRIMARY KEY,
  category ENUM('operational','software','hardware','salary','marketing','tax','office','travel','other') NOT NULL DEFAULT 'operational',
  description TEXT NOT NULL,
  vendor TEXT,
  amount DECIMAL(15,2) NOT NULL,
  expense_date DATE NOT NULL,
  payment_method ENUM('bank_transfer','cash','qris','card','other') NOT NULL DEFAULT 'bank_transfer',
  receipt_url TEXT,
  receipt_file_path TEXT,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurring_expense_id VARCHAR(36),
  created_by VARCHAR(36),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  FOREIGN KEY (recurring_expense_id) REFERENCES recurring_expenses(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- ASSETS
-- ============================================================
CREATE TABLE IF NOT EXISTS assets (
  id VARCHAR(36) PRIMARY KEY,
  name TEXT NOT NULL,
  category ENUM('laptop','monitor','smartphone','peripheral','networking','server','office_equipment','other') NOT NULL DEFAULT 'other',
  brand TEXT,
  model TEXT,
  serial_number TEXT,
  purchase_date DATE,
  purchase_price DECIMAL(15,2) DEFAULT 0,
  warranty_expiration DATE,
  `condition` TEXT,
  status ENUM('active','maintenance','retired','lost') NOT NULL DEFAULT 'active',
  notes TEXT,
  created_by VARCHAR(36),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- SOFTWARE LICENSES
-- ============================================================
CREATE TABLE IF NOT EXISTS software_licenses (
  id VARCHAR(36) PRIMARY KEY,
  name TEXT NOT NULL,
  vendor TEXT,
  license_type ENUM('free','subscription','lifetime') NOT NULL DEFAULT 'subscription',
  billing_cycle ENUM('monthly','quarterly','yearly'),
  renewal_date DATE,
  cost DECIMAL(15,2) DEFAULT 0,
  status ENUM('active','expired','cancelled') NOT NULL DEFAULT 'active',
  notes TEXT,
  created_by VARCHAR(36),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- COMPANY ACCOUNTS
-- ============================================================
CREATE TABLE IF NOT EXISTS company_accounts (
  id VARCHAR(36) PRIMARY KEY,
  category ENUM('email','cloud','hosting','domain','social_media','development','ai_platform','analytics','finance','other') NOT NULL DEFAULT 'other',
  account_name TEXT NOT NULL,
  platform TEXT,
  email TEXT,
  username TEXT,
  recovery_email TEXT,
  description TEXT,
  notes TEXT,
  created_by VARCHAR(36),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- LEGAL DOCUMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS legal_documents (
  id VARCHAR(36) PRIMARY KEY,
  category ENUM('akta_pendirian','nib','npwp','sertifikat','perizinan','perjanjian','legal_letter','trademark','other') NOT NULL DEFAULT 'other',
  title TEXT NOT NULL,
  document_number TEXT,
  issue_date DATE,
  expiration_date DATE,
  file_url TEXT,
  file_path TEXT,
  notes TEXT,
  created_by VARCHAR(36),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- COMPANY PROFILE (singleton)
-- ============================================================
CREATE TABLE IF NOT EXISTS company_profile (
  id VARCHAR(36) PRIMARY KEY DEFAULT 'singleton',
  name TEXT,
  legal_entity TEXT,
  npwp TEXT,
  nib TEXT,
  address TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  logo_url TEXT,
  brand_guidelines_url TEXT,
  company_profile_url TEXT,
  description TEXT,
  instagram TEXT,
  linkedin TEXT,
  threads TEXT,
  bluesky TEXT,
  youtube TEXT,
  bank_name TEXT,
  bank_account_number TEXT,
  bank_account_name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================
-- KNOWLEDGE ARTICLES
-- ============================================================
CREATE TABLE IF NOT EXISTS knowledge_articles (
  id VARCHAR(36) PRIMARY KEY,
  title TEXT NOT NULL,
  content LONGTEXT NOT NULL,
  category ENUM('sop','workflow','technical','business','deployment','internal_notes','best_practice','faq') NOT NULL DEFAULT 'internal_notes',
  tags JSON DEFAULT ('[]'),
  status ENUM('draft','published') NOT NULL DEFAULT 'draft',
  related_project_id VARCHAR(36),
  related_client_id VARCHAR(36),
  views INT DEFAULT 0,
  created_by VARCHAR(36),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  FOREIGN KEY (related_project_id) REFERENCES projects(id) ON DELETE SET NULL,
  FOREIGN KEY (related_client_id) REFERENCES clients(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- TEMPLATES
-- ============================================================
CREATE TABLE IF NOT EXISTS templates (
  id VARCHAR(36) PRIMARY KEY,
  name TEXT NOT NULL,
  category ENUM('proposal','invoice','quotation','mou','nda','contract','meeting_notes','email','project_checklist') NOT NULL DEFAULT 'proposal',
  content LONGTEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_by VARCHAR(36),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- SERVICE CATALOG
-- ============================================================
CREATE TABLE IF NOT EXISTS service_catalog (
  id VARCHAR(36) PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category ENUM('website','web_app','mobile_app','maintenance','hosting','consulting','ai','design','other') NOT NULL DEFAULT 'other',
  billing_type ENUM('one_time','weekly','monthly','quarterly','yearly','custom') NOT NULL DEFAULT 'one_time',
  default_price DECIMAL(15,2) DEFAULT 0,
  unit TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_by VARCHAR(36),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- AI SETTINGS (singleton)
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_settings (
  id VARCHAR(36) PRIMARY KEY DEFAULT 'singleton',
  provider TEXT,
  model_name TEXT,
  base_url TEXT,
  api_key TEXT,
  max_tokens INT DEFAULT 2048,
  temperature DECIMAL(3,2) DEFAULT 0.7,
  top_p DECIMAL(3,2) DEFAULT 1.0,
  system_prompt LONGTEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================
-- AI CHATS
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_chats (
  id VARCHAR(36) PRIMARY KEY,
  title VARCHAR(255) NOT NULL DEFAULT 'New Chat',
  is_favorite BOOLEAN DEFAULT FALSE,
  created_by VARCHAR(36),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- AI MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_messages (
  id VARCHAR(36) PRIMARY KEY,
  chat_id VARCHAR(36) NOT NULL,
  role ENUM('user','assistant','system') NOT NULL,
  content LONGTEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (chat_id) REFERENCES ai_chats(id) ON DELETE CASCADE
);

-- ============================================================
-- FUNCTION: get_next_invoice_number
-- ============================================================
CREATE TABLE IF NOT EXISTS invoice_number_seq (
  id INT PRIMARY KEY AUTO_INCREMENT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
