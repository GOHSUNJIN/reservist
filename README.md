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
- Pre-shift notification reminders (browser Notifications API)
- Attendance history with rate and streak stats
- Account management (name, password, avatar)

**Admin / Supervisor**
- Live attendance roster with realtime updates
- Mark present / MC / absent per person
- Time log with late check-in detection and reason display
- Day navigation (past attendance, future roster)
- No-reporting day toggle (per date)
- WhatsApp snapshot share
- Personnel management (add, remove, notes, shift change)
- Batch/cycle management with auto-creation
- CSV attendance export
- Pending leave and shift change request review (approve / decline)
- Meal allowance toggle per batch

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla JS (declarative component runtime via dc-runtime) |
| Backend | Supabase (PostgreSQL + Auth + Realtime + Storage) |
| Hosting | Vercel (static) |
| PWA | Service worker with versioned cache (`ops-v6`) |

---

## Database Schema

### `personnel`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| auth_id | uuid | references auth.users |
| name | text | |
| contact | text | phone number |
| shift | text | AM / PM / OFFICE |
| role | text | reservist / admin |
| batch_id | uuid FK | references batches |
| is_active | boolean | |
| notes | text | |
| deactivated_at | timestamptz | |

### `batches`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| label | text | e.g. "MAY-JUN 25 #1" |
| start_date | date | |
| end_date | date | last reporting day |
| dekit_date | date | equipment return day |
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

### `avatars` (Supabase Storage bucket)
Files named by `personnel.id`. Public bucket.

---

## Setup

### 1. Supabase project

1. Create a new Supabase project.
2. Run the table migrations in the Supabase SQL editor.
3. Enable Row Level Security on all tables with a broad authenticated policy:
   ```sql
   CREATE POLICY "authenticated" ON <table>
     FOR ALL TO authenticated USING (true) WITH CHECK (true);
   ```
4. Create a public storage bucket named `avatars`.
5. For the `leave_requests` table specifically, run:
   ```sql
   CREATE TABLE leave_requests (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     personnel_id UUID REFERENCES personnel(id) ON DELETE CASCADE,
     date DATE,
     type TEXT NOT NULL DEFAULT 'personal',
     reason TEXT,
     requested_shift TEXT,
     status TEXT NOT NULL DEFAULT 'pending',
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "authenticated" ON leave_requests
     FOR ALL TO authenticated USING (true) WITH CHECK (true);
   ```

### 2. Configure the app

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

### 3. Deploy

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
- Admins create reservist accounts via the People tab; personnel records link to auth via `auth_id`
- Sessions use `sessionStorage` so they expire on tab close

---

## PWA / Offline

- Service worker caches the app shell (`ops-v6`)
- Network-first for HTML, JS, and Supabase API requests
- Cache-first for CSS and images
- Offline attendance writes are queued in memory and retried automatically on reconnect
