# Ops Reservist

A mobile-first web application for managing NS reservist attendance, built and deployed for operational use. Replaces manual sign-in sheets and WhatsApp-based headcounts with a structured, auditable digital system accessible from any smartphone — no app store installation required.

---

## Overview

Ops Reservist provides full end-to-end attendance accountability for reservist cycles. Supervisors get a live dashboard of who has reported, who is late, and who has not shown up. Reservists check in directly from their phones with GPS verification. All records are timestamped, backed up to the cloud, and exportable.

**Zero hardware cost.** Runs in the browser on any smartphone. No dedicated terminals, no paper forms, no separate system login beyond a phone number and password.

---

## Operational Capabilities

### For Reservists
- **4-phase check-in** — Reservists log four checkpoints throughout the day: check in to work, lunch departure, return from lunch, and end of shift. Each is timestamped to the minute.
- **GPS location verification** — The phone's GPS confirms the reservist is physically present at the designated location before the check-in is accepted. The distance from HQ is recorded. The system can be configured for any GPS radius (default: 200 m).
- **MC and leave requests** — Submitted digitally through the app and sent directly to the supervisor for approval. No phone calls or messages needed.
- **Shift change requests** — Submitted with a written reason and reviewed by the supervisor.
- **Attendance history** — Each reservist can see their own record for the full cycle, including total days present, MC, and absent, plus their attendance rate.
- **Works without internet** — If the reservist loses connection during check-in, the action is saved on the phone and submitted automatically once connectivity is restored.

### For Supervisors / Admins
- **Live attendance board** — Updates in real time as reservists check in. No refreshing required. The supervisor always sees the current picture.
- **Manual status override** — If a reservist cannot use the app, the supervisor can manually mark them as Present, MC, or Absent. The original check-in time is preserved if one was recorded.
- **Late check-in alerts** — Anyone who checks in more than one hour after shift start is automatically flagged. Their written reason is displayed alongside the flag.
- **Full daily time log** — A complete record of every individual's four check-in phases for the day, including GPS distance, any late reason, and welfare notes. Can be searched by name and filtered by shift.
- **Leave request inbox** — All pending MC and absence requests appear in one place for the supervisor to approve or decline. Every decision is logged with the reviewer's name and the time it was made.
- **Welfare notes** — Supervisors can write a private daily note against any individual (e.g. medical concerns, welfare follow-up). Visible on the roster and time log.
- **Non-reporting day control** — Mark any date as a non-reporting day (public holidays, stand-down). The system will not count those days against personnel.
- **WhatsApp attendance summary** — One tap sends the day's attendance summary to the unit group chat.
- **Spreadsheet export** — Full attendance data for any cycle can be exported as a CSV file for record-keeping or further analysis.
- **Cycle management** — Create and label reporting cycles. The system automatically prepares the next 8 cycles on every login so the supervisor never has to scramble before a new intake.
- **Meal allowance tracking** — Enable or disable meal allowance per cycle.

### For Master / Command Level
- All supervisor capabilities.
- **Manage supervisor accounts** — Create new supervisor accounts, remove them, or promote an existing reservist account to supervisor, all from within the app. No technical access required.
- Displayed with a **Master** label in the interface.

---

## Accountability and Audit Trail

Every action in the system is recorded and cannot be silently changed:

