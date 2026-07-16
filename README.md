# Ops Reservist

A mobile-first web application for managing NS reservist attendance, built and deployed for operational use. Replaces manual sign-in sheets and WhatsApp-based headcounts with a structured, auditable digital system accessible from any smartphone — no app store installation required.

---

## Overview

Ops Reservist provides full end-to-end attendance accountability for reservist cycles. Supervisors get a live dashboard of who has reported, who is late, and who has not shown up. Reservists check in directly from their phones with GPS verification. All records are timestamped, backed up to the cloud, and exportable.

**Zero hardware cost.** Runs in the browser on any smartphone. No dedicated terminals, no paper forms, no separate system login beyond a phone number and password.

---

## Operational Capabilities

### For Reservists
- **4-phase GPS check-in** — Check in to work, log lunch departure, return, and end of shift. Each phase is timestamped to the minute.
- **Geofence verification** — GPS confirms the reservist is physically present at the designated location within a configurable radius (default 200 m). Distance is recorded for audit.
- **Leave and MC requests** — Submitted digitally and routed to the supervisor for approval. Reservists are notified of the outcome.
- **Shift change requests** — Submitted with reason; approved or rejected by the supervisor.
- **Attendance history** — Each reservist can view their own record across the full cycle, including present/MC/absent counts and attendance rate.
- **Works offline** — Check-in actions are queued locally and synced automatically when connectivity is restored.

### For Supervisors / Admins
- **Live attendance roster** — Real-time updates as reservists check in. No manual refreshing required.
- **One-tap status override** — Mark any individual as Present, MC, or Absent directly from the roster. Original check-in timestamps are preserved.
- **Late check-in detection** — The system automatically flags anyone who checks in more than one hour past shift start. Reason is captured and displayed.
- **Daily time log** — Full shift log per person including all four phases, GPS distance, late reason, and welfare notes. Searchable and filterable by shift.
- **Leave request queue** — Pending MC and absence requests are surfaced for review. Approved or declined with reviewer name and timestamp logged.
- **Welfare notes** — Supervisors can attach a daily welfare note to any individual, visible across the roster and log.
- **No-reporting day management** — Toggle specific dates as non-reporting (public holidays, stand-down days) to prevent false absents.
- **WhatsApp snapshot** — One-tap share of the day's attendance summary to the unit group chat.
- **CSV export** — Full attendance data per cycle exported as a spreadsheet for archiving or further reporting.
- **Cycle management** — Create and label reporting cycles (Tuesday to Monday, 13 days). Up to 8 future cycles are pre-created automatically. Equipment return (dekit) date is tracked per cycle.
- **Meal allowance toggle** — Enable or disable meal allowance tracking per cycle.

### For Master / Command Level
- All supervisor capabilities.
- **Admin account management** — Create, promote, and remove supervisor accounts without requiring database access.
- **Promote existing accounts** — Convert a reservist account to an admin account directly from the interface.
- Identified with a **Master** label in the interface.

---

## Accountability and Audit Trail

- Every check-in is timestamped and GPS-verified. Distance from HQ is recorded in metres.
- Late arrivals are flagged automatically. Reasons are submitted by the reservist and stored.
- GPS bypass (used when GPS fails) is logged with a visible indicator in the time log.
- Leave approvals log the reviewer's name and the exact time the decision was made.
- Absent records are written automatically at midnight for any reservist who did not check in, via both a client-side trigger and a scheduled server-side job — preventing gaps in the record.
- All data is stored in a managed PostgreSQL database with no manual entry required.

---

## Access Control

Three role tiers with clearly separated permissions:

| Role | Access |
|---|---|
| Reservist | Personal check-in, leave requests, attendance history |
| Admin (Supervisor) | Full roster management, attendance control, leave approval |
| Master (Command) | All admin access plus account creation and admin management |

Accounts are identified by Singapore mobile number. Sessions expire on browser close for security. All data access requires authentication.

---

## No Installation Required

Ops Reservist is a Progressive Web App (PWA). Reservists access it by navigating to the URL in any mobile browser. It can be added to the home screen for one-tap access, behaving like a native app without going through an app store.

| What you need | What you don't need |
|---|---|
| A smartphone with a browser | App Store / Play Store installation |
| Internet connection (for sync) | Dedicated hardware or terminals |
| A phone number and password | VPN or corporate network access |
| | IT department involvement per user |

---

## Data and Infrastructure

| Layer | Technology |
|---|---|
| Frontend | Vanilla JavaScript (no framework dependency) |
| Database | Supabase (PostgreSQL) — managed, hosted, auto-backed up |
| Authentication | Supabase Auth — session-based, no passwords stored in plain text |
| Realtime | Supabase Realtime — live roster updates pushed to all connected supervisors |
| File Storage | Supabase Storage — profile photos, isolated per user |
| Hosting | Vercel — static deployment, global CDN, zero server maintenance |
| PWA | Service worker with versioned cache, offline queue |

