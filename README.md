# Reservist Operations Portal

A mobile-first web portal for military reservists to check in, declare MC, and stay accounted for during their cycle. Supervisors get a live dashboard to track attendance, manage the roster, and export records.

## Features

### Reservist
- **GPS check-in** — Verifies on-site presence within a configurable radius before allowing check-in
- **MC declaration** — Upload a photo/PDF of the medical certificate with a single tap
- **Attendance history** — Full cycle history with present / MC / missed breakdown and progress tracker
- **Calendar view** — Visual cycle calendar showing reporting days, public holidays, weekends, and past attendance status
- **Offline support** — Check-in queued locally and synced when reconnected
- **WhatsApp share** — One-tap share of check-in or MC status to the group

### Admin / Supervisor
- **Live dashboard** — Real-time roster with GPS-verified check-in times; updates via Supabase Realtime
- **Date navigation** — Swipe or tap through past and future dates to review or edit attendance
- **Roster management** — Add/remove personnel, reassign shifts, attach notes
- **No-reporting toggle** — Mark any weekday as a no-report day (e.g. stand-down); public holidays are auto-locked
- **Batch management** — Create intake batches with auto-calculated end and dekit dates; auto-advances to the next batch
- **CSV export** — Full attendance record for the cycle exported as a spreadsheet
- **MC viewer** — View uploaded MC files directly in the portal

### General
- **Role-based access** — Separate views and permissions for Reservist and Admin roles
- **PWA** — Installable on iOS and Android; service worker caches assets for offline use
- **Profile management** — Change display name, password, and profile photo; self-service account deletion
- **Singapore public holidays** — 2026–2027 holidays baked in; auto-applied as no-report days

## Stack

- Vanilla HTML + JavaScript — no build step, no framework
- [`dc-runtime`](./support.js) — lightweight declarative component system with `{{ }}` interpolation, `sc-if`, and `sc-for`
- [Supabase](https://supabase.com) — auth, Postgres database, file storage, and Realtime subscriptions
- IBM Plex Sans / IBM Plex Mono (Google Fonts)
- Deployed on [Vercel](https://vercel.com)

## Project structure

```
index.html          # Single-page app template (all views)
support.js          # dc-runtime declarative component engine
sw.js               # Service worker (network-first for HTML/JS, cache-first for CSS)
css/styles.css      # Global styles
js/
  config.js         # Supabase URL, anon key, and site configuration props
  utils.js          # Date helpers, shift labels, SG holiday map
  db.js             # All Supabase queries (auth, personnel, attendance, batches, storage, realtime)
  component.js      # App logic — state, actions, and render helpers
manifest.json       # PWA manifest
```

## Configuration

All site-specific settings live in `js/config.js`:

```js
const SUPABASE_URL  = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';
// Props passed to the component:
// hqLat, hqLon   — HQ coordinates for GPS check-in
// hqRange         — Check-in radius in metres (default 500)
// hqName          — Display name for the HQ location
// orgName         — Organisation name shown in the header
// accent          — Brand colour (hex, default #2f5fd0)
// waGroupLink     — WhatsApp group invite link (optional)
```

## Quick start

1. Clone the repo and open `index.html` in a browser, or deploy as a static site on Vercel.
2. Use the **Quick Demo** buttons on the login screen to preview the Reservist or Admin experience without an account.
3. For a live deployment, fill in `js/config.js` with your Supabase project credentials and HQ coordinates.

## Batch cycle

Each intake batch runs **Tuesday → Monday (+13 days)** with a **dekit on Wednesday (+15 days)**. The admin dashboard auto-creates the next three forward batches on login and auto-advances the live batch when the current one ends.
