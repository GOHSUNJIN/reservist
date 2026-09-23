# ReservistGO

A mobile-first web application for managing NS reservist attendance. Replaces manual sign-in sheets and WhatsApp headcounts with a structured, auditable digital system accessible from any smartphone, no app installation required.

**Live app:** https://opsreservist.vercel.app

---

## Overview

ReservistGO provides end-to-end attendance accountability for reservist cycles. Supervisors see a live dashboard of who has reported, who is late, and who has not shown up. Reservists check in from their phones with GPS verification. All records are timestamped, stored in the cloud, and exportable.

**Zero hardware cost.** Runs in the browser on any smartphone. No dedicated terminals, no paper forms, no separate system login beyond a phone number and password.

**Try it now.** The login screen has built-in demo buttons for both the reservist and supervisor views. No account required.

---

## No Installation Required

ReservistGO runs directly in the phone's browser. Personnel access it through a URL. It can be saved to the home screen for one-tap access, where it behaves exactly like a downloaded app, without going through the App Store or Google Play.

| What is needed | What is not needed |
|---|---|
| Any smartphone with a browser | App Store or Google Play installation |
| An internet connection (for live sync) | Dedicated devices or terminals |
| A phone number and password | VPN or special network access |
| | IT setup per individual user |

---

## Features

### For Reservists

- **Department-based check-in flow**: Ops Security reservists log four phases (check in, lunch out, return from lunch, end of shift). Crime Prevention Office (CPO) reservists use a simplified two-phase flow: check in and check out only. Each phase is timestamped to the minute.
- **GPS verification**: Tapping a check-in phase shows a "Locate me" button first. After GPS confirms you are within range of HQ, the button swaps to "Check in to work" (or the phase-specific label). Distance from HQ is recorded. The radius is configurable (default: 250 m).
- **GPS bypass**: If GPS cannot detect your location at all (permission denied, signal unavailable, or timeout), a bypass option appears immediately so you can check in without GPS. The bypass is not offered when GPS works but you are simply out of range; in that case you must move closer to HQ and try again. Bypassed records are permanently flagged in the log.
- **Leave and MC requests**: Submit requests digitally through the app. They go directly to the supervisor for approval with no phone calls or messages needed. Only one leave type is supported per day: MC (sick leave) or Personal Leave (other absences). When an MC is approved for today, the check-in phases are replaced with a "Marked as MC" card. When a Personal Leave is approved for today, the status chip switches to amber "Personal Leave" and an "On Personal Leave" card is shown instead.
- **Cancel pending requests**: A leave or MC request can be withdrawn by the reservist before the supervisor has acted on it, from both the check-in screen and the Requests history tab.
- **Request history**: The Requests tab shows the full history of submitted leave and MC requests, each with a coloured left bar, a type badge (MC and Personal Leave both in amber), and a status badge (Submitted, Approved, Declined, or Withdrawn). Records are deduplicated by date: if multiple requests exist for the same date, only the most relevant one is shown (pending takes priority over approved, approved over declined). Filter pills let you narrow the list by status. Pending requests can be withdrawn inline.
- **Info and Attendance tabs**: The Info tab shows an About section explaining the app, shift and reporting details, dekit day steps, leave request history, and a team directory listing batchmates with contact links. The Attendance tab shows the personal attendance calendar and history.
- **Attendance history**: View your full record for the cycle, including total days present, MC and Personal Leave, absent, and your attendance rate. Approved personal leave days are counted in the MC and Leave stat rather than the Absent stat, so the numbers reflect actual unexcused absences. Future approved MC or Personal Leave requests already visible in Shift History are included in the MC/Leave and Logged counts so the totals stay consistent with what is shown on screen. If a supervisor has manually corrected one of your check-in times, that time appears in blue in the Shift History grid so you can see at a glance which entries were admin-adjusted. The late check-in reason card is suppressed for any day where the supervisor has corrected the check-in time.
- **Upcoming leave in Shift History**: Approved or pending leave requests for future dates appear in a separate "Upcoming" section at the top of the Shift History list, above past attendance records. Each entry shows the date and leave type (MC or Personal Leave) with an amber badge.
- **End-of-cycle notice**: When the reporting cycle ends, the Attendance tab shows a congratulations card and a reminder of the dekit date when the account will be deactivated. Today's row is suppressed for post-cycle days so no false Pending entry appears.
- **Cycle-scoped history**: Attendance records from before a reservist's current batch start date are excluded from both the reservist's own Shift History and the admin's person history modal. This prevents pre-cycle auto-absent records from appearing as if they belong to the current cycle.
- **Copyable contact numbers**: Tap any batchmate's phone number in the team directory to copy it to the clipboard.
- **Calendar coloring**: The attendance calendar uses colour to distinguish day types at a glance. Present days are green. MC and approved personal leave days are amber with a solid border. Pending MC or personal leave requests appear with a lighter amber tint and a dashed border. Days with a missing clock-out are orange with a dashed border. No-report days are slate blue. Unexcused absent days are red.
- **Phase reminder banner**: A banner appears automatically when a check-in phase window is open and you have not yet logged it. It disappears once the phase is recorded.
- **Upcoming no-report days**: Lists all remaining no-report days in the current cycle (public holidays and stand-downs) so reservists can plan ahead.
- **Cycle notice board**: If the supervisor has posted a notice for the current cycle, it appears as a banner on the check-in screen for everyone in that cycle.
- **Offline check-in**: If connectivity is lost during check-in, the action is saved on the device and submitted automatically once the connection is restored.
- **Department selection at signup**: Reservists choose their department (Ops Security or Crime Prevention Office/CPO) during signup. The intake cycle shown on the form updates to reflect whichever department is selected.
- **Returning reservist re-enrollment**: When a reservist from a previous cycle logs in after their account was deactivated, the app automatically submits a re-enrollment request to the supervisor. No manual coordination required.
- **Logout confirmation**: Tapping Log Out shows a confirmation step before the session is ended, preventing accidental logouts.
- **Session expiry warning**: A banner appears at 55 minutes into the session with a one-tap option to extend it before the session expires at 60 minutes.
- **Idle timeout**: Sessions expire after 20 minutes of inactivity, with a warning at 18 minutes.
- **Work timer and meal allowance**: When meal allowance is active for the cycle, a live timer shows total work time for the day, paused during lunch. Once 6 hours of work is reached, a "Meal eligible" badge appears. A reminder is shown inside the timer card when eligible but Phase 4 has not yet been recorded, to discourage leaving without clocking out. The Meal tab shows a summary of total entitlements and a Daily Breakdown card listing every reporting day so far with a per-day status badge. MC days show "MC", approved personal leave days show "Personal Leave", and present days under 6 hours or missing clock-out show the specific shortfall reason.
- **Missing clock-out detection**: If a past day shows no clock-out, that calendar day is coloured orange with a dashed border. Tapping it shows a warning. A persistent orange banner also appears on the check-in screen if any day in the past two weeks is missing a clock-out, prompting the reservist to inform their supervisor so their meal allowance record can be corrected.
- **Late check-in self-declaration**: If you check in more than one hour after shift start, a full-width amber action row labelled "Late check-in" appears on your check-in screen. Tapping it opens a reason field where you enter the reason for being late. The reason must be submitted before the check-in is accepted.
- **In-app browser detection**: If opened from WhatsApp, Instagram, or another in-app browser where GPS is blocked, the app shows specific instructions for opening in the device's real browser.
- **Profile photo**: Upload a profile photo from account settings. Tap your photo to view it enlarged. Works on iOS and Android.

### For Supervisors (Admin)

**Attendance Roster:**
- **Live attendance board**: Updates in real time as reservists check in, with no manual refresh needed. When a reservist self-deactivates their account, the admin receives a toast notification immediately and the person is removed from the active roster without requiring a page refresh.
- **Status filter chips**: Filter the roster by All, Present, MC, Absent, or Pending to see only the group you need.
- **Roster search**: Filter roster entries by name. The filter persists while navigating dates.
- **Manual status override**: Mark any reservist as Present, MC, Personal Leave, or Absent directly from the roster using a status dropdown. The dropdown shows the current status and changes it with a single selection.
- **Mark all absent**: Instantly mark all reservists with no status as absent for the current date, with a confirmation step before committing.
- **Mark all present**: Instantly mark all pending reservists as present, also with a required confirmation step.
- **Pending badge on Log nav**: The Log navigation button shows a badge when there are reservists with no attendance status for the current date, so you always know at a glance if action is needed.
- **Day navigation**: Swipe left or right to move between dates, or use the previous/next day buttons. The calendar in the Overview tab can also be tapped to jump directly to any date. When navigating to a non-reporting day, the no-report message is department-aware: Ops Security shows "Weekend, no reporting" for Saturdays and Sundays, while Logistics and Finance (which reports Monday to Saturday) shows "Sunday, no reporting" for Sundays only.
- **Jump to date**: Navigate directly to any date across any cycle using the date picker.
- **Attendance rate**: Each roster card shows the reservist's attendance percentage for the current cycle, loaded alongside the roster.

