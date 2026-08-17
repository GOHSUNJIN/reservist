# Ops Reservist

A mobile-first web application for managing NS reservist attendance. Replaces manual sign-in sheets and WhatsApp headcounts with a structured, auditable digital system accessible from any smartphone, no app installation required.

---

## Overview

Ops Reservist provides end-to-end attendance accountability for reservist cycles. Supervisors see a live dashboard of who has reported, who is late, and who has not shown up. Reservists check in from their phones with GPS verification. All records are timestamped, stored in the cloud, and exportable.

**Zero hardware cost.** Runs in the browser on any smartphone. No dedicated terminals, no paper forms, no separate system login beyond a phone number and password.

**Try it now.** The login screen has built-in demo buttons for both the reservist and supervisor views. No account required.

---

## Features

### For Reservists

- **4-phase check-in**: Log four checkpoints throughout the day - check in, lunch out, return from lunch, and end of shift. Each phase is timestamped to the minute.
- **GPS verification**: The phone's GPS confirms you are physically at the designated location before the check-in is accepted. Distance from HQ is recorded. The radius is configurable (default: 200 m).
- **Leave and MC requests**: Submit requests digitally through the app. They go directly to the supervisor for approval with no phone calls or messages needed.
- **Cancel pending requests**: A leave or MC request can be withdrawn by the reservist before the supervisor has acted on it, from both the check-in tab and the Requests history.
- **Attendance history**: View your own full record for the cycle, including total days present, MC, absent, and your attendance rate.
- **Phase reminder banner**: A banner appears automatically when a check-in phase window is open and you have not yet logged it. It disappears once the phase is recorded.
- **Upcoming no-report day banner**: Shows the next scheduled no-report day (public holiday or stand-down) so reservists always know when the next off day is.
- **Cycle notice board**: If the supervisor has posted a notice for the current cycle, it appears as a banner on the check-in screen for everyone in that cycle.
- **Offline check-in**: If connectivity is lost during check-in, the action is saved on the device and submitted automatically once the connection is restored.
- **Returning reservist re-enrollment**: When a reservist from a previous cycle logs in after their account was deactivated, the app automatically submits a re-enrollment request to the supervisor. No manual coordination required.

### For Supervisors (Admin)

**Roster and Attendance:**
- **Live attendance board**: Updates in real time as reservists check in, with no manual refresh needed.
- **Manual status override**: Mark any reservist as Present, MC, or Absent if they cannot use the app.
- **Manual time correction**: Edit any reservist's check-in times for any day directly from the Log tab across all four phases. Corrected records are flagged in the database as admin-entered.
- **Mark all absent**: Instantly mark all reservists with no status as absent for the current view date, with a confirmation step.
- **Mark all present**: Instantly mark all reservists with no status as present for the current view date.
- **Search and filter**: Search the roster by name. Filter the log by attendance status (present, MC, absent).

**Requests and Leave:**
- **Unified requests inbox**: All pending signup requests, MC requests, and leave requests appear in one place. Each signup is labelled New or Returning so the supervisor knows at a glance whether they are onboarding a first-timer or re-enrolling someone from a previous cycle.
- **Bulk leave actions**: Select multiple pending leave requests and approve or reject them in a single action. Bulk rejection requires a written reason recorded against each rejected request.
- **Leave request rejection reason**: Each rejected request records the reviewer's name, timestamp, and written reason.
- **Reopen rejected signups**: A rejected signup request can be re-opened and returned to pending status if the decision needs to be reversed.
- **Hide rejected signups**: Collapsed view for rejected signup requests to reduce clutter in the inbox.

**Alerts and Notes:**
- **Late check-in alerts**: Anyone who checks in more than 30 minutes after shift start triggers a timing warning. Those more than one hour late are automatically flagged and must submit a written reason, visible alongside their record in the log.
- **Welfare notes**: Write a private daily note against any individual (for example, medical concerns or welfare follow-ups). Visible in both the roster and the time log.
- **Missed attendance notes**: Add an inline note for reservists who did not report without an approved leave, directly from the attendance history view.
- **Admin log note**: Add a note to any person's attendance entry for the current view date from the log tab.