- Every check-in carries a timestamp and the GPS distance from HQ at the time of check-in.
- Late arrivals are flagged automatically with no supervisor input required. The reservist must submit a written reason.
- If GPS verification is bypassed (e.g. GPS failure), this is permanently marked in the log with a visible indicator.
- All leave and MC approvals record who approved them and when.
- **Absences are written automatically.** If a reservist does not check in by midnight, the system marks them absent on its own — through two independent processes (one on the app, one on the server) to ensure no gaps occur even if the supervisor is offline. See [Auto-Absent](#auto-absent).
- Data is stored in a managed cloud database. Nothing relies on a local file or a spreadsheet that can be accidentally deleted or edited.

---

## Access Control

The system uses three permission levels. Each tier can only see and do what they are supposed to:

| Role | Who | What they can access |
|---|---|---|
| Reservist | NS personnel | Their own check-in, leave requests, attendance history |
| Admin | Supervisors / staff officers | Full roster and attendance management, leave approval, personnel records |
| Master | Command level | Everything Admin can do, plus managing all supervisor accounts |

Accounts are tied to Singapore mobile numbers. All sessions expire when the browser is closed. Idle sessions time out automatically after 20 minutes.

---

## No Installation Required

Ops Reservist runs directly in the phone's browser. Personnel access it through a URL — the same way they would open any website. It can be saved to the home screen for one-tap access, where it behaves exactly like a downloaded app, but without needing to go through the App Store or Google Play.

| What is needed | What is not needed |
|---|---|
| Any smartphone with a browser | App Store or Google Play installation |
| An internet connection (for live sync) | Dedicated devices or terminals |
| A phone number and password | VPN or special network access |
| | IT setup for each individual user |

---

## How the System is Built

This section explains the technical architecture for those who need to understand it. Plain-language notes are included alongside each component.

### Components at a Glance

| Component | Technology | What it does |
|---|---|---|
| The app itself | Vanilla JavaScript | The code that runs in the browser. No third-party framework is required, which means fewer points of failure and no licensing costs. |
| Database | Supabase (PostgreSQL) | Where all personnel records, attendance, and leave requests are stored. Managed, hosted, and automatically backed up in the cloud. |
| Login / accounts | Supabase Auth | Handles all password security. Passwords are never stored in plain text — they are encrypted by the authentication service. |
| Live updates | Supabase Realtime | Pushes attendance changes to all connected supervisors instantly, without anyone needing to refresh the page. |
| Profile photos | Supabase Storage | Profile pictures are stored in the cloud, isolated per user. |
| Hosting | Vercel | Where the app is served from. Deployed globally on a content delivery network (CDN), meaning the app loads quickly regardless of network conditions. Zero server maintenance required. |
| Offline support | Service worker | A background component that caches the app and queues check-in actions when there is no internet connection. |

### Data Storage

All data is stored in a structured cloud database (PostgreSQL). Think of it as a set of linked spreadsheets where every row is a record and every column is a specific piece of information — but with strict rules to prevent duplicate or corrupt data, and with access control so that only authenticated users can read it.

The database has five tables:

**Personnel** — one row per person.

| Field | What it stores |
|---|---|
| Name | Full name |
| Contact | Phone number (used as login) |
| Shift | AM, PM, or Office |
| Role | Reservist, Admin, or Master |
| Cycle | Which reporting cycle they belong to |
| Active | Whether the account is currently active |
| Notes | Supervisor notes on the person |

**Cycles (Batches)** — one row per reporting cycle.

| Field | What it stores |
|---|---|
| Label | e.g. "Cycle 15/2026" |
| Start date | First reporting day (Tuesday) |
| End date | Last reporting day (Monday, 13 days later) |
| Dekit date | Equipment return day (Wednesday after end) |
| Live | Whether this is the currently active cycle |
| Meal allowance | Whether meal allowance applies this cycle |

**Attendance** — one row per person per day.

| Field | What it stores |
|---|---|
| Status | Present, MC, or Absent |
| Check-in time | Phase 1 timestamp |
| Lunch out time | Phase 2 timestamp |
| Return time | Phase 3 timestamp |
| End of shift time | Phase 4 timestamp |
| GPS distance (in) | Metres from HQ at check-in |
| GPS distance (return) | Metres from HQ at return |
| Late reason | Written reason if late by over an hour |
| GPS bypassed | Flagged true if GPS override was used |
| Welfare note | Supervisor's note for that day |

**No-reporting days** — a list of dates where no attendance is expected (public holidays, stand-down days).

**Leave requests** — one row per request.

| Field | What it stores |
|---|---|
| Type | MC, personal leave, shift change, or other |
| Date requested | The date the leave is for |
| Reason | Written reason from the reservist |
| Status | Pending, Approved, or Rejected |
| Reviewed by | Name of the supervisor who actioned it |
| Reviewed at | Timestamp of the decision |

### Auto-Absent

Reservists who do not check in on a reporting day are marked absent automatically. Two independent processes handle this so that the record is complete regardless of circumstances:

1. **In the app** — when the clock ticks past midnight, the app immediately marks anyone still showing as unchecked for the previous day.
2. **On the server** — a scheduled task runs at 00:05 SGT every day and writes absent records for any active reservist with no entry for the previous weekday. This runs independently of whether any supervisor or reservist has the app open.

---

## Setup Guide

> This section is for the person deploying and configuring the system. It requires basic familiarity with running commands in a terminal.

### Step 1 — Set up the database

1. Create a free account at [supabase.com](https://supabase.com) and start a new project.
2. In the project's SQL editor, paste and run the schema below. This creates all five tables.
3. Set access rules so that logged-in users can read and write data:
   ```sql
   CREATE POLICY "authenticated" ON <table>
     FOR ALL TO authenticated USING (true) WITH CHECK (true);
   ```
4. Create a public storage bucket named `avatars` (for profile photos).
5. Run `supabase_cron.sql` to enable the automatic absent job. (Requires the `pg_cron` extension, which is on by default for Supabase Pro projects.)

**Full database schema:**

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

### Step 2 — Create the master account

Sign up through the app's login screen using your phone number. Then run this one-time command in the Supabase SQL editor to elevate that account to Master level:

```sql
UPDATE personnel SET role = 'superadmin' WHERE contact = '<your_contact>';
```

After this, all supervisor accounts are managed entirely within the app. No further database access is needed for day-to-day administration.

### Step 3 — Configure the app

Open `index.html` and edit the configuration block near the top. This is where the unit name, HQ location, and other settings are set:

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

| Setting | What it controls |
|---|---|
| `accent` | The app's main colour (in hex colour code) |
| `org-name` | Unit name shown in the app header |
| `hq-name` | Location name shown in GPS check-in messages |
| `hq-lat` / `hq-lon` | The GPS coordinates of HQ (latitude and longitude) |
| `hq-range` | How far from HQ (in metres) a check-in is accepted |
| `wa-group-link` | The unit WhatsApp group link, for the share button |

Also add the Supabase project credentials (found in the Supabase project settings):

```html
<script>
  const SUPABASE_URL = 'https://xxxx.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJ...';
</script>
```

### Step 4 — Deploy

No compilation or build process is required. The app is plain files that are uploaded directly. Deploy with:

```bash
vercel --prod
```

This publishes the app to a live URL on Vercel's global network. The app is then accessible from any browser worldwide via that URL.

---

## Local Testing

To run the app locally before deploying:

```bash
npx serve .
```

This starts a local web server. Open the address shown in the terminal in a browser to use the app on your own machine.

---

## Login and Session Security

- Every account is identified by a Singapore mobile number. Internally this is converted to a unique email format so the standard authentication system can handle it.
- Reservist accounts can be created by an admin through the People tab, or by the reservist themselves via self-signup on the login screen.
- Supervisor accounts are created by the Master account from within the app.
- Sessions are stored in the browser's temporary memory (not permanently on the device) and expire automatically when the browser tab is closed. If the app is left idle for 20 minutes, the session also expires and the user must log in again.
