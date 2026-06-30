-- ============================================================
-- RESIK 2.0 — Reports Table Migration
-- Run this in Supabase SQL Editor → https://supabase.com/dashboard
-- ============================================================
-- This migration safely adds all missing columns to the live
-- `reports` table and refreshes the PostgREST schema cache.
-- All statements use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS
-- so it is safe to run multiple times.
-- ============================================================

-- 1. Add missing columns to reports table
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS accuracy         NUMERIC(6,2)    NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loc_timestamp    BIGINT          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source           VARCHAR(50)     NULL DEFAULT 'device',
  ADD COLUMN IF NOT EXISTS photo_url        TEXT            NULL,
  ADD COLUMN IF NOT EXISTS storage_path     TEXT            NULL,
  ADD COLUMN IF NOT EXISTS tracking_id      VARCHAR(50)     NULL,
  ADD COLUMN IF NOT EXISTS idempotency_key  VARCHAR(100)    NULL;

-- 2. Add unique constraint on tracking_id if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reports_tracking_id_key'
  ) THEN
    ALTER TABLE reports ADD CONSTRAINT reports_tracking_id_key UNIQUE (tracking_id);
  END IF;
END $$;

-- 3. Add unique constraint on idempotency_key if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reports_idempotency_key_key'
  ) THEN
    ALTER TABLE reports ADD CONSTRAINT reports_idempotency_key_key UNIQUE (idempotency_key);
  END IF;
END $$;

-- 4. Relax NOT NULL on tracking_id (app sets it, but old rows may be null)
ALTER TABLE reports ALTER COLUMN tracking_id DROP NOT NULL;

-- 5. Relax NOT NULL on idempotency_key during migration (will be enforced by app)
ALTER TABLE reports ALTER COLUMN idempotency_key DROP NOT NULL;

-- 6. Add RLS policy for storage bucket (run in Storage tab if using Supabase UI)
-- Bucket name: report-photos
-- Policy: Allow authenticated users to upload to their own folder ({user_id}/*)

-- 7. Force PostgREST to reload its schema cache immediately
-- This fixes "Could not find column in schema cache" errors
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- VERIFICATION QUERY — run after migration to confirm columns
-- ============================================================
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'reports'
ORDER BY ordinal_position;