**Time Log:**
- **Manual time correction**: Edit any reservist's check-in times for any day directly from the Log tab across all four phases. Corrected records are flagged as admin-entered in the database. When a supervisor corrects a reservist's check-in time, the late check-in reason (if one was submitted) is hidden from the reservist's view, since the original reason no longer applies to the corrected time. Crime Prevention reservists, who only use two phases, are not required to fill in lunch or return times when editing checkout.
- **Log search**: Filter the log by name.
- **Log status filter**: Filter the log by attendance status (Present, MC, Absent) to focus on a specific group.
- **Click name to open history**: In the Log tab, clicking a reservist's name opens their full attendance history without needing to navigate to the People tab.
- **Shift label on log cards**: Each log card shows the reservist's shift alongside their check-in times.
- **Admin log note**: Add a free-text note against any person's attendance entry for the current view date. The note icon and the Edit button are both toggleable: clicking either a second time closes the panel without saving.
- **GPS distance badge**: Each log card shows the GPS distance recorded at check-in as a small badge (for example: "GPS · 43 m" in green). A 0 m reading is highlighted in amber as a possible spoofing indicator.
- **Late check-in alerts**: Anyone who checks in more than one hour after shift start is automatically flagged. The late badge shows the written reason inline (for example: "Late - Dental appointment") so supervisors do not need to expand anything to read it. If no reason was given, the badge shows "Late - No reason".
- **Missing clock-out display**: When a reservist is marked present but has no Phase 4 clock-out, the OUT column of their log card shows a dash on an orange background instead of a time. This keeps the missing clock-out visible without adding a separate badge row, making it easy to scan and correct before payroll.

**Requests and Leave:**
- **Unified requests inbox**: All pending signup requests, MC requests, and personal leave requests appear in one place. Each signup is labelled New or Returning so the supervisor knows at a glance whether they are onboarding a first-timer or re-enrolling someone from a previous cycle. Returning reservists who have a profile photo on file have it displayed on their signup card automatically.
- **Leave type badges**: Pending leave requests display amber type badges for both MC and Personal Leave. The same colour is used consistently across the admin view and the reservist's own request history.
- **Submission timestamps**: Pending requests and signups show the exact submission time (HH:MM) rather than a relative label. The time resets daily so context is always accurate.
- **Signup search and filters**: The Pending Signups panel has a collapsible search bar with filter pills (All, New, Returning). A red dot on the search icon indicates when a filter is active.
- **Leave search and filters**: The Pending Requests panel has the same collapsible search bar with filter pills (All, MC, Personal Leave).
- **Select-all for signups**: A checkbox in the signup section header selects or deselects all visible pending signups. Filtered by the search box, so select-all only acts on visible results.
- **Select-all for leave requests**: Same select-all behaviour for pending leave requests.
- **Bulk leave actions**: Select multiple pending leave requests and approve or reject them in a single action. Bulk rejection requires a written reason recorded against each rejected request.
- **Urgency sorting**: Pending leave requests are sorted by submission time, newest first, so recently submitted requests are visible immediately.
- **Leave request rejection reason**: Each rejected request records the reviewer's name, timestamp, and written reason.
- **Reopen rejected signups**: A rejected signup request can be re-opened and returned to pending status if the decision needs to be reversed.
- **Hide rejected signups**: Collapsed view for rejected signup requests to reduce clutter in the inbox.
- **Copyable contact numbers**: Tap any phone number in the requests list, roster card, or supervisor list to copy it to the clipboard.

**Alerts and Notes:**
- **Welfare notes**: Write a private daily note against any individual (for example, medical concerns or welfare follow-ups). Visible in both the roster and the time log.
- **Missed attendance notes**: Add an inline note for reservists who did not report without an approved leave, directly from the attendance history view.

**Personnel Management (People tab):**
- **Roster view**: Lists all personnel in the current cycle with their attendance rate shown when stats are loaded.
- **Collapsible action bar**: Each roster card is collapsed by default. A chevron button in the top-right corner of each card expands the action bar, which contains History, Note, Reset PW, and Remove. Only one card can be expanded at a time, keeping the list compact.
- **Roster search**: Filter the personnel list by name or contact number with a persistent search bar.
- **Per-person attendance history**: Click any person's card to open their full attendance history across all cycles. The history modal includes status filter chips (All, Present, MC, Absent) and pagination (15 records per page). Each row shows the date first, followed by the check-in time range (for present days), then the status tag on the right. Approved personal leave days are labelled "Personal Leave" in amber rather than "Absent". The history can be exported to Excel (.xlsx), with colour-coded status rows and personal leave days correctly labelled in the exported file.
- **Avatar lightbox**: Tap any reservist's profile photo in the overview, roster, or log to view it enlarged. Tapping outside the photo closes it.
- **Click row in Overview**: Clicking a person's row in the Overview tab also opens their history directly.
- **Password reset**: Reset any reservist's password directly from the roster without requiring database access. The Master account can also reset supervisor passwords from the Team tab.
- **Bulk add personnel**: Paste a list of names and contact numbers to add multiple reservists at once.
- **Re-enroll by search**: When adding personnel, search for removed reservists by name or contact number. Selecting a match triggers the re-enroll flow, reactivating their existing account and history without creating a duplicate entry.
- **Personnel accountability**: Each personnel card shows who added the reservist: "Added by [name]" for direct admin additions, or "Approved by [name]" for self-signup approvals.
- **Team tab**: View the full list of active supervisors in your department. Accessible from the People tab for all admin accounts. Each entry shows the supervisor's name, contact number, and role.

**Cycle Management:**
- **Non-reporting day control**: Mark any date as a non-reporting day (public holiday or stand-down). Singapore public holidays are excluded automatically.
- **Bulk no-report days**: Paste a list of dates to mark multiple non-reporting days in a single action.
- **Cycle notice board (broadcast)**: Post a short notice that appears on every reservist's check-in screen for the duration of the cycle. The notice is scoped to the active department and does not appear to reservists in other departments.
- **Meal allowance toggle**: Enable or disable meal allowance per cycle. When active, the work timer and meal eligibility calculations are shown to reservists.
- **Cycle picker**: Browse all cycles grouped by year with a visual picker. Each cycle row shows a colour-coded tag: Live (green) for the currently active cycle, Upcoming (grey) for future cycles, and Past (slate blue) for completed ones. The active cycle is always shown first in the list.
- **Cycle management**: Create and label reporting cycles. The system prepares the next 8 cycles automatically on every admin login.
- **Batch label editing**: Rename any cycle label inline without navigating away.

**Export and Reporting:**
- **Excel export**: Export the full attendance matrix for any cycle as a real Excel workbook (.xlsx). Includes per-person rates, totals, a legend, colour-coded status cells, and a dedicated Meal column showing how many days each reservist was eligible for meal allowance (clocked out with 6h+ worked). The Shift column shows the department label (Ops Security, Crime Prevention, or Logistics and Finance) and a Contact column shows each person's phone number. Personal leave days are shown as PL in amber rather than A, matching MC styling. The sheet opens with a styled title row and consistent row heights. The header rows freeze so they stay visible when scrolling down. Attendance rates are calculated as present days divided by recorded days (present + MC/Leave + absent), matching the People tab, so mid-cycle exports show accurate rates rather than rates diluted by future unrecorded days.
- **Print report**: Generate a formatted A4 attendance report, printable or saveable as PDF directly from the browser without leaving the app. Includes a Meal Claims summary stat and per-person meal-eligible day count alongside the attendance totals. The Shift column shows the department label and a Contact column shows each person's phone number. Absent cells are shown with a red background. Personal leave days are shown as PL in amber. Future dates with no record yet are shown as a blue P (Pending) rather than red A, so absences are not inflated by days that have not happened yet. Today's date with no record also shows as blue P if the day is still in progress.
- **WhatsApp attendance summary**: One tap generates the day's attendance summary. A preview modal lets you review and edit the text, copy it to clipboard, or send it directly to the unit group chat.
- **Per-person history export**: Export any individual's attendance history to Excel (.xlsx) from within the history modal. Rows are colour-coded by status (present, MC, absent, leave).

**Member Search:**
- **Cross-cycle search**: Search across all cycles and all personnel by name, contact, or status.
- **Filter by cycle or status**: Narrow results to a specific cycle or attendance status.
- **Permanent deletion**: Permanently delete a person's account and all associated records. Supports bulk selection and bulk delete.

### For Master Level (Super Admin)

All supervisor capabilities, plus:

- **Department switcher**: Switch the entire admin view between departments (Ops Security and Crime Prevention Office/CPO) using a dropdown in the header. Each department's last-selected cycle is remembered independently, so switching back restores the previous context.
- **Cross-department isolation**: All data (personnel, cycles, attendance, leave requests, signup requests, and realtime updates) is fully scoped to the active department. Switching departments clears the current view and reloads fresh data for the selected department.
- **Create supervisor accounts**: Add new admin accounts directly within the app.
- **Remove supervisors**: Demote any admin back to reservist status. Demoted supervisors return to the reservist pool automatically.
- **Promote to supervisor**: Promote any existing reservist to admin status. Search by name with cycle filters.
- **Supervisor password reset**: Reset any supervisor's password directly from the Team tab, without database access.
- Displayed with a **Master** label in the interface.

---

## Accountability and Audit Trail

Every action in the system is recorded:

