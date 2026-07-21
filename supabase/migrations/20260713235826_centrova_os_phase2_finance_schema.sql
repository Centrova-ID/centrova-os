/*
# Centrova OS Phase 2 — Finance Module Schema

## Overview
This migration adds the finance module tables for Phase 2 of Centrova OS.
It introduces transaction tracking, revenue management, expense management,
and recurring expense scheduling. Cash balance is always derived from
transactions (income - expense), never stored as a static value.

## New Tables

### 1. transactions
Unified ledger of all cash movements. Each row is either an `income` or `expense` entry.
- `id` (uuid, PK)
- `type` — `income` | `expense`
- `category` — free-text category (e.g. "Invoice Payment", "Software Subscription", "Office Rent")
- `description` (text, not null)
- `amount` (numeric(15,2), not null, always positive)
- `transaction_date` (date, not null)
- `reference` — optional reference text (invoice number, receipt number, etc.)
- `client_id` — FK to clients, nullable (for income linked to a client)
- `project_id` — FK to projects, nullable (for income linked to a project)
- `invoice_id` — FK to invoices, nullable (for invoice payments)
- `payment_method` — `bank_transfer` | `cash` | `qris` | `card` | `other`
- `status` — `completed` | `pending`
- `created_by` — FK to auth.users
- `created_at`, `updated_at`, `deleted_at` (soft delete)

### 2. recurring_expenses
Templates for expenses that repeat on a schedule. Used to auto-generate expense rows.
- `id` (uuid, PK)
- `name` (text, not null)
- `category` — `operational` | `software` | `hardware` | `salary` | `marketing` | `tax` | `office` | `travel` | `other`
- `description` (text, nullable)
- `vendor` (text, nullable)
- `amount` (numeric(15,2), not null)
- `frequency` — `daily` | `weekly` | `monthly` | `quarterly` | `yearly`
- `start_date` (date, not null)
- `next_due_date` (date, not null)
- `end_date` (date, nullable)
- `payment_method` — `bank_transfer` | `cash` | `qris` | `card` | `other`
- `is_active` (boolean, default true)
- `created_by` — FK to auth.users
- `created_at`, `updated_at`

### 3. expenses
Detailed expense records with vendor and receipt support. Each expense also
creates a corresponding row in `transactions` with type='expense'.
- `id` (uuid, PK)
- `category` — `operational` | `software` | `hardware` | `salary` | `marketing` | `tax` | `office` | `travel` | `other`
- `description` (text, not null)
- `vendor` (text, nullable) — supplier/vendor name
- `amount` (numeric(15,2), not null)
- `expense_date` (date, not null)
- `payment_method` — `bank_transfer` | `cash` | `qris` | `card` | `other`
- `receipt_url` — path in Supabase Storage `documents` bucket
- `receipt_file_path` — storage path
- `is_recurring` (boolean, default false) — linked to recurring_expenses
- `recurring_expense_id` — FK to recurring_expenses
- `created_by` — FK to auth.users
- `created_at`, `updated_at`, `deleted_at`

## Security
- RLS enabled on all new tables.
- All policies scoped `TO authenticated` with `USING (true)` because Centrova OS
  is an internal tool shared equally by 3 founders — every authenticated user
  has full access to all finance data (same pattern as Phase 1).
- 4 policies per table (SELECT, INSERT, UPDATE, DELETE).

## Important Notes
1. Cash balance = SUM(amount WHERE type='income' AND status='completed') - SUM(amount WHERE type='expense' AND status='completed')
2. When an invoice is marked as paid, the frontend inserts a transaction with type='income'
   linked to the invoice_id — this is the revenue record.
3. When an expense is created, a corresponding transaction row is also inserted.
4. Receipt files are stored in the existing `documents` Supabase Storage bucket.
5. `get_next_recurring_date()` function calculates the next due date based on frequency.
*/

