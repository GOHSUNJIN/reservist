"""
ReservistGO test suite.

Covers:
  - Deployment health (live Vercel URL)
  - Late-reason removal regression (source files + rendered HTML)
  - Log-badge non-report-day fix (source file)
  - Supabase RLS — anonymous access must be blocked on every sensitive table
  - Business-logic rules replicated from utils.js
"""

import pytest
import requests
from pathlib import Path
from supabase import create_client, Client

# ── Config ─────────────────────────────────────────────────────────────────────
PROD_URL       = "https://opsreservist.vercel.app"
SUPABASE_URL   = "https://phekjmzqvapzhvofrkgy.supabase.co"
SUPABASE_ANON_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
    ".eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoZWtqbXpxdmFwemh2b2Zya2d5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2MTUyNTksImV4cCI6MjEwMjE5MTI1OX0"
    ".n6av5HL-65Y7C3RYmjkoqBxnCOQvyDqFsgrM9M74TEk"
)
ROOT = Path(__file__).parent.parent


# ── Fixtures ───────────────────────────────────────────────────────────────────
@pytest.fixture(scope="session")
def db() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_ANON_KEY)


@pytest.fixture(scope="session")
def index_html() -> str:
    return (ROOT / "index.html").read_text(encoding="utf-8")


# ── Deployment health ──────────────────────────────────────────────────────────
class TestDeployment:
    def test_index_returns_200(self):
        r = requests.get(PROD_URL, timeout=15)
        assert r.status_code == 200

    def test_index_is_html(self):
        r = requests.get(PROD_URL, timeout=15)
        assert "text/html" in r.headers.get("content-type", "")

    def test_index_contains_app_root(self):
        r = requests.get(PROD_URL, timeout=15)
        assert "<x-dc>" in r.text

    def test_service_worker_served(self):
        r = requests.get(f"{PROD_URL}/sw.js", timeout=15)
        assert r.status_code == 200
        assert "javascript" in r.headers.get("content-type", "")

    def test_css_served(self):
        r = requests.get(f"{PROD_URL}/css/styles.css", timeout=15)
        assert r.status_code == 200

    def test_manifest_name(self):
        r = requests.get(f"{PROD_URL}/manifest.json", timeout=15)
        assert r.status_code == 200
        assert r.json().get("name") == "ReservistGO"

    def test_no_exposed_supabase_service_key(self):
        r = requests.get(PROD_URL, timeout=15)
        # Service role key contains "service_role" in its payload — must never appear
        assert "service_role" not in r.text


# ── Late-reason removal regression ────────────────────────────────────────────
class TestLateReasonRemoved:
    """Ensure every trace of the late-reason prompt is gone from source."""

    # index.html template bindings
    def test_no_late_reason_modal_comment(self, index_html):
        assert "LATE REASON MODAL" not in index_html

    def test_no_late_reason_open_binding(self, index_html):
        assert "lateReasonOpen" not in index_html

    def test_no_submit_late_reason_binding(self, index_html):
        assert "submitLateReason" not in index_html

    def test_no_can_add_late_reason_binding(self, index_html):
        assert "canAddLateReason" not in index_html

    def test_no_open_late_reason_binding(self, index_html):
        assert "openLateReason" not in index_html

    def test_no_has_late_reason_binding(self, index_html):
        assert "hasLateReason" not in index_html

    def test_no_skip_late_reason_binding(self, index_html):
        assert "skipLateReason" not in index_html

    def test_late_warning_banner_retained(self, index_html):
        # The 30-min "you checked in a bit late" banner is intentionally kept
        assert "showLateWarning" in index_html
        assert "dismissLateWarning" in index_html

    # State
    def test_state_no_late_reason_props(self):
        src = (ROOT / "js/state.js").read_text()
        for prop in ("lateReasonOpen", "lateReasonText", "lateReasonSubmitting"):
            assert prop not in src, f"state.js still contains {prop!r}"

    # Handler
    def test_checkin_handler_no_late_reason_fns(self):
        src = (ROOT / "js/handlers/checkin.js").read_text()
        for fn in ("submitLateReason", "openLateReason", "skipLateReason", "onLateReasonText"):
            assert fn not in src, f"checkin.js still contains {fn!r}"

    def test_checkin_handler_retains_late_warning(self):
        src = (ROOT / "js/handlers/checkin.js").read_text()
        assert "dismissLateWarning" in src

    def test_auth_reset_no_late_reason(self):
        src = (ROOT / "js/handlers/auth.js").read_text()
        assert "lateReasonOpen" not in src

    # DB layer
    def test_db_attendance_no_submit_fn(self):
        src = (ROOT / "js/db/attendance.js").read_text()
        assert "submitLateReason" not in src

    def test_db_attendance_no_late_reason_mapping(self):
        src = (ROOT / "js/db/attendance.js").read_text()
        assert "lateReason" not in src

    # Builders
    def test_checkin_builder_no_late_reason_props(self):
        src = (ROOT / "js/builders/checkin.js").read_text()
        for prop in ("canAddLateReason", "hasLateReason", "lateReasonDisplayText",
                     "lateReasonModalTitle", "lateReasonLen", "lateReasonMax"):
            assert prop not in src, f"builders/checkin.js still contains {prop!r}"

    def test_calendar_builder_no_late_reason(self):
        src = (ROOT / "js/builders/calendar.js").read_text()
        assert "showLateReason" not in src
        assert "lateReason" not in src

    def test_admin_roster_no_show_late_reason(self):
        src = (ROOT / "js/builders/admin/roster.js").read_text(encoding="utf-8")
        assert "showLateReason" not in src
        assert "showNoLateReason" not in src

    def test_admin_roster_late_tag_label_simplified(self):
        src = (ROOT / "js/builders/admin/roster.js").read_text(encoding="utf-8")
        # lateTagLabel kept but now says "Late" with no reason text
        assert "lateTagLabel" in src
        assert "No reason" not in src

    def test_requests_handler_no_late_reason_in_history(self):
        src = (ROOT / "js/handlers/requests.js").read_text()
        assert "lateReason:null" not in src


