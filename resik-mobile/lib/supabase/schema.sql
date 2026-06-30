-- RESIK 2.0 Database Schema & Row Level Security
-- Apply these scripts directly in the Supabase SQL Editor

-- ==========================================
-- 1. CLEANUP & PREPARATION
-- ==========================================
DROP TRIGGER IF EXISTS trg_update_user_points ON point_transactions;
DROP FUNCTION IF EXISTS update_user_points();
DROP TRIGGER IF EXISTS trg_audit_reports ON reports;
DROP TRIGGER IF EXISTS trg_audit_redemptions ON redemptions;
DROP FUNCTION IF EXISTS audit_log_trigger_fn();
DROP FUNCTION IF EXISTS process_waste_pickup(UUID, NUMERIC, INT);

-- ==========================================
-- 2. CREATE TYPE ENUMS
-- ==========================================
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('warga', 'bank_sampah', 'umkm', 'admin_pemda');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN
    CREATE TYPE report_status AS ENUM ('pending', 'verified', 'scheduled', 'picked_up', 'completed', 'cancelled', 'rejected');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_type') THEN
    CREATE TYPE report_type AS ENUM ('trash', 'illegal');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pickup_status') THEN
    CREATE TYPE pickup_status AS ENUM ('assigned', 'on_progress', 'picked_up', 'failed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'redemption_status') THEN
    CREATE TYPE redemption_status AS ENUM ('pending', 'verified', 'distributed', 'cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_type') THEN
    CREATE TYPE transaction_type AS ENUM ('deposit', 'redemption', 'adjustment', 'rollback');
  END IF;
END $$;

-- ==========================================
-- 3. CREATE TABLES
-- ==========================================

-- Users Table (Core Auth Integration)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  role user_role NOT NULL DEFAULT 'warga',
  points INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

-- Villages Table (Master reference)
CREATE TABLE IF NOT EXISTS villages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  subdistrict VARCHAR(100) NOT NULL,
  regency VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

-- Profiles Table (PII Data)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name VARCHAR(150) NOT NULL,
  phone_number VARCHAR(20) NULL,
  address TEXT NOT NULL,
  rt_rw VARCHAR(10) NOT NULL,
  village_id UUID NOT NULL REFERENCES villages(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

-- Reports Table (Deposits & Illegal dumps)
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_id VARCHAR(50) NOT NULL UNIQUE,
  idempotency_key VARCHAR(100) NOT NULL UNIQUE,
  citizen_id UUID NOT NULL REFERENCES profiles(id),
  report_type report_type NOT NULL DEFAULT 'trash',
  trash_type VARCHAR(50) NOT NULL,
  estimated_weight NUMERIC(6, 2) NOT NULL CHECK (estimated_weight > 0),
  actual_weight NUMERIC(6, 2) NULL CHECK (actual_weight >= 0),
  location_lat DOUBLE PRECISION NOT NULL,
  location_lng DOUBLE PRECISION NOT NULL,
  accuracy NUMERIC(6, 2) NOT NULL,
  loc_timestamp BIGINT NOT NULL,
  source VARCHAR(50) DEFAULT 'device',
  address TEXT NOT NULL,
  status report_status NOT NULL DEFAULT 'pending',
  points_earned INTEGER NULL DEFAULT 0 CHECK (points_earned >= 0),
  description TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

-- Report Photos Table
CREATE TABLE IF NOT EXISTS report_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Officers Table
CREATE TABLE IF NOT EXISTS officers (
  id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  vehicle_type VARCHAR(50) NOT NULL,
  vehicle_plate VARCHAR(15) NOT NULL,
  last_active_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

-- Pickups Assignments Table
CREATE TABLE IF NOT EXISTS pickups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  officer_id UUID NOT NULL REFERENCES officers(id),
  status pickup_status NOT NULL DEFAULT 'assigned',
  scheduled_at TIMESTAMPTZ NOT NULL,
  picked_up_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

-- Point Ledger Table (Audit proof)
CREATE TABLE IF NOT EXISTS point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id),
  amount INTEGER NOT NULL,
  transaction_type transaction_type NOT NULL,
  reference_id UUID NOT NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rewards Table
CREATE TABLE IF NOT EXISTS rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  points_cost INTEGER NOT NULL CHECK (points_cost > 0),
  stock_quantity INTEGER NOT NULL CHECK (stock_quantity >= 0),
  image_url TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

-- Redemptions Table
CREATE TABLE IF NOT EXISTS redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  citizen_id UUID NOT NULL REFERENCES profiles(id),
  reward_id UUID NOT NULL REFERENCES rewards(id),
  points_spent INTEGER NOT NULL CHECK (points_spent > 0),
  status redemption_status NOT NULL DEFAULT 'pending',
  verified_by UUID NULL REFERENCES profiles(id),
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

-- Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title VARCHAR(150) NOT NULL,
  body TEXT NOT NULL,
  read_status BOOLEAN NOT NULL DEFAULT FALSE,
  notification_type VARCHAR(50) NOT NULL,
  related_entity_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Change Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NULL,
  action VARCHAR(100) NOT NULL,
  table_name VARCHAR(100) NOT NULL,
  record_id UUID NOT NULL,
  old_state JSONB NULL,
  new_state JSONB NULL,
  client_ip VARCHAR(45) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================
-- 4. CREATE INDEXES FOR PERFORMANCE
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_village ON profiles(village_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reports_citizen ON reports(citizen_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reports_idempotency ON reports(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_transactions_profile ON point_transactions(profile_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_citizen ON redemptions(citizen_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_redemptions_status ON redemptions(status) WHERE deleted_at IS NULL;

-- ==========================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE villages ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE officers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pickups ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 5.1 Users policies
CREATE POLICY "Users can view own credential" ON users FOR SELECT USING (auth.uid() = id);

-- 5.2 Villages policies
CREATE POLICY "Anyone authenticated can view villages" ON villages FOR SELECT USING (auth.role() = 'authenticated');

-- 5.3 Profiles policies
CREATE POLICY "Users can select own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Officers and admins view all profiles" ON profiles FOR SELECT 
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('bank_sampah', 'admin_pemda')));

-- 5.4 Reports policies
CREATE POLICY "Citizens can insert own reports" ON reports FOR INSERT 
  WITH CHECK (auth.uid() = citizen_id AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'warga'));
CREATE POLICY "Citizens view own reports" ON reports FOR SELECT USING (auth.uid() = citizen_id);
CREATE POLICY "Waste banks view all reports" ON reports FOR SELECT 
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('bank_sampah', 'admin_pemda')));
CREATE POLICY "Waste banks update reports" ON reports FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('bank_sampah', 'admin_pemda')));

