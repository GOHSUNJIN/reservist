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
- **GPS verification**: The phone's GPS confirms you are physically at the designated location before the check-in is accepted. Distance from HQ is recorded. The radius is configurable (default: 500 m).
- **GPS bypass**: After two failed GPS attempts, a bypass option appears to allow check-in without location. Bypassed records are permanently flagged in the log.
- **Leave and MC requests**: Submit requests digitally through the app. They go directly to the supervisor for approval with no phone calls or messages needed.
- **Cancel pending requests**: A leave or MC request can be withdrawn by the reservist before the supervisor has acted on it, from both the check-in tab and the Requests history.
- **Attendance history**: View your own full record for the cycle, including total days present, MC, absent, and your attendance rate.
- **MC calendar coloring**: Approved MC days are highlighted amber in the attendance calendar. Pending MC requests appear with a lighter amber tint and a dashed border, so you can see at a glance which days have been covered.
- **Phase reminder banner**: A banner appears automatically when a check-in phase window is open and you have not yet logged it. It disappears once the phase is recorded.
- **Upcoming no-report days**: Lists all remaining no-report days in the current cycle (public holidays and stand-downs) so reservists can plan ahead.
- **Cycle notice board**: If the supervisor has posted a notice for the current cycle, it appears as a banner on the check-in screen for everyone in that cycle.
- **Offline check-in**: If connectivity is lost during check-in, the action is saved on the device and submitted automatically once the connection is restored.
- **Department selection at signup**: Reservists choose their department (Ops Security or Crime Alert/CAS) during signup. The intake cycle shown on the form updates to reflect whichever department is selected.
- **Returning reservist re-enrollment**: When a reservist from a previous cycle logs in after their account was deactivated, the app automatically submits a re-enrollment request to the supervisor. No manual coordination required.
- **Logout confirmation**: Tapping Log Out shows a confirmation step before the session is ended, preventing accidental logouts.
- **Session expiry warning**: A banner appears at 55 minutes into the session with a one-tap option to extend it before the session expires at 60 minutes.
- **Idle timeout**: Sessions expire after 20 minutes of inactivity, with a warning at 18 minutes.
- **Work timer and meal allowance**: When meal allowance is active for the cycle, a live timer shows total work time for the day, paused during lunch. Once 6 hours of work is reached, a "Meal eligible" badge appears. A reminder is shown inside the timer card when eligible but Phase 4 has not yet been recorded, to discourage leaving without clocking out.
- **Missing clock-out detection**: If a past day shows no clock-out, that calendar day is coloured orange with a dashed border. Tapping it shows a warning. A persistent orange banner also appears on the check-in screen if any day in the past two weeks is missing a clock-out, prompting the reservist to inform their supervisor so their meal allowance record can be corrected.
- **No-reporting day calendar coloring**: Days marked as no-reporting are highlighted in slate blue in the attendance calendar, distinct from MC (amber) and present (green), making it easy to see at a glance which days required no attendance.
- **Late check-in self-declaration**: If you check in more than one hour after shift start, you are prompted to provide a written reason for the lateness before the check-in is accepted.
- **In-app browser detection**: If opened from WhatsApp, Instagram, or another in-app browser where GPS is blocked, the app shows specific instructions for opening in the device's real browser.
- **Profile photo**: Upload a profile photo from account settings. Tap your photo to view it enlarged. Works on iOS and Android.

### For Supervisors (Admin)

**Attendance Roster:**
- **Live attendance board**: Updates in real time as reservists check in, with no manual refresh needed.
- **Status filter chips**: Filter the roster by All, Present, MC, Absent, or Pending to see only the group you need.
- **Roster search**: Filter roster entries by name. The filter persists while navigating dates.
- **Manual status override**: Mark any reservist as Present, MC, or Absent directly from the roster.
- **Mark all absent**: Instantly mark all reservists with no status as absent for the current date, with a confirmation step before committing.
- **Mark all present**: Instantly mark all pending reservists as present, also with a required confirmation step.
- **Pending badge on Log nav**: The Log navigation button shows a badge when there are reservists with no attendance status for the current date, so you always know at a glance if action is needed.
- **Day navigation**: Swipe left or right to move between dates, or use the previous/next day buttons. The calendar in the Overview tab can also be tapped to jump directly to any date.
- **Jump to date**: Navigate directly to any date across any cycle using the date picker.