All data is stored in Singapore-region cloud infrastructure. No data is held on any individual's device beyond what is cached for offline operation.

---

## Roles and Permissions Detail

| Feature | Reservist | Admin | Master |
|---|---|---|---|
| GPS check-in (4 phases) | ✓ | — | — |
| Submit MC / leave / shift change | ✓ | ✓ | ✓ |
| View own attendance history | ✓ | ✓ | ✓ |
| Live roster with realtime updates | — | ✓ | ✓ |
| Override attendance status | — | ✓ | ✓ |
| Approve / decline leave requests | — | ✓ | ✓ |
| Add / remove personnel | — | ✓ | ✓ |
| Welfare notes | — | ✓ | ✓ |
| CSV export | — | ✓ | ✓ |
| Create / manage cycles | — | ✓ | ✓ |
| Create / remove admin accounts | — | — | ✓ |
| Promote reservist to admin | — | — | ✓ |

---

## Cycle Structure

Reporting cycles run Tuesday to Monday (13 reporting days). Equipment return (dekit) falls on the following Wednesday.

| Milestone | Day |
|---|---|
| Cycle start | Tuesday |
| Cycle end (last reporting day) | Monday (+13 days) |
| Dekit date | Wednesday (+15 days) |

Reservists who sign up on the last day of a cycle are automatically enrolled in the next one.

---

## Database Schema

### `personnel`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| auth_id | uuid | references auth.users |
| name | text | |
| contact | text | phone number |
| shift | text | AM / PM / OFFICE — NULL for admin/superadmin |
| role | text | reservist / admin / superadmin |
| batch_id | uuid FK | references batches — NULL for admin/superadmin |
| is_active | boolean | |
| notes | text | |
| deactivated_at | timestamptz | |

### `batches`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| label | text | e.g. "Cycle 15/2026" |
| start_date | date | first reporting day |
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
| gps_distance_m | integer | metres from HQ at check-in |
| work_return_dist | integer | metres from HQ at return |
| late_reason | text | submitted by reservist if late |
| gps_bypassed | boolean | flagged if GPS override was used |
| welfare_note | text | supervisor note for that day |

### `no_report_days`
| Column | Type |
|---|---|
| date | date PK |

### `leave_requests`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| personnel_id | uuid FK | |
| date | date | |
| type | text | personal / mc / shift_change / other |
| reason | text | |
| requested_shift | text | for shift change requests |
| status | text | pending / approved / rejected |
| created_at | timestamptz | |
| reviewed_by | text | name of approving admin |
| reviewed_at | timestamptz | |

---

## Auto-Absent

Reservists who do not check in on a reporting day are automatically marked absent via two independent mechanisms:

1. **Client-side** — when the date rolls over at midnight, the app marks any reservist still on `pending` status for the previous day as absent.
2. **Server-side** — a scheduled database job (`pg_cron`) runs at 00:05 SGT and inserts absent records for any reservist with no entry for the previous weekday. See `supabase_cron.sql`.

This ensures no gaps in the attendance record regardless of whether the supervisor is online.

---

## Setup

### 1. Supabase project

1. Create a new Supabase project.
2. Run the table migrations below in the SQL editor.
3. Enable Row Level Security on all tables:
   ```sql
   CREATE POLICY "authenticated" ON <table>
     FOR ALL TO authenticated USING (true) WITH CHECK (true);
   ```
4. Create a public storage bucket named `avatars`.
5. Run `supabase_cron.sql` to enable the auto-absent job (requires `pg_cron`, enabled by default on Supabase Pro).

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

### 2. Create the master account

Sign up via the app login screen, then promote via SQL:

```sql
UPDATE personnel SET role = 'superadmin' WHERE contact = '<your_contact>';
```

Subsequent admin accounts are created entirely within the app — no further SQL access required.

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
| `org-name` | Unit name shown in the app header |
| `hq-name` | Location name shown in GPS messages |
| `hq-lat` / `hq-lon` | HQ coordinates for geofencing |
| `hq-range` | GPS geofence radius in metres (default 200) |
| `wa-group-link` | WhatsApp group link for status sharing |

Add your Supabase credentials in `index.html`:

```html
<script>
  const SUPABASE_URL = 'https://xxxx.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJ...';
</script>
```

### 4. Deploy

No build step required. Deploy the repo root to any static host:

```bash
vercel --prod
```

---

## Local Development

```bash
npx serve .
```

No bundler or Node runtime required.

---

## Auth

- Accounts use Singapore mobile numbers as identifiers (stored as synthetic emails internally).
- Reservist accounts are created by admins via the People tab, or by self-signup.
- Admin accounts are created by the master account within the app.
- Sessions use `sessionStorage` and expire on tab close. Idle sessions time out after 20 minutes.
