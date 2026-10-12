"""
Regression tests for changes made in Oct 2026.

Covers:
- Late threshold change from 60 min to 120 min (all three code locations)
- Non-reporting day: communication actions always visible
- Non-reporting day: Share roll call shows conditional sub-text
"""

from pathlib import Path

ROOT = Path(__file__).parent.parent.parent


class TestLateThreshold120:
    """All three late-detection sites must use >= 120, not the old 30 or 60."""

    def test_checkin_handler_uses_120(self):
        src = (ROOT / "js" / "handlers" / "checkin.js").read_text(encoding="utf-8")
        assert "ml>=120" in src or "ml >= 120" in src, \
            "handlers/checkin.js late warning must fire at 120 min, not 30"

    def test_admin_roster_builder_uses_120(self):
        src = (ROOT / "js" / "builders" / "admin" / "roster.js").read_text(encoding="utf-8")
        assert "_lm>=120" in src or "_lm >= 120" in src, \
            "admin roster late flag must fire at 120 min, not 60"

    def test_checkin_builder_uses_120(self):
        src = (ROOT / "js" / "builders" / "checkin.js").read_text(encoding="utf-8")
        assert "_lateMs>=120" in src or "_lateMs >= 120" in src, \
            "checkin builder isLate must fire at 120 min, not 60"

    def test_no_old_60_threshold_in_roster(self):
        src = (ROOT / "js" / "builders" / "admin" / "roster.js").read_text(encoding="utf-8")
        assert "_lm>=60" not in src and "_lm >= 60" not in src, \
            "old 60-min threshold must not exist in admin roster"

    def test_no_old_30_threshold_in_handler(self):
        src = (ROOT / "js" / "handlers" / "checkin.js").read_text(encoding="utf-8")
        assert "ml>=30" not in src and "ml >= 30" not in src, \
            "old 30-min threshold must not exist in checkin handler"


class TestNoReportingDayCommunicationActions:
    """Communication actions (Monitor, Post notice, Phase timings, Share roll call)
    must be visible on non-reporting days."""

    def _html(self):
        return (ROOT / "index.html").read_text(encoding="utf-8")

    def test_share_roll_call_has_no_reporting_sub_text(self):
        assert "viewNoReporting ? 'No reporting today'" in self._html(), \
            "Share roll call sub-text must be conditional on viewNoReporting"

    def test_communication_actions_follow_no_reporting_placeholder(self):
        html = self._html()
        # The communication actions comment must appear after the no-reporting sc-if closes.
        no_rep_close = html.find("</sc-if>\n\n          <!-- Communication actions -->")
        assert no_rep_close != -1, \
            "Communication actions card must come after the no-reporting placeholder"

    def test_show_snapshot_removed_from_html(self):
        assert "showSnapshot" not in self._html(), \
            "showSnapshot sc-if wrapper was removed; binding must not reappear in HTML"

    def test_monitor_button_present(self):
        assert "openMonitor" in self._html()

    def test_post_notice_button_present(self):
        assert "openBroadcast" in self._html()

    def test_open_wa_preview_button_present(self):
        assert "openWaPreview" in self._html()


class TestLateBaseUsesPersonalTimings:
    """Log rows in roster.js must derive _lateBase from the person's own
    phase_timings.p1_open, falling back to effectiveTimings(activeBatch),
    not the hardcoded LATE_CUTOFF.OFFICE constant."""

    def _roster(self):
        return (ROOT / "js" / "builders" / "admin" / "roster.js").read_text(encoding="utf-8")

    def test_late_base_uses_phase_timings_p1_open(self):
        assert "p.phase_timings?.p1_open" in self._roster(), \
            "_lateBase must try person's phase_timings.p1_open first"

    def test_late_base_falls_back_to_effective_timings(self):
        assert "effectiveTimings(activeBatch).p1_open" in self._roster(), \
            "_lateBase must fall back to effectiveTimings(activeBatch).p1_open"

    def test_late_base_line_does_not_reference_late_cutoff_office(self):
        late_base_line = next(
            (l for l in self._roster().splitlines() if "_lateBase=" in l),
            ""
        )
        assert "LATE_CUTOFF.OFFICE" not in late_base_line, \
            "_lateBase assignment must not use LATE_CUTOFF.OFFICE as its fallback"


class TestBreakLabelUsesPersonTimings:
    """Both the roster card phase line and the log rows must resolve break
    labels against person/batch timings rather than passing null, so that
    dinner-schedule reservists show DIN instead of LCH."""

    def _roster(self):
        return (ROOT / "js" / "builders" / "admin" / "roster.js").read_text(encoding="utf-8")

    def test_log_rows_define_log_break_timings(self):
        assert "_logBreakTimings" in self._roster(), \
            "Log rows must define _logBreakTimings for break label resolution"

    def test_roster_cards_define_roster_break_timings(self):
        assert "_rosterBreakTimings" in self._roster(), \
            "Roster cards must define _rosterBreakTimings for break label resolution"

    def test_log_break_label_uses_log_break_timings_not_log_p_timings(self):
        src = self._roster()
        break_label_line = next(
            (l for l in src.splitlines() if "_logBreakLabel=" in l),
            ""
        )
        assert "_logBreakTimings" in break_label_line, \
            "_logBreakLabel must be resolved with _logBreakTimings, not _logPTimings"

    def test_roster_break_short_uses_roster_break_timings(self):
        src = self._roster()
        break_short_line = next(
            (l for l in src.splitlines() if "_rosterBreakShort=" in l),
            ""
        )
        assert "_rosterBreakTimings" in break_short_line, \
            "_rosterBreakShort must use _rosterBreakTimings, not _rosterPTimings"
