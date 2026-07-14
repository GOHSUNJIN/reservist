# Ops Reservist

A mobile-first PWA for managing NS reservist attendance. Built with Supabase (auth, Postgres, realtime, storage) and a vanilla JS declarative component system.

---

## Features

**Reservists**
- 4-phase GPS check-in (check in, lunch, return, checkout) with geofence verification
- WhatsApp override button when GPS shows out-of-range
- MC submission and absence request forms
- Leave/absence requests submitted to admin for review
- Shift change requests
- Daily calendar view with cycle progress
- Attendance history with attendance rate stat
- Account management (name, password, avatar)
- Signups on the last day of a cycle are automatically enrolled in the next cycle

**Admin / Supervisor**
- Live attendance roster with realtime updates (reservists only, admins excluded)
- Mark present / MC / absent per person — preserves original check-in time on status changes
- Time log with late check-in detection, reason display, GPS bypass indicator, welfare notes
- Log search and shift filter (All / AM / PM / Office)
- Pending entries hidden from today's log; past dates show absent for anyone with no record
- Day navigation (past attendance, future roster)
- No-reporting day toggle (per date)
- WhatsApp snapshot share
- Personnel management (add, remove, notes, shift change)
- People tab with per-person attendance stats (present / MC / absent) across the full cycle, counting all report days
- Batch/cycle management with auto-creation (8 cycles pre-created ahead on every login)
- CSV attendance export per batch
- Pending leave and shift change request review (approve / decline) with reviewer audit trail
- Welfare notes per person per day (visible on reservist check-in card, roster, and time log)
- Meal allowance toggle per batch

**Superadmin / Master**
- All admin capabilities
- Create and remove admin accounts from the People tab
- Identified by "Master" header label

---

## Auto-absent

Reservists who never clock in on a report day are automatically marked absent via two mechanisms:

1. **Client-side** — when the date changes (midnight), the app marks any reservist still on `pending` status for the previous day as absent.
2. **Server-side** — a `pg_cron` job runs daily at 00:05 SGT and inserts `absent` records for any active reservist with no attendance entry for the previous weekday. See `supabase_cron.sql`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla JS (declarative component runtime via dc-runtime) |
| Backend | Supabase (PostgreSQL + Auth + Realtime + Storage) |
| Hosting | Vercel (static) |
| PWA | Service worker with versioned cache (`ops-v6`) |

---

## Roles

| Role | Access |
|---|---|
| `reservist` | Check-in, briefings, attendance history, leave requests, meal |
| `admin` | Full roster and attendance management, leave approval, people management |
| `superadmin` | All admin access plus creating/removing admin accounts |

---

## Batch / Cycle structure

Cycles run Tuesday → Monday (13 reporting days). Equipment return (dekit) is the following Wednesday.

| Field | Day | Offset from start |
|---|---|---|
| `start_date` | Tuesday | +0 |
| `end_date` | Monday | +13 |
| `dekit_date` | Wednesday | +15 |

Reservists who sign up on `end_date` (last Monday) are enrolled in the next cycle, not the ending one.

---

## Database Schema

### `personnel`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| auth_id | uuid | references auth.users |
| name | text | |
| contact | text | phone number |
| shift | text | AM / PM / OFFICE — always NULL for admin/superadmin |
| role | text | reservist / admin / superadmin |
| batch_id | uuid FK | references batches — NULL for admin/superadmin |
| is_active | boolean | |
| notes | text | |
| deactivated_at | timestamptz | |

### `batches`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| label | text | e.g. "Cycle 1/2026" |
| start_date | date | first reporting day (Tuesday) |
| end_date | date | last reporting day (Monday) |
| dekit_date | date | equipment return day (Wednesday) |
| is_live | boolean | only one active at a time |
| meal_active | boolean | meal allowance toggle |

### `attendance`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| personnel_id | uuid FK | |
| date | date | |
| status | text | present / mc / absent |
| check_in_time | time | phase 1 |
| lunch_out_time | time | phase 2 |
| work_return_time | time | phase 3 |
| work_end_time | time | phase 4 |
| gps_distance_m | integer | phase 1 GPS distance |
| work_return_dist | integer | phase 3 GPS distance |
| late_reason | text | |
| gps_bypassed | boolean | true if WhatsApp override was used |
| welfare_note | text | supervisor welfare note for that day |

