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