**Time Log:**
- **Manual time correction**: Edit any reservist's check-in times for any day directly from the Log tab across all four phases. Corrected records are flagged as admin-entered in the database.
- **Log search**: Filter the log by name.
- **Log status filter**: Filter the log by attendance status (Present, MC, Absent) to focus on a specific group.
- **Click name to open history**: In the Log tab, clicking a reservist's name opens their full attendance history without needing to navigate to the People tab.
- **Shift label on log cards**: Each log card shows the reservist's shift alongside their check-in times.
- **Admin log note**: Add a free-text note against any person's attendance entry for the current view date.
- **Late check-in alerts**: Anyone who checks in more than one hour after shift start is automatically flagged in the log and their written late reason is displayed alongside the attendance record.
- **Missing clock-out flag**: Any log entry where a reservist is marked present but has no Phase 4 clock-out is flagged with a visible "No clock-out" badge on both the log row and the attendance record view, making it easy to identify and correct before payroll.

**Requests and Leave:**
- **Unified requests inbox**: All pending signup requests, MC requests, and leave requests appear in one place. Each signup is labelled New or Returning so the supervisor knows at a glance whether they are onboarding a first-timer or re-enrolling someone from a previous cycle.
- **Select-all for signups**: A checkbox in the signup section header selects or deselects all visible pending signups. Filtered by the search box, so select-all only acts on visible results.
- **Select-all for leave requests**: Same select-all behavior for pending leave requests.
- **Bulk leave actions**: Select multiple pending leave requests and approve or reject them in a single action. Bulk rejection requires a written reason recorded against each rejected request.
- **Urgency sorting**: Pending leave requests are sorted by submission time, newest first, so recently submitted requests are visible immediately.
- **Leave request rejection reason**: Each rejected request records the reviewer's name, timestamp, and written reason.
- **Reopen rejected signups**: A rejected signup request can be re-opened and returned to pending status if the decision needs to be reversed.
- **Hide rejected signups**: Collapsed view for rejected signup requests to reduce clutter in the inbox.

**Alerts and Notes:**
- **Welfare notes**: Write a private daily note against any individual (for example, medical concerns or welfare follow-ups). Visible in both the roster and the time log.
- **Missed attendance notes**: Add an inline note for reservists who did not report without an approved leave, directly from the attendance history view.

**Personnel Management (People tab):**
- **Roster view**: Lists all personnel in the current cycle with their attendance rate shown when stats are loaded.
- **Low attendance warning**: Personnel with an attendance rate below 75% are flagged inline on their card - the attendance percentage turns amber and a compact "Low" chip appears on the same line as the stats, without adding a separate row.
- **Per-person attendance history**: Click any person's card to open their full attendance history across all cycles. The history modal includes status filter chips (All, Present, MC, Absent) and pagination (15 records per page). Time ranges are only shown for present days - MC and absent rows are displayed without a meaningless "- to -" placeholder. The history can be exported to Excel (.xls).
- **Avatar lightbox**: Tap any reservist's profile photo in the overview, roster, or log to view it enlarged. Tapping outside the photo closes it.
- **Click row in Overview**: Clicking a person's row in the Overview tab also opens their history directly.
- **Password reset**: Reset any reservist's password directly from the roster without requiring database access. The Master account can also reset supervisor passwords from the Team tab.
- **Bulk add personnel**: Paste a list of names and contact numbers to add multiple reservists at once.
- **Re-enroll by search**: When adding personnel, search for removed reservists by name or contact number. Selecting a match triggers the re-enroll flow, reactivating their existing account and history without creating a duplicate entry.
- **Personnel accountability**: Each personnel card shows who added the reservist - "Added by [name]" for direct admin additions, or "Approved by [name]" for self-signup approvals.
- **Team tab**: View the full list of active supervisors in your department. Accessible from the People tab for all admin accounts. Each entry shows the supervisor's name, contact number, and role.

**Cycle Management:**
- **Non-reporting day control**: Mark any date as a non-reporting day (public holiday or stand-down). Singapore public holidays are excluded automatically.
- **Bulk no-report days**: Paste a list of dates to mark multiple non-reporting days in a single action.
- **Cycle notice board (broadcast)**: Post a short notice that appears on every reservist's check-in screen for the duration of the cycle. The notice is scoped to the active department and does not appear to reservists in other departments.
- **Meal allowance toggle**: Enable or disable meal allowance per cycle. When active, the work timer and meal eligibility calculations are shown to reservists.
- **Cycle picker**: Browse all cycles grouped by year with a visual picker.
- **Cycle management**: Create and label reporting cycles. The system prepares the next 8 cycles automatically on every admin login.
- **Batch label editing**: Rename any cycle label inline without navigating away.