**Cycle and Personnel Management:**
- **Non-reporting day control**: Mark any date as a non-reporting day (public holiday or stand-down). Singapore public holidays are excluded automatically from attendance rate calculations.
- **Cycle notice board**: Post a short notice that appears on every reservist's check-in screen for the duration of the cycle.
- **WhatsApp attendance summary**: One tap copies and sends the day's attendance summary to the unit group chat.
- **Spreadsheet export (XLS)**: Export the full attendance matrix for any cycle as an Excel-compatible spreadsheet. Includes per-person rates, totals, and a print-ready report view.
- **Print report**: Generate a formatted A4 attendance report, printable or saveable as PDF directly from the browser.
- **Cycle management**: Create and label reporting cycles. The system prepares the next 8 cycles automatically on every admin login.
- **Bulk add personnel**: Paste a list of names and contact numbers to add multiple reservists at once.
- **Bulk no-report days**: Paste a list of dates to mark multiple non-reporting days in a single action.
- **Jump to date**: Navigate directly to any date across any cycle using the date picker.
- **Cycle picker**: Browse all cycles grouped by year with a visual picker.
- **Per-person attendance history**: View the full attendance record for any individual across all cycles they have been part of, with export to XLS.
- **Member search**: Search across all cycles by name, status, or cycle. Supports permanent deletion of records.
- **Meal allowance tracking**: Enable or disable meal allowance per cycle. When active, a live work timer appears on each reservist's check-in screen showing elapsed work time, paused during lunch. Meal eligibility is automatically calculated after 8 hours of work (excluding the lunch break). The admin log shows a per-person meal eligibility badge with exact work time.
- **Broadcast (cycle notice)**: Post a cycle-wide notice visible to all reservists in the current cycle.
- **Admin password reset**: Reset any reservist's password directly from the roster without requiring database access.

### For Master Level (Super Admin)

All supervisor capabilities, plus:

- **Create supervisor accounts**: Add new admin accounts directly within the app.
- **Remove supervisors**: Demote any admin back to reservist status. Demoted supervisors return to the reservist pool automatically.
- **Promote to supervisor**: Promote any existing reservist to admin status.
- Displayed with a **Master** label in the interface.

---

## Accountability and Audit Trail

Every action in the system is recorded with no silent changes possible:

