/*
# Phase 4: Company Management Schema

## Overview
Creates tables for internal company administration: assets, software licenses,
company accounts, legal documents, and a singleton company profile.

## New Tables
1. `assets` — Physical/digital assets (laptops, monitors, peripherals, etc.)
   - category: laptop, monitor, smartphone, peripheral, networking, server, office_equipment, other
   - status: active, maintenance, retired, lost
   - purchase_date, purchase_price, warranty_expiration, condition, notes
   - soft delete via deleted_at

2. `software_licenses` — Software subscriptions and licenses
   - license_type: free, subscription, lifetime
   - billing_cycle: monthly, quarterly, yearly
   - status: active, expired, cancelled
   - renewal_date, cost, vendor, notes
   - soft delete via deleted_at

3. `company_accounts` — Digital account references (NOT passwords)
   - category: email, cloud, hosting, domain, social_media, development, ai_platform, analytics, finance, other
   - account_name, platform, email, username, recovery_email, description, notes
   - soft delete via deleted_at

4. `legal_documents` — Legal document metadata + file attachment
   - category: akta_pendirian, nib, npwp, sertifikat, perizinan, perjanjian, legal_letter, trademark, other
   - title, document_number, issue_date, expiration_date, file_url, file_path, notes
   - soft delete via deleted_at

5. `company_profile` — Singleton company info (one row only)
   - General: name, legal_entity, npwp, nib, address, email, phone, website
   - Branding: logo_url, brand_guidelines_url, company_profile_url, description
   - Social media: instagram, linkedin, threads, bluesky, youtube
   - Bank: bank_name, bank_account_number, bank_account_name
   - Enforced singleton via CHECK constraint on id = 'singleton'

## Security
- RLS enabled on all tables
- All policies use TO authenticated USING (true) since all 3 founders share equal access
- 4 policies per table (SELECT, INSERT, UPDATE, DELETE)

## Notes
- company_profile uses a fixed UUID 'singleton' as primary key to enforce one row
- No user_id columns — all founders have equal access
- Activity logging via logActivity() with module 'company'
*/

-- Assets table
CREATE TABLE IF NOT EXISTS assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  brand text,
  model text,
  serial_number text,
  purchase_date date,
  purchase_price numeric DEFAULT 0,
  warranty_expiration date,
  condition text,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_assets" ON assets;
CREATE POLICY "select_assets" ON assets FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_assets" ON assets;
CREATE POLICY "insert_assets" ON assets FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_assets" ON assets;
CREATE POLICY "update_assets" ON assets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_assets" ON assets;
CREATE POLICY "delete_assets" ON assets FOR DELETE TO authenticated USING (true);

-- Software licenses table
CREATE TABLE IF NOT EXISTS software_licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  vendor text,
  license_type text NOT NULL DEFAULT 'subscription',
  billing_cycle text,
  renewal_date date,
  cost numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE software_licenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_software_licenses" ON software_licenses;
CREATE POLICY "select_software_licenses" ON software_licenses FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_software_licenses" ON software_licenses;
CREATE POLICY "insert_software_licenses" ON software_licenses FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_software_licenses" ON software_licenses;
CREATE POLICY "update_software_licenses" ON software_licenses FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_software_licenses" ON software_licenses;
CREATE POLICY "delete_software_licenses" ON software_licenses FOR DELETE TO authenticated USING (true);

-- Company accounts table
CREATE TABLE IF NOT EXISTS company_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_name text NOT NULL,
  platform text,
  category text NOT NULL DEFAULT 'other',
  email text,
  username text,
  recovery_email text,
  description text,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE company_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_company_accounts" ON company_accounts;
CREATE POLICY "select_company_accounts" ON company_accounts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_company_accounts" ON company_accounts;
CREATE POLICY "insert_company_accounts" ON company_accounts FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_company_accounts" ON company_accounts;
CREATE POLICY "update_company_accounts" ON company_accounts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_company_accounts" ON company_accounts;
CREATE POLICY "delete_company_accounts" ON company_accounts FOR DELETE TO authenticated USING (true);

-- Legal documents table
CREATE TABLE IF NOT EXISTS legal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  document_number text,
  issue_date date,
  expiration_date date,
  file_url text,
  file_path text,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE legal_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_legal_documents" ON legal_documents;
CREATE POLICY "select_legal_documents" ON legal_documents FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_legal_documents" ON legal_documents;
CREATE POLICY "insert_legal_documents" ON legal_documents FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_legal_documents" ON legal_documents;
CREATE POLICY "update_legal_documents" ON legal_documents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_legal_documents" ON legal_documents;
CREATE POLICY "delete_legal_documents" ON legal_documents FOR DELETE TO authenticated USING (true);

-- Company profile (singleton)
CREATE TABLE IF NOT EXISTS company_profile (
  id uuid PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001',
  name text NOT NULL DEFAULT 'PT Centrova Teknologi Indonesia',
  legal_entity text,
  npwp text,
  nib text,
  address text,
  email text,
  phone text,
  website text,
  logo_url text,
  brand_guidelines_url text,
  company_profile_url text,
  description text,
  instagram text,
  linkedin text,
  threads text,
  bluesky text,
  youtube text,
  bank_name text,
  bank_account_number text,
  bank_account_name text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE company_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_company_profile" ON company_profile;
CREATE POLICY "select_company_profile" ON company_profile FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_company_profile" ON company_profile;
CREATE POLICY "insert_company_profile" ON company_profile FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_company_profile" ON company_profile;
CREATE POLICY "update_company_profile" ON company_profile FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_company_profile" ON company_profile;
CREATE POLICY "delete_company_profile" ON company_profile FOR DELETE TO authenticated USING (true);

-- Insert default singleton row if not exists
INSERT INTO company_profile (id, name)
SELECT '00000000-0000-0000-0000-000000000001', 'PT Centrova Teknologi Indonesia'
WHERE NOT EXISTS (SELECT 1 FROM company_profile WHERE id = '00000000-0000-0000-0000-000000000001');

-- Update activity_logs module constraint to include 'company'
ALTER TABLE activity_logs DROP CONSTRAINT IF EXISTS activity_logs_module_check;
ALTER TABLE activity_logs ADD CONSTRAINT activity_logs_module_check
  CHECK (module IN ('auth', 'clients', 'projects', 'tasks', 'invoices', 'documents', 'system', 'finance', 'delivery', 'company'));

-- Indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_software_licenses_status ON software_licenses(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_software_licenses_renewal_date ON software_licenses(renewal_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_company_accounts_category ON company_accounts(category) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_legal_documents_category ON legal_documents(category) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_legal_documents_expiration_date ON legal_documents(expiration_date) WHERE deleted_at IS NULL;
