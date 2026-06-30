# RESIK Government Dashboard — Design Spec

## Overview

A simple government dashboard for RESIK (waste management system). Built with Next.js 14 App Router, Supabase (shared with resik-mobile), and Leaflet for maps. The dashboard is used by `admin_pemda` (government) to monitor waste reports, track statistics, and review activity.

## Architecture

- **Next.js 14 App Router** — server components fetch data from Supabase via `@supabase/supabase-js`
- **Supabase** — shared DB with resik-mobile; data accessed via anon key (server-side client uses service role for admin queries)
- **Leaflet** via `react-leaflet` — map rendered client-side with markers from `waste_reports`
- **Tailwind CSS 4** — styling with custom Bold Dark theme

## Visual Style: Bold Dark

- Background: `#0f172a` (slate-950)
- Cards: `#1e293b` (slate-800) with `#10b981` (emerald-500) accent border-left
- Text: white headings, `#94a3b8` (slate-400) body text
- Stats: large bold numbers (2xl-3xl), minimal labels
- Map: default Leaflet tiles, fits dark theme context

## Data Model (existing tables)

### waste_reports
| Column | Type | Notes |
|---|---|---|
| id | uuid | |
| user_id | uuid | FK to users |
| waste_type | text | |
| estimated_weight | numeric | kg |
| location_lat | float | for map markers |
| location_lng | float | for map markers |
| address | text | used for region grouping |
| status | text | pending / processing / completed |
| created_at | timestamp | |

### pickups (waste_pickups)
| Column | Type | Notes |
|---|---|---|
| id | uuid | |
| report_id | uuid | FK to waste_reports |
| collector_id | uuid | FK to users |
| actual_weight | numeric | kg |
| status | text | |
| created_at | timestamp | |

### users
| Column | Type | Notes |
|---|---|---|
| id | uuid | |
| name | text | |
| role | text | warga / bank_sampah / umkm / admin_pemda |
| created_at | timestamp | |

## Stats Calculation

- **Total Reports** = `COUNT(*)` from `waste_reports`
- **Total Waste (kg)** = `COALESCE(SUM(estimated_weight), 0)` from `waste_reports` (fallback to `SUM(actual_weight)` from pickups if report weight is null)
- **Active Users** = `COUNT(DISTINCT user_id)` from `waste_reports` where `created_at` is within the selected date range (users who have actually submitted reports)
- **Status Distribution** = count of reports grouped by `status`:
  - Pending: `COUNT(*)` where `status = 'pending'`
  - Processing: `COUNT(*)` where `status = 'processing'`
  - Completed: `COUNT(*)` where `status = 'completed'`
  - Rendered as a compact bar or inline stat chips inside the dashboard

## System Insights / Recommendations

A decision-driven system that produces ACTION-ORIENTED insights for government admins. Insights are sorted by severity and each includes a clear recommendation.

**Severity levels:**
- **HIGH** (red) — Critical issues requiring immediate action
- **MEDIUM** (yellow) — Warnings that need attention
- **LOW** (green) — Informational, system operating normally

**Insight rules (with actions and severity):**

| Condition | Severity | Insight Message | Action |
|---|---|---|---|
| `processing` reports > 7 days old | HIGH | "{count} reports stuck in processing" | "Follow up with collectors assigned to these reports" |
| `pending` reports > 100 in last 7 days | HIGH | "High pending backlog — {count} reports awaiting processing" | "Dispatch additional collectors to clear the backlog" |
| `completed` reports < 50% of total | MEDIUM | "Low completion rate ({pct}%)" | "Review collector assignments and dispatch more collectors to pending areas" |
| Total waste > 5000kg in period | MEDIUM | "High waste volume period ({kg}kg)" | "Consider scaling pickup capacity for this period" |
| No reports in last 3 days | MEDIUM | "No recent reports in {days} days" | "Check if citizen reporting is disrupted" |
| Reports with `location_lat` IS NULL | LOW | "{count} reports missing location data" | "Remind citizens to enable location services when reporting" |

