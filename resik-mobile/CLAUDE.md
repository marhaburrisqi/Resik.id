# RESIK — Claude Code Agent Memory

## Project
Ekosistem digital pengelolaan sampah terpadu untuk daerah rural Jawa Timur.
Fokus Utama: **Refactor UI/UX Mobile-First (Material 3 & HIG Patterns).**
Stack: React Native (Expo) + Supabase + TypeScript strict.

---

## Architecture Law (NEVER BREAK)
- Supabase calls → ONLY in `/lib/supabase/` (Currently bypassed for UI-First phase)
- Business logic → ONLY in `/hooks/`
- UI/screens → presentational only, zero logic
- Shared types → ONLY in `/types/`
- Pure helpers → ONLY in `/utils/`

---

## Data Flow Law (STRICT — ONE DIRECTION)

```
UI (Screen)
  → calls Hook
    → Hook calls /lib/supabase/
      → Supabase returns data
    → Hook transforms + exposes state
  → UI renders state
```

- Data NEVER flows backwards (no screen calling lib directly)
- Hooks NEVER import other hooks (compose at screen level only)
- /lib/supabase/ functions MUST be pure: input → output, no side effects
- All data transformations happen in hooks, never in screens or lib

### Inter-module data flow (cross-feature)
- Module A MUST NOT import from Module B's hook directly
- Shared state between modules → goes through Supabase (source of truth)
- Example: warga submits setoran → bank_sampah reads from DB, not from warga's hook

---

## Realtime Consistency Rules

- Supabase Realtime MUST be used for: poin_wallet, harga_sampah, armada status
- On realtime event received → invalidate local cache → re-fetch from DB
- NEVER mutate local state directly on realtime event — always re-fetch
- Realtime subscriptions MUST be cleaned up on component unmount
- If realtime unavailable (offline) → fall back to last known local state silently

```typescript
// CORRECT pattern
useEffect(() => {
  const channel = supabase.channel('poin_wallet')
    .on('postgres_changes', { ... }, () => refetch())
    .subscribe()
  return () => supabase.removeChannel(channel) // MUST cleanup
}, [])
```

---

## Concurrency & Race Condition Rules

- All mutations MUST use optimistic locking via `updated_at` timestamp check
- Before update: verify `updated_at` matches — if not, abort and notify user
- Point transactions MUST use Supabase DB function (RPC) — never raw update
- NEVER update `poin_wallet.balance` directly — always use `rpc('add_points', {...})`
- Offline queue flush MUST be sequential (one at a time), never parallel
- If two offline actions conflict on sync → last-write-wins with user notification
- Use `select ... for update` in DB functions for critical balance operations

```sql
-- CORRECT: atomic point update via RPC (prevents race condition)
CREATE OR REPLACE FUNCTION add_points(p_user_id uuid, p_amount int)
RETURNS void AS $$
BEGIN
  UPDATE poin_wallet
  SET balance = balance + p_amount, updated_at = now()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Feature Boundary Rules

Each feature is a self-contained vertical slice:
```
features/
└── [feature-name]/
    ├── types.ts        → feature-specific types only
    ├── lib.ts          → re-exports from /lib/supabase/[feature]
    ├── hook.ts         → single hook for this feature
    └── screen.tsx      → UI only