-- 5.5 Report Photos policies
CREATE POLICY "Citizens view own report photos" ON report_photos FOR SELECT 
  USING (EXISTS (SELECT 1 FROM reports WHERE id = report_photos.report_id AND citizen_id = auth.uid()));
CREATE POLICY "Citizens insert photos" ON report_photos FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM reports WHERE id = report_photos.report_id AND citizen_id = auth.uid()));
CREATE POLICY "Officers view all photos" ON report_photos FOR SELECT 
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('bank_sampah', 'admin_pemda')));

-- 5.6 Rewards policies
CREATE POLICY "Anyone view active rewards" ON rewards FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "Admins manage rewards" ON rewards FOR ALL 
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin_pemda'));

-- 5.7 Redemptions policies
CREATE POLICY "Citizens view own redemptions" ON redemptions FOR SELECT USING (auth.uid() = citizen_id);
CREATE POLICY "Citizens create redemption" ON redemptions FOR INSERT 
  WITH CHECK (auth.uid() = citizen_id AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'warga'));
CREATE POLICY "Admins manage redemptions" ON redemptions FOR SELECT OR UPDATE
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin_pemda'));

-- 5.8 Point Transactions policies
CREATE POLICY "Citizens view own ledger" ON point_transactions FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "Admins view all ledgers" ON point_transactions FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin_pemda'));