- Every check-in carries a timestamp and the GPS distance from HQ at the moment of submission.
- Late arrivals are flagged automatically with no supervisor input required. The reservist must submit a written reason.
- If GPS verification is bypassed (for example, due to GPS failure), this is permanently marked in the log with a visible indicator.
- If a supervisor manually corrects a reservist's times, the record is flagged as admin-entered in the database.
- All leave and MC approvals record who approved them and when.
- **Absences are written automatically.** If a reservist does not check in by midnight, the system marks them absent through two independent processes (one in the app, one on the server) to ensure no gaps occur even if the supervisor is offline. See [Auto-Absent](#auto-absent).
- Data is stored in a managed cloud database. Nothing relies on a local file or spreadsheet that can be accidentally deleted or edited.

---

## Returning Reservist Workflow

When a reservist's account is deactivated at the end of a cycle, their login credentials are preserved but access is blocked. If they return for a new cycle:

1. The reservist logs in with their existing phone number and password.
2. The app detects the inactive account and automatically submits a re-enrollment request on their behalf.
3. The supervisor sees the request in the Requests tab, labelled **Returning**, and approves it with one tap.
4. The reservist's account is reactivated and assigned to the current cycle. They can log in immediately.

No manual coordination, no new account creation, no password reset needed.

If the supervisor adds a returning reservist manually via the roster, the system detects the existing inactive record and reactivates it without creating a new account.

---

## Data Privacy

Ops Reservist collects only what is operationally necessary:

- **No NRIC, rank, or service details**: accounts require only a name, phone number, and password.
- **No location history**: GPS is used solely at the moment of check-in to verify proximity to HQ. Exact coordinates are never recorded; only the distance from HQ in metres is stored.
- **No device data**: the app does not collect device identifiers, browser fingerprints, or any information about the user's phone.
- **Passwords are never stored in plain text**: all passwords are encrypted by the authentication service before storage. Even administrators cannot view a user's password.
- **Profile photos are optional**: avatars are stored only if the user chooses to upload one, and can be removed at any time.
- **Sessions leave no permanent trace**: login sessions are held in the browser's temporary memory and are cleared when the tab is closed or after 20 minutes of inactivity.

The only personal data held in the system is: name, phone number, and attendance records.

---

## Access Control

The system uses three permission levels:

| Role | Who | Access |
|---|---|---|
| Reservist | NS personnel | Own check-in, leave requests, and attendance history |
| Admin | Supervisors and staff officers | Full roster and attendance management, leave approval, personnel records, time correction |
| Master | Command level | Everything Admin can do, plus managing all supervisor accounts |

Accounts are tied to Singapore mobile numbers. All sessions expire when the browser is closed. Idle sessions time out after 20 minutes.

---

## No Installation Required

Ops Reservist runs directly in the phone's browser. Personnel access it through a URL. It can be saved to the home screen for one-tap access, where it behaves exactly like a downloaded app, without going through the App Store or Google Play.

| What is needed | What is not needed |
|---|---|
| Any smartphone with a browser | App Store or Google Play installation |
| An internet connection (for live sync) | Dedicated devices or terminals |
| A phone number and password | VPN or special network access |
| | IT setup per individual user |

---

## How the System is Built

### Components

| Component | Technology | What it does |
|---|---|---|
| The app | Vanilla JavaScript | Runs in the browser. No third-party framework, so fewer failure points and no licensing costs. |
| Database | Supabase (PostgreSQL) | Stores all personnel records, attendance, and leave requests. Managed, hosted, and automatically backed up. |
| Login / accounts | Supabase Auth | Handles all password security. Passwords are encrypted before storage. |
| Live updates | Supabase Realtime | Pushes attendance changes to all connected supervisors instantly, without any page refresh. |
| Profile photos | Supabase Storage | Profile pictures stored in the cloud, isolated per user. |
| Hosting | Vercel | Deployed globally on a CDN. Loads quickly regardless of network conditions. Zero server maintenance required. |
| Offline support | Service Worker | Caches the app and queues check-in actions when there is no internet connection. |

### Code Structure

The JavaScript is split into two layers: **builders** (read state and compute UI props) and **handlers** (write state and call the database). Each feature area has its own file.

```
js/
├── db.js               - All Supabase queries, namespaced by table (DB.auth, DB.personnel, DB.attendance, etc.)
├── state.js            - Initial application state factory
├── utils.js            - Date helpers, contact validation, phase window logic, formatting
├── component.js        - Component lifecycle, offline queue retry logic
├── config.js           - Runtime configuration (Supabase credentials)
│
├── builders/           - Pure functions: (state) -> flat object of UI props for the template
│   ├── auth.js         - Login and signup screens
│   ├── nav.js          - Navigation bar and offline queue badge
│   ├── checkin.js      - Reservist check-in screen, phase tiles, calendar, banners
│   ├── briefings.js    - Info tab (shift info, leave request history)
│   ├── account.js      - Account settings, profile photo
│   └── admin/
│       ├── index.js    - Shared admin context and sub-builder aggregation
│       ├── batch.js    - Cycle picker, batch management, meal toggle, broadcast
│       ├── roster.js   - Attendance roster, time log, search, stats, notes
│       └── people.js   - Personnel list, member search, leave inbox, signups
│
└── handlers/           - Event handlers: setState calls and DB writes
    ├── auth.js         - Login, logout, signup, session management
    ├── init.js         - App startup, realtime subscriptions, date change, auto-absent
    ├── checkin.js      - Phase submission, GPS, offline queue
    ├── requests.js     - Leave and signup approve/reject, bulk actions
    ├── people.js       - Add/remove personnel, member search, bulk delete, admin management
    ├── roster.js       - Manual status override, time correction, no-report days
    ├── batch.js        - Cycle CRUD, export (XLS and print), bulk add, broadcast
    ├── account.js      - Profile photo upload/remove, password change, name change
    └── misc.js         - Toast, navigation helpers, WhatsApp share, welfare notes
```

`support.js` is the compiled declarative component runtime (do not edit). `index.html` is the single-page template that wires all builders and handlers together.

### Database Schema

All data is stored in a structured cloud database (PostgreSQL), with six tables:

**Personnel** - one row per person.

| Field | What it stores |
|---|---|
| Name | Full name |
| Contact | Phone number (used as login) |
| Shift | Office (0900 to 1800) |
| Role | Reservist, Admin, or Master |
| Cycle | Which reporting cycle they belong to |
| Active | Whether the account is currently active |
| Notes | Supervisor notes on the person |

**Cycles (Batches)** - one row per reporting cycle.

| Field | What it stores |
|---|---|
| Label | e.g. "Cycle 15/2026" |
| Start date | First reporting day (Tuesday) |
| End date | Last reporting day (Monday, 13 days later) |
| Dekit date | Equipment return day (Wednesday after end) |
| Live | Whether this is the currently active cycle |
| Meal allowance | Whether meal allowance applies this cycle |
| Notice | Cycle notice text shown to all reservists (blank if none) |

**Attendance** - one row per person per day.

| Field | What it stores |
|---|---|
| Status | Present, MC, Absent, or Missed |
| Check-in time | Phase 1 timestamp |
| Lunch out time | Phase 2 timestamp |
| Return time | Phase 3 timestamp |
| End of shift time | Phase 4 timestamp |
| GPS distance (in) | Metres from HQ at check-in |
| GPS distance (return) | Metres from HQ at return |
| Late reason | Written reason if late by over one hour |
| GPS bypassed | Flagged true if GPS was overridden or times were admin-corrected |
| Welfare note | Supervisor's daily note (also used for missed-attendance notes) |
| Edit log | JSON list of admin edits, each with editor name and timestamp |

**No-reporting days** - a list of dates where no attendance is expected.

**Leave requests** - one row per request.

| Field | What it stores |
|---|---|
| Type | MC, personal leave, or other |
| Date requested | The date the leave is for |
| Reason | Written reason from the reservist |
| Status | Pending, Approved, Rejected, or Cancelled |
| Reviewed by | Name of the supervisor who actioned it |
| Reviewed at | Timestamp of the decision |
| Rejection reason | Written reason if rejected |

**Signup requests** - one row per enrollment request, including returning reservist re-enrollment.

| Field | What it stores |
|---|---|
| Name | Name submitted at signup |
| Contact | Phone number |
| Cycle | Which cycle they are enrolling into |
| Status | Pending, Approved, or Rejected |
| Reviewed by | Name of the supervisor who actioned it |

### Auto-Absent

Reservists who do not check in on a reporting day are marked absent automatically through two independent processes:

1. **In the app**: when the clock ticks past midnight, the app immediately marks anyone still showing as unchecked for the previous day. Approved leaves and pending leave requests for that date are excluded automatically.
2. **On the server**: a scheduled task runs at 00:05 SGT every day and writes absent records for any active reservist with no entry for the previous weekday. This runs independently of whether any supervisor or reservist has the app open.

---

## Setup Guide

> This section is for the person deploying and configuring the system. Basic familiarity with running terminal commands is required.

### Step 1 - Set up the database

1. Create a free account at [supabase.com](https://supabase.com) and start a new project.
2. In the project's SQL editor, paste and run the schema below to create all six tables.
3. Set access rules so authenticated users can read and write data:
   ```sql
   CREATE POLICY "authenticated" ON <table>
     FOR ALL TO authenticated USING (true) WITH CHECK (true);
   ```
4. Create a public storage bucket named `avatars` for profile photos.
5. Run `supabase_cron.sql` to enable the automatic absent job. Requires the `pg_cron` extension (enabled by default on Supabase Pro).

**Full schema:**

```sql
CREATE TABLE personnel (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_id UUID,
  name TEXT NOT NULL,
  contact TEXT,
  shift TEXT CHECK (shift IS NULL OR shift IN ('OFFICE')),
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
  meal_active BOOLEAN NOT NULL DEFAULT false,
  notice_text TEXT
);

CREATE TABLE attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  personnel_id UUID REFERENCES personnel(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'absent' CHECK (status IN ('present', 'absent', 'mc', 'missed')),
  check_in_time TIME,
  lunch_out_time TIME,
  work_return_time TIME,
  work_end_time TIME,
  gps_distance_m INTEGER,
  work_return_dist INTEGER,
  late_reason TEXT,
  gps_bypassed BOOLEAN DEFAULT false,
  welfare_note TEXT,
  edit_log JSONB DEFAULT '[]',
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

CREATE TABLE signup_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_id UUID NOT NULL,
  name TEXT NOT NULL,
  contact TEXT NOT NULL,
  shift TEXT NOT NULL,
  batch_id UUID REFERENCES batches(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Step 2 - Create the master account

Sign up through the app's login screen using your phone number. Then run this one-time command in the Supabase SQL editor to elevate that account to Master level:

```sql
UPDATE personnel SET role = 'superadmin' WHERE contact = '<your_contact>';
```

After this, all supervisor accounts are managed entirely within the app. No further database access is needed for day-to-day administration.

### Step 3 - Configure the app

Open `index.html` and edit the configuration block at the top of the file:

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
| `accent` | Main colour of the app (hex code) |
| `org-name` | Unit name shown in the app header |
| `hq-name` | Location name shown in GPS check-in messages |
| `hq-lat` / `hq-lon` | GPS coordinates of the check-in location |
| `hq-range` | Accepted radius from HQ in metres |
| `wa-group-link` | Unit WhatsApp group link for the share button |

Also add the Supabase project credentials (found in the Supabase project settings under API):

```html
<script>
  const SUPABASE_URL = 'https://xxxx.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJ...';
</script>
```

### Step 4 - Deploy

No build process is required. Deploy with:

```bash
vercel --prod
```

This publishes the app to a live URL on Vercel's global CDN. The app is then accessible from any browser via that URL.

---

## Local Development

To run the app locally before deploying:

```bash
npx serve .
```

Open the address shown in the terminal in a browser. The service worker requires HTTPS in production but works over localhost for development.

---

## Login and Session Security

- Every account is identified by a Singapore mobile number. Internally this is converted to a standard email format so the authentication service can handle it.
- Reservist accounts can be created by an admin via the People tab, or by the reservist themselves through self-signup on the login screen.
- Returning reservists who log in after deactivation automatically trigger a re-enrollment request without needing a new account.
- Supervisor accounts are created by the Master account from within the app. No database access is required after initial setup.
- Sessions are held in the browser's temporary memory (not permanently on the device) and expire when the browser tab is closed. Sessions also expire after 20 minutes of inactivity.
- A session expiry warning appears 5 minutes before the session ends, with a one-tap option to extend it.