-- ============================================================
-- 1. TRANSACTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  category text NOT NULL DEFAULT 'General',
  description text NOT NULL,
  amount numeric(15,2) NOT NULL CHECK (amount >= 0),
  transaction_date date NOT NULL,
  reference text,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  payment_method text NOT NULL DEFAULT 'bank_transfer' CHECK (payment_method IN ('bank_transfer', 'cash', 'qris', 'card', 'other')),
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'pending')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_transactions" ON transactions;
CREATE POLICY "select_transactions" ON transactions FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_transactions" ON transactions;
CREATE POLICY "insert_transactions" ON transactions FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_transactions" ON transactions;
CREATE POLICY "update_transactions" ON transactions FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_transactions" ON transactions;
CREATE POLICY "delete_transactions" ON transactions FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_invoice_id ON transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_transactions_client_id ON transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_transactions_deleted_at ON transactions(deleted_at);

-- ============================================================
-- 2. RECURRING_EXPENSES TABLE (created before expenses due to FK)
-- ============================================================
CREATE TABLE IF NOT EXISTS recurring_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'operational' CHECK (category IN ('operational', 'software', 'hardware', 'salary', 'marketing', 'tax', 'office', 'travel', 'other')),
  description text,
  vendor text,
  amount numeric(15,2) NOT NULL CHECK (amount >= 0),
  frequency text NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
  start_date date NOT NULL,
  next_due_date date NOT NULL,
  end_date date,
  payment_method text NOT NULL DEFAULT 'bank_transfer' CHECK (payment_method IN ('bank_transfer', 'cash', 'qris', 'card', 'other')),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE recurring_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_recurring_expenses" ON recurring_expenses;
CREATE POLICY "select_recurring_expenses" ON recurring_expenses FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_recurring_expenses" ON recurring_expenses;
CREATE POLICY "insert_recurring_expenses" ON recurring_expenses FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_recurring_expenses" ON recurring_expenses;
CREATE POLICY "update_recurring_expenses" ON recurring_expenses FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_recurring_expenses" ON recurring_expenses;
CREATE POLICY "delete_recurring_expenses" ON recurring_expenses FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_recurring_expenses_active ON recurring_expenses(is_active);
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_next_due ON recurring_expenses(next_due_date);

-- ============================================================
-- 3. EXPENSES TABLE (references recurring_expenses)
-- ============================================================
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL DEFAULT 'operational' CHECK (category IN ('operational', 'software', 'hardware', 'salary', 'marketing', 'tax', 'office', 'travel', 'other')),
  description text NOT NULL,
  vendor text,
  amount numeric(15,2) NOT NULL CHECK (amount >= 0),
  expense_date date NOT NULL,
  payment_method text NOT NULL DEFAULT 'bank_transfer' CHECK (payment_method IN ('bank_transfer', 'cash', 'qris', 'card', 'other')),
  receipt_url text,
  receipt_file_path text,
  is_recurring boolean NOT NULL DEFAULT false,
  recurring_expense_id uuid REFERENCES recurring_expenses(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_expenses" ON expenses;
CREATE POLICY "select_expenses" ON expenses FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_expenses" ON expenses;
CREATE POLICY "insert_expenses" ON expenses FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_expenses" ON expenses;
CREATE POLICY "update_expenses" ON expenses FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_expenses" ON expenses;
CREATE POLICY "delete_expenses" ON expenses FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_vendor ON expenses(vendor);
CREATE INDEX IF NOT EXISTS idx_expenses_deleted_at ON expenses(deleted_at);
CREATE INDEX IF NOT EXISTS idx_expenses_recurring_id ON expenses(recurring_expense_id);

-- ============================================================
-- HELPER FUNCTION: Calculate next recurring expense due date
-- ============================================================
CREATE OR REPLACE FUNCTION get_next_recurring_date(
  current_date_val date,
  freq text
) RETURNS date AS $$
BEGIN
  RETURN CASE
    WHEN freq = 'daily' THEN current_date_val + INTERVAL '1 day'
    WHEN freq = 'weekly' THEN current_date_val + INTERVAL '7 days'
    WHEN freq = 'monthly' THEN current_date_val + INTERVAL '1 month'
    WHEN freq = 'quarterly' THEN current_date_val + INTERVAL '3 months'
    WHEN freq = 'yearly' THEN current_date_val + INTERVAL '1 year'
    ELSE current_date_val + INTERVAL '1 month'
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