**New components:**

| Component | Purpose |
|---|---|
| `CriticalAlert` | Top-of-page banner showing ONLY the single most severe (HIGH) insight with dominant red/warning styling |
| `SystemHealth` | Compact indicator: Healthy (green) / Warning (yellow) / Critical (red) based on backlog, completion rate, stuck reports |
| `OperationalSummary` | Compact bar showing Pending / Processing / Completed as percentage + count |
| `InsightsPanel` | Decision-driven insights list, sorted by severity (HIGH → MEDIUM → LOW), each with action text |

## Region Filtering

No dedicated regions table. Region is derived from the `address` field by extracting the city/region substring (split on comma, take last segment). The `RegionFilter` component renders a dropdown of discovered regions from the address data. Filtering matches address substring against the selected region.

## Components

All components live in `components/dashboard/`.

| Component | Purpose | Reusable |
|---|---|---|
| `StatsCard` | Single stat: value, label | Yes — takes `value`, `label`, `accentColor` |
| `StatsGrid` | Renders 3 `StatsCard` in a row | No — dashboard-specific |
| `WasteMap` | Leaflet map with markers from `waste_reports` | Yes — takes `reports` prop (array of `{lat, lng, type, status}`) |
| `DateFilter` | Date range picker (from/to) | Yes — takes `onChange` callback returning `{from, to}` |
| `RegionFilter` | Dropdown derived from address parsing (group by city/region substring) | Yes — takes `onChange` callback returning selected region |
| `ActivityLog` | Chronological list of reports + pickups | Yes — takes `items` prop (array of activity entries) |
| `InsightsPanel` | Analyzes data trends, renders insight cards with severity | Yes — takes `reports` and `pickups` props |
| `DashboardPage` | Composes everything, owns state + data fetch | No — page-level |

## Data Flow

1. `page.tsx` (server component) fetches initial data from Supabase:
   - `waste_reports` count, sum of `estimated_weight`, status distribution counts, distinct active user count
   - Latest 20 reports + 20 pickups for activity log and insights
   - Pickups data for cross-analysis
2. Server component passes data to `DashboardPage` (client component)
3. `InsightsPanel` computes insight rules from `reports` and `pickups` props and renders insight cards
4. Map markers rendered client-side via `WasteMap` (`use client`)
5. Filters (`DateFilter` + `RegionFilter`) are client components that refetch via client-side Supabase queries with date range and address substring filters
6. Activity log merges reports + pickups, sorted by `created_at` desc

## Folder Structure

```
app/
  layout.tsx
  globals.css
  page.tsx              # dashboard page (server component)
components/
  dashboard/
    StatsCard.tsx
    StatsGrid.tsx
    WasteMap.tsx
    DateFilter.tsx
    RegionFilter.tsx
    ActivityLog.tsx
    InsightsPanel.tsx
    DashboardPage.tsx
lib/
  supabase/
    client.ts            # browser client (exists)
    server.ts            # new: server-side Supabase client
types/
  dashboard.ts          # new: dashboard-specific types
  auth.ts               # exists
hooks/
  auth-context.tsx       # exists
  use-auth.ts            # exists
```

## Error Handling

- Server component: try/catch around Supabase calls, render fallback UI on error
- Map: graceful no-op if no reports have lat/lng
- Filters: reset button if query returns empty
- Activity log: show "No activity yet" when empty

## Server Client (lib/supabase/server.ts)

Create a server-side Supabase client using `@supabase/supabase-js` with the service role key for admin-level queries (bypassing RLS for dashboard stats). The anon key is insufficient for cross-user aggregation needed by admin_pemda.

## Page Component (app/page.tsx)

- Server component that fetches stats + initial activity
- Renders `DashboardPage` with server-fetched data
- `DashboardPage` is a client component that manages filter state and refetches on filter change