**Export and Reporting:**
- **Excel export**: Export the full attendance matrix for any cycle as an Excel spreadsheet (.xls). Includes per-person rates, totals, a legend, colour-coded status cells, and a dedicated Meal column showing how many days each reservist was eligible for meal allowance (clocked out with 6h+ worked). The sheet opens with a styled title row and consistent row heights. The header rows freeze so they stay visible when scrolling down.
- **Print report**: Generate a formatted A4 attendance report, printable or saveable as PDF directly from the browser without leaving the app. Includes a Meal Claims summary stat and per-person meal-eligible day count alongside the attendance totals.
- **WhatsApp attendance summary**: One tap generates the day's attendance summary. A preview modal lets you review and edit the text, copy it to clipboard, or send it directly to the unit group chat.
- **Per-person history export**: Export any individual's attendance history to Excel from within the history modal.

**Member Search:**
- **Cross-cycle search**: Search across all cycles and all personnel by name, contact, or status.
- **Filter by cycle or status**: Narrow results to a specific cycle or attendance status.
- **Permanent deletion**: Permanently delete a person's account and all associated records. Supports bulk selection and bulk delete.

### For Master Level (Super Admin)

All supervisor capabilities, plus:

- **Department switcher**: Switch the entire admin view between departments (Ops Security and Crime Alert/CAS) using a dropdown in the header. Each department's last-selected cycle is remembered independently, so switching back restores the previous context.
- **Cross-department isolation**: All data (personnel, cycles, attendance, leave requests, signup requests, and realtime updates) is fully scoped to the active department. Switching departments clears the current view and reloads fresh data for the selected department.
- **Create supervisor accounts**: Add new admin accounts directly within the app.
- **Remove supervisors**: Demote any admin back to reservist status. Demoted supervisors return to the reservist pool automatically.
- **Promote to supervisor**: Promote any existing reservist to admin status. Search by name with cycle filters.
- **Supervisor password reset**: Reset any supervisor's password directly from the Team tab, without database access.
- Displayed with a **Master** label in the interface.

---

## Accountability and Audit Trail

Every action in the system is recorded:

- Every check-in carries a timestamp and the GPS distance from HQ at the moment of submission.
- Late arrivals are flagged automatically. If more than one hour late, the reservist must submit a written reason, which is stored alongside the attendance record.
- If GPS verification is bypassed (due to GPS failure or supervisor authorisation), this is permanently marked in the log with a visible indicator.
- If a supervisor manually corrects a reservist's times, the record is flagged as admin-entered, and the edit log includes the editor's name and timestamp.
- All leave and MC approvals record who approved them and when. Rejections record the reviewer and reason.
- **Absences are written automatically.** If a reservist does not check in by midnight, the system marks them absent through two independent processes (one in the app, one on the server) to ensure no gaps occur even if the supervisor is offline. See [Auto-Absent](#auto-absent).
- Data is stored in a managed cloud database. Nothing relies on a local file or spreadsheet.

---

## Returning Reservist Workflow

When a reservist's account is deactivated at the end of a cycle, their login credentials are preserved but access is blocked. If they return for a new cycle:

1. The reservist logs in with their existing phone number and password.
2. The app detects the inactive account and automatically submits a re-enrollment request on their behalf.
3. The supervisor sees the request in the Requests tab, labelled **Returning**, and approves it with one tap.
4. The reservist's account is reactivated and assigned to the current cycle. They can log in immediately.

No manual coordination, no new account creation, no password reset needed.

If the supervisor adds a returning reservist directly via the Add Personnel form, they can search by name or contact to find the removed record. Selecting it triggers the re-enroll flow, reactivating the existing account without creating a new one.

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
| Reservist | NS personnel | Own check-in, leave requests, and attendance history (scoped to their department) |
| Admin | Supervisors and staff officers | Full roster and attendance management, leave approval, personnel records, time correction (scoped to their department) |
| Master | Command level | Everything Admin can do, plus managing all supervisor accounts and switching between departments |

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
| Offline support | Service Worker | Caches the app shell and queues check-in actions when there is no internet connection. |

### Architecture

The app is a single-page application built without a framework. State is held in a single object and passed down to a declarative template engine. The JavaScript is divided into two layers:

**Builders** read the current state and return a flat object of UI properties for the template. They contain no side effects - just pure computation. This makes the UI predictable: the same state always produces the same output.

**Handlers** respond to user actions. They call the database, update state via `setState`, and trigger side effects like toasts and haptic feedback. Handlers never read from the DOM directly.

The template in `index.html` is driven by `sc-if`, `sc-for`, and `{{ prop }}` expressions. Because the template engine does not support ternary expressions or arithmetic, all computed values (styles, labels, badge counts, pagination state) are pre-computed as named properties in the builder layer before the template consumes them.

### Code Structure

```
assets/                 - Static icons (PWA home screen, apple-touch-icon)

js/
├── support.js          - Compiled declarative component runtime (do not edit)
├── db.js               - All Supabase queries, namespaced by table (DB.auth, DB.personnel, DB.attendance, etc.)
├── state.js            - Initial application state factory
├── utils.js            - Date helpers, contact validation, phase window logic, formatting, SG holiday data
├── component.js        - Component lifecycle, realtime wiring, offline queue retry logic
├── config.js           - Runtime configuration (Supabase credentials, do not commit)
│
├── builders/           - Pure functions: (state) -> flat object of UI props for the template
│   ├── auth.js         - Login and signup screens
│   ├── nav.js          - Navigation bar, offline queue badge, pending-action indicators
│   ├── checkin.js      - Reservist check-in screen, phase tiles, GPS state, calendar, banners, work timer
│   ├── briefings.js    - Info tab (shift info, leave request history)
│   ├── account.js      - Account settings, profile photo, password change, name change
│   └── admin/
│       ├── index.js    - Shared admin context and sub-builder aggregation
│       ├── batch.js    - Cycle picker, batch management, meal toggle, broadcast, export
│       ├── roster.js   - Attendance roster, time log, status filters, mark-all actions, search, stats, notes, person history
│       └── people.js   - Personnel list, member search, leave inbox, signup inbox, bulk actions, low-attendance flags
│
└── handlers/           - Event handlers: setState calls and DB writes
    ├── init.js          - App startup, realtime subscriptions, date change detection, auto-absent, batch provisioning
    ├── auth.js          - Login, logout, signup, session management, idle/session timers
    ├── checkin.js       - Phase submission (GPS and bypass), offline queue, late reason, location verification
    ├── signups.js       - Signup request approve/reject/reopen, bulk approve, signup search
    ├── requests.js      - Leave approve/reject, bulk actions, welfare notes, missed-day notes, log notes
    ├── people.js        - Add/remove personnel, re-enroll, deactivate, bulk add, people stats
    ├── member_search.js - Cross-cycle member search, permanent delete, bulk delete, person history, password reset
    ├── admin_mgmt.js    - Add, demote, and promote admin accounts
    ├── batch.js         - Cycle CRUD, broadcast, no-report days, meal toggle, cycle picker, jump to date
    ├── export.js        - Excel (.xls) attendance export and print/PDF report generation
    ├── roster.js        - Manual status override, time correction, search, sort, day navigation
    ├── account.js       - Profile photo upload/remove, password change, name change, notification permissions
    └── misc.js          - Toast, navigation helpers, WhatsApp share/copy, page refresh

scripts/                - Offline tooling (not part of the web app)
    ├── build_pptx.py         - Generates the OpsTracker briefing deck
    ├── generate_checklist.py - Generates the admin testing checklist
    ├── supabase_cron.sql     - SQL to enable the auto-absent scheduled job
    └── add_departments.sql   - Migration to add department columns to an existing deployment
```

`index.html` is the single-page template that wires all builders and handlers together. The `<x-dc>` element at the top of the file is where all deployment-specific configuration lives.

### Key Patterns

**Attendance state cache**: Today's attendance is stored in `state.attendance`. Past and future dates are stored in `state.attendanceCache`, keyed by date string (`YYYY-MM-DD`). Roster handlers use `_viewAttMap`, `_setViewEntry`, and `_delViewEntry` helpers to read and write the correct map depending on the current view offset.

**Offline queue**: When the device is offline, check-in actions are pushed to `this._offlineQueues` and persisted to `sessionStorage`. On reconnect, `_onOnline` replays the queue in order against the database.

**Realtime**: Supabase Realtime channels push row-level changes for attendance (admin view), leave status (reservist view), and new requests (admin notifications) without polling.

**Batch provisioning**: On every admin login, the system ensures a live batch exists and that 8 future batches are pre-created. This prevents the cycle selector from being empty when a new cycle starts.

**Person history pagination**: The person history modal is paginated at 15 records per page. Status filters (All, Present, MC, Absent) are applied before pagination. Page state is reset when the filter changes.

**Department isolation**: All database queries, realtime subscriptions, and state updates are scoped to the active department. The `_myDept()` helper on handlers returns the superadmin's manually selected department or the user's own department (set at signup). Switching departments clears all cached data (personnel, batches, attendance, requests) and reloads from scratch for the new department. Realtime callbacks guard against cross-department rows arriving via shared channels.

### Database Schema

All data is stored in a structured cloud database (PostgreSQL), with six tables:

**Personnel** - one row per person.

| Field | What it stores |
|---|---|
| Name | Full name |
| Contact | Phone number (used as login) |
| Shift | Office (0900 to 1800) |
| Role | Reservist, Admin, or Master |
| Department | Which department the person belongs to (ops_security or cas) |
| Cycle | Which reporting cycle they belong to |
| Active | Whether the account is currently active |
| Notes | Supervisor notes on the person |
| Created by | Name of the admin who added or re-enrolled the person (blank for self-signups) |
| Deactivated at | Timestamp of when the account was last deactivated |

**Cycles (Batches)** - one row per reporting cycle.

| Field | What it stores |
|---|---|
| Label | e.g. "Cycle 15/2026" |
| Department | Which department this cycle belongs to (ops_security or cas) |
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
| Created at | Submission timestamp, used for urgency sorting |

**Signup requests** - one row per enrollment request, including returning reservist re-enrollment.

| Field | What it stores |
|---|---|
| Name | Name submitted at signup |
| Contact | Phone number |
| Department | Which department the person is signing up for |
| Cycle | Which cycle they are enrolling into |
| Status | Pending, Approved, or Rejected |
| Reviewed by | Name of the supervisor who actioned it |
| Created at | Submission timestamp |

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
4. Create a storage bucket named `avatars` for profile photos. Set it to **public** so photos load without authentication. Then add these three policies in the SQL editor:
   ```sql
   CREATE POLICY "upload own avatar" ON storage.objects
     FOR INSERT TO authenticated
     WITH CHECK (bucket_id = 'avatars' AND name = auth.uid()::text);

   CREATE POLICY "update own avatar" ON storage.objects
     FOR UPDATE TO authenticated
     USING (bucket_id = 'avatars' AND name = auth.uid()::text);

   CREATE POLICY "read all avatars" ON storage.objects
     FOR SELECT TO authenticated
     USING (bucket_id = 'avatars');
   ```
5. Run `scripts/supabase_cron.sql` to enable the automatic absent job. Requires the `pg_cron` extension (enabled by default on Supabase Pro).

> **Upgrading an existing deployment?** If you already have the tables from an earlier version, run `scripts/add_departments.sql` instead of re-creating the schema. It adds the `department_type` enum and the `department` column to `personnel`, `batches`, and `signup_requests`, defaulting all existing rows to `ops_security`.

**Full schema:**

```sql
CREATE TYPE department_type AS ENUM ('ops_security', 'cas');

CREATE TABLE personnel (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_id UUID,
  name TEXT NOT NULL,
  contact TEXT,
  shift TEXT CHECK (shift IS NULL OR shift IN ('OFFICE')),
  role TEXT NOT NULL DEFAULT 'reservist' CHECK (role IN ('reservist', 'admin', 'superadmin')),
  department department_type NOT NULL DEFAULT 'ops_security',
  batch_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deactivated_at TIMESTAMPTZ
);

CREATE TABLE batches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  label TEXT NOT NULL,
  department department_type NOT NULL DEFAULT 'ops_security',
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
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT
);

CREATE TABLE signup_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_id UUID NOT NULL,
  name TEXT NOT NULL,
  contact TEXT NOT NULL,
  shift TEXT NOT NULL,
  department department_type NOT NULL DEFAULT 'ops_security',
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
  hq-range="500"
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

Open `js/config.js` and fill in the Supabase project credentials (found in the Supabase project settings under API):

```js
const SUPABASE_URL      = 'https://xxxx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJ...';
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
- An idle warning appears at 18 minutes to give users time to respond before automatic logout at 20 minutes.