- Every check-in carries a timestamp and the GPS distance from HQ at the moment of submission. The distance is visible on each log card in the admin view. A 0 m reading is highlighted in amber as a possible GPS spoofing indicator.
- Check-in times are stamped server-side at the moment the request is processed. Clients cannot supply a backdated or future time: offline check-ins are validated against server time and rejected if more than 4 hours old.
- Late arrivals are flagged automatically. If more than one hour late, the reservist must submit a written reason, which is stored alongside the attendance record and displayed inline on the log card.
- If GPS verification is bypassed (due to GPS failure or supervisor authorisation), this is permanently marked in the log with a visible indicator.
- If a supervisor manually corrects a reservist's times, the record is flagged as admin-entered, and the edit log includes the editor's name and timestamp.
- All leave and MC approvals record who approved them and when. Rejections record the reviewer and reason.
- **Absences are written automatically.** If a reservist does not check in by midnight, the system marks them absent through two independent processes (one in the app, one on the server) to ensure no gaps occur even if the supervisor is offline. See [Auto-Absent](#auto-absent).
- Data is stored in a managed cloud database. Nothing relies on a local file or spreadsheet.
- Every significant user action (check-in phases, roster changes, leave decisions, personnel management, exports, and account changes) is written to a dedicated `audit_log` table and visible in the ReservistGO Monitor.

---

## ReservistGO Monitor

A separate, login-protected admin console accessible at `/admin`. Restricted to supervisor and master accounts only.

**Access:** Navigate directly to `/admin`. If you are already logged into the main app as a supervisor or master, the monitor signs you in automatically using your existing session with no second login required. Reservists and guests are shown an access-denied screen.

**Session isolation:** The monitor maintains its own session independently of the main app. Logging out of either does not affect the other. A deactivated account cannot access the monitor even if a session token is present.

### What it shows

**Live activity feed:** Every recorded action appears as a row in the feed, ordered newest first. Each row shows:
- Who performed the action (name, role badge, avatar)
- What they did (plain-language action label)
- Which category and department the action belongs to
- A relative timestamp ("2m ago") and an absolute time
- Expandable metadata panel (tap any row with details to see the full payload: target IDs, dates, counts, corrected times, etc.)

Hovering over a profile photo in the feed shows an enlarged version of the photo directly above the avatar, without opening any modal.

**Stats bar:** Four tiles at the top update on every load:
- Total events today
- Unique actors today
- Total events this week
- Top category today

### Filtering

- **Search:** Full-text filter across actor name, action, and target name with 300 ms debounce.
- **Date range:** From/to date pickers to narrow to any window.
- **Category pills:** Filter by Attendance, Leave, Signup, Personnel, Cycle, Export, Account, or Admin. Selecting a pill resets the offset and reloads. Multiple pills can be active at once.
- **Department selector (master only):** Switch between departments to scope the entire feed to one department, or leave unset to view all.

### Actions logged

| Action key | Display label | Who triggers it |
|---|---|---|
| `checkin.p1` | Phase 1: Checked in | Reservist |
| `checkin.p2` | Phase 2: Lunch out | Reservist |
| `checkin.p3` | Phase 3: Returned from lunch | Reservist |
| `checkin.p4` | Phase 4: Checked out | Reservist |
| `checkin.late_reason` | Submitted late reason | Reservist (when more than 1 hour late) |
| `roster.status_set` | Set attendance status | Admin: manual mark Present, MC, or Absent |
| `roster.mark_all_absent` | Marked all absent (N) — count of affected records shown | Admin |
| `roster.mark_all_present` | Marked all present (N) — count of affected records shown | Admin |
| `roster.times_corrected` | Corrected attendance times | Admin: via time correction modal |
| `roster.person_note_saved` | Saved person note | Admin |
| `roster.log_note_saved` | Saved log note (with note text shown below the action label; shows "Note cleared" if the note was saved empty; shows a strikethrough and new text if an existing note was overwritten) | Admin |
| `roster.welfare_note_saved` | Saved welfare note | Reservist (own record) or Admin |
| `roster.missed_note_saved` | Saved missed-day note | Admin: note on a missed day in history |
| `leave.submitted` | Submitted MC request / Submitted Personal Leave request — leave type shown | Reservist |
| `leave.cancelled` | Withdrew MC request / Withdrew Personal Leave request — leave type shown | Reservist |
| `leave.approved` | Approved [name]'s MC request / Approved [name]'s Personal Leave request — leave type shown | Admin |
| `leave.rejected` | Declined [name]'s MC request / Declined [name]'s Personal Leave request — leave type shown; rejection reason shown inline below the label | Admin |
| `leave.bulk_approved` | Bulk approved N leave requests — count shown | Admin |
| `leave.bulk_rejected` | Bulk declined N leave requests — count shown | Admin |
| `signup.request_submitted` | Submitted signup request | Reservist (new or returning) |
| `signup.approved` | Approved [name]'s signup | Admin |
| `signup.rejected` | Declined [name]'s signup | Admin |
| `signup.reopened` | Re-opened [name]'s signup | Admin |
| `signup.bulk_approved` | Bulk approved N signups — count shown | Admin |
| `personnel.added` | Added [name] to roster | Admin |
| `personnel.re_enrolled` | Re-enrolled [name] | Admin |
| `personnel.removed` | Removed [name] from roster | Admin |
| `personnel.bulk_added` | Bulk added N personnel, skipped M — counts shown | Admin |
| `personnel.permanently_deleted` | Permanently deleted [name]'s record | Admin |
| `personnel.bulk_deleted` | Permanently deleted N records — count shown | Admin |
| `personnel.password_reset` | Reset [name]'s password | Admin |
| `batch.created` | Created cycle [name] | Admin |
| `batch.deleted` | Deleted cycle [name] | Admin |
| `batch.activated` | Activated reporting cycle | System (auto-activation on login) |
| `batch.label_edited` | Renamed cycle to [new name] | Admin |
| `batch.broadcast_updated` | Updated cycle notice | Admin |
| `batch.no_report_toggled` | Toggled no-report day for [date] | Admin |
| `batch.no_report_bulk` | Set N no-report days — count shown | Admin |
| `export.excel` | Exported Excel report for [cycle] | Admin |
| `export.print` | Print report for [cycle] | Admin |
| `export.person_history` | Exported [name]'s history | Admin |
| `account.name_changed` | Changed name to [new name] | Any user |
| `account.password_changed` | Changed account password | Any user |
| `account.photo_uploaded` | Uploaded profile photo | Any user |
| `account.photo_removed` | Removed profile photo | Any user |
| `account.deleted` | Deleted own account | Any user |
| `admin.added` | Added [name] as supervisor | Master |
| `admin.demoted` | Demoted [name] | Master |
| `admin.promoted` | Promoted [name] to supervisor | Master |

---

## Access Control

The system uses three permission levels:

| Role | Who | Access |
|---|---|---|
| Reservist | NS personnel | Own check-in, leave requests, and attendance history (scoped to their department) |
| Admin | Supervisors and staff officers | Full roster and attendance management, leave approval, personnel records, time correction (scoped to their department) |
| Master | Command level | Everything Admin can do, plus managing all supervisor accounts and switching between departments |

Accounts are tied to Singapore mobile numbers. All sessions expire when the browser is closed. Idle sessions time out after 20 minutes.

Row-level security policies are enforced at the database level, not just in the app:

- Reservists can only write attendance records for today in SGT (Asia/Singapore timezone), not UTC, so a reservist cannot exploit a UTC midnight window to submit records for the wrong date.
- Admin accounts can only read, update, or delete signup requests that belong to their own department. Superadmins retain full cross-department visibility.
- Leave approval and rejection check department membership at the application layer before any database write, so an admin cannot action a request from a different department even if it reaches the handler.
- Signup status transitions are guarded: reopen only works on rejected requests and reject only works on pending ones, preventing race conditions when two admins process the same request simultaneously.
- Reservists are capped at 10 pending leave requests at any one time. Submitting beyond this limit returns an error.

---

## Data Privacy

ReservistGO collects only what is operationally necessary:

- **No NRIC, rank, or service details**: accounts require only a name, phone number, and password.
- **No location history**: GPS is used solely at the moment of check-in to verify proximity to HQ. Exact coordinates are never recorded; only the distance from HQ in metres is stored.
- **No device data**: the app does not collect device identifiers, browser fingerprints, or any information about the user's phone.
- **Passwords are never stored in plain text**: all passwords are encrypted by the authentication service before storage. Even administrators cannot view a user's password.
- **Profile photos are optional**: avatars are stored only if the user chooses to upload one, and can be removed at any time.
- **Sessions leave no permanent trace**: login sessions are held in the browser's temporary memory and are cleared when the tab is closed or after 20 minutes of inactivity.

The only personal data held in the system is: name, phone number, and attendance records.

---

## Returning Reservist Workflow

When a reservist's account is deactivated at the end of a cycle, their login credentials are preserved but access is blocked. If they return for a new cycle:

1. The reservist logs in with their existing phone number and password.
2. The app detects the inactive account and automatically submits a re-enrollment request on their behalf. If the request cannot be submitted (network failure), a clear error message is shown with instructions to contact the supervisor directly.
3. The supervisor sees the request in the Requests tab, labelled **Returning**, and approves it with one tap.
4. The reservist's account is reactivated and assigned to the current cycle. They can log in immediately.

No manual coordination, no new account creation, no password reset needed.

If the supervisor adds a returning reservist directly via the Add Personnel form, they can search by name or contact to find the removed record. Selecting it triggers the re-enroll flow, reactivating the existing account without creating a new one.

When a supervisor deactivates a reservist or when a cycle ends and auto-deactivation fires, all pending leave requests for that person are cancelled automatically. Approved leaves already on record are preserved for audit purposes.

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

**Builders** read the current state and return a flat object of UI properties for the template. They contain no side effects: just pure computation. This makes the UI predictable; the same state always produces the same output.

**Handlers** respond to user actions. They call the database, update state via `setState`, and trigger side effects like toasts and haptic feedback. Handlers never read from the DOM directly.

The template in `index.html` is driven by `sc-if`, `sc-for`, and `{{ prop }}` expressions. Because the template engine does not support ternary expressions or arithmetic, all computed values (styles, labels, badge counts, pagination state) are pre-computed as named properties in the builder layer before the template consumes them.

### Code Structure

```
assets/                 - Static icons (PWA home screen, apple-touch-icon)

js/
├── support.js          - Compiled declarative component runtime (do not edit)
├── db-client.js        - Supabase client initialisation (creates the shared _db instance)
├── db.js               - DB namespace aggregator; collects all sub-modules into a single DB.* object
├── db/                 - Individual query modules, one per table
│   ├── auth.js         - Authentication (login, logout, session, password)
│   ├── attendance.js   - Attendance CRUD, phase logging, time correction, welfare notes
│   ├── audit.js        - Audit log insert and query
│   ├── batches.js      - Cycle management queries
│   ├── leaves.js       - Leave request queries
│   ├── no-report-days.js - No-report day queries
│   ├── personnel.js    - Personnel queries
│   ├── realtime.js     - Realtime subscription setup
│   ├── signups.js      - Signup request queries
│   └── storage.js      - Avatar storage queries
├── state.js            - Initial application state factory
├── utils.js            - Date helpers, contact validation, phase window logic, formatting, SG holiday data
├── component.js        - Component lifecycle, realtime wiring, offline queue retry logic
├── config.js           - Runtime configuration (Supabase credentials, do not commit)
│
├── builders/           - Pure functions: (state) -> flat object of UI props for the template
│   ├── auth.js         - Login and signup screens
│   ├── nav.js          - Navigation bar, offline queue badge, pending-action indicators
│   ├── checkin.js      - Reservist check-in screen, phase tiles, GPS state, banners, work timer
│   ├── calendar.js     - Attendance calendar, day detail, attendance history summary
│   ├── briefings.js    - Info tab (shift info, leave request history with dedup and filter pills)
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
    ├── export.js        - Excel (.xlsx) attendance export and print/PDF report generation
    ├── roster.js        - Manual status override, time correction, search, sort, day navigation, roster card expand/collapse
    ├── account.js       - Profile photo upload/remove, password change, name change, notification permissions
    └── misc.js          - Toast, navigation helpers, department switching, WhatsApp share/copy, page refresh

scripts/
    ├── build-config.js       - Generates js/config.js from environment variables at Vercel build time
    └── sql/
        ├── audit_log.sql         - audit_log table schema and RLS policies
        ├── rls_policies.sql      - Row-level security policies for all tables
        ├── supabase_cron.sql     - SQL to enable the auto-absent and auto-deactivation scheduled jobs
        └── migrations/           - One-time scripts already applied to the live database
            ├── add_departments.sql           - Added department columns to an existing deployment
            ├── add_lnf_department.sql        - Added L&F as a department
            ├── add_nrd_department.sql        - Added NRD as a department
            ├── fix_avatar_storage_policy.sql - Storage policy fix for avatar uploads
            ├── fix_lnf_batch_dates.sql       - Corrected L&F cycle date values
            └── renumber_lnf_cycles.sql       - Renumbered L&F cycle labels
```

`index.html` is the single-page template that wires all builders and handlers together. The `<x-dc>` element at the top of the file is where all deployment-specific configuration lives.

`admin/index.html` is the ReservistGO Monitor, a self-contained single-file admin console. It has its own Supabase client (separate session storage key `ops-monitor-session`), its own login form, and no dependency on the main app's JS files. On first visit within the same tab as an authenticated admin session, it auto-logs in by reading the main app's session from `sessionStorage` under `ops-auth`.

### Key Patterns

**Attendance state cache**: Today's attendance is stored in `state.attendance`. Past and future dates are stored in `state.attendanceCache`, keyed by date string (`YYYY-MM-DD`). Roster handlers use `_viewAttMap`, `_setViewEntry`, and `_delViewEntry` helpers to read and write the correct map depending on the current view offset.

**Approved leave cache**: `state.approvedLeavesCache` maps date keys to a map of `personnelId: leaveType`. It is populated when attendance is fetched and updated when leave is approved or voided. The roster and calendar builders use it to colour-code reservists who are absent due to approved leave rather than unexplained absence. When a supervisor overrides an absent status to present, the cache entry is cleared immediately alongside the database void.

**Offline queue**: When the device is offline, check-in actions are pushed to `this._offlineQueues` and persisted to `sessionStorage`. On reconnect, `_onOnline` replays the queue in order against the database.

**Realtime**: Supabase Realtime channels push row-level changes for attendance (admin view), leave status (reservist view), new requests (admin notifications), and personnel status changes (reservist view) without polling. If a reservist's account is deactivated while they are logged in, the personnel status channel fires immediately, shows a toast, and logs them out within a few seconds. If a reservist self-deactivates, the admin's personnel deactivation channel fires and removes the person from the active roster in real time. All subscription errors (channel errors, timeouts) are logged to the console for debugging rather than failing silently. When an admin corrects a past-date attendance record, the realtime channel fires on the reservist's session and updates their history state immediately, so edited times appear in the reservist's shift history without a page refresh.

**Batch provisioning**: On every admin login, the system ensures a live batch exists and that 8 future batches are pre-created. This prevents the cycle selector from being empty when a new cycle starts. Batch creation is idempotent: if a batch with the same start date and department already exists, the existing record is returned rather than creating a duplicate.

**Request deduplication**: The reservist's Requests history deduplicates entries by date. If multiple requests exist for the same date (for example, an approved request followed by a withdrawn re-submission), only the most relevant one is shown. Priority order: pending > approved > rejected > withdrawn. This prevents the list from showing confusing duplicate rows.

**Person history pagination**: The person history modal is paginated at 15 records per page. Status filters (All, Present, MC, Absent) are applied before pagination. Page state is reset when the filter changes.

**Department isolation**: All database queries, realtime subscriptions, and state updates are scoped to the active department. The `_myDept()` helper on handlers returns the master account's manually selected department or the user's own department (set at signup). Switching departments clears all cached data (personnel, batches, attendance, requests) and reloads from scratch for the new department. Realtime subscriptions (attendance, leave requests, personnel deactivations) operate on unfiltered Supabase channels because the `leave_requests` table has no department column and Realtime cannot filter on joined tables; instead each callback guards against cross-department rows by checking the incoming `personnel_id` against `state.personnel`, which is always department-scoped. Leave approval and rejection verify that the requester belongs to the admin's department before any database write. Approved leave lookups (`listApprovedInRange`) filter via a personnel join so only leaves belonging to the active department are returned; this is used in both the export pipeline and attendance statistics. No-report day queries always pass the active department so stand-downs set by one department do not affect another department's reporting day calculations, including when navigating to past batches. Contact lookups (`findByContact`) are scoped to the active department so a matching record in another department is never returned. Signup `reopen` is guarded to only act on rejected requests; `reject` is guarded to only act on pending ones, preventing double-processing in concurrent admin sessions.

### Database Schema

All data is stored in a structured cloud database (PostgreSQL), with seven tables:

**Personnel** - one row per person.

| Field | What it stores |
|---|---|
| Name | Full name |
| Contact | Phone number (used as login) |
| Shift | Office (0900 to 1800) |
| Role | Reservist, Admin, or Master |
| Department | Which department the person belongs to (ops_security, cas, or lnf) |
| Cycle | Which reporting cycle they belong to |
| Active | Whether the account is currently active |
| Notes | Supervisor notes on the person |
| Created by | Name of the admin who added or re-enrolled the person (blank for self-signups) |
| Deactivated at | Timestamp of when the account was last deactivated |

**Cycles (Batches)** - one row per reporting cycle.

| Field | What it stores |
|---|---|
| Label | e.g. "Cycle 15/2026" |
| Department | Which department this cycle belongs to (ops_security or cpo) |
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
| Type | MC or Personal Leave |
| Date requested | The date the leave is for |
| Reason | Written reason from the reservist |
| Status | Submitted (awaiting review), Approved, Rejected, or Cancelled |
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

**Audit log** - one row per recorded user action, written by the app on every significant event.

| Field | What it stores |
|---|---|
| Actor ID | Personnel ID of the person who performed the action |
| Actor name | Display name at time of action |
| Actor role | Role at time of action (reservist, admin, master) |
| Department | Department context in which the action occurred |
| Category | Broad category (attendance, leave, signup, personnel, batch, export, account, admin) |
| Action | Specific action key (e.g. `checkin.p1`, `leave.approved`, `roster.times_corrected`) |
| Target ID | Personnel ID of the person affected, if applicable |
| Target name | Display name of the affected person, if applicable |
| Meta | JSONB payload with action-specific details (dates, counts, corrected times, etc.) |
| Created at | Timestamp of the action |

### Auto-Absent

Reservists who do not check in on a reporting day are marked absent automatically through two independent processes:

1. **In the app**: when the clock ticks past midnight, the app immediately marks anyone still showing as unchecked for the previous day. Approved leaves and pending leave requests for that date are excluded automatically.
2. **On the server**: a scheduled task runs at 00:05 SGT every day and writes absent records for any active reservist with no entry for the previous weekday. This runs independently of whether any supervisor or reservist has the app open.

### Auto-Deactivation

A second scheduled task runs at 02:00 SGT every day. It deactivates any personnel whose batch's dekit date has already passed, and in the same operation cancels any pending leave requests they still have open. This ensures that a reservist whose cycle has ended cannot have outstanding leave requests approved after the fact. The app also performs this check on every login and on every midnight date rollover, so deactivation is enforced through three independent paths.

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
5. Run `scripts/sql/supabase_cron.sql` to enable the automatic absent and auto-deactivation jobs. Requires the `pg_cron` extension (enabled by default on Supabase Pro).

> **Upgrading an existing deployment?** If you already have the tables from an earlier version, the migration scripts in `scripts/sql/migrations/` document every schema change applied since the initial release. Run only the ones that apply to your version.

> **Updating the cron jobs on an existing deployment?** If you previously ran `supabase_cron.sql` and need to apply the updated version, unschedule the existing job first before re-running the file: `SELECT cron.unschedule('deactivate-expired-personnel');`

**Full schema:**

```sql
CREATE TYPE department_type AS ENUM ('ops_security', 'cas', 'lnf');

CREATE TABLE personnel (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_id UUID,
  name TEXT NOT NULL,
  contact TEXT,
  shift TEXT CHECK (shift IS NULL OR shift IN ('OFFICE')),
  role TEXT NOT NULL DEFAULT 'reservist' CHECK (role IN ('reservist', 'admin', 'master')),
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

CREATE TABLE audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id UUID,
  actor_name TEXT,
  actor_role TEXT,
  department TEXT,
  category TEXT NOT NULL,
  action TEXT NOT NULL,
  target_id UUID,
  target_name TEXT,
  meta JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Step 2 - Create the master account

Sign up through the app's login screen using your phone number. Then run this one-time command in the Supabase SQL editor to elevate that account to Master level:

```sql
UPDATE personnel SET role = 'master' WHERE contact = '<your_contact>';
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
  hq-range="250"
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

---

## Supervisor Quick-Start

This section is for a supervisor taking over the system for the first time.

### First-time setup

1. Sign up through the app login screen using your mobile number. Your account will initially be created as a reservist.
2. Have the Master account log in and promote your account to Admin (People tab > Team tab > add supervisor) or promote an existing reservist to admin from the People tab.
3. Once promoted, log out and log back in. You will land on the supervisor dashboard.

### Starting a new cycle

The system auto-creates the next 8 cycles on every admin login, so no manual cycle creation is needed in most cases.

1. Go to the Overview tab and tap the cycle label at the top to open the cycle picker.
2. Select the cycle you want to activate and tap "Set as Live". Only one cycle is live at a time.
3. Set the correct start and end dates if they are not already filled in.
4. Mark any no-report days (public holidays, stand-downs) from the cycle management panel.
5. Enable meal allowance if it applies to this cycle.
6. Post a cycle notice if there is anything all reservists need to see on their check-in screen.

### Daily routine

1. Open the Roster tab each morning to see who has reported.
2. Use the status filters (Present, Absent, Pending) to focus on who still needs attention.
3. Check the Requests tab for any new leave or MC requests and approve or reject them.
4. At end of day, use "Mark all absent" to write absence records for anyone still showing as pending. This is also done automatically at midnight, but doing it manually confirms the day is closed.
5. Use the WhatsApp summary button to send the day's headcount to the unit group chat.

### End of cycle

1. Export the attendance matrix from the Overview tab (Export button) for records.
2. Print or save the PDF attendance report if a hardcopy is required.
3. Go to the People tab and deactivate all reservists for the cycle. Their accounts are preserved and can be re-enrolled for the next cycle.

### Managing personnel

- To add new reservists: People tab > Add Personnel. Paste a list of names and contact numbers for bulk adds.
- To approve a self-signup: Requests tab > Signups section. Each request shows whether the person is new or returning.
- To reset a forgotten password: People tab > find the person > Reset Password.
- To re-enroll a returning reservist: either approve their re-enrollment request in the Requests tab, or search for them by name in the Add Personnel form and select the existing record.

---

## Troubleshooting

### Reservist cannot check in

- **GPS not working in WhatsApp or Instagram browser**: The in-app browser blocks GPS. The app will detect this and show instructions to open the link in Chrome or Safari instead.
- **GPS cannot detect location** (permission denied, signal unavailable, or timeout): a bypass option appears immediately. The reservist can check in without GPS and the record will be flagged as bypassed in the log. Note: if GPS works but the reservist is simply out of range, no bypass is offered. They must move closer to HQ and try again.
- **Button is greyed out or unresponsive**: The reservist may already have a check-in recorded for that phase. Check the Log tab to confirm. If the record is wrong, edit it from the Log tab.
- **Reservist sees the wrong phase**: Phase windows are time-based. If they are outside the window, the current phase card may not be active yet. Check the configured phase times.

### Reservist forgot their password

Go to People tab, find the person, and tap Reset Password. Enter and confirm a new temporary password and share it with the reservist verbally. They can change it later from their account settings.

### Attendance status is wrong

Open the Log tab, navigate to the date in question, find the person, and tap the edit icon to correct their status or times. All edits are flagged as admin-entered with your name and a timestamp.

### A reservist is showing as absent but was present

If the auto-absent job ran before the reservist checked in, their status may have been set to absent. Correct it manually from the Roster or Log tab by setting their status to Present and entering their times.

### Clock-out is missing

If a reservist is marked present but has no Phase 4 time, the log entry's OUT column will show a dash on an orange background. Open the log entry and add the correct end-of-shift time. This affects meal allowance eligibility, so correct it before the end of the day where possible.

### Realtime updates are not appearing

The live roster requires a stable internet connection. If updates stop appearing, refresh the page. The connection re-establishes automatically on reload.

### Session expired mid-shift

Sessions expire after 60 minutes or after 20 minutes of inactivity. A warning appears beforehand with a one-tap option to extend. If a session expires unexpectedly, the reservist or supervisor just logs back in. No data is lost.

### The cycle picker shows no cycles

This should not happen after an admin login, as the system auto-creates 8 upcoming cycles. If the picker is empty, log out and log back in to trigger the provisioning step.

### A signup request is not appearing

Signup requests only appear for admins scoped to the correct department. If you are a Master account, check that the department switcher in the header is set to the correct department.

---

## Testing Checklist

Use this checklist when verifying a deployment or after making changes. Test each role in a real browser on a mobile device where possible. The demo buttons on the login screen cover basic flows; use real accounts for anything involving the database, realtime, or GPS.

---

### Reservist

#### Auth
- [ ] Sign up with a new phone number and password - request appears in admin Requests tab as New
- [ ] Sign up with a number that was previously approved and deactivated - request appears as Returning
- [ ] Sign up with a number that already has a pending request - error shown, no duplicate created
- [ ] Sign up with a number that was previously rejected - error shown
- [ ] Log in with correct credentials - lands on check-in screen
- [ ] Log in with wrong password - error shown, no access granted
- [ ] Log out - confirmation dialog appears, session ends on confirm
- [ ] Close and reopen tab before session expires - still logged in (session persists in memory)
- [ ] Leave tab idle for 18 minutes - idle warning banner appears
- [ ] Leave tab idle for 20 minutes - session ends, redirected to login
- [ ] Admin deactivates a reservist who is currently logged in: reservist sees a toast within a few seconds and is logged out automatically
- [ ] Reservist self-deactivates while admin is logged in: admin sees a real-time toast naming the reservist and the person is removed from the active roster immediately, no page refresh needed
- [ ] Deactivated reservist logs in with a live batch: re-enrollment request auto-submitted, error shown with instructions if submission fails
- [ ] Deactivated reservist logs in with no live batch: clear error shown, no re-enrollment request created
- [ ] Deactivated reservist logs in with a pending re-enrollment request: message shown that the request is awaiting approval, no duplicate request created
- [ ] Reservist account auto-deactivated at dekit date on login: deactivation message shown, cannot re-enter the app
- [ ] Reservist session active when midnight rolls to the dekit date: app detects the date change, deactivates account, and logs out without requiring a page refresh
- [ ] Admin deactivates a reservist who had pending leave requests: all pending requests are cancelled (verify in DB or admin Requests tab shows none for that person)
- [ ] Reservist self-deletes their account: pending leave requests cancelled, deactivation message shown on login screen
- [ ] Adding a person whose contact has multiple DB records (e.g. old deactivated duplicate): active record is preferred, or if all inactive, the most recent is selected for re-enroll
- [ ] Signup submitted using a contact number that belongs to an existing admin or master account: if the admin approves the request, approval fails gracefully with a message and the signup is returned to pending status
- [ ] Cron auto-deactivation: after a batch's dekit date passes and the cron runs, any pending leave requests for those personnel are also cancelled (verify in DB that no pending rows remain for deactivated personnel)

#### Check-in (Ops Security - 4 phases)
- [ ] Phase 1 (from 08:00): Locate Me button appears, GPS resolves within range, Check In button becomes active, tap to record
- [ ] Phase 1 outside window: card is visible but button is greyed out
- [ ] Phase 2 (Lunch out, from 11:00): Locate Me not required, button is direct
- [ ] Phase 3 (Return from lunch, from 13:00): GPS verify required, records on tap
- [ ] Phase 4 (Check out, from 14:00): direct button, records timestamp
- [ ] All 4 phases done: "All done for today" state shown
- [ ] Late check-in (more than 1 hour after 0900): late reason modal appears, reason recorded and visible inline on log card
- [ ] GPS cannot detect location (permission denied or timeout): bypass option appears immediately
- [ ] GPS out of range: no bypass offered, must retry or move closer to HQ
- [ ] GPS bypass: check-in completes, record is flagged as GPS bypassed in admin log
- [ ] Opened in WhatsApp or Instagram in-app browser: banner shown with instructions to open in Chrome or Safari
- [ ] Offline check-in: disable network, tap check-in, pending badge appears; restore network, record submits automatically

#### Check-in (CPO - 2 phases)
- [ ] Phase 1 (check in): GPS verify, records on tap
- [ ] Phase 2 (check out): records timestamp
- [ ] No phases 3 or 4 visible

#### Leave and MC requests
- [ ] Submit MC request for today or a future date - appears in admin Requests tab with amber badge
- [ ] Submit Personal Leave request - appears in admin Requests tab with amber badge
- [ ] Try to submit a second request for a date already covered by a pending request - error shown
- [ ] Try to submit a request for a past date - error shown
- [ ] Try to submit a request for a weekend or public holiday - error shown
- [ ] Try to submit a request for a date outside the current cycle - error shown
- [ ] Withdraw a pending request from the check-in screen - request removed
- [ ] Withdraw a pending request from the Requests history (Info tab) - status changes to Withdrawn
- [ ] Multiple requests for the same date: only one entry shown in history (pending shown over approved, approved over declined)
- [ ] View Requests history: type badge (MC and Personal Leave both amber) and status badge (Submitted, Approved, Declined, Withdrawn) shown correctly
- [ ] View a declined request: supervisor's decline reason displayed
- [ ] Approved MC for today: check-in phases hidden, "Marked as MC" card shown with Share to group and Request absence buttons
- [ ] Approved Personal Leave for today: status chip shows amber "Personal Leave", "On Personal Leave" card shown with Request absence button
- [ ] Absent with no approved leave (auto-marked or admin-marked): status chip shows red "Absent", "Marked absent" card shown
- [ ] After admin voids an approved leave (marks present): reservist can re-submit a new request for that date

#### Calendar (Attendance tab)
- [ ] Present days shown in green
- [ ] MC days shown in amber with solid border
- [ ] Approved MC request for a future date shown in amber with solid border
- [ ] Pending (submitted) MC request for a future date shown with dashed amber border
- [ ] Approved Personal Leave for a future date shown in amber with solid border
- [ ] Pending Personal Leave request shown with dashed amber border
- [ ] No-report days shown in slate blue
- [ ] Absent days shown in red
- [ ] Days with missing clock-out shown in orange with dashed border
- [ ] Tap any calendar day: detail panel shows correct label, sub-text, and colour
- [ ] Tap a past day with approved personal leave: detail panel shows "Personal Leave" in amber, not "Absent"

#### Info tab
- [ ] About section shown with correct app description
- [ ] Shift info shown correctly (title, window, items)
- [ ] Team directory lists batchmates (not the logged-in user, not admins)
- [ ] Tap a contact number in team directory: copies to clipboard, toast appears
- [ ] WhatsApp link button opens WA chat with the correct number
- [ ] WA group link shown only if configured

#### Attendance tab (post-cycle)
- [ ] After batch end date: no Pending row shown for today in Shift History
- [ ] Congrats card and deactivation notice appear in Attendance tab during post-cycle window (after end date, up to and including dekit date)
- [ ] Deactivation notice shows the correct dekit date

#### Account settings
- [ ] Change display name: saved and reflected in header immediately
- [ ] Change password: re-login with new password works; old password rejected
- [ ] Upload profile photo: photo appears in header and team directory
- [ ] Tap own photo: lightbox opens
- [ ] Remove photo: reverts to initials

---

### Admin (Supervisor)

#### Auth and navigation
- [ ] Log in as admin: lands on Overview tab, not check-in
- [ ] All 4 tabs visible: Overview, Roster, Log, People
- [ ] Logout confirmation works

#### Overview tab
- [ ] Stat tiles show correct Present, Leave, Absent, Pending counts for today
- [ ] Pending requests card shows avatars, copyable contact numbers, type badges, and time
- [ ] Tap Approve or Decline on a pending request from the Overview tab
- [ ] Calendar shows current day highlighted
- [ ] Realtime: open a second browser tab as a reservist and check in - Overview updates without refresh

#### Roster tab
- [ ] All active reservists for the live cycle listed
- [ ] Filter by Present, MC, Absent, Pending - list updates correctly
- [ ] Search by name - list filters correctly
- [ ] Status dropdown shows current status (Pending, Present, MC, Personal Leave, or Absent) with matching border colour
- [ ] Select Present from dropdown: status updates immediately in roster and log
- [ ] Select MC from dropdown: status updates
- [ ] Select Personal Leave from dropdown: status set to absent with approved leave record created
- [ ] Select Absent from dropdown: status updates, any approved leave for that day is voided
- [ ] Mark All Absent: confirmation step shown, all Pending become Absent
- [ ] Mark All Present: confirmation step shown, all Pending become Present
- [ ] Navigate to yesterday (viewOffset -1): log reads from cache, not live attendance
- [ ] Navigate to a future date (viewOffset +1 or more): status dropdown not shown
- [ ] Attendance percentage visible on each roster card when stats are loaded

#### Log tab
- [ ] All personnel listed for the viewed date
- [ ] Filter by status (Present, MC, Absent) - list updates
- [ ] Search by name - filters correctly
- [ ] Edit times for a present record: all 4 phase fields editable, save updates the record and flags it as admin-entered
- [ ] Add a welfare note to a record: note saved and visible on next load
- [ ] Tap a person's name in the log: opens their full history modal
- [ ] Late check-in: "Late" badge shows the written reason inline (e.g. "Late - Dental appointment")
- [ ] Late check-in with no reason given: badge shows "Late - No reason"
- [ ] Missing clock-out: OUT column shows a dash on orange background (no separate badge row)
- [ ] WhatsApp summary button: generates text, preview modal opens, copy and send both work

#### Requests tab (Signups)
- [ ] Pending signups listed with name, contact, timestamp, New or Returning badge; returning reservists who have a profile photo show it on the card instead of initials
- [ ] Tap contact number: copies to clipboard
- [ ] Approve a signup: person appears in roster on next load; request disappears from pending list
- [ ] Decline a signup: request moves to Declined section
- [ ] Reopen a declined signup: request returns to Pending
- [ ] Search by name: filters list
- [ ] Filter by New: only new signups shown
- [ ] Filter by Returning: only returning signups shown
- [ ] Red dot on search icon when filter is active
- [ ] Select all (checkbox): selects all visible signups
- [ ] Bulk approve selected signups: all approved in one action

#### Requests tab (Leave)
- [ ] Pending leave requests listed with avatar, name, contact, type badge (MC and Personal Leave both amber), time
- [ ] Approve a request: removed from list, reservist's status updates if for today
- [ ] Decline a request: enter reason, confirm - request shows declined badge and reason on reservist side
- [ ] Bulk approve multiple requests: all approved, toast confirms count
- [ ] Bulk reject: requires reason, applied to all selected
- [ ] Search and filter by type (All, MC, Personal Leave): list filters correctly
- [ ] Expired requests (older than 48 hours): shown with Expired badge
- [ ] Mark a reservist with approved leave as Present: leave is voided, reservist can re-submit

#### People tab - Roster view
- [ ] All personnel listed with name, contact, shift, attendance stats
- [ ] Search by name or contact: filters correctly
- [ ] Tap the chevron on a card: action bar expands (History, Note, Reset PW, Remove)
- [ ] Only one card expanded at a time - opening another collapses the previous
- [ ] History: opens person's full attendance history
- [ ] Note: opens note editor, save persists the note on the card
- [ ] Reset PW: enter and confirm new password, save
- [ ] Remove: confirmation shown, person deactivated and removed from roster
- [ ] Approved by / Added by label correct for each card

#### People tab - Bulk add and re-enroll
- [ ] Bulk add: paste names and numbers, preview list, add all
- [ ] Search for removed person by name: existing record found, re-enroll triggers
- [ ] Re-enrolled person receives a Returning signup request

#### Cycle management
- [ ] Open cycle picker from Overview tab
- [ ] Cycle picker shows correct tags: Live (green) on the active cycle, Past (slate blue) on completed cycles, Upcoming (grey) on future cycles; active cycle shown first
- [ ] Set a cycle as Live: only that cycle is live, previous live cycle is no longer live
- [ ] Label editing: rename a cycle inline
- [ ] Add a no-report day: date highlighted in slate on reservist calendar
- [ ] Bulk add no-report days: paste multiple dates, all applied
- [ ] Toggle meal allowance: work timer and meal badge appear or disappear for reservists
- [ ] Post broadcast notice: text appears on reservist check-in screen

#### Export and reporting
- [ ] Export Excel: file downloads, all columns present (Name, Shift showing department label, Contact, dates, P, MC, A, Meal, Rate), colour-coding correct, personal leave days show PL in amber not A, headers freeze
- [ ] Print report: print preview opens, A4 formatted, includes Meal column, Contact column, department label in Shift, red absent cells, PL in amber for personal leave, blue P for today and future pending dates
- [ ] Export from a multi-department deployment: Excel and print report only contain personnel and leave records from the active department
- [ ] Export person history from history modal: file downloads with that person's records

---

### Master (Superadmin)

All admin checks above apply. Run them for both departments. Then verify the following.

#### Department switcher
- [ ] Dropdown visible in header
- [ ] Switching department reloads all data: roster, personnel, batches, pending requests all change
- [ ] Search and filter state clears when switching departments (no stale text from previous dept)
- [ ] Last-selected cycle is remembered per department: switching back restores previous cycle context

#### Cross-department isolation
- [ ] Logged in as Master in Dept A: signups from Dept B do not appear in Requests tab
- [ ] Leave request submitted by Dept B reservist: does not appear in Dept A Requests tab
- [ ] Browser notification (if enabled) for a Dept B leave request does not fire while viewing Dept A
- [ ] Cycle notice posted in Dept A: not visible to Dept B reservists

#### Team management
- [ ] Add supervisor: fill in name, contact, password - account created and appears in Team tab
- [ ] Reset supervisor password from Team tab
- [ ] Demote supervisor: person moves back to reservist roster
- [ ] Promote reservist to supervisor: search by name, select, confirm - person appears in Team tab

#### Access control verification
- [ ] Reservist cannot access admin tabs (Overview, Roster, Log, People)
- [ ] Admin cannot see other departments' data
- [ ] Admin cannot promote accounts to admin or master
- [ ] Reservist cannot submit a leave request on behalf of another user (RLS enforced)
- [ ] Reservist cannot mark their own attendance as present without going through the check-in flow

---

### ReservistGO Monitor (`/admin`)

- [ ] Navigate to `/admin` as a logged-in supervisor: auto-login fires, lands on monitor without a second login prompt
- [ ] Navigate to `/admin` as a logged-in master: auto-login fires, department selector visible in header, "Full access" dept chip shown
- [ ] Navigate to `/admin` as a logged-in reservist: access-denied screen shown, not the activity feed
- [ ] Navigate to `/admin` with no main app session: login form shown
- [ ] Log in via the monitor login form as an admin: activity feed loads, correct department scoped
- [ ] Log in via the monitor login form as a deactivated account: access denied error shown, no feed access
- [ ] Log in via the monitor login form as a reservist: access denied error shown
- [ ] Refresh the monitor page while logged in: session persists, feed reloads without re-login
- [ ] Log out of the monitor: login form shown, session cleared; main app session unaffected
- [ ] Log out of the main app: monitor session unaffected (independent sessions)
- [ ] Activity feed loads and shows events ordered newest first
- [ ] Tap any row with metadata: expands to show meta payload; tap again to collapse
- [ ] Search by actor name: feed filters correctly
- [ ] Search by action text: feed filters correctly
- [ ] Search by target name: feed filters correctly
- [ ] Clear search: feed resets to all events
- [ ] Select a category pill (e.g. Attendance): only attendance events shown, count updates
- [ ] Select multiple category pills: events from all selected categories shown
- [ ] Select All pill: full feed restored
- [ ] Set date From/To: feed scoped to that range
- [ ] Click Load more: next page appended, no duplicate rows
- [ ] Double-click Load more rapidly: no duplicate rows (guard prevents concurrent fetches)
- [ ] Stat tiles show correct counts: Events today, Unique actors today, This week, Top category
- [ ] Master dept selector: switch to a department, feed and stats re-scope; switch back, previous context restored
- [ ] Perform a check-in phase in the main app, then view the monitor: a checkin.p1 event appears with the correct time and date
- [ ] Admin approves a leave request: leave.approved event appears in monitor with target name and date in metadata

---

## Known Limitations

- **CPO Info tab content is a placeholder.** The Info tab for Crime Prevention Office (CPO) reservists currently shows placeholder text. The attire, location, and operational details for CPO have not yet been configured in the codebase.
- **Phase windows are hardcoded.** The check-in phase times (check-in from 08:00, lunch from 11:00, return from lunch from 13:00, check-out from 14:00) are fixed constants and cannot be changed from within the app. Changing them requires a code update and redeployment. This is tracked as item 3 in the Planned Enhancements section.
- **Departments cannot be added or removed from within the app.** The department list (Ops Security and CPO) is defined in the database schema as an enum. Adding a new department requires a schema migration. This is tracked as item 6 in the Planned Enhancements section.
- **No push notifications.** Supervisors must have the app open to see new leave requests or signup requests. There is no background alert. This is tracked as item 9 in the Planned Enhancements section.
- **RLS batch-mate visibility requires a manual SQL step.** If the Supabase project is ever recreated from scratch, the `_auth_batch_id()` function and the updated `personnel_select` policy in `scripts/sql/rls_policies.sql` must be re-run in the Supabase SQL editor for the YOUR TEAM section to appear correctly for reservists.

---

## Planned Enhancements

The goal for the next stage of development is to make ReservistGO fully self-managed: a successor with no technical background should be able to run, configure, and hand it off again without touching any code or deployment files. Everything below is ordered by how directly it unblocks that goal.

Each item is annotated with its current build status based on a code audit:
- **Done** - fully implemented and live
- **Partial** - groundwork exists in the codebase; the feature is incomplete
- **Not started** - no code exists for this yet

### Stage 1 - Zero-code configuration (highest priority)

These are the things that currently require a developer to change. Eliminating them means the app is truly self-contained after initial deployment.

1. **In-app settings panel (Master account)**: Move all deployment-time config into a Settings tab editable from within the app. This covers org name, HQ name, GPS coordinates, check-in radius, accent colour, and the WhatsApp group link. Once done, the `index.html` config block and Vercel environment variables are set once and never touched again.

   _Partial: all config values (orgName, hqLat, hqLon, hqRange, waGroupLink, accent) exist as data-props in index.html and are read at runtime, but no DB settings table or in-app edit UI exists yet._

2. **Editable Info tab content**: The About text, attire requirement, dekit checklist steps, and reporting details are currently hardcoded. Moving them to a database record per department and exposing an edit form in the cycle management panel means a supervisor can update them each cycle without a code change.

   _Not started: content is hardcoded in briefings.js with no DB backing._

3. **Editable phase windows**: Check-in phase times (0900, 1200, 1400, 1800) are fixed constants. Storing them per cycle in the database lets supervisors set different hours for each cycle. Phase banners, the work timer, and meal eligibility all derive from these values automatically.

   _Not started: phase times are hardcoded constants in utils.js (currently 08:00, 11:00, 13:00, 14:00) and referenced in at least four places._

4. **WhatsApp group link in database**: Currently set at deployment. Moving it to a department-level record lets supervisors update it from the app when the group changes.

   _Partial: the link is a runtime data-prop but is deployment-level only, not stored in the database._

5. **Per-cycle GPS location and radius**: HQ coordinates are deployment-level. Storing them per cycle lets supervisors run cycles at different venues (exercises, off-site operations) without redeployment.

   _Not started: hqLat, hqLon, and hqRange are deployment-level data-props with no per-cycle equivalent in the batches table._

### Stage 2 - Department self-management

These items require database schema work but unlock full multi-department control from within the app.

6. **Department CRUD**: Departments are currently a fixed enum in the database schema. Migrating to a `departments` table lets the Master account create and manage departments from within the app. This is the prerequisite for everything below.

   _Partial: department scoping is enforced throughout the codebase (_myDept() helper, all queries), but departments are a fixed enum - not a table - so there is no Master UI to add or remove them._

7. **Per-department configuration panel**: Once departments are table-driven, each department stores its own HQ coordinates, GPS radius, phase windows, WA group link, accent colour, and Info tab content. The Master account edits these from a Settings panel. No config files need to be touched after initial deployment.

   _Not started: depends on item 6._

8. **Scoped department access for supervisors**: Currently all admins in a department see all data for that department. As more departments are added, this may need tightening so each supervisor is scoped to one department, with the Master account retaining full cross-department visibility.

   **Done:** department scoping is fully enforced via _myDept() across all queries, realtime subscriptions, and state updates. RLS policies reinforce this at the database level.

### Stage 3 - Operational upgrades

Features that improve day-to-day operations but are not blockers for handover.

9. **Push notifications**: The service worker is already in place. Adding Web Push lets reservists receive phase reminders and supervisors get alerted on new requests without having the app open.

   _Not started: the service worker handles caching and offline but has no PushManager or VAPID subscription code._

10. **Multiple shifts**: The system tracks shift assignments but only supports "Office". Extending to AM, PM, Night, and custom shifts with their own phase windows supports departments with rotating schedules.

    _Not started: shiftLabel() and shiftWindow() in utils.js always return hardcoded "Office" values regardless of shift field. Depends on item 3 (editable phase windows) being done first._

11. **Shift scheduler**: Pre-assign which reservists report on which days. Mark-all-absent then only targets scheduled personnel, which is useful when not all reservists report every weekday.

    _Not started: no shift_schedule table or per-person per-day scheduling logic exists._

12. **Audit log viewer**: A read-only tab for the Master account showing all supervisor actions (overrides, time corrections, approvals, account changes). Useful for accountability without database access.

    **Done:** a dedicated `audit_log` table records every significant action across all roles and departments. The ReservistGO Monitor at `/admin` provides a searchable, filterable live feed of all events with expandable metadata, stat tiles, category pills, date range filters, and department scoping for master accounts. Auto-logs in from the main app session when navigating as an authenticated supervisor or master.

13. **Automated attendance summaries**: Scheduled daily or weekly reports to the supervisor's WhatsApp or email covering attendance rate, pending requests, and missing clock-outs. Requires a messaging API integration.

    _Not started: the WhatsApp summary exists as a manual one-tap flow only, with no scheduled or automated sending._

14. **Equipment and dekit tracking**: Track issued items per reservist per cycle and record return status at dekit. Fits naturally into the existing cycle lifecycle alongside the dekit date.

    _Not started: no equipment or dekit items table exists._

### Stage 4 - Ideas for future consideration

Longer-horizon features that would meaningfully expand what the system can do. None of these are required for the app to run well, but each one addresses a real gap.

15. **Meal allowance form auto-fill**: At dekit, reservists fill out a physical form using their clock-in and clock-out times. The app already holds all this data. Generating a pre-filled PDF from the app would eliminate manual transcription errors and save time on dekit day.

    _Partial: meal eligibility is calculated per day and included in the Excel export and print report. No PDF form generation exists._

16. **MC document upload**: Reservists currently bring physical MC hardcopies to dekit. Allowing them to photograph and upload the MC at the time of submission gives supervisors an immediate digital record and reduces the risk of lost paperwork.

    _Not started: the avatar upload pipeline (Supabase Storage, handlers/account.js) exists and could be extended, but no MC upload UI or storage bucket is set up._

17. **QR code check-in (backup mode)**: A supervisor can display a time-limited QR code on a screen or printout. Scanning it records a check-in without GPS. Useful as a reliable fallback for venues with poor signal, or for roll calls at an off-site location.

    _Not started: QR references in the codebase are for the WhatsApp share/export flow, not for check-in._

18. **Medical and fitness status per person**: Store per-person status flags such as RSI, Light Duty, or Restricted from physical activities. These appear on the roster card so supervisors know at a glance who has duty limitations without checking a separate spreadsheet.

    _Not started: no medical or fitness status field in the personnel table._

19. **Calendar export**: Let reservists add their cycle dates (start, end, dekit, no-report days) directly to their phone calendar (Google Calendar or Apple Calendar via ICS file). Reduces the need for supervisors to repeat this information verbally.

    _Not started: all cycle dates are available in state but no ICS file generation exists._

20. **Attendance trend charts**: Visual graphs showing attendance rate over time, lateness frequency, and MC patterns across cycles. Surfaced in the admin Overview tab to help supervisors identify welfare concerns or accountability issues early.

    _Not started: no charting library is loaded and no chart UI exists._

21. **Late arrival pattern detection**: Automatically flag reservists who have been late more than a set number of times within a cycle or across cycles. An amber indicator on their roster card prompts a welfare check without the supervisor needing to count manually.

    _Partial: late_reason is stored per attendance record and displayed inline on log cards. No cumulative count or roster-level flag exists._

22. **Supervisor handover notes**: A structured notes field for the outgoing supervisor to leave context for their replacement: known welfare cases, ongoing issues, cycle quirks, and contacts. Stored in the database and accessible to the incoming admin immediately on their first login.

    _Not started: no handover notes field in the batches table and no UI for it._

23. **Emergency contact storage**: Store a next-of-kin name and contact number per reservist. Visible on the person's profile card and exportable. Useful for duty of care situations and for supervisors who may not have personal contact with all reservists.

    _Not started: no emergency contact fields in the personnel table._

24. **Cross-cycle analytics**: A summary view for the Master account showing attendance rates, average lateness, and MC frequency across all past cycles. Useful for identifying long-term trends and for justifying manpower decisions.

    _Not started: cross-cycle member search exists but no analytics aggregation or summary view._

25. **Reservist self-service contact update**: Allow reservists to update their own contact number from account settings with a confirmation step. Currently only an admin can change this, which creates friction when a reservist changes their number between cycles.

    _Not started: account settings allow name and password changes only; contact number is read-only for reservists._

26. **Duty roster**: A separate tab or section where supervisors assign specific reservists to special duties (guard duty, escort, standby) on specific dates. This appears on the individual's check-in screen for that day and is visible on the admin roster.

    _Not started: no duty_assignments table or duty display in the check-in or roster views._

27. **Announcement board**: A persistent, pinned notice visible to all reservists across all cycles, separate from the cycle-specific broadcast. Useful for standing orders, dress code reminders, and permanent welfare resources that do not change cycle to cycle.

    _Partial: the cycle notice_text field already broadcasts a message per cycle. There is no separate global/persistent announcement table for cross-cycle notices._

28. **Bulk attendance import**: Accept a pasted or uploaded spreadsheet to back-fill attendance records for a past date range. Useful when the app was not in use for the start of a cycle and the supervisor needs to populate historical data without entering each record individually.

    _Not started: bulk add exists for personnel (People tab) but not for attendance records._

---

## Implementation Order Guide

The safest way to build these features is to work from the outside in: start with things that only read existing data, then add new data, then change how existing data is used, and leave schema migrations for last. Breaking the site almost always happens when existing queries or logic are changed without a fallback. The groups below follow that principle.

### Group A: Zero risk - pure frontend, no database changes

These only compute from data already in the app. A bug here shows a wrong UI value; it cannot corrupt data or break check-in.

| Item | What makes it safe |
|---|---|
| 19 - Calendar export | Generates an ICS file from batch dates already in state. No DB write. |
| 21 - Late pattern detection | Reads existing history records and computes in the builder. No DB change. |
| 20 - Attendance trend charts | Reads existing data. Pure builder addition. |
| 15 - Meal allowance PDF auto-fill | Formats existing clock-in/out times into a PDF. No DB change. |
| 24 - Cross-cycle analytics | Aggregates existing tables. Read-only. |

**Do these first.** Each one can be added and removed independently. None of them touch a handler, a DB write, or any existing logic path.

### Group B: Very low risk - new columns on existing tables

Adding a column to an existing table is safe as long as it is nullable (no default required). Existing rows are unaffected. Existing queries still work because they do not select the new column unless you ask them to.

| Item | Column added to |
|---|---|
| 23 - Emergency contact | `personnel` (nok_name, nok_contact) |
| 18 - Medical/fitness status | `personnel` (duty_status) |
| 22 - Supervisor handover notes | `batches` (handover_notes) |
| 4 - WA group link in DB | `batches` or new `dept_config` row |
| 5 - Per-cycle GPS location | `batches` (hq_lat, hq_lon, hq_range) |

The pattern for all of these: read the new column if it exists, otherwise fall back to the hardcoded value. This means the feature is opt-in and the site never breaks if the column is empty.

### Group C: Low risk - new tables only

New tables have no impact on anything existing. Existing queries do not touch them. The only risk is if a new handler writes bad data, which only affects the new feature.

| Item | New table |
|---|---|
| 27 - Announcement board | `announcements` |
| 14 - Equipment tracking | `equipment_issues` |
| ~~12 - Audit log viewer~~ | Done. `audit_log` table live; ReservistGO Monitor at `/admin`. |
| 26 - Duty roster | `duty_assignments` |
| 11 - Shift scheduler | `shift_schedule` |
| 16 - MC document upload | New Supabase storage bucket only |
| 1 - In-app settings panel | `app_settings` (key/value rows, fall back to hardcoded config if absent) |
| 2 - Editable Info tab content | New column on `batches` or a `dept_content` table |

### Group D: Medium risk - new logic paths in existing handlers

These add new code paths to existing handlers or extend the service worker. A bug here can affect existing flows, but since you are adding new paths rather than replacing old ones, the existing functionality stays intact as a fallback.

| Item | What to watch |
|---|---|
| 25 - Self-service contact update | Touches auth/contact flow. Validate contact format carefully and test login with new number before shipping. |
| 28 - Bulk attendance import | Batch DB writes. Use a transaction or upsert so a partial import does not leave dirty data. |
| 9 - Push notifications | Service worker extension. Test on both iOS and Android. A broken SW registration can prevent the app loading offline. |
| 17 - QR code check-in | New check-in path, runs alongside GPS. The existing GPS path is untouched. |

### Group E: Higher risk - replacing existing core logic

These change code that the entire check-in flow depends on. The current constants are referenced in at least four places (utils.js, checkin.js, builders, the work timer). Replace them one file at a time, keep the hardcoded value as a fallback if the DB value is missing, and test each phase window end-to-end before shipping.

| Item | Risk |
|---|---|
| 3 - Editable phase windows | Phase constants are used in check-in validation, the work timer, meal eligibility, and phase reminder banners. Touch all four or none. |
| 10 - Multiple shifts | Depends on phase windows being dynamic first. Do not start this before item 3 is stable. |
| 13 - Automated summaries | Requires an external API (WhatsApp Business or email). External dependency means new failure modes outside your control. |

### Group F: Do last - schema migrations

These change the shape of existing tables or convert a database enum to a table. A failed migration on a live database can take the app down. Always run these on a copy of the database first, test fully, then apply to production during a low-traffic window.

| Item | Why it is last |
|---|---|
| 6 - Department CRUD | Converts `department_type` enum to a `departments` table. Every query that filters by department needs updating. |
| 7 - Per-department config panel | Depends on item 6 being stable. |
| 8 - Scoped department access | Already done. No action needed. |

### Golden rule

Never change an existing query or logic path without keeping the old behaviour as a fallback. Read new data if it exists; use the hardcoded value if it does not. This way every feature in Group B, C, and D can be shipped incrementally and rolled back by removing a UI element without touching the database.