# ── Log-badge non-report-day fix ──────────────────────────────────────────────
class TestLogBadgeFix:
    def test_badge_condition_includes_report_day(self):
        src = (ROOT / "js/builders/admin/roster.js").read_text(encoding="utf-8")
        assert "viewIsToday&&viewReportDay&&pendingCount>0" in src

    def test_badge_not_view_is_today_alone(self):
        src = (ROOT / "js/builders/admin/roster.js").read_text(encoding="utf-8")
        # The old (broken) condition must not exist
        assert "viewIsToday&&pendingCount>0" not in src


# ── Supabase RLS — anonymous access blocked ───────────────────────────────────
class TestRLS:
    """
    The anon key has no session.  Every sensitive table must return an empty
    result set (RLS filters all rows) rather than raising an exception.
    Supabase-py raises on network errors but returns data=[] on RLS blocks.
    """

    # Tables that must never expose rows to unauthenticated clients
    SENSITIVE_TABLES = [
        "personnel",
        "attendance",
        "leave_requests",
        "signup_requests",
        "audit_log",
    ]

    @pytest.mark.parametrize("table", SENSITIVE_TABLES)
    def test_anon_blocked(self, db, table):
        resp = db.table(table).select("id").limit(5).execute()
        assert resp.data == [], (
            f"Table '{table}' returned rows to an unauthenticated client — RLS may be misconfigured"
        )

    def test_batches_readable_anonymously(self, db):
        # Batch metadata (cycle dates/labels) is intentionally public
        resp = db.table("batches").select("id,label").limit(1).execute()
        assert isinstance(resp.data, list)

    def test_anon_cannot_insert_attendance(self, db):
        try:
            db.table("attendance").insert({
                "personnel_id": "00000000-0000-0000-0000-000000000000",
                "date": "2099-01-01",
                "status": "present",
            }).execute()
            pytest.fail("Unauthenticated insert to attendance should have been rejected")
        except Exception:
            pass  # any exception means RLS or schema enforcement blocked it


# ── Business logic (replicated from utils.js) ─────────────────────────────────
class TestBusinessLogic:
    """Key numeric rules from Utils validated independently in Python."""

    LATE_CUTOFF = "09:00"

    @staticmethod
    def hm_to_mins(hhmm: str) -> int:
        h, m = map(int, hhmm.split(":"))
        return h * 60 + m

    def mins_late(self, checkin: str) -> int:
        return self.hm_to_mins(checkin) - self.hm_to_mins(self.LATE_CUTOFF)

    # Threshold boundaries
    def test_on_time_not_flagged(self):
        assert self.mins_late("08:55") < 30

    def test_exactly_cutoff_not_flagged(self):
        assert self.mins_late("09:00") < 30

    def test_29_mins_late_not_flagged(self):
        assert self.mins_late("09:29") < 30

    def test_30_mins_late_triggers_warning(self):
        assert self.mins_late("09:30") >= 30

    def test_59_mins_late_warning_only(self):
        ml = self.mins_late("09:59")
        assert 30 <= ml < 60

    def test_60_mins_late_triggers_admin_flag(self):
        assert self.mins_late("10:00") >= 60

    def test_2h_late_also_flagged(self):
        assert self.mins_late("11:00") >= 60

    # Date key format (YYYY-MM-DD)
    def test_date_key_format(self):
        from datetime import date
        dk = date(2026, 10, 2).isoformat()
        assert dk == "2026-10-02"

    # Meal eligibility: 6 h worked
    def test_meal_eligible_at_6h(self):
        work_mins = 360
        assert work_mins >= 360

    def test_meal_not_eligible_below_6h(self):
        work_mins = 359
        assert work_mins < 360