-- 5.9 Audit Logs policies
CREATE POLICY "Only admins view audits" ON audit_logs FOR SELECT 
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin_pemda'));

-- ==========================================
-- 6. SQL PROCEDURES AND TRIGGERS
-- ==========================================

-- Trigger Function: Automatic points ledger synchronization to profiles & users tables
CREATE OR REPLACE FUNCTION update_user_points()
RETURNS TRIGGER AS $$
BEGIN
  -- Update points inside profiles table (ledger projection)
  UPDATE users 
  SET points = COALESCE(points, 0) + NEW.amount,
      updated_at = NOW()
  WHERE id = NEW.profile_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_user_points
AFTER INSERT ON point_transactions
FOR EACH ROW
EXECUTE FUNCTION update_user_points();

-- Trigger Function: Auditing changes
CREATE OR REPLACE FUNCTION audit_log_trigger_fn()
RETURNS TRIGGER AS $$
DECLARE
  _old_state JSONB := NULL;
  _new_state JSONB := NULL;
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    _old_state := to_jsonb(OLD);
    _new_state := to_jsonb(NEW);
  ELSIF (TG_OP = 'INSERT') THEN
    _new_state := to_jsonb(NEW);
  ELSIF (TG_OP = 'DELETE') THEN
    _old_state := to_jsonb(OLD);
  END IF;

  INSERT INTO audit_logs (actor_id, action, table_name, record_id, old_state, new_state)
  VALUES (auth.uid(), TG_OP, TG_TABLE_NAME, COALESCE(NEW.id, OLD.id), _old_state, _new_state);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_audit_reports
AFTER INSERT OR UPDATE OR DELETE ON reports
FOR EACH ROW EXECUTE FUNCTION audit_log_trigger_fn();

CREATE TRIGGER trg_audit_redemptions
AFTER INSERT OR UPDATE OR DELETE ON redemptions
FOR EACH ROW EXECUTE FUNCTION audit_log_trigger_fn();

-- Stored Procedure (RPC): Process Waste Pickup & Disburse Points Atomically
CREATE OR REPLACE FUNCTION process_waste_pickup(
  _report_id UUID, 
  _actual_weight NUMERIC, 
  _points_per_kg INT
)
RETURNS JSON AS $$
DECLARE
  _points_earned INT;
  _updated_report RECORD;
  _citizen_id UUID;
  _tx_id UUID;
BEGIN
  _points_earned := FLOOR(_actual_weight * _points_per_kg);
  
  -- Resolve citizen identifier
  SELECT citizen_id INTO _citizen_id FROM reports WHERE id = _report_id;
  IF _citizen_id IS NULL THEN
    RAISE EXCEPTION 'Report ID not found';
  END IF;

  -- 1. Complete report status and log weights
  UPDATE reports 
  SET 
    status = 'completed',
    actual_weight = _actual_weight,
    points_earned = _points_earned,
    updated_at = NOW()
  WHERE id = _report_id
  RETURNING * INTO _updated_report;

  -- 2. Insert point ledger record (Trigger automatically updates users point balance)
  INSERT INTO point_transactions (profile_id, amount, transaction_type, reference_id, notes)
  VALUES (
    _citizen_id, 
    _points_earned, 
    'deposit', 
    _report_id, 
    CONCAT('Disbursed from completed pickup: ', _updated_report.tracking_id)
  )
  RETURNING id INTO _tx_id;

  RETURN json_build_object(
    'success', true,
    'report', row_to_json(_updated_report),
    'transaction_id', _tx_id,
    'points_credited', _points_earned
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