```

- Features MUST NOT bleed into each other's folders
- Shared types ONLY → `/types/global.ts`
- If two features share logic → extract to `/utils/`, never cross-import hooks
- Feature boundaries map 1:1 to user roles:
  - `warga/` → warga role only
  - `bank-sampah/` → bank_sampah role only
  - `umkm/` → umkm role only
  - `pemda/` → admin_pemda role only
  - `shared/` → cross-role components (buttons, inputs, etc.)

---

## Testing Mindset (MANDATORY)

Every feature MUST have tests before considered done.

### Test layers (in order of priority):
1. **Unit** → test hooks in isolation (mock Supabase)
2. **Integration** → test lib/supabase/ against real Supabase test project
3. **E2E** → test critical user flows (Maestro for mobile)

### What MUST be tested per feature:
- [ ] Happy path (normal flow works)
- [ ] Offline → online sync (data survives no connection)
- [ ] Concurrent mutation (two users update same resource)
- [ ] Role boundary (warga cannot access bank_sampah data)
- [ ] Error state (Supabase down → user sees readable message)

### Test file convention:
```
hooks/__tests__/useWargaReport.test.ts
lib/supabase/__tests__/reports.test.ts
```

### NEVER ship a feature without:
- At least 1 unit test for the hook
- At least 1 RLS policy test (verify cross-role access is blocked)
- Manual offline test on low-end Android device

---

## Data Integrity Rules

- NEVER delete data — always soft delete via `deleted_at = now()`
- NEVER update balance fields directly — always via RPC with transaction log
- Every write to DB MUST produce a corresponding audit row in `audit_logs` table
- Foreign key constraints MUST be enforced at DB level — not just app level
- NEVER trust client-sent data — validate all inputs server-side via RLS + DB constraints
- All money/point values stored as INTEGER (cents/poin unit) — NEVER float
- Cascading deletes MUST be explicit — no silent orphan records
- Before any bulk operation (update/delete 10+ rows) → dry-run first, log count, then execute

```sql
-- CORRECT: every mutation writes audit trail
INSERT INTO audit_logs (user_id, action, table_name, record_id, old_value, new_value)
VALUES (auth.uid(), 'UPDATE', 'poin_wallet', p_user_id, old_balance, new_balance);
```

---

## Deployment Safe Rules

- NEVER deploy DB migration without running it on staging Supabase first
- NEVER use `DROP COLUMN` or `DROP TABLE` in migrations — mark deprecated only
- All migrations MUST be idempotent — safe to run twice without side effects
- New columns MUST be nullable or have default value — never break existing rows
- Feature flags MUST wrap any new feature in production until fully tested
- Environment variables MUST be validated on app startup — crash early if missing
- NEVER hardcode Supabase URL or API keys — always from `.env`
- Before any release: run `/db-check` + `/race-check` + `/test-coverage`
- Rollback plan MUST exist before every migration — document in migration file header

```typescript
// CORRECT: validate env on startup
const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'APP_ENV']
REQUIRED_ENV.forEach(key => {
  if (!process.env[key]) throw new Error(`Missing required env: ${key}`)
})
```

---

## Observability Rules

- ALL errors MUST be logged with: timestamp, user_id, action, error message, stack trace
- Use structured logging — JSON format, never plain string
- Critical events MUST emit to `event_logs` table: auth, point transactions, sync events
- Offline queue length MUST be tracked — alert if queue > 50 items (user stuck)
- Supabase Realtime disconnect MUST be logged + auto-reconnect attempted (max 3x)
- Performance: log any DB query > 500ms as WARNING
- Every API call from mobile MUST include: app version, device OS, network type
- Dashboard pemda MUST show system health: last sync time, active users, queue status

```typescript
// CORRECT: structured error log
logger.error({
  timestamp: new Date().toISOString(),
  user_id: auth.currentUser?.id,
  action: 'sync_queue_flush',
  error: err.message,
  stack: err.stack,
  queue_length: queue.length,
  network_type: NetInfo.type
})
```

---

## Code Rules
- TypeScript strict mode — no `any`, no implicit types
- Every async call MUST have try/catch with human-readable errors
- Every screen MUST have loading + error state
- Offline queue: AsyncStorage → flush sequentially to Supabase on reconnect
- Images MUST be compressed before upload (rural = slow internet)
- All lists MUST use pagination (page size: 20)

---

## Database Rules
- Tables: snake_case plural
- Columns: snake_case
- Every table MUST have: `created_at`, `updated_at`, `deleted_at` (nullable)
- Foreign keys: `[table_singular]_id`
- RLS MUST be enabled on ALL tables — never expose cross-user data
- Critical balance ops MUST use RPC — never raw UPDATE on balance fields
- Never recreate tables — use ALTER TABLE only

---

## UX Rules (Rural Users)
- Large buttons, minimal text, clear flow
- All critical actions MUST have confirmation dialog
- All inputs MUST have validation
- App MUST work offline (read + write locally, sync later)
- Target: Android SDK 21, 2GB RAM, 2G–3G network

---

## How to Find Info
- Project context → `RESIK_Konsep_Inovasi.txt`
- Dev architecture → `RESIK_Rancangan_Dev.txt`
- Supabase schema → `.claude/references/schema.sql`
- RLS policies → `.claude/references/rls.sql`
- RPC functions → `.claude/references/rpc.sql`

---

## Pragmatism Rule

- Rules are guidelines, not blockers
- If a rule slows down critical progress → choose simpler solution

- MVP > Perfection
- Shipping working feature > perfect architecture

- For hackathon / competition:
  - prioritize visible impact
  - defer heavy abstractions if not needed

- Always ask:
  "Does this improve user impact right now?"
  ---

## Skills Available
- `/new-feature` — scaffold new feature (SQL → lib → hook → screen → test)
- `/fix-issue` — fix bug by issue number
- `/db-check` — verify schema + RLS consistency
- `/sync-check` — audit offline queue implementation
- `/race-check` — audit concurrent mutation vulnerabilities
- `/test-coverage` — check which features are missing tests
- `/integrity-check` — audit soft deletes, audit_logs, FK constraints
- `/deploy-check` — pre-deploy checklist (migration safety + env + rollback plan)
- `/observability-check` — verify all critical events have logging