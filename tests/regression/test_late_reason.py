"""
Regression tests for the late-reason removal and log-badge non-report-day fix.

Run these after any change touching checkin, attendance, or roster builders to
confirm the feature stays removed and the badge condition stays correct.
"""

from tests.conftest import ROOT, read_src


class TestLateReasonRemovedFromHTML:
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
        # 30-min "you checked in a bit late" banner is intentionally kept
        assert "showLateWarning" in index_html
        assert "dismissLateWarning" in index_html


class TestLateReasonRemovedFromSource:
    def test_state_no_late_reason_props(self):
        src = read_src("js/state.js")
        for prop in ("lateReasonOpen", "lateReasonText", "lateReasonSubmitting"):
            assert prop not in src, f"state.js still contains {prop!r}"

    def test_checkin_handler_no_late_reason_fns(self):
        src = read_src("js/handlers/checkin.js")
        for fn in ("submitLateReason", "openLateReason", "skipLateReason", "onLateReasonText"):
            assert fn not in src, f"checkin.js still contains {fn!r}"

    def test_checkin_handler_retains_late_warning(self):
        src = read_src("js/handlers/checkin.js")
        assert "dismissLateWarning" in src

    def test_auth_reset_no_late_reason(self):
        src = read_src("js/handlers/auth.js")
        assert "lateReasonOpen" not in src

    def test_db_attendance_no_submit_fn(self):
        src = read_src("js/db/attendance.js")
        assert "submitLateReason" not in src

    def test_db_attendance_no_late_reason_mapping(self):
        src = read_src("js/db/attendance.js")
        assert "lateReason" not in src

    def test_checkin_builder_no_late_reason_props(self):
        src = read_src("js/builders/checkin.js")
        for prop in ("canAddLateReason", "hasLateReason", "lateReasonDisplayText",
                     "lateReasonModalTitle", "lateReasonLen", "lateReasonMax"):
            assert prop not in src, f"builders/checkin.js still contains {prop!r}"

    def test_calendar_builder_no_late_reason(self):
        src = read_src("js/builders/calendar.js")
        assert "showLateReason" not in src
        assert "lateReason" not in src

    def test_admin_roster_no_show_late_reason(self):
        src = read_src("js/builders/admin/roster.js")
        assert "showLateReason" not in src
        assert "showNoLateReason" not in src

    def test_admin_roster_late_tag_label_simplified(self):
        src = read_src("js/builders/admin/roster.js")
        assert "lateTagLabel" in src
        assert "No reason" not in src

    def test_requests_handler_no_late_reason_in_history(self):
        src = read_src("js/handlers/requests.js")
        assert "lateReason:null" not in src


class TestLogBadgeFix:
    def test_badge_condition_includes_report_day(self):
        src = read_src("js/builders/admin/roster.js")
        assert "viewIsToday&&viewReportDay&&pendingCount>0" in src

    def test_badge_not_view_is_today_alone(self):
        src = read_src("js/builders/admin/roster.js")
        assert "viewIsToday&&pendingCount>0" not in src
