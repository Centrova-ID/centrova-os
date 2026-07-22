/*
# Phase 6 — AI Invoice Generator: Invoice Versioning

## Summary
Adds invoice versioning support for the AI Invoice Generator feature.

## Changes

### New Tables
- `invoice_versions`: Stores a full snapshot of every invoice save event
  - `id` (uuid, primary key)
  - `invoice_id` (uuid, FK → invoices) — which invoice this version belongs to
  - `version_number` (integer) — sequential version counter per invoice
  - `snapshot` (jsonb) — full invoice row snapshot at save time
  - `items_snapshot` (jsonb) — all invoice_items at save time
  - `change_summary` (text) — human-readable description of what changed
  - `created_by` (uuid, FK → auth.users) — who triggered the save
  - `created_at` (timestamptz)

## Security
- RLS enabled on `invoice_versions`.
- Authenticated users can insert and read all versions (single-team app).
- Anon and authenticated both allowed since the app requires login to reach invoices.

## Notes
1. Versions are append-only — no update or delete to preserve audit trail.
2. Restore is handled at the application layer by reading a snapshot and writing it back to invoices + invoice_items.
*/

CREATE TABLE IF NOT EXISTS invoice_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  version_number integer NOT NULL DEFAULT 1,
  snapshot jsonb NOT NULL,
  items_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  change_summary text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_versions_invoice_id ON invoice_versions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_versions_created_at ON invoice_versions(created_at);

ALTER TABLE invoice_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_invoice_versions" ON invoice_versions;
CREATE POLICY "select_invoice_versions" ON invoice_versions FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_invoice_versions" ON invoice_versions;
CREATE POLICY "insert_invoice_versions" ON invoice_versions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = created_by);