### `no_report_days`
| Column | Type |
|---|---|
| date | date PK |

### `leave_requests`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| personnel_id | uuid FK | |
| date | date | requested leave date |
| type | text | personal / mc / shift_change / other |
| reason | text | |
| requested_shift | text | for shift_change type |
| status | text | pending / approved / rejected |
| created_at | timestamptz | |
| reviewed_by | text | name of admin who actioned the request |
| reviewed_at | timestamptz | when the request was actioned |

### `avatars` (Supabase Storage bucket)
Files named by `personnel.id`. Public bucket.

---

## Setup

### 1. Supabase project

1. Create a new Supabase project.
2. Run the table migrations below in the Supabase SQL editor.
3. Enable Row Level Security on all tables with a broad authenticated policy:
   ```sql
   CREATE POLICY "authenticated" ON <table>
     FOR ALL TO authenticated USING (true) WITH CHECK (true);
   ```
4. Create a public storage bucket named `avatars`.
5. Run `supabase_cron.sql` in the SQL editor to enable the auto-absent cron job (requires the `pg_cron` extension, enabled by default on Supabase Pro).

**Full schema:**

```sql
CREATE TABLE personnel (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_id UUID,
  name TEXT NOT NULL,
  contact TEXT,
  shift TEXT CHECK (shift IS NULL OR shift IN ('AM', 'PM', 'OFFICE')),
  role TEXT NOT NULL DEFAULT 'reservist' CHECK (role IN ('reservist', 'admin', 'superadmin')),
  batch_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deactivated_at TIMESTAMPTZ
);

CREATE TABLE batches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  label TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  dekit_date DATE,
  is_live BOOLEAN NOT NULL DEFAULT false,
  meal_active BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  personnel_id UUID REFERENCES personnel(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'absent',
  check_in_time TIME,
  lunch_out_time TIME,
  work_return_time TIME,
  work_end_time TIME,
  gps_distance_m INTEGER,
  work_return_dist INTEGER,
  late_reason TEXT,
  gps_bypassed BOOLEAN DEFAULT false,
  welfare_note TEXT,
  UNIQUE(personnel_id, date)
);

CREATE TABLE no_report_days (
  date DATE PRIMARY KEY
);

CREATE TABLE leave_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  personnel_id UUID REFERENCES personnel(id) ON DELETE CASCADE,
  date DATE,
  type TEXT NOT NULL DEFAULT 'personal',
  reason TEXT,
  requested_shift TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ
);
```

### 2. Create the superadmin account

Sign up through the app login screen first, then promote the account via SQL:

```sql
UPDATE personnel SET role = 'superadmin' WHERE contact = '<your_contact>';
```

### 3. Configure the app

Edit the `<x-dc>` tag near the top of `index.html`:

```html
<x-dc
  accent="#2f5fd0"
  org-name="Your Unit Name"
  hq-name="Your Location Name"
  hq-lat="1.332572"
  hq-lon="103.937189"
  hq-range="200"
  wa-group-link="https://chat.whatsapp.com/YOUR_GROUP_LINK"
>
```

| Prop | Description |
|---|---|
| `accent` | Brand colour (hex) |
| `org-name` | Unit name shown in the header |
| `hq-name` | Location name shown in GPS messages |
| `hq-lat` / `hq-lon` | HQ coordinates for geofencing |
| `hq-range` | Allowed GPS radius in metres (default 200) |
| `wa-group-link` | WhatsApp group invite link (optional) |

Also add your Supabase credentials in `index.html` (in the `<script>` block near the bottom):

```html
<script>
  const SUPABASE_URL = 'https://xxxx.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJ...';
</script>
```

### 4. Deploy

No build step. Deploy the repo root to any static host:

```bash
vercel --prod
```

---

## Development

Serve locally with:

```bash
npx serve .
```

No bundler or Node runtime required.

---

## Auth flow

- Accounts are identified by phone number (stored as a synthetic email: `<contact>@opsreservist.mil`)
- Reservist accounts are created by admins via the People tab, or by self-signup on the login screen
- Superadmin creates admin accounts directly from the People tab (no SQL required after initial setup)
- Sessions use `sessionStorage` so they expire on tab close

---

## PWA / Offline

- Service worker caches the app shell (`ops-v6`)
- Network-first for HTML, JS, and Supabase API requests
- Cache-first for CSS and images
- Offline attendance writes are queued in memory and retried automatically on reconnect
